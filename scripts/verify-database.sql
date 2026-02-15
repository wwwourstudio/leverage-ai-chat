-- Database Verification Script
-- Execute this to check if all required tables and columns exist

-- 1. Check all required tables exist
SELECT 
  table_name,
  CASE 
    WHEN table_name IN (
      'live_odds_cache', 'mlb_odds', 'nfl_odds', 'nba_odds', 'nhl_odds',
      'ai_response_trust', 'line_movement', 'player_props_markets',
      'historical_games', 'kalshi_markets', 'arbitrage_opportunities',
      'capital_state', 'bet_allocations', 'projection_priors',
      'bayesian_updates', 'edge_opportunities'
    ) THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'live_odds_cache', 'mlb_odds', 'nfl_odds', 'nba_odds', 'nhl_odds',
    'ai_response_trust', 'line_movement', 'player_props_markets',
    'historical_games', 'kalshi_markets', 'arbitrage_opportunities',
    'capital_state', 'bet_allocations', 'projection_priors',
    'bayesian_updates', 'edge_opportunities'
  )
ORDER BY table_name;

-- 2. Check critical columns exist
SELECT 
  table_name,
  column_name,
  data_type,
  '✓ EXISTS' as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'live_odds_cache' AND column_name IN ('sport_key', 'sport', 'game_id')) OR
    (table_name = 'ai_response_trust' AND column_name = 'consensus_score') OR
    (table_name = 'line_movement' AND column_name IN ('game_id', 'line_change', 'old_line', 'new_line')) OR
    (table_name = 'capital_state' AND column_name IN ('total_capital', 'risk_budget', 'kelly_scale'))
  )
ORDER BY table_name, column_name;

-- 3. Check for data in key tables
SELECT 
  'live_odds_cache' as table_name,
  COUNT(*) as row_count,
  MAX(updated_at) as last_updated
FROM live_odds_cache
UNION ALL
SELECT 
  'arbitrage_opportunities',
  COUNT(*),
  MAX(updated_at)
FROM arbitrage_opportunities
WHERE status = 'active'
UNION ALL
SELECT 
  'line_movement',
  COUNT(*),
  MAX(updated_at)
FROM line_movement
WHERE updated_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
  'kalshi_markets',
  COUNT(*),
  MAX(updated_at)
FROM kalshi_markets;

-- 4. Check indexes exist
SELECT 
  schemaname,
  tablename,
  indexname,
  '✓ INDEXED' as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('live_odds_cache', 'line_movement', 'arbitrage_opportunities', 'bet_allocations')
ORDER BY tablename, indexname;

-- 5. Check realtime is enabled
SELECT 
  schemaname,
  tablename,
  '✓ REALTIME ENABLED' as status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('live_odds_cache', 'arbitrage_opportunities', 'line_movement', 'bet_allocations')
ORDER BY tablename;

-- 6. Validate RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  '✓ RLS ACTIVE' as status
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
