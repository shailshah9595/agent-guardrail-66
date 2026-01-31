import { useState } from 'react';
import { Copy, Check, Shield, Terminal, Code2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

const typescriptSDK = `// Agent Firewall SDK - TypeScript (Production-Ready)

class ToolBlockedError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly errorCode: string,
    public readonly decisionReasons: Array<{ code: string; message: string }>
  ) {
    super(\`Tool "\${toolName}" blocked: \${decisionReasons.map(r => r.message).join('; ')}\`);
    this.name = 'ToolBlockedError';
  }
}

class AgentFirewall {
  constructor(private config: { apiKey: string; baseUrl: string }) {}

  guard<T>(sessionId: string, agentId: string, toolName: string, toolFn: (p: T) => Promise<any>) {
    return async (payload: T) => {
      const res = await fetch(\`\${this.config.baseUrl}/functions/v1/runtime-check\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': this.config.apiKey },
        body: JSON.stringify({ sessionId, agentId, toolName, payload }),
      });
      const result = await res.json();
      if (!result.allowed) {
        throw new ToolBlockedError(toolName, result.errorCode, result.decisionReasons);
      }
      return toolFn(payload);
    };
  }
}

// Usage
const firewall = new AgentFirewall({ apiKey: 'af_xxx', baseUrl: 'https://xxx.supabase.co' });
const guardedRefund = firewall.guard('session-1', 'agent-1', 'refund_payment', processRefund);

try {
  await guardedRefund({ orderId: '123', amount: 50 });
} catch (e) {
  if (e instanceof ToolBlockedError) {
    console.log('Blocked:', e.errorCode, e.decisionReasons);
  }
}`;

const pythonSDK = `# Agent Firewall SDK - Python (Production-Ready)
import httpx

class ToolBlockedError(Exception):
    def __init__(self, tool_name, error_code, reasons):
        self.tool_name = tool_name
        self.error_code = error_code
        self.reasons = reasons
        super().__init__(f'Tool "{tool_name}" blocked: {"; ".join(r["message"] for r in reasons)}')

class AgentFirewall:
    def __init__(self, api_key: str, base_url: str):
        self.api_key = api_key
        self.base_url = base_url
    
    def guard(self, session_id: str, agent_id: str, tool_name: str):
        def decorator(func):
            def wrapper(**kwargs):
                res = httpx.post(
                    f"{self.base_url}/functions/v1/runtime-check",
                    headers={"x-api-key": self.api_key},
                    json={"sessionId": session_id, "agentId": agent_id, "toolName": tool_name, "payload": kwargs}
                ).json()
                if not res["allowed"]:
                    raise ToolBlockedError(tool_name, res.get("errorCode"), res.get("decisionReasons", []))
                return func(**kwargs)
            return wrapper
        return decorator

# Usage
firewall = AgentFirewall("af_xxx", "https://xxx.supabase.co")

@firewall.guard("session-1", "agent-1", "refund_payment")
def refund_payment(order_id: str, amount: float):
    return {"status": "success"}`;

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <Button variant="ghost" size="sm" className="absolute top-2 right-2" onClick={async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
      <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-sm"><code>{code}</code></pre>
    </div>
  );
}

export default function SDKPage() {
  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-8 max-w-5xl">
        <PageHeader title="SDK & Integration" description="Integrate Agent Firewall with type-safe, fail-closed SDKs." />

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />SDK Contract</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              <li>1. SDK <strong>MUST</strong> call /runtime-check before every tool execution</li>
              <li>2. SDK <strong>MUST</strong> block locally if allowed=false</li>
              <li>3. SDK <strong>MUST</strong> surface decisionReasons to agent</li>
              <li>4. SDK <strong>MUST NOT</strong> auto-retry blocked calls</li>
              <li>5. SDK <strong>MUST NOT</strong> modify payload to bypass checks</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Code2 className="h-5 w-5" />SDK Implementation</CardTitle></CardHeader>
          <CardContent>
            <Tabs defaultValue="typescript">
              <TabsList className="mb-4">
                <TabsTrigger value="typescript">TypeScript</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
              </TabsList>
              <TabsContent value="typescript"><CodeBlock code={typescriptSDK} /></TabsContent>
              <TabsContent value="python"><CodeBlock code={pythonSDK} /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Error Codes</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <code className="p-2 bg-muted rounded">MAX_CALLS_EXCEEDED</code><span className="p-2">Session limit reached</span>
              <code className="p-2 bg-muted rounded">COOLDOWN_ACTIVE</code><span className="p-2">Must wait before retry</span>
              <code className="p-2 bg-muted rounded">REQUIRED_STATE_NOT_MET</code><span className="p-2">Wrong state</span>
              <code className="p-2 bg-muted rounded">RATE_LIMITED</code><span className="p-2">Too many requests</span>
              <code className="p-2 bg-muted rounded">INTERNAL_ERROR</code><span className="p-2">Fail closed</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
