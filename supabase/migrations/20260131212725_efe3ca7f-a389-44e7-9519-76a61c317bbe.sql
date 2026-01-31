-- Fix RLS policy for rate limits - restrict to service role only
-- Drop the overly permissive policy and create a proper one

DROP POLICY IF EXISTS "Service role can manage rate_limits" ON public.api_key_rate_limits;

-- Rate limits are ONLY managed by edge functions via service role key
-- Regular users should never access this table directly
-- The service role bypasses RLS, so we create a restrictive policy
-- that denies all access to regular users
CREATE POLICY "No direct user access to rate_limits"
ON public.api_key_rate_limits
FOR ALL
USING (false)
WITH CHECK (false);

COMMENT ON POLICY "No direct user access to rate_limits" ON public.api_key_rate_limits IS 
'Rate limits are managed exclusively by edge functions using service role. Regular users cannot access.';