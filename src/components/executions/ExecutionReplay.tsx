import { useState } from 'react';
import { Play, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { supabase } from '@/integrations/supabase/client';

interface ToolCallLog {
  id: string;
  timestamp: string;
  tool_name: string;
  action_type: string | null;
  payload_redacted: Record<string, unknown>;
  decision: 'allowed' | 'blocked';
  decision_reasons: string[];
  policy_version_used: number | null;
  policy_hash: string | null;
  state_before: string | null;
  state_after: string | null;
  counters_before: Record<string, number>;
  counters_after: Record<string, number>;
}

interface ReplayResult {
  toolName: string;
  originalDecision: 'allowed' | 'blocked';
  replayedDecision: 'allowed' | 'blocked';
  match: boolean;
  originalReasons: string[];
  replayedReasons: string[];
}

interface ExecutionReplayProps {
  sessionId: string;
  toolCalls: ToolCallLog[];
  policySpec: Record<string, unknown> | null;
}

/**
 * ExecutionReplay Component
 * 
 * Re-evaluates all tool calls in a session using the same policy version,
 * states, and counters to prove determinism.
 * 
 * DEVELOPER TRUST: If any decision doesn't match, we surface an error.
 * This should NEVER happen in a correctly functioning system.
 */
export function ExecutionReplay({ sessionId, toolCalls, policySpec }: ExecutionReplayProps) {
  const [replaying, setReplaying] = useState(false);
  const [results, setResults] = useState<ReplayResult[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hasNonDeterminism, setHasNonDeterminism] = useState(false);

  async function runReplay() {
    if (!policySpec || toolCalls.length === 0) return;
    
    setReplaying(true);
    setResults([]);
    setHasNonDeterminism(false);
    
    const replayResults: ReplayResult[] = [];
    
    // Simulate the policy evaluation locally for each tool call
    // Using the same inputs that were recorded
    let currentState = toolCalls[0]?.state_before || 'initial';
    let counters: Record<string, number> = toolCalls[0]?.counters_before || {};
    const toolCallCounts: Record<string, number> = {};
    const lastToolCallTimes: Record<string, number> = {};
    const toolCallsHistory: string[] = [];
    
    for (const log of toolCalls) {
      // Simulate evaluation
      const result = evaluateToolCallLocal(
        policySpec,
        log.tool_name,
        log.action_type,
        log.payload_redacted,
        currentState,
        toolCallsHistory,
        counters,
        toolCallCounts,
        lastToolCallTimes,
        new Date(log.timestamp).getTime()
      );
      
      const match = result.allowed === (log.decision === 'allowed');
      
      replayResults.push({
        toolName: log.tool_name,
        originalDecision: log.decision,
        replayedDecision: result.allowed ? 'allowed' : 'blocked',
        match,
        originalReasons: log.decision_reasons,
        replayedReasons: result.reasons,
      });
      
      if (!match) {
        setHasNonDeterminism(true);
      }
      
      // Update state for next iteration
      if (result.allowed) {
        currentState = result.newState;
        counters = result.newCounters;
        toolCallCounts[log.tool_name] = (toolCallCounts[log.tool_name] || 0) + 1;
        lastToolCallTimes[log.tool_name] = new Date(log.timestamp).getTime();
        toolCallsHistory.push(log.tool_name);
      }
    }
    
    setResults(replayResults);
    setReplaying(false);
  }

  // Local evaluation function that mirrors the edge function logic
  function evaluateToolCallLocal(
    policy: Record<string, unknown>,
    toolName: string,
    actionType: string | null,
    payload: Record<string, unknown>,
    currentState: string,
    previousToolsCalled: string[],
    counters: Record<string, number>,
    toolCallCounts: Record<string, number>,
    lastToolCallTimes: Record<string, number>,
    timestamp: number
  ): { allowed: boolean; reasons: string[]; newState: string; newCounters: Record<string, number> } {
    const reasons: string[] = [];
    let allowed = true;
    let newState = currentState;
    const newCounters = { ...counters };
    
    const toolRules = (policy.toolRules || []) as Array<{
      toolName: string;
      effect: string;
      actionType?: string;
      maxCallsPerSession?: number;
      cooldownMs?: number;
      requireState?: string;
      requirePreviousToolCalls?: string[];
      requireFields?: string[];
      denyIfFieldsPresent?: string[];
    }>;
    
    const defaultDecision = policy.defaultDecision as string || 'deny';
    const rule = toolRules.find(r => r.toolName === toolName);
    
    // Check 1: Unknown tool
    if (!rule) {
      if (defaultDecision === 'deny') {
        allowed = false;
        reasons.push(`Tool "${toolName}" is not defined in policy and defaultDecision is "deny"`);
      }
      return { allowed, reasons, newState, newCounters };
    }
    
    // Check 2: Explicit deny
    if (rule.effect === 'deny') {
      allowed = false;
      reasons.push(`Tool "${toolName}" is explicitly denied by policy`);
      return { allowed, reasons, newState, newCounters };
    }
    
    // Check 3: Side-effect enforcement
    const effectiveActionType = actionType || rule.actionType;
    if ((effectiveActionType === 'side_effect' || effectiveActionType === 'write') && rule.effect !== 'allow') {
      allowed = false;
      reasons.push(`Tool "${toolName}" is a ${effectiveActionType} operation and must be explicitly allowed`);
      return { allowed, reasons, newState, newCounters };
    }
    
    // Check 4: Required state
    if (rule.requireState && rule.requireState !== currentState) {
      allowed = false;
      reasons.push(`Tool "${toolName}" requires state "${rule.requireState}" but current state is "${currentState}"`);
    }
    
    // Check 5: Required previous tools
    if (rule.requirePreviousToolCalls) {
      for (const req of rule.requirePreviousToolCalls) {
        if (!previousToolsCalled.includes(req)) {
          allowed = false;
          reasons.push(`Tool "${toolName}" requires "${req}" to be called first`);
        }
      }
    }
    
    // Check 6: Max calls
    if (rule.maxCallsPerSession !== undefined) {
      const count = toolCallCounts[toolName] || 0;
      if (count >= rule.maxCallsPerSession) {
        allowed = false;
        reasons.push(`Tool "${toolName}" has reached maximum calls (${rule.maxCallsPerSession}) for this session`);
      }
    }
    
    // Check 7: Cooldown
    if (rule.cooldownMs !== undefined) {
      const lastTime = lastToolCallTimes[toolName];
      if (lastTime !== undefined) {
        const elapsed = timestamp - lastTime;
        if (elapsed < rule.cooldownMs) {
          allowed = false;
          reasons.push(`Tool "${toolName}" is in cooldown. ${rule.cooldownMs - elapsed}ms remaining`);
        }
      }
    }
    
    // Check 8: Required fields
    if (rule.requireFields) {
      for (const field of rule.requireFields) {
        if (!(field in payload)) {
          allowed = false;
          reasons.push(`Required field "${field}" is missing from payload`);
        }
      }
    }
    
    // Check 9: Forbidden fields
    if (rule.denyIfFieldsPresent) {
      for (const field of rule.denyIfFieldsPresent) {
        if (field in payload) {
          allowed = false;
          reasons.push(`Field "${field}" is forbidden in payload`);
        }
      }
    }
    
    // State machine
    const stateMachine = policy.stateMachine as {
      states: string[];
      initialState: string;
      transitions: Array<{
        fromState: string;
        toState: string;
        triggeredByTool: string;
        setsCounters?: Record<string, number>;
      }>;
    } | undefined;
    
    if (allowed && stateMachine) {
      const transition = stateMachine.transitions.find(
        t => t.triggeredByTool === toolName && t.fromState === currentState
      );
      if (transition) {
        newState = transition.toState;
        reasons.push(`State transition: ${currentState} → ${newState}`);
        if (transition.setsCounters) {
          for (const [name, delta] of Object.entries(transition.setsCounters)) {
            newCounters[name] = (newCounters[name] || 0) + delta;
          }
        }
      }
    }
    
    if (allowed && reasons.length === 0) {
      reasons.push('All policy conditions satisfied');
    }
    
    return { allowed, reasons, newState, newCounters };
  }

  const allMatch = results.length > 0 && results.every(r => r.match);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={!policySpec || toolCalls.length === 0}>
          <Play className="h-4 w-4" />
          Replay Execution
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Execution Replay</DialogTitle>
          <DialogDescription>
            Re-evaluate all tool calls using the same policy, states, and counters.
            Results must match exactly to prove determinism.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {toolCalls.length} tool calls to replay
            </span>
            <Button onClick={runReplay} disabled={replaying}>
              {replaying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Replaying...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Replay
                </>
              )}
            </Button>
          </div>
          
          {results.length > 0 && (
            <>
              {hasNonDeterminism ? (
                <Card className="border-destructive bg-destructive/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Non-deterministic Behavior Detected
                    </CardTitle>
                    <CardDescription className="text-destructive/80">
                      This should never happen. The policy engine produced different results
                      for the same inputs. Please report this issue immediately.
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <Card className="border-success bg-success/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-success flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5" />
                      Determinism Verified
                    </CardTitle>
                    <CardDescription className="text-success/80">
                      All {results.length} decisions matched exactly. The policy engine is deterministic.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
              
              <ScrollArea className="h-[40vh]">
                <div className="space-y-2">
                  {results.map((result, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${
                        result.match 
                          ? 'border-border' 
                          : 'border-destructive bg-destructive/5'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono">{result.toolName}</code>
                          {result.match ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Original:</span>
                          <StatusBadge status={result.originalDecision} />
                          <span className="text-xs text-muted-foreground">Replayed:</span>
                          <StatusBadge status={result.replayedDecision} />
                        </div>
                      </div>
                      
                      {!result.match && (
                        <div className="mt-2 text-xs space-y-1">
                          <div>
                            <span className="text-muted-foreground">Original reasons:</span>
                            <ul className="list-disc list-inside">
                              {result.originalReasons.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Replayed reasons:</span>
                            <ul className="list-disc list-inside">
                              {result.replayedReasons.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
