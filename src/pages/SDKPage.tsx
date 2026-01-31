import { useState } from 'react';
import { Copy, Check, Shield, Code2, AlertTriangle, CheckCircle2, XCircle, Terminal, Zap, Ban } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

// Error type definitions that SDK must implement
const errorTypes = `// Error Types - SDK must expose these for type safety

interface FirewallDecisionReason {
  code: string;          // e.g., "REQUIRED_TOOLS_NOT_CALLED"
  message: string;       // Human-readable: "verify_identity must be called first"
  ruleRef?: string;      // Optional reference to policy rule
}

interface ToolBlockedError extends Error {
  name: 'ToolBlockedError';
  toolName: string;
  errorCode: string;
  decisionReasons: FirewallDecisionReason[];
  policyVersion: number;
  currentState: string;
  
  // Serializable for logging/transmission
  toJSON(): {
    error: 'ToolBlockedError';
    toolName: string;
    errorCode: string;
    reasons: FirewallDecisionReason[];
    policyVersion: number;
    state: string;
  };
}

interface RateLimitError extends Error {
  name: 'RateLimitError';
  retryAfterMs: number;
}

interface FirewallUnavailableError extends Error {
  name: 'FirewallUnavailableError';
  // When firewall is down, execution is BLOCKED (fail-closed)
}`;

const typescriptSDK = `// Agent Firewall SDK - TypeScript

class ToolBlockedError extends Error {
  public readonly name = 'ToolBlockedError';
  
  constructor(
    public readonly toolName: string,
    public readonly errorCode: string,
    public readonly decisionReasons: Array<{ code: string; message: string }>,
    public readonly policyVersion: number,
    public readonly currentState: string
  ) {
    const mainReason = decisionReasons[0]?.message || errorCode;
    super(\`\${toolName} blocked: \${mainReason}\`);
  }
  
  toJSON() {
    return {
      error: 'ToolBlockedError',
      toolName: this.toolName,
      errorCode: this.errorCode,
      reasons: this.decisionReasons,
      policyVersion: this.policyVersion,
      state: this.currentState,
    };
  }
}

class AgentFirewall {
  constructor(private config: { apiKey: string; baseUrl: string }) {}

  async check(sessionId: string, agentId: string, toolName: string, payload: unknown) {
    const res = await fetch(\`\${this.config.baseUrl}/functions/v1/runtime-check\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
      },
      body: JSON.stringify({ sessionId, agentId, toolName, payload }),
    });
    
    if (!res.ok) {
      // Fail closed - if firewall unavailable, block execution
      throw new Error('Firewall unavailable - execution blocked');
    }
    
    return res.json();
  }

  guard<T, R>(
    sessionId: string,
    agentId: string,
    toolName: string,
    toolFn: (payload: T) => Promise<R>
  ): (payload: T) => Promise<R> {
    return async (payload: T) => {
      const result = await this.check(sessionId, agentId, toolName, payload);
      
      if (!result.allowed) {
        throw new ToolBlockedError(
          toolName,
          result.errorCode,
          result.decisionReasons,
          result.policyVersionUsed,
          result.stateAfter
        );
      }
      
      return toolFn(payload);
    };
  }
}

export { AgentFirewall, ToolBlockedError };`;

const pythonSDK = `# Agent Firewall SDK - Python
import httpx
from dataclasses import dataclass
from typing import List, Dict, Any, Callable, TypeVar

@dataclass
class DecisionReason:
    code: str
    message: str
    rule_ref: str | None = None

class ToolBlockedError(Exception):
    """Raised when firewall blocks a tool call."""
    def __init__(
        self,
        tool_name: str,
        error_code: str,
        reasons: List[DecisionReason],
        policy_version: int,
        current_state: str
    ):
        self.tool_name = tool_name
        self.error_code = error_code
        self.reasons = reasons
        self.policy_version = policy_version
        self.current_state = current_state
        main_reason = reasons[0].message if reasons else error_code
        super().__init__(f"{tool_name} blocked: {main_reason}")
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "error": "ToolBlockedError",
            "tool_name": self.tool_name,
            "error_code": self.error_code,
            "reasons": [{"code": r.code, "message": r.message} for r in self.reasons],
            "policy_version": self.policy_version,
            "state": self.current_state,
        }

class FirewallUnavailableError(Exception):
    """Firewall unavailable - execution blocked (fail-closed)."""
    pass

class AgentFirewall:
    def __init__(self, api_key: str, base_url: str):
        self.api_key = api_key
        self.base_url = base_url
    
    def check(self, session_id: str, agent_id: str, tool_name: str, payload: dict) -> dict:
        try:
            res = httpx.post(
                f"{self.base_url}/functions/v1/runtime-check",
                headers={"x-api-key": self.api_key, "Content-Type": "application/json"},
                json={"sessionId": session_id, "agentId": agent_id, "toolName": tool_name, "payload": payload},
                timeout=5.0
            )
            res.raise_for_status()
            return res.json()
        except httpx.RequestError:
            raise FirewallUnavailableError("Firewall unavailable - execution blocked")
    
    def guard(self, session_id: str, agent_id: str, tool_name: str):
        def decorator(func):
            def wrapper(**kwargs):
                result = self.check(session_id, agent_id, tool_name, kwargs)
                if not result["allowed"]:
                    reasons = [DecisionReason(**r) for r in result.get("decisionReasons", [])]
                    raise ToolBlockedError(
                        tool_name,
                        result.get("errorCode", "UNKNOWN"),
                        reasons,
                        result.get("policyVersionUsed", 0),
                        result.get("stateAfter", "unknown")
                    )
                return func(**kwargs)
            return wrapper
        return decorator`;

const bestPractice = `// BEST PRACTICE: How agents should handle blocks

async function runAgentTask(context: AgentContext) {
  const firewall = new AgentFirewall({
    apiKey: process.env.AGENT_FIREWALL_API_KEY,
    baseUrl: process.env.FIREWALL_URL,
  });
  
  const safeRefund = firewall.guard(
    context.sessionId,
    context.agentId,
    'refund_payment',
    processRefund
  );
  
  try {
    // Attempt the refund
    await safeRefund({ orderId: context.orderId, amount: context.amount });
    
  } catch (error) {
    if (error instanceof ToolBlockedError) {
      // ✅ DO: Log the decision for debugging
      console.log('Tool blocked:', error.toJSON());
      
      // ✅ DO: React based on the error code
      switch (error.errorCode) {
        case 'REQUIRED_TOOLS_NOT_CALLED':
          // Agent understands it needs to verify first
          await verifyIdentity(context);
          // Then proceed with proper flow
          break;
          
        case 'MAX_CALLS_EXCEEDED':
          // Escalate to human - limit reached
          await escalateToHuman(context, 'Refund limit reached');
          break;
          
        case 'REQUIRED_STATE_NOT_MET':
          // Wrong state - explain to user
          await notifyUser('Please complete verification first');
          break;
          
        default:
          // Unknown block - escalate
          await escalateToHuman(context, error.message);
      }
      
      // ❌ DON'T: Auto-retry the same call
      // ❌ DON'T: Modify payload to bypass checks
      // ❌ DON'T: Ignore the block and proceed anyway
      
      return;
    }
    
    // Non-firewall errors
    throw error;
  }
}`;

function CodeBlock({ code, language = 'typescript' }: { code: string; language?: string }) {
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

export default function SDKPage() {
  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-8 max-w-5xl">
        <PageHeader
          title="SDK & Integration"
          description="Type-safe, fail-closed SDKs for deterministic policy enforcement."
        />

        {/* SDK Contract - Critical */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              SDK Contract
            </CardTitle>
            <CardDescription>
              These rules are non-negotiable. SDKs that violate them break the security model.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                <span>SDK <strong>MUST</strong> call /runtime-check before every tool execution</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                <span>SDK <strong>MUST</strong> block locally if <code className="bg-muted px-1 rounded text-xs">allowed=false</code></span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                <span>SDK <strong>MUST</strong> surface <code className="bg-muted px-1 rounded text-xs">decisionReasons</code> to agent code</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                <span>SDK <strong>MUST</strong> fail closed if firewall is unavailable</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <span>SDK <strong>MUST NOT</strong> auto-retry blocked calls</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <span>SDK <strong>MUST NOT</strong> modify payload to bypass checks</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Error Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Error Types
            </CardTitle>
            <CardDescription>
              All errors are typed, deterministic, and serializable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock code={errorTypes} />
            
            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Ban className="h-4 w-4 text-destructive" />
                  ToolBlockedError
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Policy blocked execution. Contains all context needed for agent to react.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  FirewallUnavailableError
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Firewall down. Execution blocked (fail-closed). Never allow execution on uncertainty.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SDK Implementations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code2 className="h-5 w-5" />
              SDK Implementation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="typescript">
              <TabsList className="mb-4">
                <TabsTrigger value="typescript">TypeScript</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
              </TabsList>
              <TabsContent value="typescript">
                <CodeBlock code={typescriptSDK} />
              </TabsContent>
              <TabsContent value="python">
                <CodeBlock code={pythonSDK} language="python" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Best Practice */}
        <Card className="border-success/30 bg-success/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-success" />
              Best Practice: Handling Blocks
            </CardTitle>
            <CardDescription>
              How agents should react to blocked tool calls.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock code={bestPractice} />
            
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Key Patterns</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• <strong>Log the decision</strong> - error.toJSON() gives all context</li>
                <li>• <strong>Switch on errorCode</strong> - take appropriate action per error type</li>
                <li>• <strong>Escalate when needed</strong> - some blocks require human intervention</li>
                <li>• <strong>Never auto-retry</strong> - the block is intentional, not transient</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Error Codes Reference */}
        <Card>
          <CardHeader>
            <CardTitle>Error Codes Reference</CardTitle>
            <CardDescription>
              Every block includes a stable, documented error code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                <code className="text-xs font-mono text-primary">REQUIRED_TOOLS_NOT_CALLED</code>
              </div>
              <div className="p-2 text-muted-foreground text-xs">
                A prerequisite tool was not called earlier in this session
              </div>
              
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                <code className="text-xs font-mono text-primary">REQUIRED_STATE_NOT_MET</code>
              </div>
              <div className="p-2 text-muted-foreground text-xs">
                Session is not in the required state for this tool
              </div>
              
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                <code className="text-xs font-mono text-primary">MAX_CALLS_EXCEEDED</code>
              </div>
              <div className="p-2 text-muted-foreground text-xs">
                Tool has reached maximum calls allowed per session
              </div>
              
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                <code className="text-xs font-mono text-primary">COOLDOWN_ACTIVE</code>
              </div>
              <div className="p-2 text-muted-foreground text-xs">
                Must wait before calling this tool again
              </div>
              
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                <code className="text-xs font-mono text-primary">TOOL_EXPLICITLY_DENIED</code>
              </div>
              <div className="p-2 text-muted-foreground text-xs">
                Policy has an explicit deny rule for this tool
              </div>
              
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                <code className="text-xs font-mono text-primary">UNKNOWN_TOOL_DENIED</code>
              </div>
              <div className="p-2 text-muted-foreground text-xs">
                Tool not in policy and defaultDecision is deny
              </div>
              
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                <code className="text-xs font-mono text-primary">REQUIRED_FIELD_MISSING</code>
              </div>
              <div className="p-2 text-muted-foreground text-xs">
                Payload missing a required field
              </div>
              
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                <code className="text-xs font-mono text-primary">INTERNAL_ERROR</code>
              </div>
              <div className="p-2 text-muted-foreground text-xs">
                System error - fail closed, execution blocked
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Reference */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              API Reference
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">POST /functions/v1/runtime-check</h4>
              <div className="space-y-3">
                <div>
                  <h5 className="text-xs font-medium text-muted-foreground mb-1">Headers</h5>
                  <pre className="bg-muted rounded p-2 text-xs">
{`x-api-key: af_xxxxxxxxxxxx
Content-Type: application/json`}
                  </pre>
                </div>
                <div>
                  <h5 className="text-xs font-medium text-muted-foreground mb-1">Request Body</h5>
                  <pre className="bg-muted rounded p-2 text-xs">
{`{
  "sessionId": "session-123",
  "agentId": "agent-1",
  "toolName": "refund_payment",
  "payload": { "orderId": "ord_123", "amount": 5000 }
}`}
                  </pre>
                </div>
                <div>
                  <h5 className="text-xs font-medium text-muted-foreground mb-1">Response (Allowed)</h5>
                  <pre className="bg-success/10 rounded p-2 text-xs border border-success/20">
{`{
  "allowed": true,
  "policyVersionUsed": 3,
  "stateBefore": "verified",
  "stateAfter": "refund_issued",
  "decisionReasons": []
}`}
                  </pre>
                </div>
                <div>
                  <h5 className="text-xs font-medium text-muted-foreground mb-1">Response (Blocked)</h5>
                  <pre className="bg-destructive/10 rounded p-2 text-xs border border-destructive/20">
{`{
  "allowed": false,
  "errorCode": "REQUIRED_TOOLS_NOT_CALLED",
  "policyVersionUsed": 3,
  "stateBefore": "initial",
  "stateAfter": "initial",
  "decisionReasons": [
    {
      "code": "REQUIRED_TOOLS_NOT_CALLED",
      "message": "refund_payment requires verify_identity to be called first"
    }
  ]
}`}
                  </pre>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
