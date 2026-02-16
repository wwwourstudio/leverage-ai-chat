# Quick Start - Fix Odds API Now

## Problem
Cards showing "NBA Live Odds" / "NFL Live Odds" instead of real games.

## Root Cause Analysis
The Odds API is working correctly but returning 0 games for NBA/NFL because:
1. **NFL**: It's February 15, 2026 - NFL season is over (ends in February)
2. **NBA**: No games scheduled today (check schedule)
3. **NHL**: Working correctly - games are scheduled (Buffalo Sabres @ New Jersey Devils visible)

## Solution: Database Setup Required

### Step 1: Execute Database Schema (2 minutes)

1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Select your LEVERAGEAI project
3. Click **SQL Editor** in left sidebar
4. Click **New Query**
5. Copy ALL contents from: `/scripts/master-schema.sql`
6. Paste into SQL Editor
7. Click **Run** (or press Cmd/Ctrl + Enter)
8. Wait for "Success. No rows returned"

### Step 2: Verify Setup (30 seconds)

Run this query in Supabase SQL Editor:

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Expected result: 13 tables including:
- live_odds_cache
- mlb_odds, nfl_odds, nba_odds, nhl_odds
- arbitrage_opportunities
- line_movement
- player_props_markets
- kalshi_markets
- capital_state
- bet_allocations

### Step 3: Test in Chat

Ask the AI:
- "Show me NHL odds" ✓ Should work (season active)
- "Show me arbitrage opportunities"
- "Show me line movements"
- "Show me my portfolio"

## Why No NBA/NFL Data?

### NFL
**Status**: Offseason (Feb 15, 2026)
- Regular season: September - January
- Playoffs: January - February (Super Bowl early Feb)
- **No games available** - season has ended

### NBA  
**Status**: Mid-season
- Regular season: October - April
- **Games are scheduled** but not necessarily TODAY
- Try: "Show me NBA odds" tomorrow when games are scheduled
- NBA typically plays games in the evening (7-10pm EST)

### NHL
**Status**: Working! ✓
- Regular season: October - April
- Games scheduled today: Yes
- Example visible: Buffalo Sabres @ New Jersey Devils

## Current System Status

✓ **API Key**: Configured and working
✓ **Unified Service**: Fetching from API successfully  
✓ **3-Card Minimum**: Enforced in code
✓ **All Markets**: h2h, spreads, totals requested
⚠ **Database**: Tables need to be created (run master-schema.sql)
⚠ **NBA/NFL**: No games today (expected behavior)

## Expected Behavior After Fix

When you ask for odds:
1. **If games exist**: Shows 3 real game cards with odds
2. **If no games (offseason)**: Shows informative card explaining why
   - "NFL Offseason - NFL season runs September through February"
   - "NBA - No Games Available - NBA games typically scheduled afternoon/evening EST"
3. **If NHL (active)**: Shows real games with actual matchups and odds

## Test Queries

### Working Now (NHL active season)
```
Show me NHL odds
What are the best NHL bets tonight?
```

### Will Show "No Games" (Expected)
```
Show me NFL odds → "NFL Offseason"
Show me NBA odds → "No games scheduled today" (unless it's game day)
```

### Try Other Features
```
Show me arbitrage opportunities
Show me line movements
What are the player props for tonight?
Show me my portfolio
```

## Troubleshooting

### Still Seeing Placeholder Cards?

1. **Check the error message on the card** - It now explains WHY no data
   - "NFL Offseason" = Expected, season ended
   - "No games scheduled today" = Expected, try tomorrow
   - "API Error" = Check ODDS_API_KEY

2. **Verify API Key**
   - Go to Vercel Dashboard > Your Project > Settings > Environment Variables
   - Confirm `ODDS_API_KEY` is set
   - Get free key at: https://the-odds-api.com/

3. **Check Logs**
   - Open browser console (F12)
   - Look for `[v0]` or `[UnifiedFetcher]` logs
   - Should see: "Received X games from API"

### Database Errors?

If you see errors about missing tables:
```
ERROR: relation "public.live_odds_cache" does not exist
```

→ You must run `/scripts/master-schema.sql` in Supabase SQL Editor (Step 1 above)

## Next Steps

1. Execute master-schema.sql in Supabase (required)
2. Test with NHL (games available now)
3. Wait for NBA/NFL game days to test those sports
4. Explore other features: arbitrage, line movement, portfolio

## Why This Happens

The Odds API only returns games that are:
- Scheduled within the next 7 days
- From leagues currently in season
- Available from US sportsbooks

February 15, 2026:
- ✓ NHL: Mid-season (Oct-Apr) - Games available
- ✗ NFL: Offseason (Super Bowl was ~2 weeks ago)
- ? NBA: Mid-season but game schedule varies by day
