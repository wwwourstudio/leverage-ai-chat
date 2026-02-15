# Sports API Testing & Debugging Guide

## Overview

This guide provides comprehensive instructions for testing, debugging, and validating sports API integrations across MLB, NBA, NFL, NHL, NCAAB, NCAAF, and college baseball.

## Quick Start

### 1. Verify Environment Variables

Check that your `ODDS_API_KEY` is properly configured:

```bash
# Check if key is set (from project root)
echo $ODDS_API_KEY

# Or check in Vercel dashboard:
# Project Settings → Environment Variables → ODDS_API_KEY
```

Get your API key from: https://the-odds-api.com/

### 2. Run Comprehensive Diagnostics

Navigate to the health dashboard in your browser:

```
https://your-app.vercel.app/api-health
```

Or call the diagnostics API directly:

```bash
curl https://your-app.vercel.app/api/odds/diagnostics
```

This will test all sports and return:
- Overall health status
- Games available per sport
- Response times
- API quota remaining
- Error details for failed sports

### 3. Test Individual Sports

Test a specific sport using the odds API:

```bash
# NBA
curl -X POST https://your-app.vercel.app/api/odds \
  -H "Content-Type: application/json" \
  -d '{"sport":"basketball_nba","marketType":"h2h"}'

# NFL
curl -X POST https://your-app.vercel.app/api/odds \
  -H "Content-Type: application/json" \
  -d '{"sport":"americanfootball_nfl","marketType":"h2h"}'

# MLB
curl -X POST https://your-app.vercel.app/api/odds \
  -H "Content-Type: application/json" \
  -d '{"sport":"baseball_mlb","marketType":"h2h"}'

# NHL
curl -X POST https://your-app.vercel.app/api/odds \
  -H "Content-Type: application/json" \
  -d '{"sport":"icehockey_nhl","marketType":"h2h"}'

# NCAAB (College Basketball)
curl -X POST https://your-app.vercel.app/api/odds \
  -H "Content-Type: application/json" \
  -d '{"sport":"basketball_ncaab","marketType":"h2h"}'

# NCAAF (College Football)
curl -X POST https://your-app.vercel.app/api/odds \
  -H "Content-Type: application/json" \
  -d '{"sport":"americanfootball_ncaaf","marketType":"h2h"}'

# College Baseball
curl -X POST https://your-app.vercel.app/api/odds \
  -H "Content-Type: application/json" \
  -d '{"sport":"baseball_ncaa","marketType":"h2h"}'
```

## Sport Key Reference

| Sport | API Key | Season |
|-------|---------|--------|
| NBA | `basketball_nba` | Oct - Jun |
| NFL | `americanfootball_nfl` | Sep - Feb |
| MLB | `baseball_mlb` | Mar - Oct |
| NHL | `icehockey_nhl` | Oct - Jun |
| NCAAB | `basketball_ncaab` | Nov - Apr |
| NCAAF | `americanfootball_ncaaf` | Aug - Jan |
| College Baseball | `baseball_ncaa` | Feb - Jun |

## Common Issues & Solutions

### Issue 1: No Games Found

**Symptoms:**
- API returns 200 OK but `events` array is empty
- Console shows: `[NO GAMES FOUND] nba`

**Causes:**
- Sport is in off-season
- No games scheduled for today
- Games may have already started/finished

**Solution:**
- Check the sport's season dates (see table above)
- Try a different sport that's currently in-season
- This is expected behavior during off-season

### Issue 2: API Key Invalid

**Symptoms:**
- HTTP 401 Unauthorized
- Error: "Invalid API key"

**Solutions:**
1. Verify key is correct in environment variables
2. Check that key hasn't expired
3. Ensure no extra spaces/characters in the key
4. Generate a new key at https://the-odds-api.com/

### Issue 3: Rate Limit Exceeded

**Symptoms:**
- HTTP 429 Too Many Requests
- Console: "x-requests-remaining: 0"

**Solutions:**
1. Free tier limit: 500 requests/month
2. Check current usage in diagnostics dashboard
3. Implement request caching (already built-in)
4. Upgrade to paid plan if needed

### Issue 4: Slow Response Times

**Symptoms:**
- Response times > 3000ms
- Timeout errors

**Solutions:**
1. Check network connectivity
2. Verify Odds API status: https://status.the-odds-api.com/
3. Retry logic will automatically handle this
4. Check if circuit breaker has opened

### Issue 5: Database Storage Failing

**Symptoms:**
- Console error: "Failed to store odds"
- Data not appearing in Supabase

**Solutions:**
1. Run the migration script:
   ```sql
   -- Execute in Supabase SQL Editor
   -- File: scripts/odds-storage-by-sport.sql
   ```

2. Verify Supabase credentials:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

3. Check table permissions in Supabase dashboard

4. Verify RLS policies allow service role writes

## Database Schema

Each sport has its own table for optimal performance:

- `nba_odds`
- `nfl_odds`
- `mlb_odds`
- `nhl_odds`
- `ncaab_odds`
- `ncaaf_odds`
- `college_baseball_odds`

### Query Recent Odds

```sql
-- Get latest NBA odds
SELECT * FROM nba_odds
WHERE expires_at > NOW()
ORDER BY fetched_at DESC
LIMIT 10;

-- Count games by sport
SELECT 
  'NBA' as sport, COUNT(DISTINCT event_id) as games FROM nba_odds WHERE expires_at > NOW()
UNION ALL
SELECT 'NFL', COUNT(DISTINCT event_id) FROM nfl_odds WHERE expires_at > NOW()
UNION ALL
SELECT 'MLB', COUNT(DISTINCT event_id) FROM mlb_odds WHERE expires_at > NOW()
UNION ALL
SELECT 'NHL', COUNT(DISTINCT event_id) FROM nhl_odds WHERE expires_at > NOW();
```

## Monitoring & Observability

### Key Metrics to Track

1. **Success Rate by Sport**
   - Target: >95% success rate
   - Monitor via diagnostics dashboard

2. **Response Times**
   - Target: <2000ms average
   - Alert if >3000ms consistently

3. **API Quota Usage**
   - Free tier: 500 req/month
   - Monitor remaining requests in diagnostics

4. **Database Write Success**
   - Target: 100% of successful API calls stored
   - Check console logs for storage errors

### Console Logging

Development mode includes comprehensive logging:

```javascript
[v0] === ODDS FETCH STARTING ===
[v0] Fetching ONLY detected sport: basketball_nba
[NO FALLBACK] Explicit sport detected
[v0] ✅ Found 10 live games in BASKETBALL_NBA
[v0] ✅ Stored 150 odds records in database
[v0] === ODDS FETCH COMPLETE ===
```

## Testing Checklist

Before deploying to production:

- [ ] Verify ODDS_API_KEY is set
- [ ] Run diagnostics dashboard - all sports should report status
- [ ] Execute database migration for odds storage tables
- [ ] Test at least one sport with live games
- [ ] Verify data is being stored in Supabase
- [ ] Check API quota usage (should have requests remaining)
- [ ] Test during off-season (should gracefully handle no games)
- [ ] Verify retry logic works (simulate timeout)
- [ ] Check circuit breaker prevents repeated failures

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/odds` | POST | Fetch odds for specific sport |
| `/api/odds/diagnostics` | GET | Run comprehensive health check |
| `/api/odds/sports` | GET | List all available sports |
| `/api-health` | GET | Visual health dashboard |

## Support Resources

- **Odds API Docs**: https://the-odds-api.com/liveapi/guides/v4/
- **Odds API Status**: https://status.the-odds-api.com/
- **Support**: https://the-odds-api.com/support
- **Supabase Docs**: https://supabase.com/docs

## Advanced: Manual Testing Scripts

### Test All Sports Sequentially

```javascript
const sports = [
  'basketball_nba',
  'americanfootball_nfl',
  'baseball_mlb',
  'icehockey_nhl',
  'basketball_ncaab',
  'americanfootball_ncaaf',
  'baseball_ncaa'
];

for (const sport of sports) {
  console.log(`Testing ${sport}...`);
  const res = await fetch('/api/odds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sport, marketType: 'h2h' })
  });
  const data = await res.json();
  console.log(`${sport}: ${data.events?.length || 0} games`);
}
```

### Monitor API Quota

```javascript
const res = await fetch('/api/odds/diagnostics');
const data = await res.json();
const quotaInfo = data.results[0]?.remainingRequests;
console.log(`Remaining requests: ${quotaInfo}`);
```

## Production Recommendations

1. **Caching**: Built-in 5-minute cache reduces API calls
2. **Rate Limiting**: Implement user-level rate limits
3. **Monitoring**: Set up alerts for API quota < 50 requests
4. **Fallback**: Use cached data when API unavailable
5. **Off-Season**: Disable polling for off-season sports
6. **Error Tracking**: Log all API failures to monitoring service

## Changelog

- **2026-02-14**: Initial API testing guide created
- **2026-02-14**: Added comprehensive diagnostics endpoint
- **2026-02-14**: Implemented sport-specific database tables
- **2026-02-14**: Added retry logic with circuit breaker
