# IMMEDIATE DEPLOYMENT INSTRUCTIONS

## Step 1: Deploy Database Schema (5 minutes)

1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to SQL Editor
4. Copy contents of `/scripts/DEPLOY_THIS_SCHEMA.sql`
5. Paste and click "Run"
6. Verify success - you should see 12 tables listed at bottom

**Expected Output:**
```
live_odds_cache
mlb_odds
nfl_odds
nba_odds
nhl_odds
ai_response_trust
capital_state
bet_allocations
edge_opportunities
arbitrage_opportunities
player_stats
line_movement
```

## Step 2: Verify Environment Variables

Check these are set in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ODDS_API_KEY`

## Step 3: Code Changes Applied

The following code changes are now in place:

### ✅ Cards Generator (`/lib/cards-generator.ts`)
- Line 23: Force minimum 3 cards: `actualCount = Math.max(count, 3)`
- Line 43: Request ALL markets: `['h2h', 'spreads', 'totals']`
- Line 47: Skip cache: `skipCache: true`
- Added detailed logging to track card creation

### ✅ Supabase Integration
- `/lib/supabase-odds-service.ts` - Complete service layer (275 lines)
- `/lib/unified-odds-fetcher.ts` - Unified API + cache (102 lines)
- `/lib/hooks/use-realtime.ts` - Real-time subscriptions (91 lines)

### ✅ Database Schema
- `/scripts/DEPLOY_THIS_SCHEMA.sql` - Production schema (279 lines)
- All 12 tables with proper indexes
- RLS policies configured
- Real-time enabled for key tables

## Step 4: Test the Application

After deploying the schema, test these features:

1. **Card Display**: Should show 3 cards per sport with real game data
2. **Market Data**: Each card should show moneyline, spreads, and totals
3. **Real-time Updates**: Changes in Supabase should reflect immediately
4. **Edge Opportunities**: System should detect and store value bets
5. **Arbitrage Detection**: Cross-bookmaker opportunities tracked

## Expected Behavior

### Before:
- Only 1 card showing ("NHL Live Odds" placeholder)
- Only h2h markets
- Database errors (tables not found)

### After:
- 3 real game cards per sport
- Full market data (moneyline, spreads, over/under)
- No database errors
- Real-time sync working
- Opportunities tracking active

## Troubleshooting

### If cards still show placeholders:
1. Hard refresh browser (Ctrl+Shift+R)
2. Wait 60 seconds for cache to expire
3. Check debug logs for new logging format: `[v0] [CARDS-GEN]`

### If database errors persist:
1. Verify all 12 tables exist in Supabase
2. Check RLS policies are enabled
3. Confirm environment variables are set

### If no games show:
1. Check Odds API quota at https://the-odds-api.com/account
2. Verify API key is correct
3. Check if sport is in season

## Next Steps

Once deployed and verified:
1. Monitor capital allocations in `bet_allocations` table
2. Track edge opportunities in real-time
3. Review arbitrage opportunities as they're detected
4. Use the quantitative trading engine for Kelly-optimal sizing

## Support

All code changes are committed. The database schema just needs to be executed once in Supabase SQL Editor.
