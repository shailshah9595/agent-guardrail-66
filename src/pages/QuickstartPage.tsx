import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ArrowRight, ArrowLeft, Copy, Check, CheckCircle2, XCircle, AlertTriangle, Play, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const DEMO_EXECUTION = [
  {
    tool: 'get_order_details',
    decision: 'allowed' as const,
    reason: 'Read-only operation permitted',
    state: 'initial → initial',
  },
  {
    tool: 'refund_payment',
    decision: 'blocked' as const,
    reason: 'refund_payment requires verify_identity to be called first',
    errorCode: 'REQUIRED_TOOLS_NOT_CALLED',
    state: 'initial',
  },
  {
    tool: 'verify_identity',
    decision: 'allowed' as const,
    reason: 'Identity verification completed',
    state: 'initial → verified',
  },
  {
    tool: 'refund_payment',
    decision: 'allowed' as const,
    reason: 'All preconditions satisfied',
    state: 'verified → refund_issued',
  },
];

const SDK_EXAMPLE = `import { AgentFirewall, ToolBlockedError } from '@agent-firewall/sdk';

const firewall = new AgentFirewall({
  apiKey: process.env.AGENT_FIREWALL_API_KEY,
  baseUrl: 'https://your-project.supabase.co'
});

// Wrap your tool function
const safeRefund = firewall.guard('session-123', 'agent-1', 'refund_payment', 
  async (payload) => {
    return await stripe.refunds.create(payload);
  }
);

// Execute - firewall checks BEFORE your code runs
try {
  const result = await safeRefund({ amount: 5000, orderId: 'ord_123' });
  console.log('Refund processed:', result);
} catch (error) {
  if (error instanceof ToolBlockedError) {
    // Agent can react intelligently
    console.log('Blocked:', error.errorCode);
    console.log('Reasons:', error.decisionReasons);
    // e.g., prompt user for identity verification
  }
}`;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  
  return (
    <Button
      variant="ghost"
      size="sm"
      className="absolute top-3 right-3"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

export default function QuickstartPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [demoStep, setDemoStep] = useState(-1);

  const playDemo = () => {
    setDemoPlaying(true);
    setDemoStep(0);
    
    const playNext = (index: number) => {
      if (index >= DEMO_EXECUTION.length) {
        setDemoPlaying(false);
        return;
      }
      setDemoStep(index);
      setTimeout(() => playNext(index + 1), 1500);
    };
    
    setTimeout(() => playNext(0), 500);
  };

  const steps = [
    // Step 0: Understand the Problem
    {
      title: 'The Problem',
      content: (
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <p className="text-xl text-muted-foreground mb-8">
              Agents fail not because they reason badly, but because they{' '}
              <span className="text-foreground font-medium">execute without constraints</span>.
            </p>
          </motion.div>
          
          {/* Flow diagram */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-center gap-4 py-8"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-xl bg-secondary flex items-center justify-center">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <span className="text-sm font-medium">Agent</span>
            </div>
            
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
            
            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-xl bg-primary/10 border-2 border-primary flex items-center justify-center glow-primary">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <span className="text-sm font-medium text-primary">Firewall</span>
            </div>
            
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
            
            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-xl bg-secondary flex items-center justify-center">
                <span className="text-2xl">🔧</span>
              </div>
              <span className="text-sm font-medium">Tool</span>
            </div>
          </motion.div>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center text-lg"
          >
            Agent Firewall <span className="text-primary font-medium">blocks unsafe actions</span> before they happen.
          </motion.p>
        </div>
      ),
    },
    
    // Step 1: See a Real Failure
    {
      title: 'See It Work',
      content: (
        <div className="space-y-6">
          <p className="text-muted-foreground text-center">
            Watch how the firewall enforces a simple rule:{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">refund_payment</code>{' '}
            requires{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">verify_identity</code>{' '}
            to be called first.
          </p>
          
          <div className="flex justify-center">
            <Button onClick={playDemo} disabled={demoPlaying} className="gap-2">
              <Play className="h-4 w-4" />
              {demoPlaying ? 'Playing...' : 'Run Demo'}
            </Button>
          </div>
          
          <div className="space-y-3">
            {DEMO_EXECUTION.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0.3 }}
                animate={{ 
                  opacity: demoStep >= index ? 1 : 0.3,
                  scale: demoStep === index ? 1.02 : 1,
                }}
                className={`p-4 rounded-lg border ${
                  item.decision === 'allowed' 
                    ? 'bg-success/5 border-success/20' 
                    : 'bg-destructive/5 border-destructive/20'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {item.decision === 'allowed' ? (
                      <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-medium">{item.tool}</code>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          item.decision === 'allowed' 
                            ? 'bg-success/10 text-success' 
                            : 'bg-destructive/10 text-destructive'
                        }`}>
                          {item.decision}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{item.reason}</p>
                    </div>
                  </div>
                  <code className="text-xs text-muted-foreground">{item.state}</code>
                </div>
                {item.errorCode && (
                  <div className="mt-2 flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-destructive" />
                    <code className="text-xs text-destructive">{item.errorCode}</code>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
          
          {demoStep === DEMO_EXECUTION.length - 1 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-sm text-muted-foreground"
            >
              The agent tried to refund without verification → blocked. 
              After verification → allowed.
            </motion.p>
          )}
        </div>
      ),
    },
    
    // Step 2: Copy-Paste Integration
    {
      title: 'Integrate',
      content: (
        <div className="space-y-6">
          <p className="text-muted-foreground text-center">
            Wrap your tool functions with the firewall. 15 lines of code.
          </p>
          
          <Card className="relative">
            <CopyButton text={SDK_EXAMPLE} />
            <CardContent className="pt-6">
              <pre className="text-sm overflow-x-auto bg-muted/50 p-4 rounded-lg">
                <code className="text-foreground">{SDK_EXAMPLE}</code>
              </pre>
            </CardContent>
          </Card>
          
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Run Locally
            </h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Create a project in Agent Firewall</li>
              <li>Copy your API key from Settings → API Keys</li>
              <li>Define a policy requiring <code className="text-xs bg-muted px-1 rounded">verify_identity</code> before <code className="text-xs bg-muted px-1 rounded">refund_payment</code></li>
              <li>Run the code above</li>
            </ol>
          </div>
          
          <div className="flex justify-center gap-4">
            <Button onClick={() => navigate('/projects')} className="gap-2">
              Create Project
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => navigate('/sdk')}>
              Full SDK Docs
            </Button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <span className="text-lg font-semibold">Agent Firewall</span>
            </button>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">Quickstart</span>
          </div>
          <Button variant="ghost" onClick={() => navigate('/projects')}>
            Skip to Dashboard
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="container pt-32 pb-20">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {steps.map((_, index) => (
            <button
              key={index}
              onClick={() => setStep(index)}
              className={`h-2 rounded-full transition-all ${
                index === step 
                  ? 'w-8 bg-primary' 
                  : index < step 
                    ? 'w-2 bg-primary/50' 
                    : 'w-2 bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-3xl font-bold text-center mb-8">{steps[step].title}</h2>
              {steps[step].content}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4 mt-12">
          <Button
            variant="outline"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={() => {
              if (step < steps.length - 1) {
                setStep(step + 1);
              } else {
                navigate('/projects');
              }
            }}
            className="gap-2"
          >
            {step === steps.length - 1 ? 'Get Started' : 'Next'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </main>
    </div>
  );
}
