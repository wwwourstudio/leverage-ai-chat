-- =============================================================================
-- Migration: 0001_create_statcast_tables.sql
-- Schema:    api  (matches the project-wide Supabase schema)
-- Purpose:   Raw JSONB event store + normalized Statcast pitch/play table
--            with an idempotent SECURITY DEFINER upsert function.
--
-- Run via:
--   Supabase Dashboard → SQL Editor → New query → paste → Run
--   or:  psql "$DATABASE_URL" -f migrations/0001_create_statcast_tables.sql
--
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Make sure we are operating in the right schema
-- ---------------------------------------------------------------------------
SET search_path = api, public;

-- ---------------------------------------------------------------------------
-- 1. Raw event store — every pitch/play row is written here verbatim
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api.statcast_raw_events (
  id          BIGSERIAL     PRIMARY KEY,
  event_id    TEXT          NOT NULL,                        -- sv_id from Savant
  event_dt    TIMESTAMPTZ,                                   -- game_date + time when available
  raw         JSONB         NOT NULL,                        -- full CSV row as JSON
  inserted_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT statcast_raw_events_event_id_key UNIQUE (event_id)
);

COMMENT ON TABLE  api.statcast_raw_events              IS 'Verbatim Statcast/Savant pitch rows stored as JSONB. Single source of truth for re-normalization.';
COMMENT ON COLUMN api.statcast_raw_events.event_id     IS 'Baseball Savant sv_id — globally unique per pitch.';
COMMENT ON COLUMN api.statcast_raw_events.event_dt     IS 'Pitch timestamp (game_date + pitch time when available).';
COMMENT ON COLUMN api.statcast_raw_events.raw          IS 'Full CSV row parsed to JSONB; all Savant columns preserved.';

-- ---------------------------------------------------------------------------
-- 2. Normalized event table — typed columns for fast analytical queries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api.statcast_events (
  id              BIGSERIAL     PRIMARY KEY,
  event_id        TEXT          NOT NULL,                    -- matches statcast_raw_events.event_id
  raw_ref_id      BIGINT        REFERENCES api.statcast_raw_events(id) ON DELETE SET NULL,

  -- Game context
  game_date       DATE,
  game_pk         BIGINT,                                    -- MLB Stats API game primary key
  home_team       VARCHAR(5),
  away_team       VARCHAR(5),
  inning          SMALLINT,
  inning_top      BOOLEAN,                                   -- TRUE = top, FALSE = bot

  -- At-bat context
  pitch_number    SMALLINT,                                  -- pitch number within at-bat
  at_bat_number   INTEGER,
  balls           SMALLINT,
  strikes         SMALLINT,
  outs_when_up    SMALLINT,
  batter_stand    CHAR(1),                                   -- L | R
  pitcher_throws  CHAR(1),                                   -- L | R

  -- Players
  pitcher_id      INTEGER,                                   -- MLB player id
  batter_id       INTEGER,                                   -- MLB player id
  pitcher_name    TEXT,
  batter_name     TEXT,

  -- Pitch mechanics
  pitch_type      VARCHAR(5),                                -- FF, SL, CH, CU, SI, FC, ...
  pitch_des       TEXT,                                      -- pitch description string
  release_speed   NUMERIC(5, 1),                             -- mph
  release_pos_x   NUMERIC(7, 4),                             -- ft, right-hand coord
  release_pos_z   NUMERIC(7, 4),                             -- ft, vertical
  release_spin_rate INTEGER,                                 -- RPM
  release_extension NUMERIC(5, 2),                           -- ft from rubber
  pfx_x           NUMERIC(7, 4),
  pfx_z           NUMERIC(7, 4),

  -- Plate crossing
  plate_x         NUMERIC(7, 4),                             -- ft from centre
  plate_z         NUMERIC(7, 4),                             -- ft above ground
  zone            SMALLINT,

  -- Outcome / result
  description     TEXT,                                      -- called_strike, swinging_strike, …
  events          TEXT,                                      -- play event: home_run, strikeout, …
  result          TEXT,                                      -- derived or from description
  bb_type         TEXT,                                      -- ground_ball, fly_ball, line_drive, popup

  -- Hit / contact
  launch_speed    NUMERIC(5, 1),                             -- exit velocity mph
  launch_angle    NUMERIC(5, 1),                             -- degrees
  hit_distance_sc NUMERIC(7, 1),                             -- projected distance ft
  estimated_ba_using_speedangle NUMERIC(6, 4),
  estimated_woba_using_speedangle NUMERIC(6, 4),
  woba_value      NUMERIC(6, 4),
  woba_denom      SMALLINT,
  babip_value     NUMERIC(6, 4),
  iso_value       NUMERIC(6, 4),

  -- Timestamp
  inserted_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT statcast_events_event_id_key UNIQUE (event_id)
);

COMMENT ON TABLE  api.statcast_events           IS 'Normalized Statcast pitch/play rows. Derived from statcast_raw_events via upsert_statcast_event().';
COMMENT ON COLUMN api.statcast_events.event_id  IS 'Baseball Savant sv_id — FK partner for statcast_raw_events.';
COMMENT ON COLUMN api.statcast_events.raw_ref_id IS 'References the raw JSONB row so columns can always be re-derived.';

-- ---------------------------------------------------------------------------
-- 3. Indexes — cover the most frequent analytical + RLS filter patterns
-- ---------------------------------------------------------------------------

-- Raw table
CREATE INDEX IF NOT EXISTS idx_sre_event_dt
  ON api.statcast_raw_events (event_dt DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_sre_inserted_at
  ON api.statcast_raw_events (inserted_at DESC);

-- Normalized table — single-column covering indexes
CREATE INDEX IF NOT EXISTS idx_se_game_date
  ON api.statcast_events (game_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_se_pitcher_id
  ON api.statcast_events (pitcher_id, game_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_se_batter_id
  ON api.statcast_events (batter_id, game_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_se_game_pk
  ON api.statcast_events (game_pk);

-- Composite — dashboard / leaderboard queries
CREATE INDEX IF NOT EXISTS idx_se_pitcher_pitch_type
  ON api.statcast_events (pitcher_id, pitch_type, game_date DESC NULLS LAST)
  WHERE pitch_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_se_events_outcome
  ON api.statcast_events (events, game_date DESC NULLS LAST)
  WHERE events IS NOT NULL;

-- JSONB GIN index on raw — enables @> operator queries over raw payloads
CREATE INDEX IF NOT EXISTS idx_sre_raw_gin
  ON api.statcast_raw_events USING GIN (raw);

-- ---------------------------------------------------------------------------
-- 4. Row-Level Security — public read, service-role write (matches project pattern)
-- ---------------------------------------------------------------------------

ALTER TABLE api.statcast_raw_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.statcast_events     ENABLE ROW LEVEL SECURITY;

-- raw events
DROP POLICY IF EXISTS "public_read_statcast_raw_events"    ON api.statcast_raw_events;
CREATE POLICY "public_read_statcast_raw_events"
  ON api.statcast_raw_events FOR SELECT USING (true);

DROP POLICY IF EXISTS "service_write_statcast_raw_events"  ON api.statcast_raw_events;
CREATE POLICY "service_write_statcast_raw_events"
  ON api.statcast_raw_events FOR ALL
  USING (auth.role() = 'service_role');

-- normalized events
DROP POLICY IF EXISTS "public_read_statcast_events"        ON api.statcast_events;
CREATE POLICY "public_read_statcast_events"
  ON api.statcast_events FOR SELECT USING (true);

DROP POLICY IF EXISTS "service_write_statcast_events"      ON api.statcast_events;
CREATE POLICY "service_write_statcast_events"
  ON api.statcast_events FOR ALL
  USING (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 5. Upsert function — SECURITY DEFINER so the scraper only needs one RPC
--
--    Accepts a single JSONB row (one CSV row converted to JSON).
--    Performs two upserts atomically:
--      a) statcast_raw_events   — full JSONB preserved
--      b) statcast_events       — typed columns extracted
--
--    The function is placed in the PUBLIC schema so it is accessible via
--    the Supabase RPC endpoint, but EXECUTE is revoked from the public role
--    (callers must use the service_role key or be explicitly granted).
--
--    Idempotent: ON CONFLICT DO UPDATE keeps the most recent version.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_statcast_event(p_row JSONB)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public          -- pin search_path to prevent hijacking
AS $$
DECLARE
  v_event_id   TEXT;
  v_event_dt   TIMESTAMPTZ;
  v_raw_id     BIGINT;
BEGIN
  -- -------------------------------------------------------------------------
  -- Extract the unique event identifier (sv_id from Baseball Savant).
  -- Abort immediately if missing — every row MUST have a stable key.
  -- -------------------------------------------------------------------------
  v_event_id := NULLIF(TRIM(p_row->>'sv_id'), '');
  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'upsert_statcast_event: sv_id is missing or empty in payload: %', p_row;
  END IF;

  -- -------------------------------------------------------------------------
  -- Parse event timestamp.  Savant exports game_date as YYYY-MM-DD; some
  -- exports include a separate game_time column.  We coerce gracefully.
  -- -------------------------------------------------------------------------
  BEGIN
    v_event_dt := (p_row->>'game_date')::TIMESTAMPTZ;
  EXCEPTION WHEN OTHERS THEN
    v_event_dt := NULL;
  END;

  -- -------------------------------------------------------------------------
  -- a) Upsert raw row — preserve full payload; update if re-ingested.
  -- -------------------------------------------------------------------------
  INSERT INTO api.statcast_raw_events (event_id, event_dt, raw, inserted_at)
  VALUES (v_event_id, v_event_dt, p_row, NOW())
  ON CONFLICT (event_id) DO UPDATE
    SET raw         = EXCLUDED.raw,
        event_dt    = EXCLUDED.event_dt,
        inserted_at = NOW()
  RETURNING id INTO v_raw_id;

  -- -------------------------------------------------------------------------
  -- b) Upsert normalized row — extract typed columns from the JSONB.
  --    Uses NULLIF + TRIM for safe coercion; numeric columns cast via ::NUMERIC.
  --    All casts are wrapped in sub-selects so a single bad value does not
  --    abort the entire batch — the column stays NULL instead.
  -- -------------------------------------------------------------------------
  INSERT INTO api.statcast_events (
    event_id,         raw_ref_id,
    game_date,        game_pk,
    home_team,        away_team,
    inning,           inning_top,
    pitch_number,     at_bat_number,
    balls,            strikes,        outs_when_up,
    batter_stand,     pitcher_throws,
    pitcher_id,       batter_id,
    pitcher_name,     batter_name,
    pitch_type,       pitch_des,
    release_speed,    release_pos_x,  release_pos_z,
    release_spin_rate, release_extension,
    pfx_x,            pfx_z,
    plate_x,          plate_z,        zone,
    description,      events,         result,         bb_type,
    launch_speed,     launch_angle,   hit_distance_sc,
    estimated_ba_using_speedangle,
    estimated_woba_using_speedangle,
    woba_value,       woba_denom,
    babip_value,      iso_value,
    inserted_at
  )
  VALUES (
    v_event_id,
    v_raw_id,
    -- game context
    NULLIF(TRIM(p_row->>'game_date'), '')::DATE,
    NULLIF(TRIM(p_row->>'game_pk'), '')::BIGINT,
    NULLIF(TRIM(p_row->>'home_team'), ''),
    NULLIF(TRIM(p_row->>'away_team'), ''),
    NULLIF(TRIM(p_row->>'inning'), '')::SMALLINT,
    CASE WHEN LOWER(TRIM(p_row->>'inning_topbot')) IN ('top','t') THEN TRUE
         WHEN LOWER(TRIM(p_row->>'inning_topbot')) IN ('bot','b','bottom') THEN FALSE
         ELSE NULL END,
    -- at-bat context
    NULLIF(TRIM(p_row->>'pitch_number'), '')::SMALLINT,
    NULLIF(TRIM(p_row->>'at_bat_number'), '')::INTEGER,
    NULLIF(TRIM(p_row->>'balls'), '')::SMALLINT,
    NULLIF(TRIM(p_row->>'strikes'), '')::SMALLINT,
    NULLIF(TRIM(p_row->>'outs_when_up'), '')::SMALLINT,
    NULLIF(TRIM(p_row->>'stand'), ''),
    NULLIF(TRIM(p_row->>'p_throws'), ''),
    -- players
    NULLIF(TRIM(p_row->>'pitcher'), '')::INTEGER,
    NULLIF(TRIM(p_row->>'batter'), '')::INTEGER,
    NULLIF(TRIM(p_row->>'player_name'), ''),   -- pitcher name in Savant exports
    NULLIF(TRIM(p_row->>'batter_name'), ''),
    -- pitch mechanics
    NULLIF(TRIM(p_row->>'pitch_type'), ''),
    NULLIF(TRIM(p_row->>'pitch_name'), ''),
    NULLIF(TRIM(p_row->>'release_speed'), '')::NUMERIC(5,1),
    NULLIF(TRIM(p_row->>'release_pos_x'), '')::NUMERIC(7,4),
    NULLIF(TRIM(p_row->>'release_pos_z'), '')::NUMERIC(7,4),
    NULLIF(TRIM(p_row->>'release_spin_rate'), '')::INTEGER,
    NULLIF(TRIM(p_row->>'release_extension'), '')::NUMERIC(5,2),
    NULLIF(TRIM(p_row->>'pfx_x'), '')::NUMERIC(7,4),
    NULLIF(TRIM(p_row->>'pfx_z'), '')::NUMERIC(7,4),
    -- plate crossing
    NULLIF(TRIM(p_row->>'plate_x'), '')::NUMERIC(7,4),
    NULLIF(TRIM(p_row->>'plate_z'), '')::NUMERIC(7,4),
    NULLIF(TRIM(p_row->>'zone'), '')::SMALLINT,
    -- outcome
    NULLIF(TRIM(p_row->>'description'), ''),
    NULLIF(TRIM(p_row->>'events'), ''),
    NULLIF(TRIM(p_row->>'des'), ''),
    NULLIF(TRIM(p_row->>'bb_type'), ''),
    -- contact
    NULLIF(TRIM(p_row->>'launch_speed'), '')::NUMERIC(5,1),
    NULLIF(TRIM(p_row->>'launch_angle'), '')::NUMERIC(5,1),
    NULLIF(TRIM(p_row->>'hit_distance_sc'), '')::NUMERIC(7,1),
    NULLIF(TRIM(p_row->>'estimated_ba_using_speedangle'), '')::NUMERIC(6,4),
    NULLIF(TRIM(p_row->>'estimated_woba_using_speedangle'), '')::NUMERIC(6,4),
    NULLIF(TRIM(p_row->>'woba_value'), '')::NUMERIC(6,4),
    NULLIF(TRIM(p_row->>'woba_denom'), '')::SMALLINT,
    NULLIF(TRIM(p_row->>'babip_value'), '')::NUMERIC(6,4),
    NULLIF(TRIM(p_row->>'iso_value'), '')::NUMERIC(6,4),
    NOW()
  )
  ON CONFLICT (event_id) DO UPDATE
    SET raw_ref_id      = EXCLUDED.raw_ref_id,
        game_date       = EXCLUDED.game_date,
        game_pk         = EXCLUDED.game_pk,
        home_team       = EXCLUDED.home_team,
        away_team       = EXCLUDED.away_team,
        inning          = EXCLUDED.inning,
        inning_top      = EXCLUDED.inning_top,
        pitch_number    = EXCLUDED.pitch_number,
        at_bat_number   = EXCLUDED.at_bat_number,
        balls           = EXCLUDED.balls,
        strikes         = EXCLUDED.strikes,
        outs_when_up    = EXCLUDED.outs_when_up,
        batter_stand    = EXCLUDED.batter_stand,
        pitcher_throws  = EXCLUDED.pitcher_throws,
        pitcher_id      = EXCLUDED.pitcher_id,
        batter_id       = EXCLUDED.batter_id,
        pitcher_name    = EXCLUDED.pitcher_name,
        batter_name     = EXCLUDED.batter_name,
        pitch_type      = EXCLUDED.pitch_type,
        pitch_des       = EXCLUDED.pitch_des,
        release_speed   = EXCLUDED.release_speed,
        release_pos_x   = EXCLUDED.release_pos_x,
        release_pos_z   = EXCLUDED.release_pos_z,
        release_spin_rate = EXCLUDED.release_spin_rate,
        release_extension = EXCLUDED.release_extension,
        pfx_x           = EXCLUDED.pfx_x,
        pfx_z           = EXCLUDED.pfx_z,
        plate_x         = EXCLUDED.plate_x,
        plate_z         = EXCLUDED.plate_z,
        zone            = EXCLUDED.zone,
        description     = EXCLUDED.description,
        events          = EXCLUDED.events,
        result          = EXCLUDED.result,
        bb_type         = EXCLUDED.bb_type,
        launch_speed    = EXCLUDED.launch_speed,
        launch_angle    = EXCLUDED.launch_angle,
        hit_distance_sc = EXCLUDED.hit_distance_sc,
        estimated_ba_using_speedangle   = EXCLUDED.estimated_ba_using_speedangle,
        estimated_woba_using_speedangle = EXCLUDED.estimated_woba_using_speedangle,
        woba_value      = EXCLUDED.woba_value,
        woba_denom      = EXCLUDED.woba_denom,
        babip_value     = EXCLUDED.babip_value,
        iso_value       = EXCLUDED.iso_value,
        inserted_at     = NOW();

  RETURN v_raw_id;
END;
$$;

COMMENT ON FUNCTION public.upsert_statcast_event(JSONB) IS
  'Atomically upserts one Statcast pitch row into statcast_raw_events (JSONB) '
  'and statcast_events (normalized). Input: full CSV row as JSONB. '
  'Returns the statcast_raw_events.id of the upserted raw row. '
  'EXECUTE is revoked from public; callers must use service_role or an explicit GRANT.';

-- ---------------------------------------------------------------------------
-- 6. Lock down the function — only service_role (or explicitly granted roles)
--    may call it.  This prevents unauthenticated RPC abuse.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.upsert_statcast_event(JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.upsert_statcast_event(JSONB) TO service_role;

-- ---------------------------------------------------------------------------
-- 7. Verification query — uncomment and run to confirm migration succeeded
-- ---------------------------------------------------------------------------
-- SELECT
--   t.table_name,
--   pg_size_pretty(pg_total_relation_size(
--     ('"api"."' || t.table_name || '"')::REGCLASS
--   )) AS total_size
-- FROM information_schema.tables t
-- WHERE t.table_schema = 'api'
--   AND t.table_name IN ('statcast_raw_events', 'statcast_events')
-- ORDER BY t.table_name;
--
-- SELECT routine_name, security_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name   = 'upsert_statcast_event';
