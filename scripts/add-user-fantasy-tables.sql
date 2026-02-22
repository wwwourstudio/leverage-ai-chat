-- ============================================================================
-- LEVERAGE AI - MISSING TABLES MIGRATION
-- Run this in Supabase SQL Editor if you already ran master-schema.sql.
-- Safe to run multiple times (uses IF NOT EXISTS / IF NOT EXISTS guards).
-- ============================================================================

-- Ensure the api schema exists and all objects land in it
CREATE SCHEMA IF NOT EXISTS api;
SET search_path TO api;

-- ============================================================================
-- 1. USER PROFILES
-- Stores per-user display name, avatar, subscription tier, and credits.
-- Referenced by: page-client.tsx, SettingsLightbox, UserLightbox
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name       TEXT,
  avatar_url         TEXT,
  subscription_tier  TEXT        NOT NULL DEFAULT 'free'
                                 CHECK (subscription_tier IN ('free', 'core', 'pro', 'high_stakes')),
  credits_remaining  INTEGER     NOT NULL DEFAULT 15,
  credits_total      INTEGER     NOT NULL DEFAULT 15,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- ============================================================================
-- 2. USER PREFERENCES
-- Stores notification settings, preferred sports/books, theme, bankroll.
-- Referenced by: SettingsLightbox, server-data-loader.ts
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tracked_sports        TEXT[]      NOT NULL DEFAULT ARRAY['NBA','NFL'],
  preferred_books       TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  theme                 TEXT        NOT NULL DEFAULT 'dark'
                                    CHECK (theme IN ('dark', 'light', 'system')),
  default_sport         TEXT        NOT NULL DEFAULT 'NBA',
  email_notifications   BOOLEAN     NOT NULL DEFAULT TRUE,
  push_notifications    BOOLEAN     NOT NULL DEFAULT FALSE,
  odds_alerts           BOOLEAN     NOT NULL DEFAULT TRUE,
  line_movement_alerts  BOOLEAN     NOT NULL DEFAULT TRUE,
  arbitrage_alerts      BOOLEAN     NOT NULL DEFAULT TRUE,
  bankroll              NUMERIC     NOT NULL DEFAULT 0,
  risk_tolerance        TEXT        NOT NULL DEFAULT 'medium'
                                    CHECK (risk_tolerance IN ('conservative', 'medium', 'aggressive')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- ============================================================================
-- 3. USER ALERTS
-- Stores per-user configurable alerts for odds changes, line movement, etc.
-- Referenced by: AlertsLightbox
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_alerts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type        TEXT        NOT NULL
                                CHECK (alert_type IN (
                                  'odds_change','line_movement','player_prop',
                                  'arbitrage','kalshi_price','game_start'
                                )),
  sport             TEXT,
  team              TEXT,
  player            TEXT,
  condition         JSONB       NOT NULL DEFAULT '{}',
  threshold         NUMERIC,
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  trigger_count     INTEGER     NOT NULL DEFAULT 0,
  max_triggers      INTEGER     NOT NULL DEFAULT 1,
  last_triggered_at TIMESTAMPTZ,
  title             TEXT        NOT NULL,
  description       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_alerts_user_id   ON user_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_alerts_is_active ON user_alerts(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_alerts_type      ON user_alerts(alert_type);

-- ============================================================================
-- 4. USER STATS
-- Aggregate betting performance stats per user.
-- Referenced by: server-data-loader.ts
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_stats (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_analyses       INTEGER     NOT NULL DEFAULT 0,
  total_bets_tracked   INTEGER     NOT NULL DEFAULT 0,
  wins                 INTEGER     NOT NULL DEFAULT 0,
  losses               INTEGER     NOT NULL DEFAULT 0,
  pushes               INTEGER     NOT NULL DEFAULT 0,
  total_wagered        NUMERIC     NOT NULL DEFAULT 0,
  total_won            NUMERIC     NOT NULL DEFAULT 0,
  roi                  NUMERIC     NOT NULL DEFAULT 0,
  longest_win_streak   INTEGER     NOT NULL DEFAULT 0,
  current_win_streak   INTEGER     NOT NULL DEFAULT 0,
  favorite_sport       TEXT,
  favorite_book        TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);

-- ============================================================================
-- 5. USER INSIGHTS
-- Rolling insights used by /api/insights route.
-- Referenced by: api/insights/route.ts, CLAUDE.md (listed as existing but was absent)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_insights (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_value      NUMERIC     NOT NULL DEFAULT 0,
  win_rate         NUMERIC     NOT NULL DEFAULT 0,
  roi              NUMERIC     NOT NULL DEFAULT 0,
  active_contests  INTEGER     NOT NULL DEFAULT 0,
  total_invested   NUMERIC     NOT NULL DEFAULT 0,
  last_updated     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_insights_user_id ON user_insights(user_id);

-- ============================================================================
-- 6. SUBSCRIPTION TIERS
-- Per-user subscription info (used for feature gating in fantasy routes).
-- Referenced by: api/fantasy/waivers/route.ts
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_tiers (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tier                    TEXT        NOT NULL DEFAULT 'free'
                                      CHECK (tier IN ('free', 'core', 'pro', 'high_stakes')),
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_tiers_user_id ON subscription_tiers(user_id);

-- ============================================================================
-- 7. FANTASY LEAGUES
-- Top-level league configuration.
-- Referenced by: api/fantasy/leagues, api/fantasy/waivers, api/fantasy/draft/*
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_leagues (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  sport            TEXT        NOT NULL CHECK (sport IN ('nfl','nba','mlb','nhl')),
  platform         TEXT        NOT NULL DEFAULT 'custom',
  league_size      INTEGER     NOT NULL DEFAULT 12,
  scoring_type     TEXT        NOT NULL DEFAULT 'ppr'
                               CHECK (scoring_type IN ('ppr','half_ppr','standard','custom')),
  scoring_settings JSONB       NOT NULL DEFAULT '{}',
  roster_slots     JSONB       NOT NULL DEFAULT '{}',
  draft_type       TEXT        NOT NULL DEFAULT 'snake'
                               CHECK (draft_type IN ('snake','auction','linear')),
  faab_budget      INTEGER     NOT NULL DEFAULT 100,
  season_year      INTEGER     NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fantasy_leagues_user_id     ON fantasy_leagues(user_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_leagues_sport       ON fantasy_leagues(sport);
CREATE INDEX IF NOT EXISTS idx_fantasy_leagues_season_year ON fantasy_leagues(season_year);

-- ============================================================================
-- 8. FANTASY TEAMS
-- Teams within a league. One team per user per league.
-- Referenced by: api/fantasy/leagues, api/fantasy/waivers, api/fantasy/draft/*
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_teams (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id      UUID        NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
  user_id        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  team_name      TEXT        NOT NULL,
  draft_position INTEGER,
  is_user_team   BOOLEAN     NOT NULL DEFAULT FALSE,
  waiver_priority INTEGER,
  faab_remaining  INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fantasy_teams_league_id    ON fantasy_teams(league_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_teams_user_id      ON fantasy_teams(user_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_teams_is_user_team ON fantasy_teams(league_id, is_user_team);

-- ============================================================================
-- 9. FANTASY ROSTERS
-- Players on each team's roster.
-- Referenced by: api/fantasy/waivers, api/fantasy/draft/pick
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_rosters (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          UUID        NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  player_name      TEXT        NOT NULL,
  position         TEXT        NOT NULL,
  roster_slot      TEXT        NOT NULL,
  acquisition_type TEXT        NOT NULL DEFAULT 'draft'
                               CHECK (acquisition_type IN ('draft','waiver','trade','free_agent')),
  acquisition_cost INTEGER     NOT NULL DEFAULT 0,
  added_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fantasy_rosters_team_id     ON fantasy_rosters(team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_rosters_player_name ON fantasy_rosters(player_name);

-- ============================================================================
-- 10. FANTASY PROJECTIONS
-- Weekly or season-long player projections.
-- Referenced by: api/fantasy/projections, api/fantasy/waivers, api/fantasy/draft/simulate
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_projections (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sport              TEXT        NOT NULL,
  player_name        TEXT        NOT NULL,
  player_id          TEXT,
  position           TEXT        NOT NULL,
  season_year        INTEGER     NOT NULL,
  week               INTEGER,              -- NULL = season-long projection
  projection_source  TEXT        NOT NULL DEFAULT 'user',
  stats              JSONB       NOT NULL DEFAULT '{}',
  fantasy_points     NUMERIC     NOT NULL DEFAULT 0,
  adp                NUMERIC,
  vbd                NUMERIC,
  tier               INTEGER,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sport, player_name, season_year, week, projection_source)
);

CREATE INDEX IF NOT EXISTS idx_fantasy_projections_sport        ON fantasy_projections(sport);
CREATE INDEX IF NOT EXISTS idx_fantasy_projections_season       ON fantasy_projections(season_year);
CREATE INDEX IF NOT EXISTS idx_fantasy_projections_player       ON fantasy_projections(player_name);
CREATE INDEX IF NOT EXISTS idx_fantasy_projections_points       ON fantasy_projections(fantasy_points DESC);
CREATE INDEX IF NOT EXISTS idx_fantasy_projections_week_sport   ON fantasy_projections(sport, season_year, week);

-- ============================================================================
-- 11. WAIVER TRANSACTIONS
-- Waiver wire claims submitted by teams.
-- Referenced by: api/fantasy/waivers
-- ============================================================================

CREATE TABLE IF NOT EXISTS waiver_transactions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id    UUID        NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
  team_id      UUID        NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  add_player   TEXT        NOT NULL,
  drop_player  TEXT,
  faab_bid     INTEGER     NOT NULL DEFAULT 0,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','approved','rejected','processed')),
  week         INTEGER     NOT NULL,
  reason       TEXT,
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waiver_transactions_league_id ON waiver_transactions(league_id);
CREATE INDEX IF NOT EXISTS idx_waiver_transactions_team_id   ON waiver_transactions(team_id);
CREATE INDEX IF NOT EXISTS idx_waiver_transactions_status    ON waiver_transactions(status);
CREATE INDEX IF NOT EXISTS idx_waiver_transactions_week      ON waiver_transactions(league_id, week);

-- ============================================================================
-- 12. DRAFT ROOMS
-- Active draft sessions linked to a league.
-- Referenced by: api/fantasy/draft/pick, api/fantasy/draft/simulate
-- ============================================================================

CREATE TABLE IF NOT EXISTS draft_rooms (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id    UUID        NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','active','paused','completed')),
  current_pick INTEGER     NOT NULL DEFAULT 1,
  total_picks  INTEGER,
  draft_order  UUID[],
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_draft_rooms_league_id ON draft_rooms(league_id);
CREATE INDEX IF NOT EXISTS idx_draft_rooms_status    ON draft_rooms(status);

-- ============================================================================
-- 13. DRAFT PICKS
-- Individual picks recorded during a draft.
-- Referenced by: api/fantasy/draft/pick, api/fantasy/draft/simulate
-- ============================================================================

CREATE TABLE IF NOT EXISTS draft_picks (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_room_id        UUID        NOT NULL REFERENCES draft_rooms(id) ON DELETE CASCADE,
  pick_number          INTEGER     NOT NULL,
  round                INTEGER     NOT NULL,
  team_id              UUID        REFERENCES fantasy_teams(id) ON DELETE SET NULL,
  player_name          TEXT        NOT NULL,
  position             TEXT        NOT NULL,
  vbd_at_pick          NUMERIC,
  recommendation       JSONB,
  was_recommended      BOOLEAN     NOT NULL DEFAULT FALSE,
  survival_probability NUMERIC,
  picked_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (draft_room_id, pick_number),
  UNIQUE (draft_room_id, player_name)
);

CREATE INDEX IF NOT EXISTS idx_draft_picks_draft_room_id ON draft_picks(draft_room_id);
CREATE INDEX IF NOT EXISTS idx_draft_picks_team_id       ON draft_picks(team_id);
CREATE INDEX IF NOT EXISTS idx_draft_picks_pick_number   ON draft_picks(draft_room_id, pick_number);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE user_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_alerts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_insights        ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_tiers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_leagues      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_teams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_rosters      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_projections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiver_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_rooms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_picks          ENABLE ROW LEVEL SECURITY;

-- User-scoped tables: each user can only see and modify their own rows
-- (DROP IF EXISTS first so this file is safe to re-run)
DROP POLICY IF EXISTS "Own profile only"      ON user_profiles;
DROP POLICY IF EXISTS "Own preferences only"  ON user_preferences;
DROP POLICY IF EXISTS "Own alerts only"       ON user_alerts;
DROP POLICY IF EXISTS "Own stats only"        ON user_stats;
DROP POLICY IF EXISTS "Own insights only"     ON user_insights;
DROP POLICY IF EXISTS "Own subscription only" ON subscription_tiers;
DROP POLICY IF EXISTS "League owner access"   ON fantasy_leagues;
DROP POLICY IF EXISTS "League member read"    ON fantasy_teams;
DROP POLICY IF EXISTS "League owner write"    ON fantasy_teams;
DROP POLICY IF EXISTS "Roster access"         ON fantasy_rosters;
DROP POLICY IF EXISTS "Projections read"      ON fantasy_projections;
DROP POLICY IF EXISTS "Projections write"     ON fantasy_projections;
DROP POLICY IF EXISTS "Projections update"    ON fantasy_projections;
DROP POLICY IF EXISTS "Waiver access"         ON waiver_transactions;
DROP POLICY IF EXISTS "Draft room access"     ON draft_rooms;
DROP POLICY IF EXISTS "Draft pick access"     ON draft_picks;

CREATE POLICY "Own profile only"      ON user_profiles      FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Own preferences only"  ON user_preferences   FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Own alerts only"       ON user_alerts        FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Own stats only"        ON user_stats         FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Own insights only"     ON user_insights      FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Own subscription only" ON subscription_tiers FOR ALL USING (auth.uid() = user_id);

-- Fantasy: league owner has full access; league members (via teams) can read
CREATE POLICY "League owner access"  ON fantasy_leagues
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "League member read"   ON fantasy_teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM fantasy_leagues
      WHERE fantasy_leagues.id = fantasy_teams.league_id
        AND fantasy_leagues.user_id = auth.uid()
    )
  );
CREATE POLICY "League owner write"   ON fantasy_teams
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM fantasy_leagues
      WHERE fantasy_leagues.id = fantasy_teams.league_id
        AND fantasy_leagues.user_id = auth.uid()
    )
  );

CREATE POLICY "Roster access"        ON fantasy_rosters
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM fantasy_teams
      JOIN fantasy_leagues ON fantasy_leagues.id = fantasy_teams.league_id
      WHERE fantasy_teams.id = fantasy_rosters.team_id
        AND fantasy_leagues.user_id = auth.uid()
    )
  );

-- Projections: all authenticated users can read; owners can write
CREATE POLICY "Projections read"     ON fantasy_projections FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Projections write"    ON fantasy_projections FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Projections update"   ON fantasy_projections FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Waiver access"        ON waiver_transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM fantasy_leagues
      WHERE fantasy_leagues.id = waiver_transactions.league_id
        AND fantasy_leagues.user_id = auth.uid()
    )
  );

CREATE POLICY "Draft room access"    ON draft_rooms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM fantasy_leagues
      WHERE fantasy_leagues.id = draft_rooms.league_id
        AND fantasy_leagues.user_id = auth.uid()
    )
  );

CREATE POLICY "Draft pick access"    ON draft_picks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM draft_rooms
      JOIN fantasy_leagues ON fantasy_leagues.id = draft_rooms.league_id
      WHERE draft_rooms.id = draft_picks.draft_room_id
        AND fantasy_leagues.user_id = auth.uid()
    )
  );

-- ============================================================================
-- REALTIME (optional — enable for live draft updates)
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE fantasy_leagues;
ALTER PUBLICATION supabase_realtime ADD TABLE fantasy_teams;
ALTER PUBLICATION supabase_realtime ADD TABLE draft_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE draft_picks;
ALTER PUBLICATION supabase_realtime ADD TABLE waiver_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE user_alerts;

-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✓ User tables created: user_profiles, user_preferences, user_alerts, user_stats, user_insights, subscription_tiers';
  RAISE NOTICE '✓ Fantasy tables created: fantasy_leagues, fantasy_teams, fantasy_rosters, fantasy_projections, waiver_transactions';
  RAISE NOTICE '✓ Draft tables created: draft_rooms, draft_picks';
  RAISE NOTICE '✓ RLS policies applied';
  RAISE NOTICE '✓ Realtime enabled for live draft and alert updates';
  RAISE NOTICE 'Done. Run /api/health to verify the full setup.';
END $$;
