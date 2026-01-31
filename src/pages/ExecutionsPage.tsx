import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Activity, Loader2, ArrowLeft, CheckCircle2, XCircle, Timer } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExecutionReplay } from '@/components/executions/ExecutionReplay';
import { ToolCallSentence } from '@/components/executions/ToolCallSentence';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ExecutionSession {
  id: string;
  agent_id: string;
  session_id: string;
  current_state: string;
  policy_id: string | null;
  policy_version_locked: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  environment?: { name: string; project: { name: string } };
  _toolCallStats?: { allowed: number; blocked: number; avgLatencyMs: number };
}

interface ToolCallLog {
  id: string;
  timestamp: string;
  tool_name: string;
  action_type: string | null;
  payload_redacted: Record<string, unknown>;
  decision: 'allowed' | 'blocked';
  decision_reasons: string[];
  error_code: string | null;
  policy_version_used: number | null;
  policy_hash: string | null;
  state_before: string | null;
  state_after: string | null;
  counters_before: Record<string, number>;
  counters_after: Record<string, number>;
  execution_duration_ms: number | null;
}

export default function ExecutionsPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [sessions, setSessions] = useState<ExecutionSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ExecutionSession | null>(null);
  const [toolCalls, setToolCalls] = useState<ToolCallLog[]>([]);
  const [policySpec, setPolicySpec] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (sessionId) {
      loadSessionDetail(sessionId);
    } else {
      setSelectedSession(null);
      setToolCalls([]);
      setPolicySpec(null);
    }
  }, [sessionId]);

  async function loadSessions() {
    try {
      const { data, error } = await supabase
        .from('execution_sessions')
        .select(`
          id, agent_id, session_id, current_state, policy_id, policy_version_locked, metadata, created_at, updated_at,
          environment:environments(name, project:projects(name))
        `)
        .order('updated_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const sessionsWithStats = await Promise.all(
        (data || []).map(async (session) => {
          const { data: logs } = await supabase
            .from('tool_call_logs')
            .select('decision, execution_duration_ms')
            .eq('execution_session_id', session.id);

          const allowed = (logs || []).filter(l => l.decision === 'allowed').length;
          const blocked = (logs || []).filter(l => l.decision === 'blocked').length;
          const durations = (logs || [])
            .filter(l => l.execution_duration_ms !== null)
            .map(l => l.execution_duration_ms as number);
          const avgLatencyMs = durations.length > 0 
            ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
            : 0;

          return {
            ...session,
            environment: Array.isArray(session.environment) ? session.environment[0] : session.environment,
            _toolCallStats: { allowed, blocked, avgLatencyMs },
          };
        })
      );

      setSessions(sessionsWithStats as ExecutionSession[]);
    } catch (error: any) {
      toast({
        title: 'Failed to load executions',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadSessionDetail(id: string) {
    setDetailLoading(true);
    try {
      const { data: session, error: sessionError } = await supabase
        .from('execution_sessions')
        .select(`
          id, agent_id, session_id, current_state, policy_id, policy_version_locked, metadata, created_at, updated_at,
          environment:environments(name, project:projects(name))
        `)
        .eq('id', id)
        .single();

      if (sessionError) throw sessionError;

      setSelectedSession({
        ...session,
        environment: Array.isArray(session.environment) ? session.environment[0] : session.environment,
      } as ExecutionSession);

      // Load tool calls
      const { data: logs, error: logsError } = await supabase
        .from('tool_call_logs')
        .select('*')
        .eq('execution_session_id', id)
        .order('timestamp', { ascending: true });

      if (logsError) throw logsError;
      setToolCalls((logs || []) as ToolCallLog[]);

      // Load policy spec for replay
      if (session.policy_id) {
        const { data: policy } = await supabase
          .from('policies')
          .select('policy_spec')
          .eq('id', session.policy_id)
          .single();
        
        setPolicySpec(policy?.policy_spec as Record<string, unknown> || null);
      }
    } catch (error: any) {
      toast({
        title: 'Failed to load session detail',
        description: error.message,
        variant: 'destructive',
      });
      navigate('/executions');
    } finally {
      setDetailLoading(false);
    }
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

  // Session detail view
  if (sessionId && selectedSession) {
    const avgLatency = toolCalls.length > 0
      ? Math.round(toolCalls.filter(t => t.execution_duration_ms).reduce((a, b) => a + (b.execution_duration_ms || 0), 0) / toolCalls.filter(t => t.execution_duration_ms).length)
      : 0;

    return (
      <AppLayout>
        <div className="p-6 lg:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/executions')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Execution Detail</h1>
                <p className="text-muted-foreground">
                  {selectedSession.environment?.project?.name} / {selectedSession.environment?.name}
                </p>
              </div>
            </div>
            <ExecutionReplay
              sessionId={selectedSession.id}
              toolCalls={toolCalls}
              policySpec={policySpec}
            />
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Agent ID</CardTitle>
              </CardHeader>
              <CardContent>
                <code className="text-sm font-mono">{selectedSession.agent_id}</code>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Session ID</CardTitle>
              </CardHeader>
              <CardContent>
                <code className="text-sm font-mono">{selectedSession.session_id.substring(0, 16)}...</code>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Policy Version</CardTitle>
              </CardHeader>
              <CardContent>
                <code className="text-sm font-mono">v{selectedSession.policy_version_locked || '?'}</code>
                <span className="text-xs text-muted-foreground ml-2">(locked at session start)</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Latency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  <span className={`font-mono ${avgLatency < 5 ? 'text-success' : avgLatency < 20 ? 'text-warning' : 'text-destructive'}`}>
                    {avgLatency}ms
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tool Call Timeline</CardTitle>
              <CardDescription>
                Each tool call reads as a sentence. A non-expert should understand failures in under 30 seconds.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {detailLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : toolCalls.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tool calls recorded yet.
                </div>
              ) : (
                <div className="ml-2">
                  {toolCalls.map((log, index) => (
                    <ToolCallSentence
                      key={log.id}
                      log={log}
                      isLast={index === toolCalls.length - 1}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Sessions list view
  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageHeader
          title="Executions"
          description="View audit logs of agent executions and tool calls. Every decision is recorded for compliance."
        />

        {sessions.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No executions yet"
            description="Execution logs will appear here when your agents make tool calls through the firewall."
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project / Environment</TableHead>
                    <TableHead>Agent ID</TableHead>
                    <TableHead>Session ID</TableHead>
                    <TableHead>Policy</TableHead>
                    <TableHead>Decisions</TableHead>
                    <TableHead>Avg Latency</TableHead>
                    <TableHead>Last Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow
                      key={session.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/executions/${session.id}`)}
                    >
                      <TableCell>
                        <span className="font-medium">{session.environment?.project?.name}</span>
                        <span className="text-muted-foreground"> / {session.environment?.name}</span>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm font-mono">{session.agent_id}</code>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm font-mono">{session.session_id.substring(0, 8)}...</code>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm">v{session.policy_version_locked || '?'}</code>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-success">
                            <CheckCircle2 className="h-3 w-3" />
                            {session._toolCallStats?.allowed || 0}
                          </span>
                          <span className="flex items-center gap-1 text-destructive">
                            <XCircle className="h-3 w-3" />
                            {session._toolCallStats?.blocked || 0}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`font-mono text-sm ${
                          (session._toolCallStats?.avgLatencyMs || 0) < 5 ? 'text-success' : 
                          (session._toolCallStats?.avgLatencyMs || 0) < 20 ? 'text-warning' : 'text-muted-foreground'
                        }`}>
                          {session._toolCallStats?.avgLatencyMs || 0}ms
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(session.updated_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
