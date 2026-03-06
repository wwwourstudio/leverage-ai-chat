import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/admin/migrate
 *
 * Runs all pending database migrations against Supabase using the
 * Supabase Management API.
 *
 * Migrations run (in order):
 *   003 — api.player_props_markets table
 *   004 — api.user_profiles and api.user_preferences tables
 *
 * Requirements:
 *   NEXT_PUBLIC_SUPABASE_URL    — already required by the app
 *   SUPABASE_SERVICE_ROLE_KEY   — already required by the app (used as auth guard)
 *   SUPABASE_ACCESS_TOKEN       — personal access token from supabase.com/dashboard →
 *                                 Account → Access Tokens (needed for management API)
 *
 * Call example:
 *   curl -X POST https://<your-domain>/api/admin/migrate \
 *        -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>"
 */

// Migration 003 — mirrors scripts/003-player-props-table.sql
const MIGRATION_003_SQL = `
DROP TABLE IF EXISTS public.player_props_markets CASCADE;

CREATE TABLE IF NOT EXISTS api.player_props_markets (
  id TEXT PRIMARY KEY,
  sport VARCHAR(50) NOT NULL,
  game_id VARCHAR(255) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  stat_type VARCHAR(100) NOT NULL,
  line NUMERIC,
  over_odds INTEGER,
  under_odds INTEGER,
  bookmaker VARCHAR(100) NOT NULL,
  game_time TIMESTAMPTZ,
  home_team VARCHAR(255),
  away_team VARCHAR(255),
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_player_props_sport   ON api.player_props_markets(sport);
CREATE INDEX IF NOT EXISTS idx_api_player_props_game_id ON api.player_props_markets(game_id);
CREATE INDEX IF NOT EXISTS idx_api_player_props_player  ON api.player_props_markets(player_name);
CREATE INDEX IF NOT EXISTS idx_api_player_props_type    ON api.player_props_markets(stat_type);
CREATE INDEX IF NOT EXISTS idx_api_player_props_fetched ON api.player_props_markets(fetched_at DESC);

ALTER TABLE api.player_props_markets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read player props"    ON api.player_props_markets;
DROP POLICY IF EXISTS "Service write player props"  ON api.player_props_markets;
DROP POLICY IF EXISTS "Service upsert player props" ON api.player_props_markets;

CREATE POLICY "Public read player props"
  ON api.player_props_markets FOR SELECT USING (true);

CREATE POLICY "Service write player props"
  ON api.player_props_markets FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service upsert player props"
  ON api.player_props_markets FOR UPDATE
  USING (true);

GRANT ALL ON api.player_props_markets TO anon, authenticated;
`;

// Migration 004 — mirrors scripts/004-user-profiles-table.sql
const MIGRATION_004_SQL = `
CREATE TABLE IF NOT EXISTS api.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,
  email text,
  display_name text,
  avatar_url text,
  subscription_tier text NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free','core','pro','high_stakes')),
  credits_remaining integer DEFAULT 50,
  total_predictions integer DEFAULT 0,
  correct_predictions integer DEFAULT 0,
  win_rate numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,
  email_notifications boolean DEFAULT true,
  push_notifications boolean DEFAULT false,
  tracked_sports text[] DEFAULT ARRAY['NBA', 'NFL'],
  theme text DEFAULT 'dark',
  default_sport text DEFAULT 'NBA',
  odds_alerts boolean NOT NULL DEFAULT true,
  line_movement_alerts boolean NOT NULL DEFAULT true,
  arbitrage_alerts boolean NOT NULL DEFAULT true,
  preferred_books text[] NOT NULL DEFAULT '{}',
  bankroll numeric NOT NULL DEFAULT 0,
  risk_tolerance text NOT NULL DEFAULT 'medium',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON api.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON api.user_preferences(user_id);

ALTER TABLE api.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile" ON api.user_profiles;
DROP POLICY IF EXISTS "Users update own profile" ON api.user_profiles;
DROP POLICY IF EXISTS "Service inserts profiles" ON api.user_profiles;
DROP POLICY IF EXISTS "Users read own preferences" ON api.user_preferences;
DROP POLICY IF EXISTS "Users upsert own preferences" ON api.user_preferences;
DROP POLICY IF EXISTS "Service inserts preferences" ON api.user_preferences;

CREATE POLICY "Users read own profile"
  ON api.user_profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users update own profile"
  ON api.user_profiles FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Service inserts profiles"
  ON api.user_profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users read own preferences"
  ON api.user_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users upsert own preferences"
  ON api.user_preferences FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service inserts preferences"
  ON api.user_preferences FOR INSERT
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION api.handle_new_user_profile()
RETURNS trigger AS $$
BEGIN
  INSERT INTO api.user_profiles (user_id, email, display_name, credits_remaining)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    50
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_profile'
  ) THEN
    CREATE TRIGGER on_auth_user_created_profile
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION api.handle_new_user_profile();
  END IF;
END;
$$;

INSERT INTO api.user_profiles (user_id, email, display_name, credits_remaining)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  50
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

GRANT ALL ON api.user_profiles TO anon, authenticated;
GRANT ALL ON api.user_preferences TO anon, authenticated;
`;

// Migration 006 — Statcast pitch-level data + hitter splits (mirrors scripts/statcast-schema.sql)
const MIGRATION_006_SQL = `
CREATE TABLE IF NOT EXISTS api.statcast_pitches_raw (
  id                BIGSERIAL PRIMARY KEY,
  batter            INTEGER       NOT NULL,
  pitcher           INTEGER       NOT NULL,
  game_date         DATE          NOT NULL,
  game_pk           BIGINT,
  pitch_type        VARCHAR(5),
  release_speed     NUMERIC(5,1),
  release_spin_rate INTEGER,
  release_extension NUMERIC(4,2),
  pfx_x             NUMERIC(6,3),
  pfx_z             NUMERIC(6,3),
  vx0               NUMERIC(8,4),
  vy0               NUMERIC(8,4),
  vz0               NUMERIC(8,4),
  ax                NUMERIC(8,4),
  ay                NUMERIC(8,4),
  az                NUMERIC(8,4),
  launch_speed      NUMERIC(5,1),
  launch_angle      NUMERIC(5,1),
  hit_distance_sc   NUMERIC(7,1),
  events            VARCHAR(50),
  description       VARCHAR(100),
  stand             CHAR(1),
  p_throws          CHAR(1),
  home_team         VARCHAR(5),
  away_team         VARCHAR(5),
  inning            SMALLINT,
  inning_topbot     VARCHAR(3),
  outs_when_up      SMALLINT,
  balls             SMALLINT,
  strikes           SMALLINT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_statcast_batter_date
  ON api.statcast_pitches_raw (batter, game_date DESC);

CREATE INDEX IF NOT EXISTS idx_statcast_pitcher_date
  ON api.statcast_pitches_raw (pitcher, game_date DESC);

CREATE INDEX IF NOT EXISTS idx_statcast_game_date
  ON api.statcast_pitches_raw (game_date DESC);

CREATE INDEX IF NOT EXISTS idx_statcast_pitch_type
  ON api.statcast_pitches_raw (pitch_type, pitcher);

ALTER TABLE api.statcast_pitches_raw ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_statcast_pitches" ON api.statcast_pitches_raw;
CREATE POLICY "public_read_statcast_pitches"
  ON api.statcast_pitches_raw
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "service_write_statcast_pitches" ON api.statcast_pitches_raw;
CREATE POLICY "service_write_statcast_pitches"
  ON api.statcast_pitches_raw
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS api.hitter_splits (
  id                BIGSERIAL     PRIMARY KEY,
  batter            INTEGER       NOT NULL,
  player_name       VARCHAR(100),
  season            INTEGER       NOT NULL,
  split_type        VARCHAR(20)   NOT NULL,
  pa                INTEGER       NOT NULL DEFAULT 0,
  hr                INTEGER       NOT NULL DEFAULT 0,
  hr_rate           NUMERIC(7,5),
  barrel_rate       NUMERIC(7,5),
  avg_exit_velocity NUMERIC(5,1),
  air_pull_rate     NUMERIC(7,5),
  hard_hit_rate     NUMERIC(7,5),
  xslg              NUMERIC(5,3),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (batter, season, split_type)
);

CREATE INDEX IF NOT EXISTS idx_hitter_splits_batter
  ON api.hitter_splits (batter, season);

CREATE INDEX IF NOT EXISTS idx_hitter_splits_leaderboard
  ON api.hitter_splits (season, split_type, barrel_rate DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_hitter_splits_hr_leaderboard
  ON api.hitter_splits (season, split_type, hr_rate DESC NULLS LAST);

ALTER TABLE api.hitter_splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_hitter_splits" ON api.hitter_splits;
CREATE POLICY "public_read_hitter_splits"
  ON api.hitter_splits
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "service_write_hitter_splits" ON api.hitter_splits;
CREATE POLICY "service_write_hitter_splits"
  ON api.hitter_splits
  FOR ALL
  USING (auth.role() = 'service_role');
`;

// Migration 007 — patch api.user_profiles to add columns required by SettingsLightbox
const MIGRATION_007_SQL = `
-- Add columns missing from the original migration 004 definition
ALTER TABLE api.user_profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE api.user_profiles ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free';

-- Add CHECK constraint only if not already present (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_profiles_subscription_tier_check'
      AND conrelid = 'api.user_profiles'::regclass
  ) THEN
    ALTER TABLE api.user_profiles
      ADD CONSTRAINT user_profiles_subscription_tier_check
      CHECK (subscription_tier IN ('free','core','pro','high_stakes'));
  END IF;
END;
$$;
`;

// Migration 008 — patch api.user_preferences to add alert/settings columns required by SettingsLightbox
const MIGRATION_008_SQL = `
ALTER TABLE api.user_preferences ADD COLUMN IF NOT EXISTS odds_alerts         boolean NOT NULL DEFAULT true;
ALTER TABLE api.user_preferences ADD COLUMN IF NOT EXISTS line_movement_alerts boolean NOT NULL DEFAULT true;
ALTER TABLE api.user_preferences ADD COLUMN IF NOT EXISTS arbitrage_alerts    boolean NOT NULL DEFAULT true;
ALTER TABLE api.user_preferences ADD COLUMN IF NOT EXISTS preferred_books     text[]  NOT NULL DEFAULT '{}';
ALTER TABLE api.user_preferences ADD COLUMN IF NOT EXISTS bankroll            numeric NOT NULL DEFAULT 0;
ALTER TABLE api.user_preferences ADD COLUMN IF NOT EXISTS risk_tolerance      text    NOT NULL DEFAULT 'medium';
`;

// Migration 005 — ai_predictions table for storing chat history
const MIGRATION_005_SQL = `
CREATE TABLE IF NOT EXISTS api.ai_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  model VARCHAR(100) DEFAULT 'grok-3-fast',
  confidence FLOAT8 CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_predictions_user    ON api.ai_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_created ON api.ai_predictions(created_at DESC);

ALTER TABLE api.ai_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own predictions only" ON api.ai_predictions;

CREATE POLICY "Own predictions only"
  ON api.ai_predictions FOR ALL
  USING (auth.uid() = user_id OR user_id IS NULL);

GRANT ALL ON api.ai_predictions TO anon, authenticated;
`;

const MIGRATIONS = [
  { id: '003', name: 'player_props_markets', sql: MIGRATION_003_SQL },
  { id: '004', name: 'user_profiles + user_preferences', sql: MIGRATION_004_SQL },
  { id: '005', name: 'ai_predictions', sql: MIGRATION_005_SQL },
  { id: '006', name: 'statcast_pitches_raw + hitter_splits', sql: MIGRATION_006_SQL },
  { id: '007', name: 'user_profiles column patch (avatar_url + subscription_tier)', sql: MIGRATION_007_SQL },
  { id: '008', name: 'user_preferences column patch (alerts + bankroll + risk_tolerance)', sql: MIGRATION_008_SQL },
];

function extractProjectRef(supabaseUrl: string): string | null {
  // https://<project-ref>.supabase.co
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : null;
}

async function runMigration(
  projectRef: string,
  accessToken: string,
  migration: { id: string; name: string; sql: string }
): Promise<{ ok: boolean; detail?: unknown; error?: string }> {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: migration.sql }),
    }
  );
  const detail = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status}`, detail };
  }
  return { ok: true, detail };
}

export async function POST(request: NextRequest) {
  // Auth guard — caller must present the service role key as Bearer token
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!serviceRoleKey || token !== serviceRoleKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

  if (!supabaseUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_SUPABASE_URL not configured' }, { status: 500 });
  }

  if (!accessToken) {
    return NextResponse.json(
      {
        error: 'SUPABASE_ACCESS_TOKEN not configured',
        help: 'Add your personal access token from supabase.com/dashboard → Account → Access Tokens as SUPABASE_ACCESS_TOKEN env var, then redeploy.',
        fallback: 'Run scripts/master-schema.sql in the Supabase SQL Editor to create all tables at once.',
      },
      { status: 500 }
    );
  }

  const projectRef = extractProjectRef(supabaseUrl);
  if (!projectRef) {
    return NextResponse.json({ error: `Could not parse project ref from NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl}` }, { status: 500 });
  }

  console.log(`[v0] [MIGRATE] Running ${MIGRATIONS.length} migrations on project ${projectRef}`);

  const results: Record<string, unknown> = {};

  try {
    for (const migration of MIGRATIONS) {
      console.log(`[v0] [MIGRATE] Running migration ${migration.id}: ${migration.name}`);
      const result = await runMigration(projectRef, accessToken, migration);
      results[`migration_${migration.id}`] = result;
      if (!result.ok) {
        console.error(`[v0] [MIGRATE] Migration ${migration.id} failed:`, result.error, result.detail);
        return NextResponse.json(
          { error: `Migration ${migration.id} (${migration.name}) failed`, detail: result.detail, results },
          { status: 502 }
        );
      }
      console.log(`[v0] [MIGRATE] ✓ Migration ${migration.id} complete: ${migration.name}`);
    }

    console.log(`[v0] [MIGRATE] All migrations complete`);
    return NextResponse.json({
      ok: true,
      message: `All ${MIGRATIONS.length} migrations completed successfully`,
      migrations: MIGRATIONS.map((m) => m.name),
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[v0] [MIGRATE] Exception:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
