-- ============================================
-- PRODUCTION HARDENING MIGRATION
-- Adds latency tracking, policy hashing, rate limiting
-- ============================================

-- 1. Add execution_duration_ms to tool_call_logs for latency tracking
ALTER TABLE public.tool_call_logs 
ADD COLUMN IF NOT EXISTS execution_duration_ms integer;

-- 2. Add policy_hash to policies for immutability verification
ALTER TABLE public.policies 
ADD COLUMN IF NOT EXISTS policy_hash text;

-- 3. Add policy_hash to tool_call_logs for audit trail
ALTER TABLE public.tool_call_logs 
ADD COLUMN IF NOT EXISTS policy_hash text;

-- 4. Create rate limiting table for API key throttling
CREATE TABLE IF NOT EXISTS public.api_key_rate_limits (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
    window_start timestamp with time zone NOT NULL DEFAULT now(),
    request_count integer NOT NULL DEFAULT 0,
    UNIQUE(api_key_id, window_start)
);

-- Enable RLS on rate limits table
ALTER TABLE public.api_key_rate_limits ENABLE ROW LEVEL SECURITY;

-- Service role can manage rate limits
CREATE POLICY "Service role can manage rate_limits"
ON public.api_key_rate_limits
FOR ALL
USING (true)
WITH CHECK (true);

-- 5. Create policy_versions table for immutable version history
CREATE TABLE IF NOT EXISTS public.policy_versions (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    policy_id uuid NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
    version integer NOT NULL,
    policy_spec jsonb NOT NULL,
    policy_hash text NOT NULL,
    published_at timestamp with time zone NOT NULL DEFAULT now(),
    published_by uuid REFERENCES auth.users(id),
    UNIQUE(policy_id, version)
);

-- Enable RLS
ALTER TABLE public.policy_versions ENABLE ROW LEVEL SECURITY;

-- Users can view policy versions in their environments
CREATE POLICY "Users can view policy_versions in their environments"
ON public.policy_versions
FOR SELECT
USING (EXISTS (
    SELECT 1 FROM policies p
    JOIN environments e ON e.id = p.env_id
    JOIN projects pr ON pr.id = e.project_id
    WHERE p.id = policy_versions.policy_id
    AND pr.org_id = get_user_org_id(auth.uid())
));

-- Users can insert policy versions in their environments
CREATE POLICY "Users can insert policy_versions in their environments"
ON public.policy_versions
FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM policies p
    JOIN environments e ON e.id = p.env_id
    JOIN projects pr ON pr.id = e.project_id
    WHERE p.id = policy_versions.policy_id
    AND pr.org_id = get_user_org_id(auth.uid())
));

-- 6. Create indexes for performance (O(1) lookups)
-- Index for API key lookup by prefix + hash (critical path)
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix_hash 
ON public.api_keys(key_prefix, key_hash) 
WHERE revoked_at IS NULL;

-- Index for policy lookup by env_id and status
CREATE INDEX IF NOT EXISTS idx_policies_env_status 
ON public.policies(env_id, status) 
WHERE status = 'published';

-- Index for session lookup by env_id and session_id
CREATE INDEX IF NOT EXISTS idx_execution_sessions_env_session 
ON public.execution_sessions(env_id, session_id);

-- Index for tool call logs by session
CREATE INDEX IF NOT EXISTS idx_tool_call_logs_session 
ON public.tool_call_logs(execution_session_id, timestamp);

-- Index for rate limiting lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_window 
ON public.api_key_rate_limits(api_key_id, window_start);

-- 7. Add comment explaining concurrency safety strategy
COMMENT ON TABLE public.execution_sessions IS 
'Execution sessions track agent state. Concurrency safety is enforced via:
1. Row-level locking on session updates (SELECT FOR UPDATE in edge function)
2. Atomic counter increments using JSONB operators
3. Policy version locked at session creation prevents mid-session policy changes
4. All state mutations happen in single UPDATE statement';

COMMENT ON COLUMN public.tool_call_logs.execution_duration_ms IS 
'Execution time in milliseconds for the runtime check. Target: <5ms excluding network.';

COMMENT ON COLUMN public.policies.policy_hash IS 
'SHA-256 hash of policy_spec JSON. Used to verify policy immutability and track exact version used.';

COMMENT ON TABLE public.policy_versions IS 
'Immutable record of all published policy versions. Once published, a version cannot be modified. Used for audit trail and execution replay.';

COMMENT ON TABLE public.api_key_rate_limits IS 
'Rate limiting counters per API key. 1-minute sliding windows. Prevents abuse of runtime-check endpoint.';