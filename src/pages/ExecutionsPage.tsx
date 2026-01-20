import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Activity, Loader2, ArrowLeft, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ExecutionSession {
  id: string;
  agent_id: string;
  session_id: string;
  current_state: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  environment?: { name: string; project: { name: string } };
  _toolCallStats?: { allowed: number; blocked: number };
}

interface ToolCallLog {
  id: string;
  timestamp: string;
  tool_name: string;
  action_type: string | null;
  payload_redacted: Record<string, unknown>;
  decision: 'allowed' | 'blocked';
  decision_reasons: string[];
  policy_version_used: number | null;
  state_before: string | null;
  state_after: string | null;
  counters_before: Record<string, number>;
  counters_after: Record<string, number>;
}

export default function ExecutionsPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [sessions, setSessions] = useState<ExecutionSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ExecutionSession | null>(null);
  const [toolCalls, setToolCalls] = useState<ToolCallLog[]>([]);
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
    }
  }, [sessionId]);

  async function loadSessions() {
    try {
      const { data, error } = await supabase
        .from('execution_sessions')
        .select(`
          id, agent_id, session_id, current_state, metadata, created_at, updated_at,
          environment:environments(name, project:projects(name))
        `)
        .order('updated_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Load tool call stats for each session
      const sessionsWithStats = await Promise.all(
        (data || []).map(async (session) => {
          const { data: logs } = await supabase
            .from('tool_call_logs')
            .select('decision')
            .eq('execution_session_id', session.id);

          const allowed = (logs || []).filter(l => l.decision === 'allowed').length;
          const blocked = (logs || []).filter(l => l.decision === 'blocked').length;

          return {
            ...session,
            environment: Array.isArray(session.environment) ? session.environment[0] : session.environment,
            _toolCallStats: { allowed, blocked },
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
      // Load session
      const { data: session, error: sessionError } = await supabase
        .from('execution_sessions')
        .select(`
          id, agent_id, session_id, current_state, metadata, created_at, updated_at,
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
    return (
      <AppLayout>
        <div className="p-6 lg:p-8 space-y-6">
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

          <div className="grid md:grid-cols-3 gap-4">
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
                <code className="text-sm font-mono">{selectedSession.session_id}</code>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Current State</CardTitle>
              </CardHeader>
              <CardContent>
                <code className="text-sm font-mono">{selectedSession.current_state}</code>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tool Call Timeline</CardTitle>
              <CardDescription>
                Chronological log of all tool calls in this session.
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
                <div className="space-y-4">
                  {toolCalls.map((log, index) => (
                    <div
                      key={log.id}
                      className={`relative pl-6 pb-4 ${
                        index < toolCalls.length - 1 ? 'border-l border-border ml-2' : ''
                      }`}
                    >
                      <div className={`absolute -left-2 top-0 flex h-4 w-4 items-center justify-center rounded-full ${
                        log.decision === 'allowed' ? 'bg-success' : 'bg-destructive'
                      }`}>
                        {log.decision === 'allowed' ? (
                          <CheckCircle2 className="h-3 w-3 text-success-foreground" />
                        ) : (
                          <XCircle className="h-3 w-3 text-destructive-foreground" />
                        )}
                      </div>
                      
                      <div className="glass-card p-4 ml-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono font-medium">{log.tool_name}</code>
                            <StatusBadge status={log.decision} />
                          </div>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        
                        {log.decision_reasons.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs text-muted-foreground mb-1">Reasons:</p>
                            <ul className="text-sm space-y-0.5">
                              {log.decision_reasons.map((reason, i) => (
                                <li key={i} className="text-muted-foreground">• {reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {log.state_before !== log.state_after && (
                          <div className="text-xs text-muted-foreground">
                            State: <code>{log.state_before}</code> → <code>{log.state_after}</code>
                          </div>
                        )}

                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer">
                            View payload
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                            {JSON.stringify(log.payload_redacted, null, 2)}
                          </pre>
                        </details>
                      </div>
                    </div>
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
          description="View audit logs of agent executions and tool calls."
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
                    <TableHead>State</TableHead>
                    <TableHead>Decisions</TableHead>
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
                        <span className="font-medium">
                          {session.environment?.project?.name}
                        </span>
                        <span className="text-muted-foreground"> / {session.environment?.name}</span>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm font-mono">{session.agent_id}</code>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm font-mono">{session.session_id.substring(0, 8)}...</code>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm">{session.current_state}</code>
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
