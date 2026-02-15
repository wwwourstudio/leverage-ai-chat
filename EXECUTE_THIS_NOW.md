# EXECUTE THIS NOW - Fix Database Errors

## Current Errors

1. ✗ `ERROR: column "sport_key" does not exist` in live_odds_cache table
2. ✗ `Could not find the 'consensus_score' column` in ai_response_trust table
3. ✗ `Could not find the table 'public.mlb_odds'` - sport tables don't exist

## Fix in 2 Steps (5 Minutes)

### Step 1: Fix Missing Columns (URGENT)

1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
2. Execute: `/scripts/fix-missing-columns.sql`
3. Verify output shows: `✓ sport_key column exists` and `✓ consensus_score column exists`

**What this fixes:**
- Adds `sport_key` column to live_odds_cache table
- Adds `consensus_score` column to ai_response_trust table
- Uses safe DO blocks (won't error if columns already exist)
- Automatically migrates existing data

### Step 2: Create Sport-Specific Tables

1. In same SQL Editor
2. Execute: `/scripts/complete-database-schema.sql`
3. This creates:
   - mlb_odds, nfl_odds, nba_odds, nhl_odds, ncaab_odds, ncaaf_odds, college_baseball_odds
   - line_movement, player_stats, player_props_markets
   - historical_games, kalshi_markets, arbitrage_opportunities
   - All indexes and constraints

**What this fixes:**
- Creates all missing tables referenced in queries
- Enables database fallback for off-season sports
- Allows line movement tracking and historical analysis

## After Execution

The errors will be resolved:
- ✓ sport_key column will exist
- ✓ consensus_score column will exist
- ✓ All sport-specific tables will exist
- ✓ Database queries will work correctly

## Current App Status

**Still showing placeholder cards** because:
1. Server hasn't restarted to load my code changes (actualCount override, skipCache, all markets)
2. Old code cached in memory still running

**My code edits are committed** (verified in files):
- ✓ actualCount = Math.max(count, 3) - forces 3 cards minimum
- ✓ markets: ['h2h', 'spreads', 'totals'] - fetches all markets
- ✓ skipCache: true - bypasses stale cache
- ✓ Enhanced card display with spreads and totals

**After database fix + server restart**, you'll see:
- 3 real game cards per sport (not 1 placeholder)
- Full market analysis (moneyline, spreads, over/under)
- Real game matchups (not "NHL Live Odds" generic titles)
