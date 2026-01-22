/**
 * Agent Firewall Policy Validator
 * 
 * Validates PolicySpec before publish. Rejects invalid policies with
 * clear, human-readable errors.
 */

import type { PolicySpec, ValidationResult, ValidationError, StateMachine, ToolRule, CounterDef } from './types';

/**
 * Validates a PolicySpec for correctness before publish.
 * Returns human-readable errors for any issues found.
 */
export function validatePolicySpec(spec: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  
  if (!spec || typeof spec !== 'object') {
    return {
      valid: false,
      errors: [{ path: '', message: 'Policy must be a valid object', code: 'INVALID_TYPE' }]
    };
  }
  
  const policy = spec as Record<string, unknown>;
  
  // Validate version
  if (!policy.version || typeof policy.version !== 'string') {
    errors.push({
      path: 'version',
      message: 'Policy must have a version string (e.g., "1.0")',
      code: 'MISSING_VERSION'
    });
  }
  
  // Validate defaultDecision
  if (!policy.defaultDecision) {
    errors.push({
      path: 'defaultDecision',
      message: 'Policy must specify defaultDecision ("allow" or "deny")',
      code: 'MISSING_DEFAULT_DECISION'
    });
  } else if (policy.defaultDecision !== 'allow' && policy.defaultDecision !== 'deny') {
    errors.push({
      path: 'defaultDecision',
      message: `defaultDecision must be "allow" or "deny", got "${policy.defaultDecision}"`,
      code: 'INVALID_DEFAULT_DECISION'
    });
  }
  
  // Validate toolRules
  if (!Array.isArray(policy.toolRules)) {
    errors.push({
      path: 'toolRules',
      message: 'toolRules must be an array',
      code: 'INVALID_TOOL_RULES'
    });
  } else {
    validateToolRules(policy.toolRules as ToolRule[], policy.stateMachine as StateMachine | undefined, errors);
  }
  
  // Validate counters
  const counterNames = new Set<string>();
  if (policy.counters !== undefined) {
    if (!Array.isArray(policy.counters)) {
      errors.push({
        path: 'counters',
        message: 'counters must be an array',
        code: 'INVALID_COUNTERS'
      });
    } else {
      for (let i = 0; i < policy.counters.length; i++) {
        const counter = policy.counters[i] as CounterDef;
        if (!counter.name || typeof counter.name !== 'string') {
          errors.push({
            path: `counters[${i}].name`,
            message: 'Counter must have a name',
            code: 'MISSING_COUNTER_NAME'
          });
        } else {
          counterNames.add(counter.name);
        }
        if (counter.scope !== 'session') {
          errors.push({
            path: `counters[${i}].scope`,
            message: 'Counter scope must be "session"',
            code: 'INVALID_COUNTER_SCOPE'
          });
        }
        if (typeof counter.initialValue !== 'number') {
          errors.push({
            path: `counters[${i}].initialValue`,
            message: 'Counter must have a numeric initialValue',
            code: 'INVALID_COUNTER_VALUE'
          });
        }
      }
    }
  }
  
  // Validate stateMachine
  if (policy.stateMachine !== undefined) {
    validateStateMachine(
      policy.stateMachine as StateMachine, 
      policy.toolRules as ToolRule[] || [], 
      counterNames,
      errors
    );
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

function validateToolRules(
  rules: ToolRule[], 
  stateMachine: StateMachine | undefined,
  errors: ValidationError[]
): void {
  const toolNames = new Set<string>();
  const stateNames = stateMachine ? new Set(stateMachine.states) : new Set<string>();
  
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const prefix = `toolRules[${i}]`;
    
    // Check toolName
    if (!rule.toolName || typeof rule.toolName !== 'string') {
      errors.push({
        path: `${prefix}.toolName`,
        message: 'Tool rule must have a toolName string',
        code: 'MISSING_TOOL_NAME'
      });
    } else {
      if (toolNames.has(rule.toolName)) {
        errors.push({
          path: `${prefix}.toolName`,
          message: `Duplicate tool rule for "${rule.toolName}". Each tool should have only one rule.`,
          code: 'DUPLICATE_TOOL_RULE'
        });
      }
      toolNames.add(rule.toolName);
    }
    
    // Check effect
    if (!rule.effect || (rule.effect !== 'allow' && rule.effect !== 'deny')) {
      errors.push({
        path: `${prefix}.effect`,
        message: 'Tool rule must have effect "allow" or "deny"',
        code: 'INVALID_EFFECT'
      });
    }
    
    // Check actionType
    if (rule.actionType !== undefined) {
      if (!['read', 'write', 'side_effect'].includes(rule.actionType)) {
        errors.push({
          path: `${prefix}.actionType`,
          message: `Invalid actionType "${rule.actionType}". Must be "read", "write", or "side_effect"`,
          code: 'INVALID_ACTION_TYPE'
        });
      }
    }
    
    // Check maxCallsPerSession
    if (rule.maxCallsPerSession !== undefined) {
      if (typeof rule.maxCallsPerSession !== 'number' || rule.maxCallsPerSession < 0 || !Number.isInteger(rule.maxCallsPerSession)) {
        errors.push({
          path: `${prefix}.maxCallsPerSession`,
          message: 'maxCallsPerSession must be a non-negative integer',
          code: 'INVALID_MAX_CALLS'
        });
      }
    }
    
    // Check cooldownMs
    if (rule.cooldownMs !== undefined) {
      if (typeof rule.cooldownMs !== 'number' || rule.cooldownMs < 0 || !Number.isInteger(rule.cooldownMs)) {
        errors.push({
          path: `${prefix}.cooldownMs`,
          message: 'cooldownMs must be a non-negative integer',
          code: 'INVALID_COOLDOWN'
        });
      }
    }
    
    // Check requireState references valid state
    if (rule.requireState !== undefined && stateMachine) {
      if (!stateNames.has(rule.requireState)) {
        errors.push({
          path: `${prefix}.requireState`,
          message: `requireState references unknown state "${rule.requireState}". Available states: ${Array.from(stateNames).join(', ')}`,
          code: 'UNKNOWN_STATE_REFERENCE'
        });
      }
    }
    
    // Check requirePreviousToolCalls
    if (rule.requirePreviousToolCalls !== undefined) {
      if (!Array.isArray(rule.requirePreviousToolCalls)) {
        errors.push({
          path: `${prefix}.requirePreviousToolCalls`,
          message: 'requirePreviousToolCalls must be an array of tool names',
          code: 'INVALID_PREVIOUS_CALLS'
        });
      }
    }
    
    // Check regex patterns are valid
    if (rule.denyIfRegexMatch) {
      for (let j = 0; j < rule.denyIfRegexMatch.length; j++) {
        const constraint = rule.denyIfRegexMatch[j];
        try {
          new RegExp(constraint.pattern);
        } catch (e) {
          errors.push({
            path: `${prefix}.denyIfRegexMatch[${j}].pattern`,
            message: `Invalid regex pattern: ${constraint.pattern}`,
            code: 'INVALID_REGEX'
          });
        }
      }
    }
    
    if (rule.allowOnlyIfRegexMatch) {
      for (let j = 0; j < rule.allowOnlyIfRegexMatch.length; j++) {
        const constraint = rule.allowOnlyIfRegexMatch[j];
        try {
          new RegExp(constraint.pattern);
        } catch (e) {
          errors.push({
            path: `${prefix}.allowOnlyIfRegexMatch[${j}].pattern`,
            message: `Invalid regex pattern: ${constraint.pattern}`,
            code: 'INVALID_REGEX'
          });
        }
      }
    }
  }
}

function validateStateMachine(
  sm: StateMachine, 
  toolRules: ToolRule[],
  counterNames: Set<string>,
  errors: ValidationError[]
): void {
  const prefix = 'stateMachine';
  
  // Check states array
  if (!Array.isArray(sm.states) || sm.states.length === 0) {
    errors.push({
      path: `${prefix}.states`,
      message: 'stateMachine.states must be a non-empty array',
      code: 'EMPTY_STATES'
    });
    return;
  }
  
  const stateNames = new Set(sm.states);
  const toolNames = new Set(toolRules.map(r => r.toolName));
  
  // Check for duplicate states
  if (stateNames.size !== sm.states.length) {
    errors.push({
      path: `${prefix}.states`,
      message: 'stateMachine.states contains duplicate state names',
      code: 'DUPLICATE_STATES'
    });
  }
  
  // Check initialState
  if (!sm.initialState) {
    errors.push({
      path: `${prefix}.initialState`,
      message: 'stateMachine must have an initialState',
      code: 'MISSING_INITIAL_STATE'
    });
  } else if (!stateNames.has(sm.initialState)) {
    errors.push({
      path: `${prefix}.initialState`,
      message: `initialState "${sm.initialState}" is not in states list. Available states: ${sm.states.join(', ')}`,
      code: 'INVALID_INITIAL_STATE'
    });
  }
  
  // Check transitions
  if (!Array.isArray(sm.transitions)) {
    errors.push({
      path: `${prefix}.transitions`,
      message: 'stateMachine.transitions must be an array',
      code: 'INVALID_TRANSITIONS'
    });
    return;
  }
  
  // Track transitions for cycle detection
  const transitionMap = new Map<string, Set<string>>(); // fromState -> Set<toState>
  
  for (let i = 0; i < sm.transitions.length; i++) {
    const t = sm.transitions[i];
    const tPrefix = `${prefix}.transitions[${i}]`;
    
    // Check fromState
    if (!t.fromState || !stateNames.has(t.fromState)) {
      errors.push({
        path: `${tPrefix}.fromState`,
        message: `fromState "${t.fromState}" is not in states list. Available: ${sm.states.join(', ')}`,
        code: 'UNKNOWN_FROM_STATE'
      });
    }
    
    // Check toState
    if (!t.toState || !stateNames.has(t.toState)) {
      errors.push({
        path: `${tPrefix}.toState`,
        message: `toState "${t.toState}" is not in states list. Available: ${sm.states.join(', ')}`,
        code: 'UNKNOWN_TO_STATE'
      });
    }
    
    // Check triggeredByTool - must have a corresponding rule or be an unknown tool check
    if (!t.triggeredByTool) {
      errors.push({
        path: `${tPrefix}.triggeredByTool`,
        message: 'Transition must have a triggeredByTool',
        code: 'MISSING_TRIGGER_TOOL'
      });
    }
    
    // Track for cycle detection
    if (t.fromState && t.toState) {
      if (!transitionMap.has(t.fromState)) {
        transitionMap.set(t.fromState, new Set());
      }
      transitionMap.get(t.fromState)!.add(t.toState);
    }
    
    // Check setsCounters references defined counters
    if (t.setsCounters) {
      for (const counterName of Object.keys(t.setsCounters)) {
        if (!counterNames.has(counterName)) {
          errors.push({
            path: `${tPrefix}.setsCounters.${counterName}`,
            message: `Counter "${counterName}" is not defined in counters array`,
            code: 'UNDEFINED_COUNTER'
          });
        }
      }
    }
    
    // Validate guard expression syntax (simple validation)
    if (t.guard) {
      const guardResult = validateGuardExpression(t.guard, counterNames);
      if (!guardResult.valid) {
        errors.push({
          path: `${tPrefix}.guard`,
          message: guardResult.error!,
          code: 'INVALID_GUARD'
        });
      }
    }
  }
  
  // Check for self-loops without guards (potential infinite loops)
  for (const t of sm.transitions) {
    if (t.fromState === t.toState && !t.guard) {
      errors.push({
        path: `${prefix}.transitions`,
        message: `Self-transition on state "${t.fromState}" triggered by "${t.triggeredByTool}" has no guard condition. This could cause infinite loops.`,
        code: 'UNGUARDED_SELF_LOOP'
      });
    }
  }
}

function validateGuardExpression(guard: string, counterNames: Set<string>): { valid: boolean; error?: string } {
  // Simple guard expression validation
  // Supports: counter_name <= N, counter_name < N, counter_name >= N, counter_name > N, counter_name == N
  const pattern = /^(\w+)\s*(<=|<|>=|>|==|!=)\s*(\d+)$/;
  const match = guard.trim().match(pattern);
  
  if (!match) {
    return {
      valid: false,
      error: `Invalid guard expression "${guard}". Expected format: "counter_name <= N" (supports <=, <, >=, >, ==, !=)`
    };
  }
  
  const counterName = match[1];
  if (!counterNames.has(counterName)) {
    return {
      valid: false,
      error: `Guard references undefined counter "${counterName}". Define it in the counters array first.`
    };
  }
  
  return { valid: true };
}

/**
 * Formats validation errors as human-readable messages
 */
export function formatValidationErrors(errors: ValidationError[]): string[] {
  return errors.map(e => {
    if (e.path) {
      return `[${e.path}] ${e.message}`;
    }
    return e.message;
  });
}
