import { supabase } from "@/integrations/supabase/client";

export { supabase };

// Re-export policy engine types and functions
export * from './policy-engine';

// Default policy spec for new policies
export const defaultPolicySpec = {
  version: "1.0",
  defaultDecision: "deny" as const,
  toolRules: [],
  stateMachine: {
    states: ["initial"],
    initialState: "initial",
    transitions: []
  },
  counters: []
};
