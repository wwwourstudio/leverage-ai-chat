-- Grant EXECUTE on process_odds_batch to authenticated and anon roles.
-- The function is SECURITY DEFINER so callers do not bypass RLS on other tables;
-- this grant only allows them to invoke it.
--
-- Run in Supabase SQL Editor (as postgres / service_role):
--   \i scripts/grant-process-odds-batch.sql

GRANT EXECUTE ON FUNCTION api.process_odds_batch(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION api.process_odds_batch(jsonb) TO anon;
