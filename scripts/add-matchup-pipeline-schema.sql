-- =============================================================================
-- scripts/add-matchup-pipeline-schema.sql
--
-- Creates four tables that persist the output of the 4-layer HR prediction
-- pipeline.  Run ONCE in Supabase Dashboard → SQL Editor → New Query.
-- Idempotent: all statements use IF NOT EXISTS / OR REPLACE.
--
-- Tables:
--   lineup_contexts     — raw LineupContext at prediction time (Layer 0 input)
--   matchup_snapshots   — full LayerSnapshot for each batter-game (all 4 layers)
--   hr_prop_edges       — EdgeScore output per player-game (trading decisions)
--   fade_signals        — dedicated log for FADE signals (UNDER opportunities)
--
-- Foreign key chain:
--   matchup_snapshots.edge_id → hr_prop_edges.id
--   fade_signals.edge_id      → hr_prop_edges.id
-- =============================================================================

SET search_path TO api;

-- ============================================================================
-- 1. LINEUP_CONTEXTS
-- Stores the raw LineupContext struct for each batter-game prediction.
-- Useful for backtest segmentation and data quality auditing.
-- ============================================================================

CREATE TABLE IF NOT EXISTS lineup_contexts (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  player_name               TEXT         NOT NULL,
  player_id                 BIGINT,
  game_id                   TEXT         NOT NULL,      -- mlb_games.id (gamePk)
  game_date                 DATE         NOT NULL,

  -- LineupContext fields (Layer 0 inputs)
  lineup_slot               SMALLINT     NOT NULL CHECK (lineup_slot BETWEEN 1 AND 9),
  batter_hand               CHAR(1)      NOT NULL CHECK (batter_hand IN ('L', 'R', 'S')),
  pitcher_hand              CHAR(1)      NOT NULL CHECK (pitcher_hand IN ('L', 'R')),
  pitcher_flyball_pct       NUMERIC(5,2),
  pitcher_hr_per_9_vs_hand  NUMERIC(5,3),
  protection_score          NUMERIC(5,3),
  platoon_advantage         BOOLEAN      NOT NULL DEFAULT FALSE,
  team_power_rank           SMALLINT     CHECK (team_power_rank BETWEEN 1 AND 30),
  opposing_bullpen_depth    NUMERIC(5,3),

  -- Computed matchup factor (Layer 0 output)
  matchup_factor            NUMERIC(6,4) NOT NULL,
  matchup_label             TEXT,

  -- Breakdown (JSONB — stores MatchupBreakdown for dashboards)
  matchup_breakdown         JSONB,

  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (player_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_lineup_contexts_game_date
  ON lineup_contexts (game_date DESC);
CREATE INDEX IF NOT EXISTS idx_lineup_contexts_player_date
  ON lineup_contexts (player_id, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_lineup_contexts_slot_platoon
  ON lineup_contexts (lineup_slot, platoon_advantage, game_date DESC);

ALTER TABLE lineup_contexts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lineup_contexts_read"  ON lineup_contexts;
DROP POLICY IF EXISTS "lineup_contexts_write" ON lineup_contexts;
CREATE POLICY "lineup_contexts_read"  ON lineup_contexts FOR SELECT USING (true);
CREATE POLICY "lineup_contexts_write" ON lineup_contexts FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 2. MATCHUP_SNAPSHOTS
-- Stores the complete LayerSnapshot for each prediction run.
-- One row per player per game.  Updated on each pipeline run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS matchup_snapshots (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  player_name               TEXT         NOT NULL,
  player_id                 BIGINT,
  game_id                   TEXT         NOT NULL,
  game_date                 DATE         NOT NULL,
  venue                     TEXT,
  opponent_pitcher          TEXT,

  -- Layer 0 outputs
  matchup_factor            NUMERIC(6,4) NOT NULL,

  -- Layer 1 outputs
  park_factor               NUMERIC(6,4),
  weather_factor            NUMERIC(7,5),
  context_multiplier        NUMERIC(6,4),  -- park_factor × (1 + weather_factor)

  -- Layer 2 outputs
  model_prob_per_ab         NUMERIC(7,5),  -- raw logistic output
  matchup_scaled_prob       NUMERIC(7,5),  -- modelProbPerAB × matchupFactor
  hr_per_game               NUMERIC(7,5),  -- 1 − (1 − matchupScaledProb)^4

  -- Raw logit inputs (JSONB for flexibility — allows new features without migration)
  logit_inputs              JSONB,

  -- Layer 3 outputs (from signal aggregator)
  calibrated_prob           NUMERIC(7,5),
  market_prob               NUMERIC(7,5),
  raw_edge                  NUMERIC(7,5),
  sharp_boost               NUMERIC(7,5),
  final_prob                NUMERIC(7,5),
  signal_strength           TEXT,          -- 'ELITE' | 'STRONG' | 'LEAN' | 'PASS'
  recommendation            TEXT,          -- 'BET' | 'MONITOR' | 'PASS'

  -- Timestamps
  pipeline_version          TEXT         DEFAULT '2.0',  -- bump when architecture changes
  computed_at               TIMESTAMPTZ  NOT NULL,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (player_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_matchup_snapshots_date_signal
  ON matchup_snapshots (game_date DESC, signal_strength);
CREATE INDEX IF NOT EXISTS idx_matchup_snapshots_player_date
  ON matchup_snapshots (player_id, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_matchup_snapshots_edge_rank
  ON matchup_snapshots (game_date DESC, raw_edge DESC NULLS LAST)
  WHERE signal_strength IN ('ELITE', 'STRONG');

ALTER TABLE matchup_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "matchup_snapshots_read"  ON matchup_snapshots;
DROP POLICY IF EXISTS "matchup_snapshots_write" ON matchup_snapshots;
CREATE POLICY "matchup_snapshots_read"  ON matchup_snapshots FOR SELECT USING (true);
CREATE POLICY "matchup_snapshots_write" ON matchup_snapshots FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 3. HR_PROP_EDGES
-- Trading decisions from edgeScorer.ts.  One row per player per game.
-- This is the primary table read by the picks UI and the backtest.
-- ============================================================================

CREATE TABLE IF NOT EXISTS hr_prop_edges (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  player_name               TEXT         NOT NULL,
  player_id                 BIGINT,
  game_id                   TEXT         NOT NULL,
  game_date                 DATE         NOT NULL,
  venue                     TEXT,
  opponent_pitcher          TEXT,

  -- Core edge metrics
  model_prob                NUMERIC(7,5) NOT NULL,
  market_prob               NUMERIC(7,5),
  raw_edge                  NUMERIC(7,5),             -- model_prob − market_prob
  adjusted_edge             NUMERIC(7,5),             -- raw_edge × matchup × sharp
  expected_value            NUMERIC(8,5),             -- (modelProb × decOdds) − 1

  -- Odds
  best_american_odds        INTEGER,
  decimal_odds              NUMERIC(7,4),

  -- Kelly sizing
  kelly_full                NUMERIC(7,5),
  kelly_half                NUMERIC(7,5),
  kelly_matchup_adjusted    NUMERIC(7,5),

  -- Context amplifiers
  matchup_factor            NUMERIC(6,4) NOT NULL,
  matchup_label             TEXT,
  sharp_boost               NUMERIC(6,4),
  total_amplifier           NUMERIC(6,4),

  -- Classification
  tier                      TEXT         NOT NULL
    CHECK (tier IN ('ELITE', 'STRONG', 'LEAN', 'FADE', 'PASS')),
  tier_reason               TEXT,

  -- Fade signal
  is_fade                   BOOLEAN      NOT NULL DEFAULT FALSE,
  fade_reason               TEXT,

  -- Risk flags (stored as JSONB array of EdgeFlag objects)
  flags                     JSONB,

  -- Outcome tracking (filled by recordPickResults() each morning)
  actual_result             BOOLEAN,     -- true = HR happened
  outcome_odds              INTEGER,     -- actual closing odds
  pnl                       NUMERIC(10,4),

  -- Timestamps
  computed_at               TIMESTAMPTZ  NOT NULL,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (player_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_prop_edges_date_tier
  ON hr_prop_edges (game_date DESC, tier);
CREATE INDEX IF NOT EXISTS idx_hr_prop_edges_player_date
  ON hr_prop_edges (player_id, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_hr_prop_edges_edge_rank
  ON hr_prop_edges (game_date DESC, adjusted_edge DESC NULLS LAST)
  WHERE tier IN ('ELITE', 'STRONG');
CREATE INDEX IF NOT EXISTS idx_hr_prop_edges_fades
  ON hr_prop_edges (game_date DESC)
  WHERE is_fade = TRUE;
CREATE INDEX IF NOT EXISTS idx_hr_prop_edges_unsettled
  ON hr_prop_edges (game_date)
  WHERE actual_result IS NULL AND tier != 'PASS';

ALTER TABLE hr_prop_edges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hr_prop_edges_read"  ON hr_prop_edges;
DROP POLICY IF EXISTS "hr_prop_edges_write" ON hr_prop_edges;
CREATE POLICY "hr_prop_edges_read"  ON hr_prop_edges FOR SELECT USING (true);
CREATE POLICY "hr_prop_edges_write" ON hr_prop_edges FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 4. FADE_SIGNALS
-- Dedicated log for FADE signals (matchup-aware UNDER opportunities).
-- Separated from hr_prop_edges for fast querying and alerting.
-- ============================================================================

CREATE TABLE IF NOT EXISTS fade_signals (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  edge_id                   UUID         REFERENCES hr_prop_edges (id) ON DELETE CASCADE,

  -- Identity
  player_name               TEXT         NOT NULL,
  game_id                   TEXT         NOT NULL,
  game_date                 DATE         NOT NULL,

  -- Fade context
  matchup_factor            NUMERIC(6,4) NOT NULL,  -- < 0.92 for confirmed fade
  market_move_pts           NUMERIC(6,4),           -- negative = market fading too
  fade_reason               TEXT         NOT NULL,

  -- Market at fade signal time
  market_prob_at_signal     NUMERIC(7,5),
  american_odds_at_signal   INTEGER,

  -- Outcome
  actual_result             BOOLEAN,     -- true = HR hit (fade was WRONG)
  pnl                       NUMERIC(10,4),

  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fade_signals_date
  ON fade_signals (game_date DESC);
CREATE INDEX IF NOT EXISTS idx_fade_signals_unsettled
  ON fade_signals (game_date)
  WHERE actual_result IS NULL;

ALTER TABLE fade_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fade_signals_read"  ON fade_signals;
DROP POLICY IF EXISTS "fade_signals_write" ON fade_signals;
CREATE POLICY "fade_signals_read"  ON fade_signals FOR SELECT USING (true);
CREATE POLICY "fade_signals_write" ON fade_signals FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 5. SEQUENCE GRANTS (prevent 'permission denied for sequence' errors)
-- ============================================================================

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA api TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA api TO authenticated;

-- ============================================================================
-- 6. REALTIME SUBSCRIPTIONS
-- ============================================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE hr_prop_edges;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE fade_signals;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 7. CONVENIENCE VIEW: today_s_edge_slate
-- Live join across hr_prop_edges + matchup_snapshots for the picks dashboard.
-- ============================================================================

CREATE OR REPLACE VIEW todays_edge_slate AS
SELECT
  e.id                      AS edge_id,
  e.player_name,
  e.game_date,
  e.venue,
  e.opponent_pitcher,

  -- Trading decision
  e.tier,
  e.adjusted_edge,
  e.expected_value,
  e.kelly_matchup_adjusted,
  e.best_american_odds,
  e.is_fade,
  e.fade_reason,

  -- All 4 layers
  e.matchup_factor,
  e.matchup_label,
  s.park_factor,
  s.weather_factor,
  s.model_prob_per_ab,
  s.matchup_scaled_prob,
  s.hr_per_game,
  s.calibrated_prob,
  s.raw_edge,
  s.sharp_boost,
  s.final_prob,
  s.signal_strength,

  -- Risk
  e.flags

FROM hr_prop_edges e
LEFT JOIN matchup_snapshots s
  ON s.player_id = e.player_id
 AND s.game_id   = e.game_id

WHERE e.game_date >= CURRENT_DATE
  AND e.tier != 'PASS'

ORDER BY
  CASE e.tier WHEN 'ELITE' THEN 0 WHEN 'FADE' THEN 1 WHEN 'STRONG' THEN 2 ELSE 3 END,
  e.adjusted_edge DESC NULLS LAST;

GRANT SELECT ON todays_edge_slate TO authenticated, anon, service_role;

-- ============================================================================
-- 8. VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✓ Matchup pipeline schema applied:';
  RAISE NOTICE '  Tables: lineup_contexts, matchup_snapshots, hr_prop_edges, fade_signals';
  RAISE NOTICE '  View:   todays_edge_slate (live join, all 4 layers)';
  RAISE NOTICE '  Realtime: hr_prop_edges, fade_signals';
END $$;
