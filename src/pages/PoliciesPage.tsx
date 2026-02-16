import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FileCode2, Plus, Loader2, Play, Save, Upload, AlertTriangle, Info, CreditCard } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PolicyExplainer, PolicyWarning, WhyNotIfElse } from '@/components/policies/PolicyExplainer';
import { PolicyTemplateSelector } from '@/components/policies/PolicyTemplateSelector';
import { PublishConfirmDialog } from '@/components/policies/PublishConfirmDialog';
import { PolicyHistory } from '@/components/policies/PolicyHistory';
import { supabase } from '@/integrations/supabase/client';
import { defaultPolicySpec, PolicySpec } from '@/lib/supabase';
import { PolicyTemplate } from '@/lib/policy-templates';
import { useToast } from '@/hooks/use-toast';

interface Policy {
  id: string;
  name: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  policy_spec: PolicySpec;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  env_id: string;
  environment?: { name: string; project: { name: string } };
}

interface Environment {
  id: string;
  name: string;
  project: { name: string };
}

interface SimulationResult {
  allowed: boolean;
  reasons: string[];
  newState?: string;
  counters?: Record<string, number>;
}

export default function PoliciesPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Editor state
  const [editorValue, setEditorValue] = useState('');
  const [editorMode, setEditorMode] = useState<'json' | 'form'>('json');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newPolicyName, setNewPolicyName] = useState('');
  const [selectedEnvId, setSelectedEnvId] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PolicyTemplate | null>(null);

  // Simulation state
  const [simToolName, setSimToolName] = useState('refund_payment');
  const [simPayload, setSimPayload] = useState('{"orderId": "ord_12345", "amount": 8999}');
  const [simState, setSimState] = useState('initial');
  const [simPrevCalls, setSimPrevCalls] = useState('');
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Load environments
      const { data: envData } = await supabase
        .from('environments')
        .select('id, name, project:projects(name)')
        .order('created_at');
      
      const envs = (envData || []).map(e => ({
        ...e,
        project: Array.isArray(e.project) ? e.project[0] : e.project
      }));
      setEnvironments(envs as Environment[]);

      // Load policies
      const { data: policyData, error } = await supabase
        .from('policies')
        .select(`
          id, name, version, status, policy_spec, created_at, updated_at, published_at, env_id,
          environment:environments(name, project:projects(name))
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const policies = (policyData || []).map(p => ({
        ...p,
        policy_spec: p.policy_spec as unknown as PolicySpec,
        environment: Array.isArray(p.environment) ? p.environment[0] : p.environment
      })) as Policy[];
      setPolicies(policies);

      // Auto-select first policy
      if (policies.length > 0 && !selectedPolicy) {
        selectPolicy(policies[0]);
      }
    } catch (error: any) {
      toast({
        title: 'Failed to load policies',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  function selectPolicy(policy: Policy) {
    setSelectedPolicy(policy);
    const spec = policy.policy_spec || defaultPolicySpec;
    setEditorValue(JSON.stringify(spec, null, 2));
    setValidationError(null);
    setSimResult(null);
  }

  function validatePolicySpec(jsonStr: string): PolicySpec | null {
    try {
      const spec = JSON.parse(jsonStr);
      // Basic validation
      if (!spec.version) throw new Error('Missing version');
      if (!spec.defaultDecision) throw new Error('Missing defaultDecision');
      if (!Array.isArray(spec.toolRules)) throw new Error('toolRules must be an array');
      setValidationError(null);
      return spec;
    } catch (error: any) {
      setValidationError(error.message);
      return null;
    }
  }

  async function savePolicy() {
    if (!selectedPolicy) return;
    
    const spec = validatePolicySpec(editorValue);
    if (!spec) {
      toast({
        title: 'Invalid policy',
        description: validationError || 'Please fix the JSON errors.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('policies')
        .update({
          policy_spec: spec as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedPolicy.id);

      if (error) throw error;

      toast({ title: 'Policy saved' });
      loadData();
    } catch (error: any) {
      toast({
        title: 'Failed to save policy',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function publishPolicy() {
    if (!selectedPolicy) return;
    
    const spec = validatePolicySpec(editorValue);
    if (!spec) {
      toast({
        title: 'Invalid policy',
        description: 'Cannot publish invalid policy. Please fix errors first.',
        variant: 'destructive',
      });
      return;
    }

    setPublishing(true);
    try {
      const { error } = await supabase
        .from('policies')
        .update({
          policy_spec: spec as any,
          status: 'published' as const,
          version: selectedPolicy.version + 1,
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedPolicy.id);

      if (error) throw error;

      toast({
        title: 'Policy published',
        description: `Version ${selectedPolicy.version + 1} is now live.`,
      });
      loadData();
    } catch (error: any) {
      toast({
        title: 'Failed to publish policy',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setPublishing(false);
    }
  }

  async function createPolicy() {
    if (!newPolicyName.trim() || !selectedEnvId) return;
    setCreating(true);

    // Use template spec if selected, otherwise default
    const policySpec = selectedTemplate ? selectedTemplate.spec : defaultPolicySpec;

    try {
      const { data, error } = await supabase
        .from('policies')
        .insert([{
          env_id: selectedEnvId,
          name: newPolicyName.trim(),
          policy_spec: policySpec as any,
        }])
        .select()
        .single();

      if (error) throw error;

      toast({ 
        title: 'Policy created',
        description: selectedTemplate 
          ? `Created from "${selectedTemplate.name}" template` 
          : 'Created with default configuration',
      });
      setCreateDialogOpen(false);
      setNewPolicyName('');
      setSelectedEnvId('');
      setSelectedTemplate(null);
      loadData();
    } catch (error: any) {
      toast({
        title: 'Failed to create policy',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  }

  function simulateToolCall() {
    const spec = validatePolicySpec(editorValue);
    if (!spec) {
      setSimResult({ allowed: false, reasons: ['Invalid policy JSON'] });
      return;
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(simPayload);
    } catch {
      setSimResult({ allowed: false, reasons: ['Invalid payload JSON'] });
      return;
    }

    const prevCalls = simPrevCalls.split(',').map(s => s.trim()).filter(Boolean);
    const reasons: string[] = [];
    let allowed = true;

    // Find matching tool rule
    const rule = spec.toolRules.find(r => r.toolName === simToolName);

    if (!rule) {
      // Check default decision
      if (spec.defaultDecision === 'deny') {
        allowed = false;
        reasons.push(`Unknown tool "${simToolName}" - default decision is deny`);
      } else {
        reasons.push(`Unknown tool "${simToolName}" - default decision is allow`);
      }
    } else {
      // Check rule effect
      if (rule.effect === 'deny') {
        allowed = false;
        reasons.push(`Tool "${simToolName}" is explicitly denied`);
      } else {
        // Check requireState
        if (rule.requireState && rule.requireState !== simState) {
          allowed = false;
          reasons.push(`Requires state "${rule.requireState}" but current state is "${simState}"`);
        }

        // Check requirePreviousToolCalls
        if (rule.requirePreviousToolCalls) {
          for (const required of rule.requirePreviousToolCalls) {
            if (!prevCalls.includes(required)) {
              allowed = false;
              reasons.push(`Requires "${required}" to be called first`);
            }
          }
        }

        // Check requireFields
        if (rule.requireFields) {
          for (const field of rule.requireFields) {
            if (!(field in payload)) {
              allowed = false;
              reasons.push(`Missing required field: ${field}`);
            }
          }
        }

        // Check denyIfFieldsPresent
        if (rule.denyIfFieldsPresent) {
          for (const field of rule.denyIfFieldsPresent) {
            if (field in payload) {
              allowed = false;
              reasons.push(`Denied because field "${field}" is present`);
            }
          }
        }

        if (allowed) {
          reasons.push('All conditions satisfied');
        }
      }
    }

    // Determine new state if FSM transition exists
    let newState = simState;
    if (allowed && spec.stateMachine) {
      const transition = spec.stateMachine.transitions.find(
        t => t.triggeredByTool === simToolName && t.fromState === simState
      );
      if (transition) {
        newState = transition.toState;
        reasons.push(`State transition: ${simState} → ${newState}`);
      }
    }

    setSimResult({ allowed, reasons, newState });
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageHeader
          title="Policies"
          description="Define enforcement rules for payment agents. Block unauthorized refunds, prevent double-charges, require verification."
          actions={
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Policy
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Create Payment Policy
                  </DialogTitle>
                  <DialogDescription>
                    Create a new policy to protect financial actions in an environment.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Environment</Label>
                    <Select value={selectedEnvId} onValueChange={setSelectedEnvId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select environment" />
                      </SelectTrigger>
                      <SelectContent>
                        {environments.map((env) => (
                          <SelectItem key={env.id} value={env.id}>
                            {env.project?.name} / {env.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="policyName">Policy Name</Label>
                    <Input
                      id="policyName"
                      placeholder="Refund Protection Policy"
                      value={newPolicyName}
                      onChange={(e) => setNewPolicyName(e.target.value)}
                    />
                  </div>
                  
                  {/* Template Selector */}
                  <div className="space-y-2">
                    <Label>Start from Template (Optional)</Label>
                    <PolicyTemplateSelector 
                      onSelect={(template) => {
                        setSelectedTemplate(template);
                        if (!newPolicyName.trim()) {
                          setNewPolicyName(template.name);
                        }
                      }}
                      trigger={
                        <Button variant="outline" className="w-full justify-start gap-2">
                          <CreditCard className="h-4 w-4" />
                          {selectedTemplate ? selectedTemplate.name : 'Choose a template...'}
                        </Button>
                      }
                    />
                    {selectedTemplate && (
                      <p className="text-xs text-muted-foreground">
                        {selectedTemplate.description}
                      </p>
                    )}
                  </div>
                  
                  <Button onClick={createPolicy} disabled={creating || !newPolicyName.trim() || !selectedEnvId} className="w-full">
                    {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Create Policy
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          }
        />

        {policies.length === 0 && environments.length === 0 ? (
          <EmptyState
            icon={FileCode2}
            title="No policies yet"
            description="Create a project and environment first, then define policies."
            action={{
              label: 'Go to Projects',
              onClick: () => navigate('/projects'),
            }}
          />
        ) : policies.length === 0 ? (
          <EmptyState
            icon={FileCode2}
            title="No policies yet"
            description="Create your first policy to start enforcing rules on tool calls."
            action={{
              label: 'Create Policy',
              onClick: () => setCreateDialogOpen(true),
            }}
          />
        ) : (
          <div className="grid lg:grid-cols-4 gap-6">
            {/* Policy list */}
            <div className="lg:col-span-1 space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Policies</h3>
              <div className="space-y-2">
                {policies.map((policy) => (
                  <button
                    key={policy.id}
                    onClick={() => selectPolicy(policy)}
                    className={`w-full flex flex-col gap-1 p-3 rounded-lg border text-left transition-colors ${
                      selectedPolicy?.id === policy.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{policy.name}</span>
                      <StatusBadge status={policy.status} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {policy.environment?.project?.name} / {policy.environment?.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      v{policy.version}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Editor */}
            <div className="lg:col-span-3 space-y-4">
              {selectedPolicy && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">{selectedPolicy.name}</h2>
                      <p className="text-sm text-muted-foreground">
                        Version {selectedPolicy.version} • {selectedPolicy.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={savePolicy} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Draft
                      </Button>
                      <PublishConfirmDialog
                        policyName={selectedPolicy.name}
                        environmentName={selectedPolicy.environment?.name || 'Unknown'}
                        currentVersion={selectedPolicy.version}
                        onConfirm={publishPolicy}
                        disabled={publishing}
                      />
                    </div>
                  </div>

                  {/* Production warning */}
                  {selectedPolicy.status === 'published' && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-warning text-sm">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <span>This policy protects live payment agents. Changes after publish affect financial actions immediately.</span>
                    </div>
                  )}

                  <Tabs defaultValue="editor" className="space-y-4">
                    <TabsList>
                      <TabsTrigger value="editor">Policy Editor</TabsTrigger>
                      <TabsTrigger value="simulate">Simulate</TabsTrigger>
                      <TabsTrigger value="history">Version History</TabsTrigger>
                      <TabsTrigger value="help">Understanding Policies</TabsTrigger>
                    </TabsList>

                    <TabsContent value="editor" className="space-y-4">
                      {validationError && (
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                          {validationError}
                        </div>
                      )}
                      <div className="border border-border rounded-lg overflow-hidden">
                        <Editor
                          height="500px"
                          language="json"
                          theme="vs-dark"
                          value={editorValue}
                          onChange={(value) => {
                            setEditorValue(value || '');
                            validatePolicySpec(value || '');
                          }}
                          options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            fontFamily: 'JetBrains Mono, monospace',
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                          }}
                        />
                      </div>
                      
                      {/* Runtime warning */}
                      <PolicyWarning type="runtime" />
                    </TabsContent>

                    <TabsContent value="simulate" className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>Simulate Tool Call</CardTitle>
                          <CardDescription>
                            Test your policy without saving logs. See exactly what would happen at runtime.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Label>Tool Name</Label>
                              </div>
                              <Input
                                placeholder="refund_payment"
                                value={simToolName}
                                onChange={(e) => setSimToolName(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Label>Current State</Label>
                                <PolicyExplainer term="state" />
                              </div>
                              <Input
                                placeholder="initial"
                                value={simState}
                                onChange={(e) => setSimState(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Payload (JSON)</Label>
                            <Input
                              placeholder='{"amount": 100}'
                              value={simPayload}
                              onChange={(e) => setSimPayload(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label>Previous Tool Calls (comma-separated)</Label>
                              <PolicyExplainer term="sequential" />
                            </div>
                            <Input
                              placeholder="verify_identity, check_balance"
                              value={simPrevCalls}
                              onChange={(e) => setSimPrevCalls(e.target.value)}
                            />
                          </div>
                          <Button onClick={simulateToolCall} className="gap-2">
                            <Play className="h-4 w-4" />
                            Simulate
                          </Button>

                          {simResult && (
                            <div className={`mt-4 p-4 rounded-lg border ${
                              simResult.allowed
                                ? 'bg-success/10 border-success/20'
                                : 'bg-destructive/10 border-destructive/20'
                            }`}>
                              <div className="flex items-center gap-2 mb-2">
                                <StatusBadge status={simResult.allowed ? 'allowed' : 'blocked'} />
                                {simResult.newState && simResult.newState !== simState && (
                                  <span className="text-sm text-muted-foreground">
                                    → {simResult.newState}
                                  </span>
                                )}
                              </div>
                              <ul className="text-sm space-y-1">
                                {simResult.reasons.map((reason, i) => (
                                  <li key={i}>• {reason}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="history">
                      <PolicyHistory
                        policyId={selectedPolicy.id}
                        currentVersion={selectedPolicy.version}
                      />
                    </TabsContent>

                    <TabsContent value="help" className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Info className="h-5 w-5" />
                            Understanding Policies
                          </CardTitle>
                          <CardDescription>
                            Everything you need to understand policy rules - without reading docs.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {/* State Machine */}
                          <div className="space-y-2">
                            <h4 className="font-medium flex items-center gap-2">
                              State Machine
                              <PolicyExplainer term="state" />
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              States track where an agent is in a workflow. Define states like <code className="text-xs bg-muted px-1 rounded">initial</code>, <code className="text-xs bg-muted px-1 rounded">verified</code>, <code className="text-xs bg-muted px-1 rounded">completed</code>. 
                              Tools can require a specific state and trigger transitions.
                            </p>
                          </div>

                          {/* Sequential Rules */}
                          <div className="space-y-2">
                            <h4 className="font-medium flex items-center gap-2">
                              Sequential Rules (requirePreviousToolCalls)
                              <PolicyExplainer term="sequential" />
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              Require specific tools to be called before this one. Example: <code className="text-xs bg-muted px-1 rounded">refund_payment</code> requires <code className="text-xs bg-muted px-1 rounded">verify_identity</code> to be called first.
                            </p>
                          </div>

                          {/* Side Effects */}
                          <div className="space-y-2">
                            <h4 className="font-medium flex items-center gap-2">
                              Side Effects (actionType)
                              <PolicyExplainer term="side_effect" />
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              Mark actions that change external state: sending emails, processing payments, modifying databases. 
                              Side effects are never auto-approved and require explicit allow rules.
                            </p>
                            <PolicyWarning type="irreversible" />
                          </div>

                          {/* Rate Limiting */}
                          <div className="space-y-2">
                            <h4 className="font-medium flex items-center gap-2">
                              Rate Limiting
                            </h4>
                            <div className="grid sm:grid-cols-2 gap-4 text-sm">
                              <div className="p-3 bg-muted/50 rounded-lg">
                                <div className="flex items-center gap-2 font-medium mb-1">
                                  maxCallsPerSession
                                  <PolicyExplainer term="maxCalls" />
                                </div>
                                <p className="text-muted-foreground text-xs">
                                  Maximum times this tool can be called per session.
                                </p>
                              </div>
                              <div className="p-3 bg-muted/50 rounded-lg">
                                <div className="flex items-center gap-2 font-medium mb-1">
                                  cooldownMs
                                  <PolicyExplainer term="cooldown" />
                                </div>
                                <p className="text-muted-foreground text-xs">
                                  Minimum time (ms) between calls to this tool.
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Required Fields */}
                          <div className="space-y-2">
                            <h4 className="font-medium flex items-center gap-2">
                              Field Constraints
                              <PolicyExplainer term="requireFields" />
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              Use <code className="text-xs bg-muted px-1 rounded">requireFields</code> to mandate payload fields. 
                              Use <code className="text-xs bg-muted px-1 rounded">denyIfFieldsPresent</code> to block if certain fields exist.
                            </p>
                          </div>

                          {/* Why not if/else */}
                          <WhyNotIfElse />
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
