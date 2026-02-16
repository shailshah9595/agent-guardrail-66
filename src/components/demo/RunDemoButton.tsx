import { useState } from 'react';
import { Play, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { simulateToolCall } from '@/lib/policy-engine/evaluator';
import { PolicySpec } from '@/lib/policy-engine/types';

const DEMO_POLICY: PolicySpec = {
  version: '1.0',
  defaultDecision: 'deny',
  toolRules: [
    { toolName: 'verify_identity', effect: 'allow', actionType: 'write' },
    {
      toolName: 'refund_payment',
      effect: 'allow',
      actionType: 'side_effect',
      requireState: 'verified',
      requirePreviousToolCalls: ['verify_identity'],
      requireFields: ['orderId', 'amount'],
      maxCallsPerSession: 1,
    },
    { toolName: 'send_email', effect: 'allow', actionType: 'side_effect', maxCallsPerSession: 1 },
    { toolName: 'delete_database', effect: 'deny', actionType: 'side_effect' },
  ],
  stateMachine: {
    states: ['initial', 'verified', 'refund_issued'],
    initialState: 'initial',
    transitions: [
      { fromState: 'initial', toState: 'verified', triggeredByTool: 'verify_identity' },
      { fromState: 'verified', toState: 'refund_issued', triggeredByTool: 'refund_payment' },
    ],
  },
  counters: [{ name: 'refund_count', scope: 'session', initialValue: 0, maxValue: 1 }],
};

interface DemoStep {
  toolName: string;
  actionType: 'read' | 'write' | 'side_effect';
  payload: Record<string, unknown>;
  narrative: string;
}

const DEMO_STEPS: DemoStep[] = [
  {
    toolName: 'verify_identity',
    actionType: 'write',
    payload: { customerId: 'cust_123', method: 'phone' },
    narrative: 'Agent verifies customer identity via phone',
  },
  {
    toolName: 'refund_payment',
    actionType: 'side_effect',
    payload: { orderId: 'ord_12847', amount: 8999 },
    narrative: 'Agent processes $89.99 refund after verification',
  },
  {
    toolName: 'send_email',
    actionType: 'side_effect',
    payload: { to: 'customer@example.com', subject: 'Refund Confirmation' },
    narrative: 'Agent sends refund confirmation email',
  },
  {
    toolName: 'delete_database',
    actionType: 'side_effect',
    payload: { table: 'customers' },
    narrative: 'Agent attempts to delete customer database',
  },
];

interface DemoResult {
  toolName: string;
  narrative: string;
  allowed: boolean;
  errorCode?: string;
  reasons: string[];
  stateBefore: string;
  stateAfter: string;
}

export function RunDemoButton() {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<DemoResult[]>([]);
  const [currentStep, setCurrentStep] = useState(-1);

  async function runDemo() {
    setRunning(true);
    setResults([]);
    setCurrentStep(0);

    let currentState = 'initial';
    const previousToolsCalled: string[] = [];
    let counters: Record<string, number> = {};
    let toolCallCounts: Record<string, number> = {};
    const lastToolCallTimes: Record<string, number> = {};
    const newResults: DemoResult[] = [];

    for (let i = 0; i < DEMO_STEPS.length; i++) {
      setCurrentStep(i);
      await new Promise(r => setTimeout(r, 800)); // Simulate latency

      const step = DEMO_STEPS[i];
      const result = simulateToolCall({
        policy: DEMO_POLICY,
        toolName: step.toolName,
        actionType: step.actionType,
        payload: step.payload,
        currentState,
        previousToolsCalled: [...previousToolsCalled],
        counters: { ...counters },
        toolCallCounts: { ...toolCallCounts },
        lastToolCallTimes: { ...lastToolCallTimes },
        timestamp: Date.now(),
      });

      const demoResult: DemoResult = {
        toolName: step.toolName,
        narrative: step.narrative,
        allowed: result.allowed,
        errorCode: result.errorCode,
        reasons: result.reasons.map(r => r.message),
        stateBefore: currentState,
        stateAfter: result.newState,
      };

      newResults.push(demoResult);
      setResults([...newResults]);

      if (result.allowed) {
        currentState = result.newState;
        previousToolsCalled.push(step.toolName);
        counters = result.newCounters;
        toolCallCounts = result.newToolCallCounts;
      }
    }

    setCurrentStep(-1);
    setRunning(false);
  }

  const allowedCount = results.filter(r => r.allowed).length;
  const blockedCount = results.filter(r => !r.allowed).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Play className="h-4 w-4" />
          Run Full Demo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Full Demo: Refund Protection</DialogTitle>
          <DialogDescription>
            Simulates 4 tool calls against the Refund Safety policy. 
            No external calls — everything runs locally against the policy engine.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {results.length === 0
                ? '4 tool calls to simulate'
                : `${allowedCount} allowed, ${blockedCount} blocked`}
            </span>
            <Button onClick={runDemo} disabled={running}>
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  {results.length > 0 ? 'Run Again' : 'Run Demo'}
                </>
              )}
            </Button>
          </div>

          <ScrollArea className="h-[50vh]">
            <div className="space-y-3">
              {DEMO_STEPS.map((step, i) => {
                const result = results[i];
                const isActive = currentStep === i;

                return (
                  <div
                    key={i}
                    className={`p-4 rounded-lg border transition-all ${
                      !result
                        ? isActive
                          ? 'border-primary bg-primary/5 animate-pulse'
                          : 'border-border/50 opacity-40'
                        : result.allowed
                          ? 'border-success/30 bg-success/5'
                          : 'border-destructive/30 bg-destructive/5'
                    }`}
                  >
                    <p className="text-sm text-muted-foreground italic mb-2">
                      "{step.narrative}"
                    </p>
                    <div className="flex items-center gap-3 mb-2">
                      {result ? (
                        result.allowed ? (
                          <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                        )
                      ) : isActive ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-border flex-shrink-0" />
                      )}
                      <code className="font-mono text-sm font-medium">{step.toolName}</code>
                      {result && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          result.allowed ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                        }`}>
                          {result.allowed ? 'ALLOWED' : 'BLOCKED'}
                        </span>
                      )}
                    </div>

                    {result && (
                      <div className="space-y-1 ml-7">
                        {result.reasons.map((reason, j) => (
                          <p key={j} className="text-xs text-muted-foreground">• {reason}</p>
                        ))}
                        {result.stateBefore !== result.stateAfter && (
                          <p className="text-xs">
                            <span className="text-muted-foreground">State:</span>{' '}
                            <code className="bg-muted px-1 rounded">{result.stateBefore}</code>
                            <ArrowRight className="inline h-3 w-3 mx-1 text-muted-foreground" />
                            <code className="bg-primary/10 text-primary px-1 rounded">{result.stateAfter}</code>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {results.length === DEMO_STEPS.length && !running && (
            <div className="bg-success/10 border border-success/20 rounded-lg p-4 text-center">
              <p className="text-sm text-success font-medium">
                ✓ Demo complete: {allowedCount} actions allowed, {blockedCount} actions blocked. 
                The policy engine is deterministic — run again to verify identical results.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
