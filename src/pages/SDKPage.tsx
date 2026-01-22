import { useState } from 'react';
import { Copy, Check, Shield, Terminal, Code2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

const typescriptSDK = `// agent-firewall-sdk.ts
import type { RuntimeCheckResponse } from './types';

interface FirewallConfig {
  apiKey: string;
  baseUrl: string;
  sessionId: string;
  agentId: string;
}

interface ToolCallOptions {
  toolName: string;
  actionType?: 'read' | 'write' | 'side_effect';
  payload: Record<string, unknown>;
}

class AgentFirewall {
  private config: FirewallConfig;

  constructor(config: FirewallConfig) {
    this.config = config;
  }

  /**
   * Check if a tool call is allowed before execution.
   * MUST be called before every tool invocation.
   */
  async check(options: ToolCallOptions): Promise<RuntimeCheckResponse> {
    const response = await fetch(\`\${this.config.baseUrl}/runtime-check\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
      },
      body: JSON.stringify({
        sessionId: this.config.sessionId,
        agentId: this.config.agentId,
        toolName: options.toolName,
        actionType: options.actionType,
        payload: options.payload,
      }),
    });

    if (!response.ok) {
      throw new Error(\`Firewall check failed: \${response.status}\`);
    }

    return response.json();
  }

  /**
   * Wrap a tool function with firewall protection.
   * Blocks execution if policy denies the call.
   */
  guard<T extends (...args: any[]) => any>(
    toolFn: T,
    toolName: string,
    actionType: 'read' | 'write' | 'side_effect' = 'side_effect'
  ): (...args: Parameters<T>) => Promise<ReturnType<T>> {
    return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      const payload = args[0] ?? {};
      
      const result = await this.check({
        toolName,
        actionType,
        payload: typeof payload === 'object' ? payload : { value: payload },
      });

      if (!result.allowed) {
        const reasons = result.decisionReasons
          .map(r => r.message)
          .join('; ');
        throw new FirewallBlockedError(
          \`Tool "\${toolName}" blocked: \${reasons}\`,
          result
        );
      }

      return toolFn(...args);
    };
  }
}

class FirewallBlockedError extends Error {
  public readonly result: RuntimeCheckResponse;
  
  constructor(message: string, result: RuntimeCheckResponse) {
    super(message);
    this.name = 'FirewallBlockedError';
    this.result = result;
  }
}

// ============================================
// USAGE EXAMPLE
// ============================================

const firewall = new AgentFirewall({
  apiKey: 'af_live_xxxxxxxxxxxxxxxx',
  baseUrl: 'https://brfwztzlfydzcgydnvlu.supabase.co/functions/v1',
  sessionId: crypto.randomUUID(),
  agentId: 'my-agent-v1',
});

// Your original tools
async function refundPayment(params: { amount: number; userId: string }) {
  // ... actual refund logic
  console.log(\`Refunding $\${params.amount} to \${params.userId}\`);
}

async function verifyIdentity(params: { userId: string }) {
  // ... actual verification logic
  console.log(\`Verifying identity for \${params.userId}\`);
}

// Wrap tools with firewall protection
const protectedRefund = firewall.guard(refundPayment, 'refund_payment', 'side_effect');
const protectedVerify = firewall.guard(verifyIdentity, 'verify_identity', 'side_effect');

// Agent execution
async function runAgent() {
  try {
    // This will be BLOCKED - refund requires verify_identity first
    await protectedRefund({ amount: 100, userId: 'user_123' });
  } catch (error) {
    if (error instanceof FirewallBlockedError) {
      console.log('Blocked:', error.message);
      console.log('Error code:', error.result.errorCode);
      // Output: Blocked: Tool "refund_payment" blocked: Tool "refund_payment" requires "verify_identity" to be called first
    }
  }

  // Now verify first
  await protectedVerify({ userId: 'user_123' });
  
  // This will be ALLOWED - verification done
  await protectedRefund({ amount: 100, userId: 'user_123' });
}

runAgent();`;

const pythonSDK = `# agent_firewall_sdk.py
import httpx
import uuid
from dataclasses import dataclass
from typing import Any, Callable, TypeVar, ParamSpec
from functools import wraps

P = ParamSpec('P')
R = TypeVar('R')

@dataclass
class DecisionReason:
    code: str
    message: str
    rule_ref: str | None = None

@dataclass
class RuntimeCheckResponse:
    allowed: bool
    error_code: str | None
    decision_reasons: list[DecisionReason]
    policy_version_used: int
    state_before: str
    state_after: str
    counters: dict[str, int]

class FirewallBlockedError(Exception):
    def __init__(self, message: str, result: RuntimeCheckResponse):
        super().__init__(message)
        self.result = result

class AgentFirewall:
    def __init__(
        self,
        api_key: str,
        base_url: str,
        session_id: str | None = None,
        agent_id: str = "default-agent"
    ):
        self.api_key = api_key
        self.base_url = base_url
        self.session_id = session_id or str(uuid.uuid4())
        self.agent_id = agent_id
        self.client = httpx.Client(timeout=10.0)

    def check(
        self,
        tool_name: str,
        payload: dict[str, Any],
        action_type: str = "side_effect"
    ) -> RuntimeCheckResponse:
        """
        Check if a tool call is allowed before execution.
        MUST be called before every tool invocation.
        """
        response = self.client.post(
            f"{self.base_url}/runtime-check",
            headers={
                "Content-Type": "application/json",
                "x-api-key": self.api_key,
            },
            json={
                "sessionId": self.session_id,
                "agentId": self.agent_id,
                "toolName": tool_name,
                "actionType": action_type,
                "payload": payload,
            },
        )
        response.raise_for_status()
        data = response.json()
        
        return RuntimeCheckResponse(
            allowed=data["allowed"],
            error_code=data.get("errorCode"),
            decision_reasons=[
                DecisionReason(
                    code=r.get("code", ""),
                    message=r.get("message", ""),
                    rule_ref=r.get("ruleRef")
                )
                for r in data.get("decisionReasons", [])
            ],
            policy_version_used=data["policyVersionUsed"],
            state_before=data["stateBefore"],
            state_after=data["stateAfter"],
            counters=data.get("counters", {}),
        )

    def guard(
        self,
        tool_name: str,
        action_type: str = "side_effect"
    ) -> Callable[[Callable[P, R]], Callable[P, R]]:
        """
        Decorator to wrap a tool function with firewall protection.
        Blocks execution if policy denies the call.
        """
        def decorator(func: Callable[P, R]) -> Callable[P, R]:
            @wraps(func)
            def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
                # Build payload from kwargs or first positional arg
                if kwargs:
                    payload = dict(kwargs)
                elif args and isinstance(args[0], dict):
                    payload = args[0]
                else:
                    payload = {"args": args}

                result = self.check(tool_name, payload, action_type)

                if not result.allowed:
                    reasons = "; ".join(r.message for r in result.decision_reasons)
                    raise FirewallBlockedError(
                        f'Tool "{tool_name}" blocked: {reasons}',
                        result
                    )

                return func(*args, **kwargs)
            return wrapper
        return decorator


# ============================================
# USAGE EXAMPLE
# ============================================

firewall = AgentFirewall(
    api_key="af_live_xxxxxxxxxxxxxxxx",
    base_url="https://brfwztzlfydzcgydnvlu.supabase.co/functions/v1",
    agent_id="my-agent-v1",
)

@firewall.guard("verify_identity", "side_effect")
def verify_identity(user_id: str) -> bool:
    """Verify user identity before sensitive operations."""
    print(f"Verifying identity for {user_id}")
    return True

@firewall.guard("refund_payment", "side_effect")
def refund_payment(amount: float, user_id: str) -> dict:
    """Process a refund - requires prior verification."""
    print(f"Refunding \${amount} to {user_id}")
    return {"status": "success", "amount": amount}


def run_agent():
    try:
        # This will be BLOCKED - refund requires verify_identity first
        refund_payment(amount=100, user_id="user_123")
    except FirewallBlockedError as e:
        print(f"Blocked: {e}")
        print(f"Error code: {e.result.error_code}")
        # Output: Blocked: Tool "refund_payment" blocked: Tool "refund_payment" requires "verify_identity" to be called first

    # Now verify first
    verify_identity(user_id="user_123")
    
    # This will be ALLOWED - verification done
    result = refund_payment(amount=100, user_id="user_123")
    print(f"Refund result: {result}")


if __name__ == "__main__":
    run_agent()`;

const samplePolicy = `{
  "version": "1.0",
  "defaultDecision": "deny",
  "toolRules": [
    {
      "toolName": "verify_identity",
      "effect": "allow",
      "actionType": "side_effect",
      "maxCallsPerSession": 3
    },
    {
      "toolName": "refund_payment",
      "effect": "allow",
      "actionType": "side_effect",
      "requireState": "verified",
      "requirePreviousToolCalls": ["verify_identity"],
      "maxCallsPerSession": 1
    },
    {
      "toolName": "delete_database",
      "effect": "deny",
      "actionType": "side_effect"
    }
  ],
  "stateMachine": {
    "states": ["unauthenticated", "verified", "executed"],
    "initialState": "unauthenticated",
    "transitions": [
      {
        "fromState": "unauthenticated",
        "toState": "verified",
        "triggeredByTool": "verify_identity"
      },
      {
        "fromState": "verified",
        "toState": "executed",
        "triggeredByTool": "refund_payment"
      }
    ]
  },
  "counters": []
}`;

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 h-8 w-8 p-0"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      </Button>
      <pre className="bg-background border border-border rounded-lg p-4 overflow-x-auto text-sm">
        <code className="text-muted-foreground">{code}</code>
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
          description="Integrate Agent Firewall into your AI agents in minutes."
        />

        {/* Quick Start */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Quick Start
            </CardTitle>
            <CardDescription>
              Three steps to protect your AI agent
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                  1
                </div>
                <div>
                  <h4 className="font-medium">Create an API Key</h4>
                  <p className="text-sm text-muted-foreground">
                    Go to Environments → Select your environment → Create API Key
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                  2
                </div>
                <div>
                  <h4 className="font-medium">Define a Policy</h4>
                  <p className="text-sm text-muted-foreground">
                    Go to Policies → Create and publish a policy for your environment
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                  3
                </div>
                <div>
                  <h4 className="font-medium">Wrap Your Tools</h4>
                  <p className="text-sm text-muted-foreground">
                    Use the SDK to wrap tool functions with firewall protection
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SDK Code */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code2 className="h-5 w-5" />
              SDK Implementation
            </CardTitle>
            <CardDescription>
              Copy-paste SDK code for your language
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="typescript">
              <TabsList className="mb-4">
                <TabsTrigger value="typescript">TypeScript</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
              </TabsList>
              <TabsContent value="typescript">
                <CodeBlock code={typescriptSDK} language="typescript" />
              </TabsContent>
              <TabsContent value="python">
                <CodeBlock code={pythonSDK} language="python" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Sample Policy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Example Policy
            </CardTitle>
            <CardDescription>
              A policy that requires verification before refunds
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock code={samplePolicy} language="json" />
          </CardContent>
        </Card>

        {/* API Reference */}
        <Card>
          <CardHeader>
            <CardTitle>API Reference</CardTitle>
            <CardDescription>
              POST /functions/v1/runtime-check
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Request Headers</h4>
              <div className="bg-muted/50 rounded-lg p-3 text-sm font-mono">
                <div>x-api-key: af_live_xxxxxxxx</div>
                <div>Content-Type: application/json</div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Request Body</h4>
              <CodeBlock
                code={`{
  "sessionId": "unique-session-id",
  "agentId": "my-agent-v1",
  "toolName": "refund_payment",
  "actionType": "side_effect",
  "payload": { "amount": 100, "userId": "user_123" }
}`}
                language="json"
              />
            </div>
            <div>
              <h4 className="font-medium mb-2">Response (Blocked)</h4>
              <CodeBlock
                code={`{
  "allowed": false,
  "errorCode": "REQUIRED_TOOLS_NOT_CALLED",
  "decisionReasons": [
    {
      "code": "REQUIRED_TOOLS_NOT_CALLED",
      "message": "Tool \\"refund_payment\\" requires \\"verify_identity\\" to be called first",
      "ruleRef": "toolRules.refund_payment.requirePreviousToolCalls"
    }
  ],
  "policyVersionUsed": 1,
  "stateBefore": "unauthenticated",
  "stateAfter": "unauthenticated",
  "counters": {}
}`}
                language="json"
              />
            </div>
          </CardContent>
        </Card>

        {/* SDK Contract */}
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-primary">SDK Contract</CardTitle>
            <CardDescription>
              The rules your SDK integration MUST follow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <span><strong>MUST</strong> call /runtime/check before every tool execution</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <span><strong>MUST</strong> block tool execution locally if allowed=false</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <span><strong>MUST</strong> surface decisionReasons to the developer</span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <span><strong>DO NOT</strong> auto-retry blocked calls</span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <span><strong>DO NOT</strong> auto-modify payloads to pass checks</span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <span><strong>DO NOT</strong> "fix" anything - agents must fail loudly and predictably</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
