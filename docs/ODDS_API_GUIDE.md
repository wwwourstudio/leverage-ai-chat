# Odds API Debugging Guide

## Problem Summary

Console logs show `[NO GAMES FOUND] nba` indicating that the Odds API is being called but returning empty arrays for most sports except NHL. This guide provides a systematic approach to debug and fix the issue.

## Root Cause Analysis

Based on the logs and codebase review, the issue stems from:

1. **API Key validity** - May be invalid or rate-limited
2. **Sport key mappings** - Incorrect sport key format being sent to API
3. **Seasonal availability** - Some sports are off-season with no scheduled games
4. **Database connectivity** - Tables may not exist causing storage failures
5. **Request timing** - Games typically appear 24-48 hours before start time

## Diagnostic Tools

### 1. Test API Endpoint
```bash
curl http://localhost:3000/api/odds/test
```

This endpoint tests all sport APIs and returns:
- Which sports are working
- Which have no games
- Which are failing with errors
- API key validation status

### 2. Verify Database Tables
```bash
npx tsx scripts/verify-odds-tables.ts
```

Checks if all required tables exist:
- nba_odds
- nfl_odds
- mlb_odds
- nhl_odds
- ncaab_odds
- ncaaf_odds
- college_baseball_odds

### 3. Run Comprehensive Test Suite
```bash
npx tsx scripts/test-odds-apis.ts
```

Tests:
- API connectivity for each sport
- Database write permissions
- Data persistence
- Error handling

## Step-by-Step Debugging

### Step 1: Verify API Key

1. Check environment variables:
```bash
echo $ODDS_API_KEY
```

2. Visit https://the-odds-api.com/account/ and verify:
   - API key is active
   - Request quota remaining
   - No suspended status

3. Test manually with curl:
```bash
curl "https://api.the-odds-api.com/v4/sports/basketball_nba/odds?apiKey=YOUR_KEY&regions=us&markets=h2h"
```

### Step 2: Check Sport Key Mappings

The Odds API requires specific sport key formats:

| Sport | Short Form | API Format |
|-------|-----------|------------|
| NBA | nba | basketball_nba |
| NFL | nfl | americanfootball_nfl |
| MLB | mlb | baseball_mlb |
| NHL | nhl | icehockey_nhl |
| NCAAB | ncaab | basketball_ncaab |
| NCAAF | ncaaf | americanfootball_ncaaf |

Verify mappings in `lib/constants.ts` under `SPORT_KEYS`.

### Step 3: Check Seasonal Availability

Sports have off-seasons:

- **NBA**: October - April (playoffs through June)
- **NFL**: September - February (playoffs through February)
- **MLB**: March - October (playoffs through November)
- **NHL**: October - April (playoffs through June)
- **NCAAB**: November - March (tournament through April)
- **NCAAF**: August - December (bowls through January)

If no games are scheduled, the API returns an empty array. This is **normal** during off-season.

### Step 4: Review Enhanced Logging

The odds API route now includes detailed logging:

```typescript
[v0] === ODDS API REQUEST DEBUG ===
[v0] Sport: basketball_nba (NBA)
[v0] Market: h2h
[v0] URL: https://api.the-odds-api.com/v4/sports/basketball_nba/odds...
[v0] API Key configured: YES
[v0] ==============================
```

Check logs for:
- Correct sport key format
- API key presence
- HTTP response status
- Event count

### Step 5: Database Verification

1. Run verification script:
```bash
npx tsx scripts/verify-odds-tables.ts
```

2. If tables are missing, execute migration:
   - Open Supabase Dashboard
   - Go to SQL Editor
   - Run: `scripts/odds-storage-by-sport.sql`

3. Verify permissions:
```sql
GRANT SELECT ON nba_odds TO authenticated;
GRANT ALL ON nba_odds TO service_role;
```

### Step 6: Test Individual Sport

Use the diagnostic endpoint to test a specific sport:

```bash
# Test NBA specifically
curl "http://localhost:3000/api/odds" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"sport":"basketball_nba","marketType":"h2h"}'
```

Expected response:
```json
{
  "sport": "basketball_nba",
  "events": [...],
  "timestamp": "2026-02-14T...",
  "cached": false
}
```

## Common Issues and Fixes

### Issue 1: "No games found" for all sports

**Cause**: Off-season or API key invalid

**Fix**:
1. Check current date - are games scheduled?
2. Verify API key at https://the-odds-api.com/account/
3. Check request quota (free tier: 500/month)

### Issue 2: NHL works but other sports don't

**Cause**: Sport key mapping mismatch

**Fix**:
1. Review `lib/constants.ts` - verify `SPORT_KEYS`
2. Ensure `sportToApi()` function is working
3. Check logs for sport key being sent to API

### Issue 3: Database storage fails

**Cause**: Missing tables or permissions

**Fix**:
1. Run `scripts/verify-odds-tables.ts`
2. Execute migration if needed
3. Check Supabase service role key is set

### Issue 4: Cross-sport contamination

**Cause**: Fallback logic returning wrong sport

**Fix**: Already fixed with new guards:
- Detects sport explicitly before fetching
- No fallback when sport is specified
- Cross-sport contamination guard blocks mismatched data

## Architecture Overview

### Request Flow

1. User sends message mentioning sport (e.g., "NBA odds")
2. `extractSport()` detects sport from message
3. Context flags set: `isSportsQuery`, `hasBettingIntent`, `sport`
4. If sport detected: fetch ONLY that sport, no fallback
5. If no sport: attempt fallback rotation across sports
6. Data stored in sport-specific table (e.g., `nba_odds`)
7. Response sent to user with odds data

### Key Files

- `/app/api/odds/route.ts` - Main odds API endpoint
- `/app/api/odds/test/route.ts` - Diagnostic endpoint
- `/lib/constants.ts` - Sport key mappings
- `/lib/sports-validator.ts` - Validation logic
- `/lib/odds-persistence.ts` - Database storage
- `/lib/odds-api-client.ts` - External API client

## Testing Checklist

- [ ] Run `/api/odds/test` endpoint
- [ ] Verify database tables exist
- [ ] Check API key validity and quota
- [ ] Test each sport individually
- [ ] Verify sport key mappings
- [ ] Check seasonal availability
- [ ] Review console logs for errors
- [ ] Test database write permissions
- [ ] Verify no cross-sport contamination
- [ ] Check user notifications appear

## Monitoring

### Production Logs to Watch

```
[SPORT DETECTED] - Shows detected sport or 'none'
[POLITICAL MARKET DETECTED] - Should be false for sports
[ODDS FETCH ATTEMPT] - Confirms odds fetch started
[NO GAMES FOUND] - Normal if off-season
[CROSS-SPORT BLOCKED] - Should never appear in production
```

### Success Indicators

- Events returned: `[v0] Events returned: N` where N > 0
- Database storage: `[v0] ✅ Stored N odds records`
- API remaining: `[v0] API Remaining: N` shows quota
- No errors in logs

## Next Steps

1. Run diagnostic endpoint: `/api/odds/test`
2. Review results and identify failing sports
3. For each failing sport:
   - Check if games are scheduled (seasonality)
   - Verify sport key format is correct
   - Test API directly with curl
4. Verify database tables exist
5. Run comprehensive test suite
6. Monitor production logs

## Support

If issues persist after following this guide:

1. Check The Odds API status: https://the-odds-api.com/
2. Review API documentation: https://the-odds-api.com/sports-odds-data/sports-apis.html
3. Check Supabase dashboard for database errors
4. Review application logs for detailed error messages
