import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/admin/migrate
 *
 * Runs the player_props_markets migration against Supabase using the
 * Supabase Management API.
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

// The migration SQL — mirrors scripts/003-player-props-table.sql
const MIGRATION_SQL = `
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

function extractProjectRef(supabaseUrl: string): string | null {
  // https://<project-ref>.supabase.co
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : null;
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
        fallback: 'Run scripts/003-player-props-table.sql manually in the Supabase SQL Editor.',
      },
      { status: 500 }
    );
  }

  const projectRef = extractProjectRef(supabaseUrl);
  if (!projectRef) {
    return NextResponse.json({ error: `Could not parse project ref from NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl}` }, { status: 500 });
  }

  console.log(`[v0] [MIGRATE] Running player_props_markets migration on project ${projectRef}`);

  try {
    const mgmtRes = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ query: MIGRATION_SQL }),
      }
    );

    const body = await mgmtRes.json().catch(() => ({}));

    if (!mgmtRes.ok) {
      console.error('[v0] [MIGRATE] Management API error:', mgmtRes.status, body);
      return NextResponse.json(
        { error: 'Supabase management API error', status: mgmtRes.status, detail: body },
        { status: 502 }
      );
    }

    console.log('[v0] [MIGRATE] ✓ player_props_markets migration complete');
    return NextResponse.json({ ok: true, message: 'api.player_props_markets created successfully', detail: body });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[v0] [MIGRATE] Exception:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
