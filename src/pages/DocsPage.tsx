import { useState } from 'react';
import { Copy, Check, Shield, ArrowRight, AlertTriangle, Book, Zap, Terminal, HelpCircle, FileCode2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      </Button>
      <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const refundSafetyExample = `{
  "version": "1.0",
  "defaultDecision": "deny",
  "toolRules": [
    { "toolName": "get_order_details", "effect": "allow", "actionType": "read" },
    { "toolName": "verify_identity", "effect": "allow", "actionType": "write" },
    {
      "toolName": "refund_payment",
      "effect": "allow",
      "actionType": "side_effect",
      "requireState": "verified",
      "requirePreviousToolCalls": ["verify_identity"],
      "requireFields": ["orderId", "amount"],
      "maxCallsPerSession": 1
    }
  ],
  "stateMachine": {
    "states": ["initial", "verified", "refund_issued"],
    "initialState": "initial",
    "transitions": [
      { "fromState": "initial", "toState": "verified", "triggeredByTool": "verify_identity" },
      { "fromState": "verified", "toState": "refund_issued", "triggeredByTool": "refund_payment" }
    ]
  },
  "counters": [
    { "name": "refund_count", "scope": "session", "initialValue": 0, "maxValue": 1 }
  ]
}`;

const paymentProtectionExample = `{
  "version": "1.0",
  "defaultDecision": "deny",
  "toolRules": [
    { "toolName": "get_cart", "effect": "allow", "actionType": "read" },
    { "toolName": "confirm_payment_intent", "effect": "allow", "actionType": "write" },
    {
      "toolName": "charge_customer",
      "effect": "allow",
      "actionType": "side_effect",
      "requireState": "payment_approved",
      "requirePreviousToolCalls": ["confirm_payment_intent"],
      "requireFields": ["customerId", "amount", "paymentMethodId"],
      "maxCallsPerSession": 1
    }
  ],
  "stateMachine": {
    "states": ["initial", "payment_approved", "payment_executed"],
    "initialState": "initial",
    "transitions": [
      { "fromState": "initial", "toState": "payment_approved", "triggeredByTool": "confirm_payment_intent" },
      { "fromState": "payment_approved", "toState": "payment_executed", "triggeredByTool": "charge_customer" }
    ]
  }
}`;

export default function DocsPage() {
  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-8 max-w-5xl">
        <PageHeader
          title="Documentation"
          description="Everything you need to understand, configure, and integrate Agent Firewall."
        />

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="overview">What It Does</TabsTrigger>
            <TabsTrigger value="setup">10-Minute Setup</TabsTrigger>
            <TabsTrigger value="reference">PolicySpec v1</TabsTrigger>
            <TabsTrigger value="troubleshooting">Troubleshooting</TabsTrigger>
          </TabsList>

          {/* PAGE 1: What Agent Firewall Does */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  What Agent Firewall Does
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Diagram */}
                <div className="flex items-center justify-center gap-6 py-8 bg-muted/30 rounded-lg">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center">
                      <Terminal className="h-7 w-7 text-primary" />
                    </div>
                    <span className="text-sm font-medium">AI Agent</span>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-xl bg-primary/10 border-2 border-primary flex items-center justify-center">
                      <Shield className="h-7 w-7 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-primary">Firewall</span>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center">
                      <Zap className="h-7 w-7 text-success" />
                    </div>
                    <span className="text-sm font-medium">Payment Tool</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Deterministic Policy Enforcement</h3>
                  <p className="text-sm text-muted-foreground">
                    Agent Firewall evaluates every tool call against a policy before execution. 
                    There is no AI, no heuristics, no randomness. The same inputs always produce the same decision.
                  </p>
                  <p className="text-sm font-medium">
                    We block irreversible actions before they happen.
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold">How It Works</h3>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>Your agent wraps tool functions with the SDK</li>
                    <li>Before each tool call, the SDK sends a check to the firewall</li>
                    <li>The firewall evaluates the call against your policy (state, prerequisites, limits)</li>
                    <li>If allowed, the tool executes. If blocked, a typed error is returned with the reason</li>
                    <li>Every decision is logged with full context for audit</li>
                  </ol>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold">Key Guarantees</h3>
                  <ul className="text-sm space-y-2">
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                      <span><strong>Deterministic</strong> — Same inputs always produce same decisions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                      <span><strong>Fail-closed</strong> — If the system is uncertain, execution is blocked</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                      <span><strong>Auditable</strong> — Every decision logged with policy version, state, and reasons</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                      <span><strong>Replayable</strong> — Re-evaluate past decisions to verify determinism</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PAGE 2: 10-Minute Setup */}
          <TabsContent value="setup" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>10-Minute Setup</CardTitle>
                <CardDescription>From zero to a working firewall in 5 steps.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Step 1 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">1</div>
                    <h3 className="font-semibold">Create a Project & Environment</h3>
                  </div>
                  <p className="text-sm text-muted-foreground ml-11">
                    Go to <strong>Projects → New Project</strong>. This auto-creates development, staging, and production environments.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">2</div>
                    <h3 className="font-semibold">Create an API Key</h3>
                  </div>
                  <p className="text-sm text-muted-foreground ml-11">
                    Go to <strong>Environments</strong>, select your environment, click <strong>Create Key</strong>. 
                    Copy the key immediately — it's shown only once.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">3</div>
                    <h3 className="font-semibold">Create & Publish a Policy</h3>
                  </div>
                  <p className="text-sm text-muted-foreground ml-11">
                    Go to <strong>Policies → New Policy</strong>. Choose the "Refund Safety" template. 
                    Review the rules, then click <strong>Publish</strong>.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">4</div>
                    <h3 className="font-semibold">Install the SDK</h3>
                  </div>
                  <div className="ml-11">
                    <CodeBlock code={`npm install @agent-firewall/sdk`} />
                  </div>
                </div>

                {/* Step 5 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">5</div>
                    <h3 className="font-semibold">Wrap Your Tools</h3>
                  </div>
                  <div className="ml-11">
                    <CodeBlock code={`import { AgentFirewall, ToolBlockedError } from '@agent-firewall/sdk';

const firewall = new AgentFirewall({
  apiKey: process.env.AGENT_FIREWALL_API_KEY,
  baseUrl: 'https://your-project.supabase.co',
});

const safeRefund = firewall.guard('session-1', 'agent-1', 'refund_payment',
  async (payload) => await stripe.refunds.create(payload)
);

try {
  await safeRefund({ orderId: 'ord_123', amount: 8999 });
} catch (error) {
  if (error instanceof ToolBlockedError) {
    console.log('Blocked:', error.errorCode, error.decisionReasons);
  }
}`} />
                  </div>
                </div>

                <div className="bg-success/10 border border-success/20 rounded-lg p-4 ml-11">
                  <p className="text-sm text-success font-medium">
                    ✓ You're done. Every refund call now goes through the firewall.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PAGE 3: PolicySpec v1 Reference */}
          <TabsContent value="reference" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCode2 className="h-5 w-5" />
                  PolicySpec v1 Reference
                </CardTitle>
                <CardDescription>
                  Complete schema reference for policy definitions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Schema overview */}
                <div className="space-y-3">
                  <h3 className="font-semibold">Top-Level Fields</h3>
                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-3 gap-2 p-2 bg-muted/50 rounded font-medium text-xs">
                      <span>Field</span><span>Type</span><span>Description</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 p-2 text-muted-foreground">
                      <code className="text-xs">version</code><span className="text-xs">string</span><span className="text-xs">Always "1.0"</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 p-2 bg-muted/30 text-muted-foreground">
                      <code className="text-xs">defaultDecision</code><span className="text-xs">"allow" | "deny"</span><span className="text-xs">Decision for unknown tools. Use "deny" for safety.</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 p-2 text-muted-foreground">
                      <code className="text-xs">toolRules</code><span className="text-xs">ToolRule[]</span><span className="text-xs">Per-tool enforcement rules</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 p-2 bg-muted/30 text-muted-foreground">
                      <code className="text-xs">stateMachine</code><span className="text-xs">StateMachine?</span><span className="text-xs">Optional FSM for workflow enforcement</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 p-2 text-muted-foreground">
                      <code className="text-xs">counters</code><span className="text-xs">CounterDef[]?</span><span className="text-xs">Session-scoped safety budgets</span>
                    </div>
                  </div>
                </div>

                {/* Tool Rules */}
                <div className="space-y-3">
                  <h3 className="font-semibold">Tool Rules</h3>
                  <p className="text-sm text-muted-foreground">Each rule defines constraints for a specific tool.</p>
                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-3 gap-2 p-2 bg-muted/50 rounded font-medium text-xs">
                      <span>Field</span><span>Type</span><span>Description</span>
                    </div>
                    {[
                      ['toolName', 'string', 'Name of the tool (e.g., "refund_payment")'],
                      ['effect', '"allow" | "deny"', 'Whether to allow or deny this tool'],
                      ['actionType', '"read" | "write" | "side_effect"', 'Classifies the operation. side_effect requires explicit allow.'],
                      ['maxCallsPerSession', 'number?', 'Max times this tool can be called per session'],
                      ['cooldownMs', 'number?', 'Minimum ms between calls'],
                      ['requireState', 'string?', 'Session must be in this state'],
                      ['requirePreviousToolCalls', 'string[]?', 'These tools must have been called earlier in session'],
                      ['requireFields', 'string[]?', 'Payload must contain these fields'],
                      ['denyIfFieldsPresent', 'string[]?', 'Block if payload contains these fields'],
                    ].map(([field, type, desc], i) => (
                      <div key={field} className={`grid grid-cols-3 gap-2 p-2 text-muted-foreground ${i % 2 === 0 ? 'bg-muted/30' : ''}`}>
                        <code className="text-xs">{field}</code>
                        <span className="text-xs">{type}</span>
                        <span className="text-xs">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* State Machine */}
                <div className="space-y-3">
                  <h3 className="font-semibold">State Machine (FSM)</h3>
                  <p className="text-sm text-muted-foreground">
                    Defines workflow states and transitions triggered by tool calls. 
                    States enforce ordering — an agent cannot skip steps.
                  </p>
                  <div className="space-y-2 text-sm">
                    {[
                      ['states', 'string[]', 'All valid states (e.g., ["initial", "verified", "refund_issued"])'],
                      ['initialState', 'string', 'Starting state for new sessions'],
                      ['transitions[].fromState', 'string', 'State the session must be in'],
                      ['transitions[].toState', 'string', 'State after the tool call succeeds'],
                      ['transitions[].triggeredByTool', 'string', 'Which tool triggers this transition'],
                      ['transitions[].guard', 'string?', 'Counter condition (e.g., "refund_count <= 1")'],
                      ['transitions[].setsCounters', 'Record?', 'Counter deltas to apply on transition'],
                    ].map(([field, type, desc], i) => (
                      <div key={field} className={`grid grid-cols-3 gap-2 p-2 text-muted-foreground ${i % 2 === 0 ? 'bg-muted/30' : ''}`}>
                        <code className="text-xs">{field}</code>
                        <span className="text-xs">{type}</span>
                        <span className="text-xs">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Counters */}
                <div className="space-y-3">
                  <h3 className="font-semibold">Counters</h3>
                  <p className="text-sm text-muted-foreground">
                    Session-scoped counters for safety budgets. Use with guard conditions on transitions.
                  </p>
                  <div className="space-y-2 text-sm">
                    {[
                      ['name', 'string', 'Counter identifier'],
                      ['scope', '"session"', 'Always "session" in v1'],
                      ['initialValue', 'number', 'Starting value (usually 0)'],
                      ['maxValue', 'number?', 'If exceeded, blocks the transition'],
                    ].map(([field, type, desc], i) => (
                      <div key={field} className={`grid grid-cols-3 gap-2 p-2 text-muted-foreground ${i % 2 === 0 ? 'bg-muted/30' : ''}`}>
                        <code className="text-xs">{field}</code>
                        <span className="text-xs">{type}</span>
                        <span className="text-xs">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Example Policies */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Example: Refund Safety</h3>
                  <CodeBlock code={refundSafetyExample} />
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Example: Payment Protection</h3>
                  <CodeBlock code={paymentProtectionExample} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PAGE 4: Troubleshooting */}
          <TabsContent value="troubleshooting" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  Troubleshooting
                </CardTitle>
                <CardDescription>
                  Common issues and how to resolve them.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {[
                  {
                    q: '"Why is my tool blocked?"',
                    code: 'UNKNOWN_TOOL_DENIED',
                    a: 'Your policy has defaultDecision: "deny" and the tool is not listed in toolRules. Add a rule for the tool with effect: "allow".',
                  },
                  {
                    q: '"No valid state transition"',
                    code: 'REQUIRED_STATE_NOT_MET',
                    a: 'The tool requires the session to be in a specific state, but the session is in a different state. Check your stateMachine transitions — you may need to call a prerequisite tool first to move into the correct state.',
                  },
                  {
                    q: '"verify_identity must be called first"',
                    code: 'REQUIRED_TOOLS_NOT_CALLED',
                    a: 'The tool has requirePreviousToolCalls set. The prerequisite tool must be called (and allowed) earlier in the same session. Call it first, then retry.',
                  },
                  {
                    q: '"Max calls exceeded"',
                    code: 'MAX_CALLS_EXCEEDED',
                    a: 'The tool has maxCallsPerSession set and the limit has been reached. This prevents double-refunds and duplicate charges. Start a new session if the action is legitimate.',
                  },
                  {
                    q: '"Policy engine failure (fail closed)"',
                    code: 'INTERNAL_ERROR',
                    a: 'The firewall encountered an internal error and blocked execution as a safety measure. This is by design — we never allow execution when uncertain. Check that your API key is valid and your environment has a published policy.',
                  },
                  {
                    q: '"Missing required field"',
                    code: 'REQUIRED_FIELD_MISSING',
                    a: 'Your payload is missing a field specified in requireFields. Add the missing field to your tool call payload.',
                  },
                  {
                    q: '"Rate limit exceeded"',
                    code: 'RATE_LIMITED',
                    a: 'Your API key has exceeded the request rate limit (1000 requests/minute). Wait and retry, or contact support if you need a higher limit.',
                  },
                  {
                    q: '"API key revoked"',
                    code: 'API_KEY_REVOKED',
                    a: 'This API key has been revoked. Create a new API key in the Environments page and update your agent configuration.',
                  },
                ].map((item) => (
                  <div key={item.code} className="space-y-2 p-4 rounded-lg border border-border">
                    <div className="flex items-start justify-between gap-4">
                      <h4 className="font-medium text-sm">{item.q}</h4>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded text-primary flex-shrink-0">{item.code}</code>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.a}</p>
                  </div>
                ))}

                <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-warning">Still stuck?</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Check the <strong>Execution Log</strong> for the specific session. Every decision includes the full reason chain, 
                        state before/after, and policy version used. Use <strong>Replay</strong> to re-evaluate and verify determinism.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
