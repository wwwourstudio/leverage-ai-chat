import pg from 'pg';

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.log('No POSTGRES_URL, DATABASE_URL, or SUPABASE_DB_URL found.');
  console.log('Available env vars with DB/PG/SUPA:', Object.keys(process.env).filter(k => 
    k.includes('PG') || k.includes('DB') || k.includes('SUPA') || k.includes('POSTGRES') || k.includes('DATABASE')
  ));
  process.exit(1);
}

console.log('Connecting to database...');
console.log('Connection string starts with:', connectionString.substring(0, 30) + '...');

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log('Connected successfully!\n');

  // Check which schemas exist
  const schemas = await client.query(`SELECT schema_name FROM information_schema.schemata ORDER BY schema_name`);
  console.log('Available schemas:', schemas.rows.map(r => r.schema_name).join(', '));

  // Check if api schema exists
  const apiExists = schemas.rows.some(r => r.schema_name === 'api');
  console.log('\napi schema exists:', apiExists);

  if (!apiExists) {
    console.log('Creating api schema...');
    await client.query('CREATE SCHEMA IF NOT EXISTS api');
  }

  // Create tables in api schema
  const createTableQueries = [
    `CREATE TABLE IF NOT EXISTS api.profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE,
      email TEXT,
      full_name TEXT,
      avatar_url TEXT,
      credits INTEGER DEFAULT 50,
      plan TEXT DEFAULT 'free',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS api.chats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      title TEXT NOT NULL DEFAULT 'New Chat',
      category TEXT DEFAULT 'all',
      sport TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS api.messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chat_id UUID REFERENCES api.chats(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      cards JSONB,
      trust_metrics JSONB,
      model TEXT,
      processing_time INTEGER,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS api.live_odds_cache (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sport_key TEXT NOT NULL,
      sport_title TEXT,
      data JSONB NOT NULL,
      fetched_at TIMESTAMPTZ DEFAULT now(),
      expires_at TIMESTAMPTZ DEFAULT (now() + interval '5 minutes')
    )`,
    `CREATE TABLE IF NOT EXISTS api.line_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      game_id TEXT NOT NULL,
      sport_key TEXT NOT NULL,
      home_team TEXT,
      away_team TEXT,
      bookmaker TEXT,
      market_type TEXT,
      odds_data JSONB,
      snapshot_time TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS api.edge_opportunities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sport_key TEXT NOT NULL,
      game_id TEXT,
      matchup TEXT,
      edge_type TEXT,
      edge_value NUMERIC,
      description TEXT,
      odds_data JSONB,
      detected_at TIMESTAMPTZ DEFAULT now(),
      expires_at TIMESTAMPTZ
    )`,
    `CREATE TABLE IF NOT EXISTS api.ai_response_trust (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      query TEXT,
      response_hash TEXT,
      benford_score NUMERIC,
      source_count INTEGER,
      confidence NUMERIC,
      trust_level TEXT,
      details JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS api.user_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE,
      preferred_books TEXT[] DEFAULT ARRAY['draftkings', 'fanduel', 'betmgm'],
      preferred_sports TEXT[] DEFAULT ARRAY['nfl', 'nba', 'mlb', 'nhl'],
      bankroll NUMERIC DEFAULT 1000,
      unit_size NUMERIC DEFAULT 25,
      risk_tolerance TEXT DEFAULT 'moderate',
      notifications JSONB DEFAULT '{"email": true, "push": false}'::jsonb,
      theme TEXT DEFAULT 'dark',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )`
  ];

  for (const query of createTableQueries) {
    const tableName = query.match(/api\.(\w+)/)?.[1] || 'unknown';
    try {
      await client.query(query);
      console.log(`Created table: api.${tableName}`);
    } catch (err) {
      console.error(`Error creating api.${tableName}:`, err.message);
    }
  }

  // Create indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_chats_user ON api.chats(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_messages_chat ON api.messages(chat_id)',
    'CREATE INDEX IF NOT EXISTS idx_odds_cache_sport ON api.live_odds_cache(sport_key)',
    'CREATE INDEX IF NOT EXISTS idx_line_snapshots_game ON api.line_snapshots(game_id, snapshot_time)',
    'CREATE INDEX IF NOT EXISTS idx_edge_sport ON api.edge_opportunities(sport_key, detected_at)',
  ];

  for (const idx of indexes) {
    try {
      await client.query(idx);
    } catch (err) {
      // Ignore index errors
    }
  }
  console.log('\nIndexes created.');

  // Grant permissions for Supabase PostgREST
  const grants = [
    'GRANT USAGE ON SCHEMA api TO anon, authenticated',
    'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA api TO anon, authenticated',
    'ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated',
  ];

  for (const grant of grants) {
    try {
      await client.query(grant);
    } catch (err) {
      console.error('Grant error:', err.message);
    }
  }
  console.log('Permissions granted.\n');

  // Verify tables
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'api' ORDER BY table_name
  `);
  console.log('Tables in api schema:', tables.rows.map(r => r.table_name).join(', '));

} catch (err) {
  console.error('Database error:', err.message);
} finally {
  await client.end();
  console.log('\nDone.');
}
