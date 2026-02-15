# Deployment Checklist - Execute in Order

## ✅ TASK 1: Execute Database Schema (REQUIRED FIRST)

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Click "SQL Editor" in the left sidebar
3. Click "New Query"

### Step 2: Execute Schema Files in Order
Execute these files in the Supabase SQL Editor in this exact order:

**File 1: `/scripts/DEPLOY_THIS_SCHEMA.sql` (279 lines)**
- Creates all base tables with proper columns
- Includes: live_odds_cache with sport_key, mlb_odds, nfl_odds, nba_odds, nhl_odds
- Adds: ai_response_trust with consensus_score column
- Creates: kalshi_markets, player_props_markets, line_movement tables
- Sets up: arbitrage_opportunities, historical_games
- Adds: All required indexes for performance

```sql
-- Copy and paste the entire contents of scripts/DEPLOY_THIS_SCHEMA.sql
-- Then click "Run" or press Cmd/Ctrl + Enter
```

**File 2: `/scripts/enable-realtime.sql` (31 lines)**
- Enables Supabase Realtime on all tables
- Allows live data streaming to clients

```sql
-- Copy and paste the entire contents of scripts/enable-realtime.sql
-- Then click "Run"
```

**File 3: `/scripts/rls-policies.sql` (127 lines)**
- Enables Row Level Security
- Sets public read access
- Restricts write access to authenticated users

```sql
-- Copy and paste the entire contents of scripts/rls-policies.sql
-- Then click "Run"
```

### Step 3: Verify Schema Created Successfully

Run this verification query:

```sql
-- Check all required tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'live_odds_cache',
  'mlb_odds',
  'nfl_odds',
  'nba_odds',
  'nhl_odds',
  'ai_response_trust',
  'kalshi_markets',
  'player_props_markets',
  'line_movement',
  'arbitrage_opportunities',
  'capital_state',
  'bet_allocations',
  'historical_games'
)
ORDER BY table_name;
```

**Expected Result:** 13 tables listed

**If tables are missing:** Re-run the corresponding SQL file

### Step 4: Verify Critical Columns Exist

```sql
-- Check sport_key column in live_odds_cache
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'live_odds_cache' 
AND column_name = 'sport_key';

-- Check consensus_score column in ai_response_trust
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'ai_response_trust' 
AND column_name = 'consensus_score';
```

**Expected Result:** Both columns should exist

---

## ✅ TASK 2: Verify API Integrations

### Check Environment Variables in Vercel

Go to Vercel project settings → Environment Variables and verify:

**Required Variables:**
- `ODDS_API_KEY` - The Odds API key for live sports data
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side)

**Optional but Recommended:**
- `KALSHI_API_KEY` - Kalshi API for prediction markets
- `KALSHI_API_SECRET` - Kalshi API secret

### Test API Keys Work

Run the diagnostic script (if Node.js available locally):

```bash
# Test odds API
npx tsx scripts/test-odds-api.ts

# Expected output:
# ✓ Fetched X games for icehockey_nhl
# ✓ Markets include: h2h, spreads, totals
# ✓ Cache working correctly
```

### Manual API Test

Visit in browser (replace YOUR_KEY):
```
https://api.the-odds-api.com/v4/sports/icehockey_nhl/odds/?apiKey=YOUR_KEY&regions=us&markets=h2h,spreads,totals
```

**Expected:** JSON response with games array

---

## ✅ TASK 3: Test Live Odds Fetching

### Verify 3 Cards Minimum

In the chat interface, ask:
```
Show me NHL betting odds
```

**Expected Behavior:**
- Should show at least 3 cards (not just 1)
- Each card should display a real game matchup
- Cards should include h2h, spreads, and totals markets
- NOT placeholder cards saying "NHL Live Odds"

### Debug Logs to Check

Look for these log statements in browser console:

```
[v0] [CARDS-GEN] ENTRY: sport=icehockey_nhl requestedCount=1 OVERRIDING TO actualCount=3
[v0] [CARDS-GEN] Fetching odds with markets: ["h2h", "spreads", "totals"] skipCache: true
[v0] [CARDS-GEN] LOOP START: Will create 3 cards
[v0] [CARDS-GEN] Creating card 1/3
[v0] [CARDS-GEN] Creating card 2/3
[v0] [CARDS-GEN] Creating card 3/3
```

**If you see count=1 or only h2h markets:**
- Server hasn't restarted yet with new code
- Wait for deployment to complete
- Or manually redeploy the project

---

## ✅ TASK 4: Validate All Card Categories

### Test Each Category Type

Test these queries in chat:

**1. Arbitrage:**
```
Show me arbitrage opportunities
```
Expected: Cards showing guaranteed profit opportunities or "No opportunities"

**2. Line Movement:**
```
Show me line movements
```
Expected: Cards showing steam moves and line changes

**3. Player Props:**
```
Show me NBA player props
```
Expected: Cards with player-specific markets (points, rebounds, assists)

**4. Portfolio/Kelly:**
```
Show me my portfolio
```
Expected: Portfolio overview card with bankroll and Kelly-sized positions

**5. Kalshi Markets:**
```
Show me Kalshi prediction markets
```
Expected: Prediction market cards with binary outcome probabilities

**6. Standard Betting:**
```
Show me NBA games
```
Expected: 3 cards with real NBA matchups, h2h/spreads/totals

### Verify Real Data

All cards should show:
- ✓ Real team/player names (not placeholders)
- ✓ Actual odds numbers
- ✓ Live timestamps
- ✓ metadata.realData = true
- ✓ dataSource indicates "Unified Service" or "Supabase"

---

## ✅ TASK 5: Monitoring and Error Reporting

### Add Health Check Endpoint

The health check endpoint is already available at:
```
GET /api/health
```

**Test it:**
```bash
curl https://your-app.vercel.app/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-15T...",
  "services": {
    "database": "connected",
    "oddsApi": "available",
    "cache": "active"
  }
}
```

### Monitor Error Logs

Check Vercel deployment logs for errors:
1. Go to Vercel dashboard
2. Click on your deployment
3. Click "Functions" tab
4. Look for errors in recent invocations

### Common Issues and Fixes

**Issue: "table does not exist"**
- Fix: Execute database schema SQL files in Supabase

**Issue: "column does not exist"**
- Fix: Re-run DEPLOY_THIS_SCHEMA.sql to add missing columns

**Issue: "Only 1 card showing"**
- Fix: Wait for server restart, or check if actualCount override is in deployed code

**Issue: "Only h2h markets, no spreads"**
- Fix: Clear cache or wait for TTL expiry (5 minutes)

**Issue: "Placeholder cards instead of real data"**
- Fix: Verify ODDS_API_KEY is set correctly in environment variables

---

## Success Criteria

### All Systems Operational When:

1. ✅ All 13 database tables exist in Supabase
2. ✅ Real-time subscriptions enabled
3. ✅ RLS policies applied
4. ✅ Environment variables set correctly
5. ✅ Chat shows 3 cards minimum (not 1)
6. ✅ All markets visible (h2h, spreads, totals)
7. ✅ Real game data displayed (not placeholders)
8. ✅ All 6 card categories working (arbitrage, lines, props, portfolio, kalshi, betting)
9. ✅ Error logs show no database or API errors
10. ✅ Health check endpoint returns "healthy"

---

## Quick Start Commands

If you have local development environment:

```bash
# 1. Verify database health
npx tsx scripts/check-database-health.ts

# 2. Test odds API integration
npx tsx scripts/test-odds-api.ts

# 3. Test cards generator
npx tsx scripts/test-cards-generator.ts

# 4. Validate odds calculations
npx tsx scripts/validate-odds-calculations.ts

# 5. Run end-to-end test
npx tsx scripts/test-end-to-end.ts
```

All tests should pass with ✓ marks and no errors.

---

## Support

If issues persist after following this checklist:

1. Check `/FIXES_NEEDED.md` for detailed debugging steps
2. Review `/STATUS_AND_FIXES.md` for current system status
3. Run diagnostic script: `npx tsx scripts/diagnose-api-response.ts`
4. Check browser console for `[v0]` prefixed debug logs
