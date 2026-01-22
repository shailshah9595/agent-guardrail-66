-- Add policy_version_locked to execution_sessions to ensure session locks policy at creation
ALTER TABLE public.execution_sessions 
ADD COLUMN IF NOT EXISTS policy_version_locked INTEGER;

-- Add initial_state column to track the state at session start
ALTER TABLE public.execution_sessions 
ADD COLUMN IF NOT EXISTS initial_state TEXT DEFAULT 'initial';

-- Add policy_id to execution_sessions to track which policy is locked
ALTER TABLE public.execution_sessions 
ADD COLUMN IF NOT EXISTS policy_id UUID REFERENCES public.policies(id);

-- Add call_count per tool tracking as JSONB
ALTER TABLE public.execution_sessions 
ADD COLUMN IF NOT EXISTS tool_call_counts JSONB DEFAULT '{}';

-- Add last_tool_call_times for cooldown tracking
ALTER TABLE public.execution_sessions 
ADD COLUMN IF NOT EXISTS last_tool_call_times JSONB DEFAULT '{}';

-- Add NOT NULL constraint to decision_reasons 
ALTER TABLE public.tool_call_logs 
ALTER COLUMN decision_reasons SET DEFAULT '{}';

-- Add error_code column for stable error codes
ALTER TABLE public.tool_call_logs 
ADD COLUMN IF NOT EXISTS error_code TEXT;

-- Create index for faster session lookups
CREATE INDEX IF NOT EXISTS idx_execution_sessions_env_session 
ON public.execution_sessions(env_id, session_id);

-- Create index for faster tool call log queries
CREATE INDEX IF NOT EXISTS idx_tool_call_logs_session_timestamp 
ON public.tool_call_logs(execution_session_id, timestamp);

-- RLS policy for service role to write execution_sessions (used by edge function)
CREATE POLICY "Service role can insert execution_sessions" 
ON public.execution_sessions 
FOR INSERT 
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update execution_sessions" 
ON public.execution_sessions 
FOR UPDATE 
TO service_role
USING (true);

-- RLS policy for service role to write tool_call_logs
CREATE POLICY "Service role can insert tool_call_logs" 
ON public.tool_call_logs 
FOR INSERT 
TO service_role
WITH CHECK (true);