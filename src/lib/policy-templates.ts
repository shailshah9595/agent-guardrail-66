/**
 * Pre-built Policy Templates for Financial & Operational Agents
 * 
 * These templates are tailored for teams running agents with financial
 * or operational authority: FinTech, marketplaces, internal ops automation.
 */

import { PolicySpec } from './policy-engine/types';

export interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  category: 'financial' | 'operations' | 'security';
  spec: PolicySpec;
}

/**
 * TEMPLATE 1: Refund Safety
 * 
 * Prevents unauthorized refunds by requiring identity verification first.
 * Limits refunds to 1 per session. Requires orderId and amount fields.
 */
const refundSafetyTemplate: PolicyTemplate = {
  id: 'refund-safety',
  name: 'Refund Safety',
  description: 'Prevents unauthorized refunds. Requires identity verification, limits to 1 refund per session, mandates orderId and amount.',
  category: 'financial',
  spec: {
    version: '1.0',
    defaultDecision: 'deny',
    toolRules: [
      {
        toolName: 'get_order_details',
        effect: 'allow',
        actionType: 'read',
      },
      {
        toolName: 'get_customer_info',
        effect: 'allow',
        actionType: 'read',
      },
      {
        toolName: 'verify_identity',
        effect: 'allow',
        actionType: 'write',
      },
      {
        toolName: 'refund_payment',
        effect: 'allow',
        actionType: 'side_effect',
        requireState: 'verified',
        requirePreviousToolCalls: ['verify_identity'],
        requireFields: ['orderId', 'amount'],
        maxCallsPerSession: 1,
      },
    ],
    stateMachine: {
      states: ['initial', 'verified', 'refund_issued'],
      initialState: 'initial',
      transitions: [
        { fromState: 'initial', toState: 'verified', triggeredByTool: 'verify_identity' },
        { fromState: 'verified', toState: 'refund_issued', triggeredByTool: 'refund_payment' },
      ],
    },
    counters: [
      { name: 'refund_count', scope: 'session', initialValue: 0, maxValue: 1 },
    ],
  },
};

/**
 * TEMPLATE 2: Payment Protection
 * 
 * Safeguards customer charges with explicit approval workflow.
 * Blocks payments after execution state to prevent double-charging.
 */
const paymentProtectionTemplate: PolicyTemplate = {
  id: 'payment-protection',
  name: 'Payment Protection',
  description: 'Safeguards customer charges. Requires approval state before charging, blocks after execution to prevent double-charges.',
  category: 'financial',
  spec: {
    version: '1.0',
    defaultDecision: 'deny',
    toolRules: [
      {
        toolName: 'get_cart',
        effect: 'allow',
        actionType: 'read',
      },
      {
        toolName: 'calculate_total',
        effect: 'allow',
        actionType: 'read',
      },
      {
        toolName: 'confirm_payment_intent',
        effect: 'allow',
        actionType: 'write',
      },
      {
        toolName: 'charge_customer',
        effect: 'allow',
        actionType: 'side_effect',
        requireState: 'payment_approved',
        requirePreviousToolCalls: ['confirm_payment_intent'],
        requireFields: ['customerId', 'amount', 'paymentMethodId'],
        maxCallsPerSession: 1,
      },
      {
        toolName: 'send_receipt',
        effect: 'allow',
        actionType: 'side_effect',
        requireState: 'payment_executed',
        maxCallsPerSession: 1,
      },
    ],
    stateMachine: {
      states: ['initial', 'payment_approved', 'payment_executed'],
      initialState: 'initial',
      transitions: [
        { fromState: 'initial', toState: 'payment_approved', triggeredByTool: 'confirm_payment_intent' },
        { fromState: 'payment_approved', toState: 'payment_executed', triggeredByTool: 'charge_customer' },
      ],
    },
    counters: [
      { name: 'charge_count', scope: 'session', initialValue: 0, maxValue: 1 },
    ],
  },
};

/**
 * TEMPLATE 3: Ops Agent Guardrails
 * 
 * For internal operations agents. Limits communications, blocks bulk actions,
 * denies destructive database operations.
 */
const opsGuardrailsTemplate: PolicyTemplate = {
  id: 'ops-guardrails',
  name: 'Ops Agent Guardrails',
  description: 'For internal ops agents. Limits emails to 1/session, blocks bulk actions, denies destructive DB operations.',
  category: 'operations',
  spec: {
    version: '1.0',
    defaultDecision: 'deny',
    toolRules: [
      // Read operations allowed
      {
        toolName: 'query_database',
        effect: 'allow',
        actionType: 'read',
      },
      {
        toolName: 'get_user_account',
        effect: 'allow',
        actionType: 'read',
      },
      {
        toolName: 'search_records',
        effect: 'allow',
        actionType: 'read',
      },
      // Limited write operations
      {
        toolName: 'update_account_status',
        effect: 'allow',
        actionType: 'write',
        requireFields: ['accountId', 'newStatus', 'reason'],
        maxCallsPerSession: 3,
      },
      // Strictly limited side effects
      {
        toolName: 'email_customer',
        effect: 'allow',
        actionType: 'side_effect',
        requireFields: ['recipientEmail', 'subject'],
        maxCallsPerSession: 1,
        cooldownMs: 60000, // 1 minute cooldown
      },
      {
        toolName: 'send_sms',
        effect: 'allow',
        actionType: 'side_effect',
        requireFields: ['phoneNumber', 'message'],
        maxCallsPerSession: 1,
        cooldownMs: 60000,
      },
      // BLOCKED: Destructive operations
      {
        toolName: 'delete_database',
        effect: 'deny',
        actionType: 'side_effect',
      },
      {
        toolName: 'drop_table',
        effect: 'deny',
        actionType: 'side_effect',
      },
      {
        toolName: 'bulk_delete',
        effect: 'deny',
        actionType: 'side_effect',
      },
      {
        toolName: 'bulk_update',
        effect: 'deny',
        actionType: 'side_effect',
      },
      {
        toolName: 'mass_email',
        effect: 'deny',
        actionType: 'side_effect',
      },
    ],
    stateMachine: {
      states: ['initial'],
      initialState: 'initial',
      transitions: [],
    },
    counters: [
      { name: 'email_count', scope: 'session', initialValue: 0, maxValue: 2 },
      { name: 'write_count', scope: 'session', initialValue: 0, maxValue: 3 },
    ],
  },
};

/**
 * All available policy templates
 */
export const policyTemplates: PolicyTemplate[] = [
  refundSafetyTemplate,
  paymentProtectionTemplate,
  opsGuardrailsTemplate,
];

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): PolicyTemplate | undefined {
  return policyTemplates.find(t => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: PolicyTemplate['category']): PolicyTemplate[] {
  return policyTemplates.filter(t => t.category === category);
}
