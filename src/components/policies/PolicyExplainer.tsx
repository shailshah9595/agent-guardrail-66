import { Info, AlertTriangle, Zap } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

interface ExplainerProps {
  term: 'state' | 'sequential' | 'side_effect' | 'maxCalls' | 'cooldown' | 'requireFields';
}

const explanations: Record<string, { title: string; description: string; example: string; warning?: string }> = {
  state: {
    title: 'State Machine',
    description: 'States track where an agent is in a workflow. Tools can require a specific state before execution and trigger transitions to new states.',
    example: 'verify_identity moves state from "initial" to "verified". refund_payment only works in "verified" state.',
  },
  sequential: {
    title: 'Sequential Rules',
    description: 'Require specific tools to be called before this one. The firewall checks the session history.',
    example: 'refund_payment requires verify_identity to be called earlier in the session.',
    warning: 'Order matters. The required tool must complete successfully before this tool can execute.',
  },
  side_effect: {
    title: 'Side Effect Actions',
    description: 'Marks actions that change external state: sending emails, processing payments, modifying databases.',
    example: 'refund_payment is a side_effect because it moves money.',
    warning: 'Side effects require explicit allow rules. They are never auto-approved.',
  },
  maxCalls: {
    title: 'Call Limit',
    description: 'Maximum times this tool can be called per session. Prevents runaway costs and abuse.',
    example: 'Limit send_email to 3 calls per session to prevent spam.',
  },
  cooldown: {
    title: 'Cooldown Period',
    description: 'Minimum time (in ms) between calls to this tool. Enforces rate limiting.',
    example: 'Set 60000ms cooldown on expensive API calls to limit costs.',
  },
  requireFields: {
    title: 'Required Fields',
    description: 'Payload must include these fields. Missing fields block execution.',
    example: 'refund_payment requires "orderId" and "amount" in the payload.',
  },
};

export function PolicyExplainer({ term }: ExplainerProps) {
  const info = explanations[term];
  if (!info) return null;

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
          <Info className="h-3.5 w-3.5" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" side="right">
        <div className="space-y-2">
          <h4 className="font-semibold flex items-center gap-2">
            {info.title}
          </h4>
          <p className="text-sm text-muted-foreground">{info.description}</p>
          <div className="bg-muted/50 rounded p-2">
            <p className="text-xs"><strong>Example:</strong> {info.example}</p>
          </div>
          {info.warning && (
            <div className="flex items-start gap-2 text-xs text-warning">
              <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>{info.warning}</span>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

interface PolicyWarningProps {
  type: 'irreversible' | 'runtime' | 'production';
}

export function PolicyWarning({ type }: PolicyWarningProps) {
  const warnings = {
    irreversible: {
      icon: AlertTriangle,
      text: 'This rule affects irreversible actions',
      color: 'text-warning',
    },
    runtime: {
      icon: Zap,
      text: 'This policy is enforced at runtime',
      color: 'text-primary',
    },
    production: {
      icon: AlertTriangle,
      text: 'Changes affect production agents immediately after publish',
      color: 'text-destructive',
    },
  };

  const warning = warnings[type];
  const Icon = warning.icon;

  return (
    <div className={`flex items-center gap-2 text-xs ${warning.color}`}>
      <Icon className="h-3 w-3" />
      <span>{warning.text}</span>
    </div>
  );
}

export function WhyNotIfElse() {
  return (
    <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
      <h4 className="font-medium mb-2 text-sm">Why not hard-code this logic?</h4>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Hard-coded if/else scattered across your codebase creates drift between agents, 
        makes auditing impossible, and fails silently. Agent Firewall provides{' '}
        <strong className="text-foreground">centralized policies</strong> visible in one place,{' '}
        <strong className="text-foreground">complete audit trails</strong> of every decision,{' '}
        <strong className="text-foreground">consistency</strong> across all agents, and{' '}
        <strong className="text-foreground">state-dependent guarantees</strong> that survive restarts and replays.
      </p>
    </div>
  );
}
