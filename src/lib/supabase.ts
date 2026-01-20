import { supabase } from "@/integrations/supabase/client";

export { supabase };

// Type helpers for policy spec
export interface ToolRule {
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

export interface StateTransition {
  fromState: string;
  toState: string;
  triggeredByTool: string;
  requiresToolsCalledBefore?: string[];
  setsCounters?: Record<string, number>;
  guard?: string;
}

export interface CounterDef {
  name: string;
  scope: 'session';
  initialValue: number;
}

export interface PolicySpec {
  version: string;
  defaultDecision: 'allow' | 'deny';
  toolRules: ToolRule[];
  stateMachine?: {
    states: string[];
    initialState: string;
    transitions: StateTransition[];
  };
  counters?: CounterDef[];
}

export const defaultPolicySpec: PolicySpec = {
  version: "1.0",
  defaultDecision: "deny",
  toolRules: [],
  stateMachine: {
    states: ["initial"],
    initialState: "initial",
    transitions: []
  },
  counters: []
};

// Sensitive fields to redact in logs
export const SENSITIVE_FIELDS = [
  'password',
  'token',
  'apiKey',
  'api_key',
  'authorization',
  'ssn',
  'credit_card',
  'creditCard',
  'cvv',
  'secret',
  'private_key',
  'privateKey'
];

export function redactSensitiveFields(payload: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...payload };
  
  function redactRecursive(obj: Record<string, unknown>) {
    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        redactRecursive(obj[key] as Record<string, unknown>);
      }
    }
  }
  
  redactRecursive(redacted);
  return redacted;
}
