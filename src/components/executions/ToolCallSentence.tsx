import { CheckCircle2, XCircle, ArrowRight, Clock, Timer } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';

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

interface ToolCallSentenceProps {
  log: ToolCallLog;
  isLast?: boolean;
}

/**
 * Renders a tool call as a human-readable sentence
 * "Agent attempted X → Blocked because Y"
 */
export function ToolCallSentence({ log, isLast = false }: ToolCallSentenceProps) {
  // Build human-readable sentence
  const buildSentence = () => {
    const tool = log.tool_name;
    
    if (log.decision === 'allowed') {
      if (log.state_before !== log.state_after) {
        return (
          <>
            Agent called <code className="text-primary">{tool}</code>{' '}
            <ArrowRight className="inline h-3 w-3 mx-1" />
            <span className="text-success">Allowed</span>, 
            state changed to <code className="text-primary">{log.state_after}</code>
          </>
        );
      }
      return (
        <>
          Agent called <code className="text-primary">{tool}</code>{' '}
          <ArrowRight className="inline h-3 w-3 mx-1" />
          <span className="text-success">Allowed</span>
        </>
      );
    }
    
    // Blocked - find the most important reason
    const mainReason = getMainBlockReason(log.decision_reasons, log.error_code);
    return (
      <>
        Agent attempted <code className="text-primary">{tool}</code>{' '}
        <ArrowRight className="inline h-3 w-3 mx-1" />
        <span className="text-destructive">Blocked</span> because {mainReason}
      </>
    );
  };

  // Get human-readable main reason
  const getMainBlockReason = (reasons: string[], errorCode: string | null): string => {
    if (reasons.length === 0) {
      return errorCode || 'policy denied execution';
    }
    
    // Return the first reason, cleaned up
    const reason = reasons[0];
    
    // Make common patterns more readable
    if (reason.includes('REQUIRED_TOOLS_NOT_CALLED')) {
      const match = reason.match(/requires? (.+?) to be called/i);
      if (match) return `${match[1]} was not called first`;
    }
    
    if (reason.includes('REQUIRED_STATE_NOT_MET')) {
      const match = reason.match(/requires? state "(.+?)"/i);
      if (match) return `current state is not "${match[1]}"`;
    }
    
    if (reason.includes('MAX_CALLS_EXCEEDED')) {
      return 'maximum call limit was reached';
    }
    
    if (reason.includes('COOLDOWN_ACTIVE')) {
      return 'cooldown period has not elapsed';
    }
    
    return reason.toLowerCase();
  };

  // Format counters as human-readable
  const formatCounters = (counters: Record<string, number>) => {
    const entries = Object.entries(counters);
    if (entries.length === 0) return null;
    
    return entries.map(([name, value]) => (
      <span key={name} className="inline-flex items-center gap-1 text-xs bg-muted px-1.5 py-0.5 rounded">
        {name}: {value}
      </span>
    ));
  };

  const countersChanged = JSON.stringify(log.counters_before) !== JSON.stringify(log.counters_after);

  return (
    <div
      className={`relative pl-8 pb-6 ${
        !isLast ? 'border-l-2 border-border ml-2' : ''
      }`}
    >
      {/* Timeline dot */}
      <div className={`absolute -left-[9px] top-0 flex h-4 w-4 items-center justify-center rounded-full ${
        log.decision === 'allowed' ? 'bg-success' : 'bg-destructive'
      }`}>
        {log.decision === 'allowed' ? (
          <CheckCircle2 className="h-2.5 w-2.5 text-success-foreground" />
        ) : (
          <XCircle className="h-2.5 w-2.5 text-destructive-foreground" />
        )}
      </div>
      
      <div className="glass-card p-4 ml-2">
        {/* Main sentence */}
        <p className="text-sm leading-relaxed mb-3">
          {buildSentence()}
        </p>
        
        {/* Metadata row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          {/* Timestamp */}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(log.timestamp).toLocaleTimeString()}
          </span>
          
          {/* Latency */}
          {log.execution_duration_ms !== null && (
            <span className={`flex items-center gap-1 font-mono ${
              log.execution_duration_ms < 5 ? 'text-success' : 
              log.execution_duration_ms < 20 ? 'text-warning' : 'text-destructive'
            }`}>
              <Timer className="h-3 w-3" />
              {log.execution_duration_ms}ms
            </span>
          )}
          
          {/* Policy version */}
          {log.policy_version_used && (
            <span>policy v{log.policy_version_used}</span>
          )}
        </div>
        
        {/* State transition */}
        {log.state_before !== log.state_after && (
          <div className="mt-2 text-xs">
            <span className="text-muted-foreground">State:</span>{' '}
            <code className="bg-muted px-1 rounded">{log.state_before}</code>
            <ArrowRight className="inline h-3 w-3 mx-1 text-muted-foreground" />
            <code className="bg-primary/10 text-primary px-1 rounded">{log.state_after}</code>
          </div>
        )}
        
        {/* Counters */}
        {countersChanged && Object.keys(log.counters_after).length > 0 && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Counters:</span>
            {formatCounters(log.counters_after)}
          </div>
        )}
        
        {/* Decision reasons (for blocked) */}
        {log.decision === 'blocked' && log.decision_reasons.length > 1 && (
          <details className="mt-3">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
              {log.decision_reasons.length} reasons
            </summary>
            <ul className="mt-2 text-xs space-y-1 text-muted-foreground">
              {log.decision_reasons.map((reason, i) => (
                <li key={i}>• {reason}</li>
              ))}
            </ul>
          </details>
        )}
        
        {/* Expandable payload */}
        <details className="mt-3">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            View payload
          </summary>
          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
            {JSON.stringify(log.payload_redacted, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
