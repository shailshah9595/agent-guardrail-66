/**
 * Agent Firewall Policy Evaluator
 * 
 * CRITICAL: This module implements deterministic policy evaluation.
 * - No randomness
 * - No LLM calls
 * - No async side effects
 * - Pure function evaluation
 * - O(1) lookups where possible
 */

import type {
  PolicySpec,
  ToolRule,
  EvaluationResult,
  DecisionReason,
  SimulationInput,
  SimulationResult,
  ErrorCode,
} from './types';
import { ErrorCodes } from './types';

/**
 * Gets a value from a nested object using a JSON path.
 * Supports dot notation: "user.address.city"
 */
function getJsonPathValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  
  return current;
}

/**
 * Evaluates a guard expression against current counters.
 * Supports: counter_name <= N, counter_name < N, etc.
 */
function evaluateGuard(guard: string, counters: Record<string, number>): boolean {
  const pattern = /^(\w+)\s*(<=|<|>=|>|==|!=)\s*(\d+)$/;
  const match = guard.trim().match(pattern);
  
  if (!match) {
    return false; // Invalid guard = fail safe
  }
  
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

/**
 * Simulates a tool call against a policy WITHOUT persisting anything.
 * This is used for the simulation panel and is completely stateless.
 */
export function simulateToolCall(input: SimulationInput): SimulationResult {
  const { 
    policy, 
    toolName, 
    actionType,
    payload, 
    currentState, 
    previousToolsCalled, 
    counters,
    toolCallCounts,
    lastToolCallTimes,
    timestamp
  } = input;
  
  const reasons: DecisionReason[] = [];
  let allowed = true;
  let errorCode: ErrorCode | undefined;
  let newState = currentState;
  const newCounters = { ...counters };
  const newToolCallCounts = { ...toolCallCounts };
  
  // Initialize counters from policy defaults
  if (policy.counters) {
    for (const counterDef of policy.counters) {
      if (!(counterDef.name in newCounters)) {
        newCounters[counterDef.name] = counterDef.initialValue;
      }
    }
  }
  
  // Find matching tool rule
  const rule = policy.toolRules.find(r => r.toolName === toolName);
  
  // ============================================
  // CHECK 1: Unknown tool handling
  // ============================================
  if (!rule) {
    if (policy.defaultDecision === 'deny') {
      allowed = false;
      errorCode = ErrorCodes.UNKNOWN_TOOL_DENIED;
      reasons.push({
        code: ErrorCodes.UNKNOWN_TOOL_DENIED,
        message: `Tool "${toolName}" is not defined in policy and defaultDecision is "deny"`,
        ruleRef: 'defaultDecision'
      });
    } else {
      reasons.push({
        code: ErrorCodes.UNKNOWN_TOOL_DENIED,
        message: `Tool "${toolName}" not in policy, allowed by defaultDecision`
      });
    }
    
    return {
      allowed,
      errorCode,
      reasons,
      newState,
      newCounters,
      newToolCallCounts
    };
  }
  
  // ============================================
  // CHECK 2: Explicit deny rule
  // ============================================
  if (rule.effect === 'deny') {
    allowed = false;
    errorCode = ErrorCodes.TOOL_EXPLICITLY_DENIED;
    reasons.push({
      code: ErrorCodes.TOOL_EXPLICITLY_DENIED,
      message: `Tool "${toolName}" is explicitly denied by policy`,
      ruleRef: `toolRules.${toolName}.effect`
    });
    
    return {
      allowed,
      errorCode,
      reasons,
      newState,
      newCounters,
      newToolCallCounts
    };
  }
  
  // ============================================
  // CHECK 3: Side-effect enforcement
  // ============================================
  const effectiveActionType = actionType || rule.actionType;
  if (effectiveActionType === 'side_effect' || effectiveActionType === 'write') {
    // For write/side_effect, must have explicit allow
    if (rule.effect !== 'allow') {
      allowed = false;
      errorCode = ErrorCodes.SIDE_EFFECT_NOT_ALLOWED;
      reasons.push({
        code: ErrorCodes.SIDE_EFFECT_NOT_ALLOWED,
        message: `Tool "${toolName}" is a ${effectiveActionType} operation and must be explicitly allowed`,
        ruleRef: `toolRules.${toolName}.actionType`
      });
      return {
        allowed,
        errorCode,
        reasons,
        newState,
        newCounters,
        newToolCallCounts
      };
    }
  }
  
  // ============================================
  // CHECK 4: Required state
  // ============================================
  if (rule.requireState && rule.requireState !== currentState) {
    allowed = false;
    errorCode = ErrorCodes.REQUIRED_STATE_NOT_MET;
    reasons.push({
      code: ErrorCodes.REQUIRED_STATE_NOT_MET,
      message: `Tool "${toolName}" requires state "${rule.requireState}" but current state is "${currentState}"`,
      ruleRef: `toolRules.${toolName}.requireState`
    });
  }
  
  // ============================================
  // CHECK 5: Required previous tool calls
  // ============================================
  if (rule.requirePreviousToolCalls && rule.requirePreviousToolCalls.length > 0) {
    for (const requiredTool of rule.requirePreviousToolCalls) {
      if (!previousToolsCalled.includes(requiredTool)) {
        allowed = false;
        if (!errorCode) errorCode = ErrorCodes.REQUIRED_TOOLS_NOT_CALLED;
        reasons.push({
          code: ErrorCodes.REQUIRED_TOOLS_NOT_CALLED,
          message: `Tool "${toolName}" requires "${requiredTool}" to be called first`,
          ruleRef: `toolRules.${toolName}.requirePreviousToolCalls`
        });
      }
    }
  }
  
  // ============================================
  // CHECK 6: Max calls per session
  // ============================================
  if (rule.maxCallsPerSession !== undefined) {
    const currentCallCount = toolCallCounts[toolName] ?? 0;
    if (currentCallCount >= rule.maxCallsPerSession) {
      allowed = false;
      if (!errorCode) errorCode = ErrorCodes.MAX_CALLS_EXCEEDED;
      reasons.push({
        code: ErrorCodes.MAX_CALLS_EXCEEDED,
        message: `Tool "${toolName}" has reached maximum calls (${rule.maxCallsPerSession}) for this session`,
        ruleRef: `toolRules.${toolName}.maxCallsPerSession`
      });
    }
  }
  
  // ============================================
  // CHECK 7: Cooldown
  // ============================================
  if (rule.cooldownMs !== undefined) {
    const lastCallTime = lastToolCallTimes[toolName];
    if (lastCallTime !== undefined) {
      const elapsed = timestamp - lastCallTime;
      if (elapsed < rule.cooldownMs) {
        allowed = false;
        if (!errorCode) errorCode = ErrorCodes.COOLDOWN_ACTIVE;
        const remainingMs = rule.cooldownMs - elapsed;
        reasons.push({
          code: ErrorCodes.COOLDOWN_ACTIVE,
          message: `Tool "${toolName}" is in cooldown. ${remainingMs}ms remaining`,
          ruleRef: `toolRules.${toolName}.cooldownMs`
        });
      }
    }
  }
  
  // ============================================
  // CHECK 8: Required fields
  // ============================================
  if (rule.requireFields && rule.requireFields.length > 0) {
    for (const field of rule.requireFields) {
      const value = getJsonPathValue(payload, field);
      if (value === undefined) {
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
  
  // ============================================
  // CHECK 9: Forbidden fields
  // ============================================
  if (rule.denyIfFieldsPresent && rule.denyIfFieldsPresent.length > 0) {
    for (const field of rule.denyIfFieldsPresent) {
      const value = getJsonPathValue(payload, field);
      if (value !== undefined) {
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
  
  // ============================================
  // CHECK 10: Deny regex match
  // ============================================
  if (rule.denyIfRegexMatch && rule.denyIfRegexMatch.length > 0) {
    for (const constraint of rule.denyIfRegexMatch) {
      const value = getJsonPathValue(payload, constraint.jsonPath);
      if (value !== undefined && typeof value === 'string') {
        try {
          const regex = new RegExp(constraint.pattern);
          if (regex.test(value)) {
            allowed = false;
            if (!errorCode) errorCode = ErrorCodes.REGEX_MATCH_DENIED;
            reasons.push({
              code: ErrorCodes.REGEX_MATCH_DENIED,
              message: `Field "${constraint.jsonPath}" matches forbidden pattern "${constraint.pattern}"`,
              ruleRef: `toolRules.${toolName}.denyIfRegexMatch`
            });
          }
        } catch {
          // Invalid regex - skip (should be caught by validation)
        }
      }
    }
  }
  
  // ============================================
  // CHECK 11: Allow only regex match
  // ============================================
  if (rule.allowOnlyIfRegexMatch && rule.allowOnlyIfRegexMatch.length > 0) {
    for (const constraint of rule.allowOnlyIfRegexMatch) {
      const value = getJsonPathValue(payload, constraint.jsonPath);
      if (value === undefined || typeof value !== 'string') {
        allowed = false;
        if (!errorCode) errorCode = ErrorCodes.REGEX_MATCH_REQUIRED;
        reasons.push({
          code: ErrorCodes.REGEX_MATCH_REQUIRED,
          message: `Field "${constraint.jsonPath}" must exist and match pattern "${constraint.pattern}"`,
          ruleRef: `toolRules.${toolName}.allowOnlyIfRegexMatch`
        });
      } else {
        try {
          const regex = new RegExp(constraint.pattern);
          if (!regex.test(value)) {
            allowed = false;
            if (!errorCode) errorCode = ErrorCodes.REGEX_MATCH_REQUIRED;
            reasons.push({
              code: ErrorCodes.REGEX_MATCH_REQUIRED,
              message: `Field "${constraint.jsonPath}" does not match required pattern "${constraint.pattern}"`,
              ruleRef: `toolRules.${toolName}.allowOnlyIfRegexMatch`
            });
          }
        } catch {
          // Invalid regex - skip
        }
      }
    }
  }
  
  // ============================================
  // CHECK 12: State machine transition
  // ============================================
  if (allowed && policy.stateMachine) {
    const transition = policy.stateMachine.transitions.find(
      t => t.triggeredByTool === toolName && t.fromState === currentState
    );
    
    if (transition) {
      // Check transition prerequisites
      if (transition.requiresToolsCalledBefore) {
        for (const requiredTool of transition.requiresToolsCalledBefore) {
          if (!previousToolsCalled.includes(requiredTool)) {
            allowed = false;
            if (!errorCode) errorCode = ErrorCodes.REQUIRED_TOOLS_NOT_CALLED;
            reasons.push({
              code: ErrorCodes.REQUIRED_TOOLS_NOT_CALLED,
              message: `State transition requires "${requiredTool}" to be called first`,
              ruleRef: `stateMachine.transitions[${currentState}->${transition.toState}]`
            });
          }
        }
      }
      
      // Check guard condition
      if (transition.guard && allowed) {
        if (!evaluateGuard(transition.guard, newCounters)) {
          allowed = false;
          if (!errorCode) errorCode = ErrorCodes.GUARD_CONDITION_FAILED;
          reasons.push({
            code: ErrorCodes.GUARD_CONDITION_FAILED,
            message: `Guard condition "${transition.guard}" not satisfied`,
            ruleRef: `stateMachine.transitions[${currentState}->${transition.toState}].guard`
          });
        }
      }
      
      // Apply transition
      if (allowed) {
        newState = transition.toState;
        reasons.push({
          code: ErrorCodes.STATE_VIOLATION, // Using this as a neutral code for success
          message: `State transition: ${currentState} → ${newState}`
        });
        
        // Apply counter updates
        if (transition.setsCounters) {
          for (const [counterName, delta] of Object.entries(transition.setsCounters)) {
            newCounters[counterName] = (newCounters[counterName] ?? 0) + delta;
          }
        }
      }
    } else {
      // No transition defined - check if we should block
      // If tool is allowed but no transition exists and we're in a state machine,
      // the tool can be called but state doesn't change
      // This is intentional - not every tool needs to trigger a transition
    }
  }
  
  // ============================================
  // FINAL: Update call counts if allowed
  // ============================================
  if (allowed) {
    newToolCallCounts[toolName] = (newToolCallCounts[toolName] ?? 0) + 1;
    
    if (reasons.length === 0) {
      reasons.push({
        code: ErrorCodes.UNKNOWN_TOOL_DENIED, // Using as neutral
        message: 'All policy conditions satisfied'
      });
    }
  }
  
  return {
    allowed,
    errorCode,
    reasons,
    newState,
    newCounters,
    newToolCallCounts
  };
}

/**
 * Creates evaluation result from simulation result with additional context.
 */
export function createEvaluationResult(
  simResult: SimulationResult,
  policyVersion: number,
  stateBefore: string,
  countersBefore: Record<string, number>
): EvaluationResult {
  return {
    allowed: simResult.allowed,
    errorCode: simResult.errorCode,
    reasons: simResult.reasons,
    policyVersionUsed: policyVersion,
    stateBefore,
    stateAfter: simResult.newState,
    countersBefore,
    countersAfter: simResult.newCounters
  };
}
