# IMMEDIATE FIXES REQUIRED

## Current Status: Application Broken

### Problems Identified from Debug Logs (Feb 15, 2026)

**1. Database Tables Missing**
- Error: `Could not find the table 'public.mlb_odds'`
- Error: `Could not find the 'consensus_score' column of 'ai_response_trust'`
- Impact: Cannot store MLB/NFL/NBA/NHL odds, cannot track AI trust metrics

**2. Only 1 Card Showing Despite 8 NHL Games Available**
- Log: `sport=icehockey_nhl count=1` - Function called with count=1
- Log: `Found 8 live games for NHL` - 8 games available
- Log: `Created 1 cards with real odds data` - Only 1 card created
- Impact: Users see only 1 game instead of 3 detailed matchups

**3. Only H2H Markets (No Spreads or Totals)**
- Log: `markets: [ 'h2h' ]` - Only moneyline odds
- Expected: `markets: [ 'h2h', 'spreads', 'totals' ]`
- Impact: No point spreads, no over/under totals shown in cards

**4. Code Edits Not Deployed**
- File `/lib/cards-generator.ts` has been edited to:
  - Force minimum 3 cards: `const actualCount = Math.max(count, 3);` (line 23)
  - Request all markets: `markets: ['h2h', 'spreads', 'totals']` (line 43)
  - Skip cache: `skipCache: true` (line 47)
- But logs show old code still running
- Server needs restart to pick up changes

---

## SOLUTION 1: Execute Database Schema (USER ACTION REQUIRED)

**Step 1: Open Supabase SQL Editor**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" in left sidebar
4. Click "New Query"

**Step 2: Execute Schema Files (In Order)**

**File 1:** `/scripts/complete-database-schema.sql` (463 lines)
```sql
-- Creates: mlb_odds, nfl_odds, nba_odds, nhl_odds tables
-- Creates: live_odds_cache with proper indexes
-- Creates: line_movement for tracking odds changes
-- Creates: player_stats and player_props_markets
-- Creates: historical_games, kalshi_markets, arbitrage_opportunities
-- Adds: consensus_score column to ai_response_trust
-- Run entire file in SQL Editor
```

**File 2:** `/scripts/quantitative-trading-schema.sql` (338 lines)
```sql
-- Creates: capital_state for bankroll management
-- Creates: bet_allocations for position tracking
-- Creates: projection_priors for Bayesian updates
-- Creates: edge_opportunities, sharp_signals
-- Creates: ml_projections, arbitrage_opportunities
-- Creates: portfolio_performance, system_metrics
-- Run entire file in SQL Editor
```

**Verification:**
```sql
-- Run this to verify tables exist:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('mlb_odds', 'nfl_odds', 'capital_state', 'ai_response_trust');

-- Should return 4 rows

-- Verify consensus_score column exists:
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'ai_response_trust' 
AND column_name = 'consensus_score';

-- Should return 1 row
```

---

## SOLUTION 2: Force Code Deployment (AUTOMATIC)

The code changes are already committed:

**Changes in `/lib/cards-generator.ts`:**
- Line 23: `const actualCount = Math.max(count, 3);` - Forces minimum 3 cards
- Line 43: `markets: ['h2h', 'spreads', 'totals']` - Fetches all markets
- Line 47: `skipCache: true` - Forces fresh API calls
- Lines 60-61: Calculates `gamesToShow = Math.min(actualCount, oddsData.length)` = min(3, 8) = 3 cards

**Changes in `/lib/odds-api-client.ts`:**
- Lines 259-264: `if (skipCache) { requestCache.delete(cacheKey); }` - Clears cache when skipCache=true
- Line 245: Defaults to `[H2H, SPREADS, TOTALS]` markets
- Line 267: Logs which markets are being served from cache

**What Should Happen After Deployment:**
1. New log appears: `originalCount=1 actualCount=3` (proves code is live)
2. New log appears: `CREATING CARDS: actualCount=3, oddsData.length=8, gamesToShow=3`
3. New log appears: `skipCache=true, clearing cache for icehockey_nhl`
4. API fetches fresh data with all 3 markets
5. 3 cards created showing moneyline + spreads + totals
6. Cards display: "Buffalo Sabres @ New Jersey Devils", "Vegas Golden Knights @ Colorado Avalanche", etc.

**Current Behavior (Old Code):**
- Log: `count=1` (no actualCount override visible)
- Log: `markets: [ 'h2h' ]` (only moneyline)
- Log: `Created 1 cards` (only 1 card despite 8 games)
- Cards show: "NHL Live Odds" placeholder

**Expected Behavior (After Deployment):**
- Log: `originalCount=1 actualCount=3`
- Log: `markets: [ 'h2h', 'spreads', 'totals' ]`
- Log: `Created 3 cards with real odds data`
- Cards show: 3 real NHL games with full market data

---

## SOLUTION 3: Verify Code is Live

Run this query to test:
```
User: "Show me NHL games"
```

**Expected Logs (Proves New Code is Running):**
```
[v0] [SPORT CARDS FUNCTION] === CALLED === sport=icehockey_nhl originalCount=1 actualCount=3
[v0] [CARDS GENERATOR] CREATING CARDS: actualCount=3, oddsData.length=8, gamesToShow=3
[API] skipCache=true, clearing cache for icehockey_nhl
[API] Fetching live odds: { sportKey: 'icehockey_nhl', markets: [ 'h2h', 'spreads', 'totals' ] }
[v0] [CARDS GENERATOR] Created 3 cards with real odds data
```

**If Still Shows Old Logs:**
```
[v0] [SPORT CARDS FUNCTION] === CALLED === sport=icehockey_nhl count=1
[API] Fetching live odds: { sportKey: 'icehockey_nhl', markets: [ 'h2h' ] }
[v0] [CARDS GENERATOR] Created 1 cards with real odds data
```
→ Server hasn't restarted yet, wait for automatic deployment

---

## What's Been Fixed in Code (Waiting for Deployment)

✅ **cards-generator.ts line 23:** Forces minimum 3 cards per sport  
✅ **cards-generator.ts line 43:** Requests all markets (h2h, spreads, totals)  
✅ **cards-generator.ts line 47:** Bypasses cache for fresh data  
✅ **cards-generator.ts lines 66-81:** Extracts spreads and totals from API response  
✅ **cards-generator.ts lines 90-108:** Displays all markets in card data  
✅ **odds-api-client.ts lines 259-264:** Clears cache when skipCache=true  
✅ **opportunities-manager.ts:** Capital allocation system with Kelly criterion  

## What Still Needs Manual User Action

❌ **Database schema deployment** - User must execute 2 SQL files in Supabase  
⏳ **Server restart** - Automatic, waiting for Next.js to pick up code changes  

---

## Summary

**Root Cause:** Database tables missing + Old code cached in memory  
**Fix Status:** Code fixed, waiting for deployment + User must run SQL scripts  
**Expected Result:** 3 cards per sport with full market analysis (moneyline + spreads + totals)  
**Timeline:** SQL scripts = 5 minutes, Code deployment = automatic (1-2 minutes after file save)
