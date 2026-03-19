-- =============================================================================
-- Fix: api.draft_picks — auth.uid() re-evaluated per row in RLS policy
-- Supabase lint: "Draft pick access re-evaluates auth.<function>() per row"
--
-- Wrap auth.uid() with (select auth.uid()) so Postgres treats it as a
-- stable expression evaluated once per statement, not once per row.
-- =============================================================================

DROP POLICY IF EXISTS "Draft pick access" ON api.draft_picks;
CREATE POLICY "Draft pick access"
  ON api.draft_picks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM api.draft_rooms
      JOIN api.fantasy_leagues ON fantasy_leagues.id = draft_rooms.league_id
      WHERE draft_rooms.id = draft_picks.draft_room_id
        AND fantasy_leagues.user_id = (SELECT auth.uid())
    )
  );

-- Verify
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'api' AND tablename = 'draft_picks';
