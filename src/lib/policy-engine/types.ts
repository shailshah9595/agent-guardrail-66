/**
 * Agent Firewall Policy Engine - Type Definitions
 * 
 * This module defines all types for the deterministic policy enforcement engine.
 * No LLM calls, no randomness, no heuristics - pure rule-based evaluation.
 */

// ============================================
// ERROR CODES - Stable, documented, machine-readable
// ============================================

export const ErrorCodes = {
  // Policy errors
  POLICY_NOT_FOUND: 'POLICY_NOT_FOUND',
  POLICY_INVALID: 'POLICY_INVALID',
  POLICY_VALIDATION_FAILED: 'POLICY_VALIDATION_FAILED',
  
  // Tool errors
  UNKNOWN_TOOL_DENIED: 'UNKNOWN_TOOL_DENIED',
  TOOL_EXPLICITLY_DENIED: 'TOOL_EXPLICITLY_DENIED',
  SIDE_EFFECT_NOT_ALLOWED: 'SIDE_EFFECT_NOT_ALLOWED',
  
  // State machine errors
  STATE_VIOLATION: 'STATE_VIOLATION',
  NO_VALID_TRANSITION: 'NO_VALID_TRANSITION',
  INVALID_STATE: 'INVALID_STATE',
  
  // Constraint errors
  MAX_CALLS_EXCEEDED: 'MAX_CALLS_EXCEEDED',
  COOLDOWN_ACTIVE: 'COOLDOWN_ACTIVE',
  COUNTER_LIMIT_EXCEEDED: 'COUNTER_LIMIT_EXCEEDED',
  
  // Prerequisite errors
  REQUIRED_STATE_NOT_MET: 'REQUIRED_STATE_NOT_MET',
  REQUIRED_TOOLS_NOT_CALLED: 'REQUIRED_TOOLS_NOT_CALLED',
  
  // Field errors
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  FORBIDDEN_FIELD_PRESENT: 'FORBIDDEN_FIELD_PRESENT',
  REGEX_MATCH_DENIED: 'REGEX_MATCH_DENIED',
  REGEX_MATCH_REQUIRED: 'REGEX_MATCH_REQUIRED',
  
  // Guard errors
  GUARD_CONDITION_FAILED: 'GUARD_CONDITION_FAILED',
  
  // Auth errors
  INVALID_API_KEY: 'INVALID_API_KEY',
  API_KEY_REVOKED: 'API_KEY_REVOKED',
  
  // Internal errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// ============================================
// POLICY SPECIFICATION TYPES
// ============================================

export interface RegexConstraint {
  jsonPath: string;
  pattern: string;
}

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
  denyIfRegexMatch?: RegexConstraint[];
  allowOnlyIfRegexMatch?: RegexConstraint[];
}

export interface StateTransition {
  fromState: string;
  toState: string;
  triggeredByTool: string;
  requiresToolsCalledBefore?: string[];
  setsCounters?: Record<string, number>;
  guard?: string; // Simple expression like "counter_name <= 1"
}

export interface CounterDef {
  name: string;
  scope: 'session';
  initialValue: number;
  maxValue?: number;
}

export interface StateMachine {
  states: string[];
  initialState: string;
  transitions: StateTransition[];
}

export interface PolicySpec {
  version: string;
  defaultDecision: 'allow' | 'deny';
  toolRules: ToolRule[];
  stateMachine?: StateMachine;
  counters?: CounterDef[];
}

// ============================================
// RUNTIME TYPES
// ============================================

export interface SessionState {
  sessionId: string;
  envId: string;
  agentId: string;
  policyId: string;
  policyVersionLocked: number;
  currentState: string;
  initialState: string;
  counters: Record<string, number>;
  toolCallsHistory: string[];
  toolCallCounts: Record<string, number>;
  lastToolCallTimes: Record<string, number>;
  metadata?: Record<string, unknown>;
}

export interface EvaluationInput {
  sessionId: string;
  agentId: string;
  toolName: string;
  actionType?: 'read' | 'write' | 'side_effect';
  payload: Record<string, unknown>;
  requestedNextState?: string | null;
  timestamp: number;
}

export interface DecisionReason {
  code: ErrorCode;
  message: string;
  ruleRef?: string; // Reference to the policy rule that caused this
}

export interface EvaluationResult {
  allowed: boolean;
  errorCode?: ErrorCode;
  reasons: DecisionReason[];
  policyVersionUsed: number;
  stateBefore: string;
  stateAfter: string;
  countersBefore: Record<string, number>;
  countersAfter: Record<string, number>;
}

// ============================================
// VALIDATION TYPES
// ============================================

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ============================================
// SIMULATION TYPES (No DB writes)
// ============================================

export interface SimulationInput {
  policy: PolicySpec;
  toolName: string;
  actionType?: 'read' | 'write' | 'side_effect';
  payload: Record<string, unknown>;
  currentState: string;
  previousToolsCalled: string[];
  counters: Record<string, number>;
  toolCallCounts: Record<string, number>;
  lastToolCallTimes: Record<string, number>;
  timestamp: number;
}

export interface SimulationResult {
  allowed: boolean;
  errorCode?: ErrorCode;
  reasons: DecisionReason[];
  newState: string;
  newCounters: Record<string, number>;
  newToolCallCounts: Record<string, number>;
}
