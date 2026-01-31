import { Info, AlertTriangle, Zap } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

interface ExplainerProps {
  term: 'state' | 'sequential' | 'side_effect' | 'maxCalls' | 'cooldown' | 'requireFields';
}

const explanations: Record<string, { title: string; description: string; example: string; warning?: string }> = {
  state: {
    title: 'Workflow State',
    description: 'States track where a transaction is in its lifecycle. Financial actions can require a specific state (like "verified") before execution.',
    example: 'verify_identity moves state from "initial" to "verified". refund_payment only works in "verified" state—preventing unauthorized refunds.',
  },
  sequential: {
    title: 'Prerequisite Actions',
    description: 'Require specific actions to complete before this one. The firewall checks session history to enforce order.',
    example: 'refund_payment requires verify_identity to be called first—no refund without verification.',
    warning: 'Order is enforced. The prerequisite must succeed before the financial action can execute.',
  },
  side_effect: {
    title: 'Irreversible Financial Action',
    description: 'Marks actions that change external financial state: processing refunds, charging customers, sending receipts.',
    example: 'refund_payment is a side_effect because it moves money. charge_customer is a side_effect because it charges a card.',
    warning: 'Financial side effects require explicit allow rules. They are never auto-approved.',
  },
  maxCalls: {
    title: 'Session Limit',
    description: 'Maximum times this financial action can execute per session. Prevents double-refunds and duplicate charges.',
    example: 'Limit refund_payment to 1 call per session to prevent duplicate refunds.',
  },
  cooldown: {
    title: 'Rate Limit',
    description: 'Minimum time (ms) between calls. Enforces spacing between financial actions.',
    example: 'Set 60000ms cooldown on charge_customer to prevent rapid duplicate charges.',
  },
  requireFields: {
    title: 'Required Transaction Data',
    description: 'Payload must include these fields. Missing data blocks the financial action.',
    example: 'refund_payment requires "orderId" and "amount"—no refund without knowing what to refund.',
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
      text: 'This rule affects irreversible financial actions (payments, refunds)',
      color: 'text-warning',
    },
    runtime: {
      icon: Zap,
      text: 'This policy is enforced at runtime on every financial action',
      color: 'text-primary',
    },
    production: {
      icon: AlertTriangle,
      text: 'Changes affect live payment agents immediately after publish',
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
      <h4 className="font-medium mb-2 text-sm">Why not hard-code refund limits?</h4>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Hard-coded if/else scattered across your payment code creates drift between agents, 
        makes auditing impossible for compliance, and fails silently under edge cases. Agent Firewall provides{' '}
        <strong className="text-foreground">centralized policies</strong> visible in one place,{' '}
        <strong className="text-foreground">complete audit trails</strong> of every refund and charge,{' '}
        <strong className="text-foreground">consistency</strong> across all payment agents, and{' '}
        <strong className="text-foreground">state-dependent guarantees</strong> that prevent double-refunds even under retries.
      </p>
    </div>
  );
}
