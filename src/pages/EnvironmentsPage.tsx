import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Server, Key, Plus, Loader2, Copy, Check, Trash2 } from 'lucide-react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Environment {
  id: string;
  name: string;
  project_id: string;
  created_at: string;
  project?: { name: string };
}

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  revoked_at: string | null;
}

interface Project {
  id: string;
  name: string;
}

export default function EnvironmentsPage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project');
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [keysLoading, setKeysLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [projectId]);

  useEffect(() => {
    if (selectedEnvId) {
      loadApiKeys(selectedEnvId);
    }
  }, [selectedEnvId]);

  async function loadData() {
    try {
      // Load projects for filter
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');
      setProjects(projectsData || []);

      // Load environments
      let query = supabase
        .from('environments')
        .select(`
          id,
          name,
          project_id,
          created_at,
          project:projects(name)
        `)
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const envs = (data || []).map(env => ({
        ...env,
        project: Array.isArray(env.project) ? env.project[0] : env.project
      }));
      setEnvironments(envs);

      // Auto-select first environment if available
      if (envs.length > 0 && !selectedEnvId) {
        setSelectedEnvId(envs[0].id);
      }
    } catch (error: any) {
      toast({
        title: 'Failed to load environments',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadApiKeys(envId: string) {
    setKeysLoading(true);
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('env_id', envId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys(data || []);
    } catch (error: any) {
      toast({
        title: 'Failed to load API keys',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setKeysLoading(false);
    }
  }

  async function generateApiKey(): Promise<{ key: string; prefix: string; hash: string }> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const prefix = 'af_';
    let secret = '';
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const fullKey = prefix + secret;
    // SHA-256 hash matching the runtime-check edge function
    const encoder = new TextEncoder();
    const data = encoder.encode(fullKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return { key: fullKey, prefix: prefix + secret.substring(0, 5), hash };
  }

  async function createApiKey() {
    if (!newKeyName.trim() || !selectedEnvId) return;
    setCreating(true);

    try {
      const { key, prefix, hash } = await generateApiKey();

      const { error } = await supabase
        .from('api_keys')
        .insert({
          env_id: selectedEnvId,
          name: newKeyName.trim(),
          key_prefix: prefix,
          key_hash: hash,
        });

      if (error) throw error;

      setGeneratedSecret(key);
      loadApiKeys(selectedEnvId);
      setNewKeyName('');
    } catch (error: any) {
      toast({
        title: 'Failed to create API key',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  }

  async function revokeApiKey(keyId: string) {
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', keyId);

      if (error) throw error;

      toast({
        title: 'API key revoked',
        description: 'The API key has been revoked and can no longer be used.',
      });

      if (selectedEnvId) loadApiKeys(selectedEnvId);
    } catch (error: any) {
      toast({
        title: 'Failed to revoke API key',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const selectedEnv = environments.find(e => e.id === selectedEnvId);

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
      <div className="p-6 lg:p-8 space-y-8">
        <PageHeader
          title="Environments"
          description="Manage environments and API keys for your projects."
        />

        {environments.length === 0 ? (
          <EmptyState
            icon={Server}
            title="No environments yet"
            description="Create a project first to get started with environments."
            action={{
              label: 'Go to Projects',
              onClick: () => navigate('/projects'),
            }}
          />
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Environment selector */}
            <div className="lg:col-span-1 space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Select Environment</h3>
              <div className="space-y-2">
                {environments.map((env) => (
                  <button
                    key={env.id}
                    onClick={() => setSelectedEnvId(env.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      selectedEnvId === env.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{env.project?.name}</p>
                      <StatusBadge status={env.name as any} className="mt-1" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* API Keys */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5" />
                      API Keys
                    </CardTitle>
                    <CardDescription>
                      Manage API keys for {selectedEnv?.project?.name} / {selectedEnv?.name}
                    </CardDescription>
                  </div>
                  <Dialog open={dialogOpen} onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) {
                      setGeneratedSecret(null);
                      setNewKeyName('');
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Create Key
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create API Key</DialogTitle>
                        <DialogDescription>
                          Create a new API key for the {selectedEnv?.name} environment.
                        </DialogDescription>
                      </DialogHeader>
                      {generatedSecret ? (
                        <div className="space-y-4 mt-4">
                          <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                            <p className="text-sm font-medium text-success mb-2">
                              API Key Created Successfully
                            </p>
                            <p className="text-xs text-muted-foreground mb-3">
                              Copy this key now. You won't be able to see it again.
                            </p>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 p-2 bg-background rounded text-sm font-mono break-all">
                                {generatedSecret}
                              </code>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => copyToClipboard(generatedSecret)}
                              >
                                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                          <Button onClick={() => setDialogOpen(false)} className="w-full">
                            Done
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4 mt-4">
                          <div className="space-y-2">
                            <Label htmlFor="keyName">Key Name</Label>
                            <Input
                              id="keyName"
                              placeholder="Production API Key"
                              value={newKeyName}
                              onChange={(e) => setNewKeyName(e.target.value)}
                            />
                          </div>
                          <Button onClick={createApiKey} disabled={creating || !newKeyName.trim()} className="w-full">
                            {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Create Key
                          </Button>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {keysLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : apiKeys.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No API keys yet. Create one to start using the firewall.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Key Prefix</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {apiKeys.map((key) => (
                          <TableRow key={key.id}>
                            <TableCell className="font-medium">{key.name}</TableCell>
                            <TableCell>
                              <code className="text-sm font-mono">{key.key_prefix}...</code>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(key.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {key.revoked_at ? (
                                <StatusBadge status="blocked" />
                              ) : (
                                <StatusBadge status="allowed" />
                              )}
                            </TableCell>
                            <TableCell>
                              {!key.revoked_at && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => revokeApiKey(key.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
