-- ============================================================================
-- Migration: add-normalized-odds-schema.sql
--
-- Adds normalized relational tables for odds ingestion pipeline:
--   games, sportsbooks, odds, odds_history,
--   players, prop_markets, player_props, player_props_history,
--   line_movements (game-level, distinct from existing player-level line_movement)
--
-- Also adds the get_biggest_line_moves() SQL function.
--
-- Run once in the Supabase SQL editor.
-- All tables live in the `api` schema with RLS enabled.
-- ============================================================================

-- ── games ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api.games (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sport       TEXT        NOT NULL,
  home_team   TEXT        NOT NULL,
  away_team   TEXT        NOT NULL,
  start_time  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sport, home_team, away_team, (start_time::date))
);

-- ── sportsbooks ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api.sportsbooks (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT NOT NULL,
  key   TEXT NOT NULL UNIQUE   -- e.g. "draftkings", "fanduel"
);

-- ── odds (current lines per game × sportsbook × market × selection) ────────
CREATE TABLE IF NOT EXISTS api.odds (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id        UUID        NOT NULL REFERENCES api.games(id)       ON DELETE CASCADE,
  sportsbook_id  UUID        NOT NULL REFERENCES api.sportsbooks(id) ON DELETE CASCADE,
  market         TEXT        NOT NULL,   -- "h2h" | "spreads" | "totals"
  selection      TEXT        NOT NULL,   -- team name or "Over" / "Under"
  line           NUMERIC,               -- spread/total value; NULL for h2h
  price          NUMERIC     NOT NULL,   -- American odds
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, sportsbook_id, market, selection)
);

-- ── odds_history (point-in-time snapshots — append-only) ───────────────────
CREATE TABLE IF NOT EXISTS api.odds_history (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id        UUID        NOT NULL REFERENCES api.games(id)       ON DELETE CASCADE,
  sportsbook_id  UUID        NOT NULL REFERENCES api.sportsbooks(id) ON DELETE CASCADE,
  market         TEXT        NOT NULL,
  selection      TEXT        NOT NULL,
  line           NUMERIC,
  price          NUMERIC     NOT NULL,
  timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── players ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api.players (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      TEXT NOT NULL,
  team      TEXT,
  sport     TEXT NOT NULL,
  position  TEXT,
  UNIQUE (name, sport)
);

-- ── prop_markets (market definitions per sport) ────────────────────────────
CREATE TABLE IF NOT EXISTS api.prop_markets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport        TEXT NOT NULL,
  market_key   TEXT NOT NULL,   -- e.g. "batter_home_runs"
  description  TEXT,
  UNIQUE (sport, market_key)
);

-- ── player_props (current lines per game × player × sportsbook × market) ──
CREATE TABLE IF NOT EXISTS api.player_props (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id        UUID        NOT NULL REFERENCES api.games(id)         ON DELETE CASCADE,
  player_id      UUID        NOT NULL REFERENCES api.players(id)       ON DELETE CASCADE,
  sportsbook_id  UUID        NOT NULL REFERENCES api.sportsbooks(id)   ON DELETE CASCADE,
  market_id      UUID        NOT NULL REFERENCES api.prop_markets(id)  ON DELETE CASCADE,
  line           NUMERIC     NOT NULL,
  over_price     NUMERIC     NOT NULL,
  under_price    NUMERIC     NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, player_id, sportsbook_id, market_id)
);

-- ── player_props_history (append-only snapshots) ──────────────────────────
CREATE TABLE IF NOT EXISTS api.player_props_history (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id        UUID        NOT NULL REFERENCES api.games(id)         ON DELETE CASCADE,
  player_id      UUID        NOT NULL REFERENCES api.players(id)       ON DELETE CASCADE,
  sportsbook_id  UUID        NOT NULL REFERENCES api.sportsbooks(id)   ON DELETE CASCADE,
  market_id      UUID        NOT NULL REFERENCES api.prop_markets(id)  ON DELETE CASCADE,
  line           NUMERIC     NOT NULL,
  over_price     NUMERIC     NOT NULL,
  under_price    NUMERIC     NOT NULL,
  timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── line_movements (game-level spread/total/h2h moves ≥ 1 point) ──────────
-- Distinct from the existing `api.line_movement` (player-level odds deltas).
-- Ingestion code inserts here only when |current_line - opening_line| >= 1.
CREATE TABLE IF NOT EXISTS api.line_movements (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       UUID        NOT NULL REFERENCES api.games(id) ON DELETE CASCADE,
  market        TEXT        NOT NULL,
  selection     TEXT        NOT NULL,
  opening_line  NUMERIC     NOT NULL,
  current_line  NUMERIC     NOT NULL,
  movement      NUMERIC     GENERATED ALWAYS AS (current_line - opening_line) STORED,
  detected_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE api.games                ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.sportsbooks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.odds                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.odds_history         ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.players              ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.prop_markets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.player_props         ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.player_props_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.line_movements       ENABLE ROW LEVEL SECURITY;

-- Public read (anonymous + authenticated)
DO $$ BEGIN
  CREATE POLICY "public read" ON api.games                FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read" ON api.sportsbooks          FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read" ON api.odds                 FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read" ON api.odds_history         FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read" ON api.players              FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read" ON api.prop_markets         FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read" ON api.player_props         FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read" ON api.player_props_history FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read" ON api.line_movements       FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Performance indexes ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_odds_game_id        ON api.odds(game_id);
CREATE INDEX IF NOT EXISTS idx_odds_updated_at     ON api.odds(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_odds_hist_game      ON api.odds_history(game_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_props_game_id       ON api.player_props(game_id);
CREATE INDEX IF NOT EXISTS idx_props_player_id     ON api.player_props(player_id);
CREATE INDEX IF NOT EXISTS idx_props_hist_player   ON api.player_props_history(player_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_line_mov_detected   ON api.line_movements(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_line_mov_game_id    ON api.line_movements(game_id);
CREATE INDEX IF NOT EXISTS idx_games_sport_time    ON api.games(sport, start_time DESC);

-- ── SQL function: get_biggest_line_moves ───────────────────────────────────
CREATE OR REPLACE FUNCTION api.get_biggest_line_moves(hours int DEFAULT 24)
RETURNS TABLE(game_id uuid, market text, selection text, move numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = api, public
AS $$
  SELECT
    lm.game_id,
    lm.market,
    lm.selection,
    MAX(ABS(lm.movement)) AS move
  FROM api.line_movements lm
  WHERE lm.detected_at > now() - (hours || ' hours')::interval
  GROUP BY lm.game_id, lm.market, lm.selection
  ORDER BY move DESC
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION api.get_biggest_line_moves(int) TO anon, authenticated;
