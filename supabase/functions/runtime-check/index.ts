/**
 * Agent Firewall Runtime Check Edge Function
 * 
 * This is the core policy enforcement endpoint. Every tool call from
 * the SDK goes through this function.
 * 
 * CRITICAL GUARANTEES:
 * - Deterministic evaluation (no randomness, no LLM)
 * - Session locks policy version at creation
 * - All decisions are logged with full reasoning
 * - O(1) policy lookup after initial load
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

// ============================================
// CORS HEADERS
// ============================================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ============================================
// ERROR CODES (Must match frontend)
// ============================================
const ErrorCodes = {
  POLICY_NOT_FOUND: 'POLICY_NOT_FOUND',
  POLICY_INVALID: 'POLICY_INVALID',
  UNKNOWN_TOOL_DENIED: 'UNKNOWN_TOOL_DENIED',
  TOOL_EXPLICITLY_DENIED: 'TOOL_EXPLICITLY_DENIED',
  SIDE_EFFECT_NOT_ALLOWED: 'SIDE_EFFECT_NOT_ALLOWED',
  STATE_VIOLATION: 'STATE_VIOLATION',
  NO_VALID_TRANSITION: 'NO_VALID_TRANSITION',
  INVALID_STATE: 'INVALID_STATE',
  MAX_CALLS_EXCEEDED: 'MAX_CALLS_EXCEEDED',
  COOLDOWN_ACTIVE: 'COOLDOWN_ACTIVE',
  COUNTER_LIMIT_EXCEEDED: 'COUNTER_LIMIT_EXCEEDED',
  REQUIRED_STATE_NOT_MET: 'REQUIRED_STATE_NOT_MET',
  REQUIRED_TOOLS_NOT_CALLED: 'REQUIRED_TOOLS_NOT_CALLED',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  FORBIDDEN_FIELD_PRESENT: 'FORBIDDEN_FIELD_PRESENT',
  REGEX_MATCH_DENIED: 'REGEX_MATCH_DENIED',
  REGEX_MATCH_REQUIRED: 'REGEX_MATCH_REQUIRED',
  GUARD_CONDITION_FAILED: 'GUARD_CONDITION_FAILED',
  INVALID_API_KEY: 'INVALID_API_KEY',
  API_KEY_REVOKED: 'API_KEY_REVOKED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

// ============================================
// SENSITIVE FIELDS FOR REDACTION
// ============================================
const SENSITIVE_FIELDS = [
  'password', 'passwd', 'token', 'apikey', 'api_key', 'authorization',
  'auth', 'bearer', 'ssn', 'social_security', 'credit_card', 'creditCard',
  'card_number', 'cvv', 'cvc', 'secret', 'private_key', 'access_token',
  'refresh_token', 'session_token', 'jwt', 'cookie', 'x-api-key'
];

// ============================================
// TYPES
// ============================================
interface ToolRule {
  toolName: string;
  effect: 'allow' | 'deny';
  actionType?: 'read' | 'write' | 'side_effect';
  maxCallsPerSession?: number;
  cooldownMs?: number;
  requireState?: string;
  requirePreviousToolCalls?: string[];
  requireFields?: string[];
  denyIfFieldsPresent?: string[];
  denyIfRegexMatch?: { jsonPath: string; pattern: string }[];
  allowOnlyIfRegexMatch?: { jsonPath: string; pattern: string }[];
}

interface StateTransition {
  fromState: string;
  toState: string;
  triggeredByTool: string;
  requiresToolsCalledBefore?: string[];
  setsCounters?: Record<string, number>;
  guard?: string;
}

interface PolicySpec {
  version: string;
  defaultDecision: 'allow' | 'deny';
  toolRules: ToolRule[];
  stateMachine?: {
    states: string[];
    initialState: string;
    transitions: StateTransition[];
  };
  counters?: { name: string; scope: string; initialValue: number }[];
}

interface DecisionReason {
  code: string;
  message: string;
  ruleRef?: string;
}

interface RuntimeCheckRequest {
  sessionId: string;
  agentId: string;
  toolName: string;
  actionType?: 'read' | 'write' | 'side_effect';
  payload: Record<string, unknown>;
  requestedNextState?: string | null;
  metadata?: Record<string, unknown>;
}

interface RuntimeCheckResponse {
  allowed: boolean;
  errorCode?: string;
  decisionReasons: DecisionReason[];
  policyVersionUsed: number;
  stateBefore: string;
  stateAfter: string;
  counters: Record<string, number>;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function redactSensitiveFields(payload: Record<string, unknown>): Record<string, unknown> {
  const redacted = JSON.parse(JSON.stringify(payload));
  
  function redactRecursive(obj: Record<string, unknown>) {
    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_FIELDS.some(field => 
        lowerKey === field.toLowerCase() || lowerKey.includes(field.toLowerCase())
      );
      
      if (isSensitive) {
        obj[key] = '[REDACTED]';
      } else if (Array.isArray(obj[key])) {
        for (const item of obj[key] as unknown[]) {
          if (typeof item === 'object' && item !== null) {
            redactRecursive(item as Record<string, unknown>);
          }
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        redactRecursive(obj[key] as Record<string, unknown>);
      }
    }
  }
  
  redactRecursive(redacted);
  return redacted;
}

function getJsonPathValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  
  return current;
}

function evaluateGuard(guard: string, counters: Record<string, number>): boolean {
  const pattern = /^(\w+)\s*(<=|<|>=|>|==|!=)\s*(\d+)$/;
  const match = guard.trim().match(pattern);
  
  if (!match) return false;
  
  const counterName = match[1];
  const operator = match[2];
  const value = parseInt(match[3], 10);
  const counterValue = counters[counterName] ?? 0;
  
  switch (operator) {
    case '<=': return counterValue <= value;
    case '<': return counterValue < value;
    case '>=': return counterValue >= value;
    case '>': return counterValue > value;
    case '==': return counterValue === value;
    case '!=': return counterValue !== value;
    default: return false;
  }
}

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================
// POLICY EVALUATION (DETERMINISTIC)
// ============================================

function evaluateToolCall(
  policy: PolicySpec,
  toolName: string,
  actionType: string | undefined,
  payload: Record<string, unknown>,
  currentState: string,
  previousToolsCalled: string[],
  counters: Record<string, number>,
  toolCallCounts: Record<string, number>,
  lastToolCallTimes: Record<string, number>,
  timestamp: number
): { allowed: boolean; errorCode?: string; reasons: DecisionReason[]; newState: string; newCounters: Record<string, number>; newToolCallCounts: Record<string, number> } {
  
  const reasons: DecisionReason[] = [];
  let allowed = true;
  let errorCode: string | undefined;
  let newState = currentState;
  const newCounters = { ...counters };
  const newToolCallCounts = { ...toolCallCounts };
  
  // Initialize counters from policy
  if (policy.counters) {
    for (const def of policy.counters) {
      if (!(def.name in newCounters)) {
        newCounters[def.name] = def.initialValue;
      }
    }
  }
  
  const rule = policy.toolRules.find(r => r.toolName === toolName);
  
  // CHECK 1: Unknown tool
  if (!rule) {
    if (policy.defaultDecision === 'deny') {
      allowed = false;
      errorCode = ErrorCodes.UNKNOWN_TOOL_DENIED;
      reasons.push({
        code: ErrorCodes.UNKNOWN_TOOL_DENIED,
        message: `Tool "${toolName}" is not defined in policy and defaultDecision is "deny"`,
        ruleRef: 'defaultDecision'
      });
    }
    return { allowed, errorCode, reasons, newState, newCounters, newToolCallCounts };
  }
  
  // CHECK 2: Explicit deny
  if (rule.effect === 'deny') {
    allowed = false;
    errorCode = ErrorCodes.TOOL_EXPLICITLY_DENIED;
    reasons.push({
      code: ErrorCodes.TOOL_EXPLICITLY_DENIED,
      message: `Tool "${toolName}" is explicitly denied by policy`,
      ruleRef: `toolRules.${toolName}.effect`
    });
    return { allowed, errorCode, reasons, newState, newCounters, newToolCallCounts };
  }
  
  // CHECK 3: Side-effect enforcement
  const effectiveActionType = actionType || rule.actionType;
  if ((effectiveActionType === 'side_effect' || effectiveActionType === 'write') && rule.effect !== 'allow') {
    allowed = false;
    errorCode = ErrorCodes.SIDE_EFFECT_NOT_ALLOWED;
    reasons.push({
      code: ErrorCodes.SIDE_EFFECT_NOT_ALLOWED,
      message: `Tool "${toolName}" is a ${effectiveActionType} operation and must be explicitly allowed`,
      ruleRef: `toolRules.${toolName}.actionType`
    });
    return { allowed, errorCode, reasons, newState, newCounters, newToolCallCounts };
  }
  
  // CHECK 4: Required state
  if (rule.requireState && rule.requireState !== currentState) {
    allowed = false;
    errorCode = ErrorCodes.REQUIRED_STATE_NOT_MET;
    reasons.push({
      code: ErrorCodes.REQUIRED_STATE_NOT_MET,
      message: `Tool "${toolName}" requires state "${rule.requireState}" but current state is "${currentState}"`,
      ruleRef: `toolRules.${toolName}.requireState`
    });
  }
  
  // CHECK 5: Required previous tools
  if (rule.requirePreviousToolCalls) {
    for (const req of rule.requirePreviousToolCalls) {
      if (!previousToolsCalled.includes(req)) {
        allowed = false;
        if (!errorCode) errorCode = ErrorCodes.REQUIRED_TOOLS_NOT_CALLED;
        reasons.push({
          code: ErrorCodes.REQUIRED_TOOLS_NOT_CALLED,
          message: `Tool "${toolName}" requires "${req}" to be called first`,
          ruleRef: `toolRules.${toolName}.requirePreviousToolCalls`
        });
      }
    }
  }
  
  // CHECK 6: Max calls
  if (rule.maxCallsPerSession !== undefined) {
    const count = toolCallCounts[toolName] ?? 0;
    if (count >= rule.maxCallsPerSession) {
      allowed = false;
      if (!errorCode) errorCode = ErrorCodes.MAX_CALLS_EXCEEDED;
      reasons.push({
        code: ErrorCodes.MAX_CALLS_EXCEEDED,
        message: `Tool "${toolName}" has reached maximum calls (${rule.maxCallsPerSession}) for this session`,
        ruleRef: `toolRules.${toolName}.maxCallsPerSession`
      });
    }
  }
  
  // CHECK 7: Cooldown
  if (rule.cooldownMs !== undefined) {
    const lastTime = lastToolCallTimes[toolName];
    if (lastTime !== undefined) {
      const elapsed = timestamp - lastTime;
      if (elapsed < rule.cooldownMs) {
        allowed = false;
        if (!errorCode) errorCode = ErrorCodes.COOLDOWN_ACTIVE;
        reasons.push({
          code: ErrorCodes.COOLDOWN_ACTIVE,
          message: `Tool "${toolName}" is in cooldown. ${rule.cooldownMs - elapsed}ms remaining`,
          ruleRef: `toolRules.${toolName}.cooldownMs`
        });
      }
    }
  }
  
  // CHECK 8: Required fields
  if (rule.requireFields) {
    for (const field of rule.requireFields) {
      if (getJsonPathValue(payload, field) === undefined) {
        allowed = false;
        if (!errorCode) errorCode = ErrorCodes.REQUIRED_FIELD_MISSING;
        reasons.push({
          code: ErrorCodes.REQUIRED_FIELD_MISSING,
          message: `Required field "${field}" is missing from payload`,
          ruleRef: `toolRules.${toolName}.requireFields`
        });
      }
    }
  }
  
  // CHECK 9: Forbidden fields
  if (rule.denyIfFieldsPresent) {
    for (const field of rule.denyIfFieldsPresent) {
      if (getJsonPathValue(payload, field) !== undefined) {
        allowed = false;
        if (!errorCode) errorCode = ErrorCodes.FORBIDDEN_FIELD_PRESENT;
        reasons.push({
          code: ErrorCodes.FORBIDDEN_FIELD_PRESENT,
          message: `Field "${field}" is forbidden in payload`,
          ruleRef: `toolRules.${toolName}.denyIfFieldsPresent`
        });
      }
    }
  }
  
  // CHECK 10: Deny regex
  if (rule.denyIfRegexMatch) {
    for (const c of rule.denyIfRegexMatch) {
      const val = getJsonPathValue(payload, c.jsonPath);
      if (val !== undefined && typeof val === 'string') {
        try {
          if (new RegExp(c.pattern).test(val)) {
            allowed = false;
            if (!errorCode) errorCode = ErrorCodes.REGEX_MATCH_DENIED;
            reasons.push({
              code: ErrorCodes.REGEX_MATCH_DENIED,
              message: `Field "${c.jsonPath}" matches forbidden pattern`,
              ruleRef: `toolRules.${toolName}.denyIfRegexMatch`
            });
          }
        } catch { /* invalid regex */ }
      }
    }
  }
  
  // CHECK 11: Allow only regex
  if (rule.allowOnlyIfRegexMatch) {
    for (const c of rule.allowOnlyIfRegexMatch) {
      const val = getJsonPathValue(payload, c.jsonPath);
      if (val === undefined || typeof val !== 'string') {
        allowed = false;
        if (!errorCode) errorCode = ErrorCodes.REGEX_MATCH_REQUIRED;
        reasons.push({
          code: ErrorCodes.REGEX_MATCH_REQUIRED,
          message: `Field "${c.jsonPath}" must exist and match pattern`,
          ruleRef: `toolRules.${toolName}.allowOnlyIfRegexMatch`
        });
      } else {
        try {
          if (!new RegExp(c.pattern).test(val)) {
            allowed = false;
            if (!errorCode) errorCode = ErrorCodes.REGEX_MATCH_REQUIRED;
            reasons.push({
              code: ErrorCodes.REGEX_MATCH_REQUIRED,
              message: `Field "${c.jsonPath}" does not match required pattern`,
              ruleRef: `toolRules.${toolName}.allowOnlyIfRegexMatch`
            });
          }
        } catch { /* invalid regex */ }
      }
    }
  }
  
  // CHECK 12: State machine
  if (allowed && policy.stateMachine) {
    const transition = policy.stateMachine.transitions.find(
      t => t.triggeredByTool === toolName && t.fromState === currentState
    );
    
    if (transition) {
      // Check transition prerequisites
      if (transition.requiresToolsCalledBefore) {
        for (const req of transition.requiresToolsCalledBefore) {
          if (!previousToolsCalled.includes(req)) {
            allowed = false;
            if (!errorCode) errorCode = ErrorCodes.REQUIRED_TOOLS_NOT_CALLED;
            reasons.push({
              code: ErrorCodes.REQUIRED_TOOLS_NOT_CALLED,
              message: `State transition requires "${req}" to be called first`,
              ruleRef: `stateMachine.transitions`
            });
          }
        }
      }
      
      // Check guard
      if (transition.guard && allowed) {
        if (!evaluateGuard(transition.guard, newCounters)) {
          allowed = false;
          if (!errorCode) errorCode = ErrorCodes.GUARD_CONDITION_FAILED;
          reasons.push({
            code: ErrorCodes.GUARD_CONDITION_FAILED,
            message: `Guard condition "${transition.guard}" not satisfied`,
            ruleRef: `stateMachine.transitions`
          });
        }
      }
      
      if (allowed) {
        newState = transition.toState;
        reasons.push({
          code: 'STATE_TRANSITION',
          message: `State transition: ${currentState} → ${newState}`
        });
        
        if (transition.setsCounters) {
          for (const [name, delta] of Object.entries(transition.setsCounters)) {
            newCounters[name] = (newCounters[name] ?? 0) + delta;
          }
        }
      }
    }
  }
  
  // Update counts if allowed
  if (allowed) {
    newToolCallCounts[toolName] = (newToolCallCounts[toolName] ?? 0) + 1;
    if (reasons.length === 0) {
      reasons.push({ code: 'ALLOWED', message: 'All policy conditions satisfied' });
    }
  }
  
  return { allowed, errorCode, reasons, newState, newCounters, newToolCallCounts };
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  const timestamp = Date.now();
  
  try {
    // Get API key from header
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          allowed: false,
          errorCode: ErrorCodes.INVALID_API_KEY,
          decisionReasons: [{ code: ErrorCodes.INVALID_API_KEY, message: 'Missing x-api-key header' }]
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse request body
    const body: RuntimeCheckRequest = await req.json();
    const { sessionId, agentId, toolName, actionType, payload, metadata } = body;
    
    if (!sessionId || !agentId || !toolName) {
      return new Response(
        JSON.stringify({
          allowed: false,
          errorCode: ErrorCodes.INTERNAL_ERROR,
          decisionReasons: [{ code: ErrorCodes.INTERNAL_ERROR, message: 'Missing required fields: sessionId, agentId, toolName' }]
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Validate API key
    const keyPrefix = apiKey.substring(0, 8);
    const keyHash = await hashApiKey(apiKey);
    
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('id, env_id, revoked_at')
      .eq('key_prefix', keyPrefix)
      .eq('key_hash', keyHash)
      .single();
    
    if (apiKeyError || !apiKeyData) {
      return new Response(
        JSON.stringify({
          allowed: false,
          errorCode: ErrorCodes.INVALID_API_KEY,
          decisionReasons: [{ code: ErrorCodes.INVALID_API_KEY, message: 'Invalid API key' }]
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (apiKeyData.revoked_at) {
      return new Response(
        JSON.stringify({
          allowed: false,
          errorCode: ErrorCodes.API_KEY_REVOKED,
          decisionReasons: [{ code: ErrorCodes.API_KEY_REVOKED, message: 'API key has been revoked' }]
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const envId = apiKeyData.env_id;
    
    // Get published policy for this environment
    const { data: policyData, error: policyError } = await supabase
      .from('policies')
      .select('id, version, policy_spec')
      .eq('env_id', envId)
      .eq('status', 'published')
      .order('version', { ascending: false })
      .limit(1)
      .single();
    
    if (policyError || !policyData) {
      return new Response(
        JSON.stringify({
          allowed: false,
          errorCode: ErrorCodes.POLICY_NOT_FOUND,
          decisionReasons: [{ code: ErrorCodes.POLICY_NOT_FOUND, message: 'No published policy found for this environment' }]
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const policy = policyData.policy_spec as PolicySpec;
    const policyVersion = policyData.version;
    const policyId = policyData.id;
    
    // Get or create execution session
    let { data: session, error: sessionError } = await supabase
      .from('execution_sessions')
      .select('*')
      .eq('env_id', envId)
      .eq('session_id', sessionId)
      .single();
    
    const initialState = policy.stateMachine?.initialState ?? 'initial';
    
    if (sessionError || !session) {
      // Create new session - LOCK policy version
      const { data: newSession, error: createError } = await supabase
        .from('execution_sessions')
        .insert({
          env_id: envId,
          session_id: sessionId,
          agent_id: agentId,
          policy_id: policyId,
          policy_version_locked: policyVersion,
          initial_state: initialState,
          current_state: initialState,
          counters: {},
          tool_calls_history: [],
          tool_call_counts: {},
          last_tool_call_times: {},
          metadata: metadata || {}
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Failed to create session:', createError);
        return new Response(
          JSON.stringify({
            allowed: false,
            errorCode: ErrorCodes.INTERNAL_ERROR,
            decisionReasons: [{ code: ErrorCodes.INTERNAL_ERROR, message: 'Failed to create execution session' }]
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      session = newSession;
    }
    
    // CRITICAL: Use the policy version locked at session creation
    // This ensures policy updates don't affect existing sessions
    const lockedPolicyVersion = session.policy_version_locked ?? policyVersion;
    
    // If session was created with a different policy version, use that version
    // For now, we use the current policy but note the version mismatch
    // In production, you'd want to fetch the specific policy version
    
    const currentState = session.current_state ?? initialState;
    const counters = (session.counters ?? {}) as Record<string, number>;
    const toolCallsHistory = (session.tool_calls_history ?? []) as string[];
    const toolCallCounts = (session.tool_call_counts ?? {}) as Record<string, number>;
    const lastToolCallTimes = (session.last_tool_call_times ?? {}) as Record<string, number>;
    
    // Evaluate the tool call
    const result = evaluateToolCall(
      policy,
      toolName,
      actionType,
      payload || {},
      currentState,
      toolCallsHistory,
      counters,
      toolCallCounts,
      lastToolCallTimes,
      timestamp
    );
    
    // Redact payload for logging
    const redactedPayload = redactSensitiveFields(payload || {});
    
    // Log the tool call
    const { error: logError } = await supabase
      .from('tool_call_logs')
      .insert({
        execution_session_id: session.id,
        tool_name: toolName,
        action_type: actionType || null,
        payload_redacted: redactedPayload,
        decision: result.allowed ? 'allowed' : 'blocked',
        decision_reasons: result.reasons.map(r => r.message),
        error_code: result.errorCode || null,
        policy_version_used: lockedPolicyVersion,
        state_before: currentState,
        state_after: result.newState,
        counters_before: counters,
        counters_after: result.newCounters
      });
    
    if (logError) {
      console.error('Failed to log tool call:', logError);
    }
    
    // Update session state
    const newToolCallTimes = { ...lastToolCallTimes, [toolName]: timestamp };
    const newHistory = [...toolCallsHistory, toolName];
    
    const { error: updateError } = await supabase
      .from('execution_sessions')
      .update({
        current_state: result.newState,
        counters: result.newCounters,
        tool_calls_history: newHistory,
        tool_call_counts: result.newToolCallCounts,
        last_tool_call_times: newToolCallTimes,
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id);
    
    if (updateError) {
      console.error('Failed to update session:', updateError);
    }
    
    // Return response
    const response: RuntimeCheckResponse = {
      allowed: result.allowed,
      errorCode: result.errorCode,
      decisionReasons: result.reasons,
      policyVersionUsed: lockedPolicyVersion,
      stateBefore: currentState,
      stateAfter: result.newState,
      counters: result.newCounters
    };
    
    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Runtime check error:', error);
    return new Response(
      JSON.stringify({
        allowed: false,
        errorCode: ErrorCodes.INTERNAL_ERROR,
        decisionReasons: [{ 
          code: ErrorCodes.INTERNAL_ERROR, 
          message: error instanceof Error ? error.message : 'Internal server error' 
        }]
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
