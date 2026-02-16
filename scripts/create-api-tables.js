import pg from 'pg';

const connectionString = process.env.SUPABASE_DIRECT_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('No database connection string found');
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
  await client.connect();
  console.log('Connected to database');

  // Create tables in 'api' schema (the only exposed schema)
  const statements = [
    `CREATE SCHEMA IF NOT EXISTS api`,

    `CREATE TABLE IF NOT EXISTS api.profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      full_name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS api.chats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES api.profiles(id),
      title TEXT DEFAULT 'New Chat',
      category TEXT DEFAULT 'all',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS api.messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chat_id UUID REFERENCES api.chats(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      cards JSONB,
      trust_metrics JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS api.live_odds_cache (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sport TEXT NOT NULL,
      sport_key TEXT NOT NULL,
      game_id TEXT UNIQUE NOT NULL,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      commence_time TIMESTAMPTZ,
      bookmakers JSONB,
      markets JSONB,
      cached_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS api.line_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      game_id TEXT NOT NULL,
      sport TEXT NOT NULL,
      market_type TEXT NOT NULL,
      team TEXT NOT NULL,
      line NUMERIC,
      odds NUMERIC NOT NULL,
      bookmaker TEXT NOT NULL,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS api.edge_opportunities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      market_id TEXT NOT NULL,
      sport TEXT NOT NULL,
      matchup TEXT NOT NULL,
      model_prob NUMERIC NOT NULL,
      market_prob NUMERIC NOT NULL,
      edge NUMERIC NOT NULL,
      confidence_score NUMERIC NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS api.arbitrage_opportunities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      market_id TEXT NOT NULL,
      sport TEXT NOT NULL,
      matchup TEXT NOT NULL,
      side_a_book TEXT NOT NULL,
      side_a_odds NUMERIC NOT NULL,
      side_a_stake NUMERIC,
      side_b_book TEXT NOT NULL,
      side_b_odds NUMERIC NOT NULL,
      side_b_stake NUMERIC,
      profit_margin NUMERIC NOT NULL,
      total_implied_prob NUMERIC NOT NULL,
      status TEXT DEFAULT 'active',
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS api.ai_response_trust (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      query TEXT NOT NULL,
      response TEXT NOT NULL,
      trust_score NUMERIC NOT NULL,
      consensus_score NUMERIC,
      data_sources JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS api.user_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES api.profiles(id),
      preferred_sports TEXT[] DEFAULT '{basketball_nba,americanfootball_nfl,baseball_mlb,icehockey_nhl}',
      preferred_books TEXT[] DEFAULT '{fanduel,draftkings,betmgm}',
      bankroll NUMERIC DEFAULT 1000,
      risk_tolerance TEXT DEFAULT 'moderate',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // Grant permissions to anon and authenticated roles
    `GRANT USAGE ON SCHEMA api TO anon, authenticated`,
    `GRANT ALL ON ALL TABLES IN SCHEMA api TO anon, authenticated`,
    `GRANT ALL ON ALL SEQUENCES IN SCHEMA api TO anon, authenticated`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT ALL ON TABLES TO anon, authenticated`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT ALL ON SEQUENCES TO anon, authenticated`,

    // Create indexes
    `CREATE INDEX IF NOT EXISTS idx_live_odds_sport ON api.live_odds_cache(sport_key)`,
    `CREATE INDEX IF NOT EXISTS idx_live_odds_expires ON api.live_odds_cache(expires_at)`,
    `CREATE INDEX IF NOT EXISTS idx_line_snapshots_game ON api.line_snapshots(game_id)`,
    `CREATE INDEX IF NOT EXISTS idx_edge_sport ON api.edge_opportunities(sport)`,
    `CREATE INDEX IF NOT EXISTS idx_arb_sport ON api.arbitrage_opportunities(sport)`,
  ];

  for (const sql of statements) {
    try {
      await client.query(sql);
      const tableName = sql.match(/api\.(\w+)/)?.[1] || sql.substring(0, 50);
      console.log(`OK: ${tableName}`);
    } catch (err) {
      console.error(`FAILED: ${err.message}`);
    }
  }

  await client.end();
  console.log('Done');
}

run().catch(err => { console.error(err); process.exit(1); });
