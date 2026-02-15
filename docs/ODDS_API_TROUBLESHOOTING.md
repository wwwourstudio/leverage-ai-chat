# Odds API Troubleshooting Guide

Quick reference for diagnosing and resolving common Odds API integration issues.

## Quick Diagnostic Checklist

Before diving into specific errors, run through this checklist:

- [ ] `.env.local` file exists in project root
- [ ] `ODDS_API_KEY` is set without quotes or spaces
- [ ] Development server has been restarted after adding/changing keys
- [ ] Test endpoint works: `http://localhost:3000/api/test-odds-connection`
- [ ] System health check passes: `http://localhost:3000/api/health/system`
- [ ] API key is active on The Odds API dashboard
- [ ] Request quota has not been exceeded

---

## Error Reference

### 1. "ODDS_API_KEY not configured"

**Symptom:** Application shows error that API key is missing

**Root Causes:**
- Environment variable not set
- File named incorrectly (must be `.env.local`)
- Server not restarted after adding key
- Syntax error in `.env.local` file

**Solution Steps:**

1. Create or verify `.env.local` in project root:
   ```bash
   # Check if file exists
   ls -la .env.local
   
   # If not, create it
   touch .env.local
   ```

2. Add API key (no quotes, no spaces):
   ```bash
   ODDS_API_KEY=your_32_character_hex_key
   ```

3. Verify file format:
   ```bash
   # Should output: ODDS_API_KEY=xxxxx
   cat .env.local | grep ODDS_API_KEY
   ```

4. Restart development server:
   ```bash
   # Stop (Ctrl+C) then:
   npm run dev
   # or
   pnpm dev
   ```

5. Test configuration:
   ```bash
   # Visit in browser:
   http://localhost:3000/api/test-odds-connection
   ```

**Common Mistakes:**
```bash
# ❌ WRONG - Has quotes
ODDS_API_KEY="6a8cb1c4d3e2f1a0b9c8d7e6f5a4b3c2"

# ❌ WRONG - Has space after =
ODDS_API_KEY= 6a8cb1c4d3e2f1a0b9c8d7e6f5a4b3c2

# ❌ WRONG - Incomplete key
ODDS_API_KEY=6a8cb1c4

# ✅ CORRECT
ODDS_API_KEY=6a8cb1c4d3e2f1a0b9c8d7e6f5a4b3c2
```

---

### 2. "Invalid API key" (401 Unauthorized)

**Symptom:** API returns 401 status code

**Root Causes:**
- API key contains typo
- Key has been regenerated on dashboard
- Extra characters or spaces in key
- Account suspended

**Solution Steps:**

1. Login to The Odds API:
   ```
   https://the-odds-api.com/account/
   ```

2. Locate your API key (should be 32 hex characters)

3. Use copy button (don't manually select)

4. Replace key in `.env.local`:
   ```bash
   ODDS_API_KEY=your_new_key_here
   ```

5. Verify key format:
   ```bash
   # Should be exactly 32 characters
   # Only contains: 0-9, a-f
   echo $ODDS_API_KEY | wc -c
   # Should output: 33 (32 + newline)
   ```

6. Restart server and test

**Validation Test:**
```bash
# Test key directly with curl
curl "https://api.the-odds-api.com/v4/sports?apiKey=YOUR_KEY_HERE"

# Valid key returns JSON array
# Invalid key returns: {"message": "Invalid API key"}
```

---

### 3. "Rate limit exceeded" (429)

**Symptom:** API returns 429 status code, application shows quota error

**Root Causes:**
- Free tier quota exhausted (500 requests/month)
- Too many requests in short time period
- Inefficient API usage (multiple markets/regions per request)
- Development testing consuming quota

**Solution Steps:**

1. Check current usage:
   ```
   https://the-odds-api.com/account/
   ```
   Look for "Requests this month" metric

2. If quota exhausted, wait for monthly reset OR upgrade plan:
   - Starter: 10,000 req/month ($10/mo)
   - Pro: 100,000 req/month ($50/mo)

3. Optimize future requests:

   **A. Use free endpoints when possible:**
   ```typescript
   // ✅ Free (doesn't count)
   GET /v4/sports
   GET /v4/sports/{sport}/events
   
   // ❌ Costs quota
   GET /v4/sports/{sport}/odds
   ```

   **B. Reduce markets and regions:**
   ```typescript
   // ❌ Bad: 9 requests
   markets: 'h2h,spreads,totals'
   regions: 'us,uk,eu'
   
   // ✅ Good: 1 request
   markets: 'h2h'
   regions: 'us'
   ```

   **C. Increase cache duration** (in `app/api/odds/route.ts`):
   ```typescript
   // Current: 60 seconds
   const CACHE_TTL = 60000;
   
   // Increase to 3-5 minutes
   const CACHE_TTL = 180000; // 3 minutes
   ```

4. Monitor quota in code:
   ```typescript
   const remaining = response.headers.get('x-requests-remaining');
   if (parseInt(remaining) < 50) {
     console.warn(`Low quota warning: ${remaining} requests remaining`);
   }
   ```

**Quota Calculator:**
```
Cost per request = [Markets] × [Regions]

Example calculations:
- 1 market × 1 region = 1 request
- 3 markets × 1 region = 3 requests  
- 1 market × 3 regions = 3 requests
- 3 markets × 3 regions = 9 requests

Monthly usage estimate:
Requests/day × 30 = Monthly total

Safe free tier usage: <450 requests/month (leaves 50 buffer)
```

---

### 4. "No events returned" / Empty Array

**Symptom:** API call succeeds but returns `[]` empty array

**Root Causes:**
- Sport is out of season (`active: false`)
- No games scheduled within next 7 days
- Bookmakers haven't posted odds yet
- Wrong sport key used

**Solution Steps:**

1. Check if sport is in season:
   ```bash
   # Visit:
   http://localhost:3000/api/odds/sports
   
   # Look for "active": true in response
   ```

2. Verify sport status:
   ```json
   // In season (✅)
   {
     "key": "icehockey_nhl",
     "active": true,
     "title": "NHL"
   }
   
   // Off season (❌)
   {
     "key": "baseball_mlb",
     "active": false,
     "title": "MLB"
   }
   ```

3. Try an active sport:

   **Winter (Dec-Mar):**
   - `icehockey_nhl` (NHL)
   - `basketball_nba` (NBA)
   - `basketball_ncaab` (College Basketball)

   **Spring (Apr-Jun):**
   - `baseball_mlb` (MLB)
   - `basketball_nba` (NBA Playoffs)

   **Summer (Jul-Sep):**
   - `baseball_mlb` (MLB)

   **Fall (Sep-Dec):**
   - `americanfootball_nfl` (NFL)
   - `americanfootball_ncaaf` (College Football)
   - `icehockey_nhl` (starts Oct)

4. Check if events exist without odds:
   ```bash
   # Free endpoint - shows scheduled games
   curl "https://api.the-odds-api.com/v4/sports/icehockey_nhl/events?apiKey=YOUR_KEY"
   
   # If this returns events but /odds doesn't, odds aren't listed yet
   ```

5. Verify sport key spelling:
   ```typescript
   // ❌ Wrong
   sport: 'nhl'
   sport: 'nba'
   
   // ✅ Correct
   sport: 'icehockey_nhl'
   sport: 'basketball_nba'
   ```

---

### 5. Connection Timeout / Network Error

**Symptom:** Request fails with timeout or network error

**Root Causes:**
- Slow internet connection
- Firewall blocking external API calls
- API service temporarily down
- DNS resolution issues

**Solution Steps:**

1. Test basic connectivity:
   ```bash
   # Can you reach the API?
   curl -I https://api.the-odds-api.com
   
   # Should return: HTTP/2 200
   ```

2. Check firewall settings:
   - Allow HTTPS (port 443) to `api.the-odds-api.com`
   - Corporate firewalls may block external APIs
   - VPN may interfere with connections

3. Increase timeout (in `app/api/odds/route.ts`):
   ```typescript
   const response = await fetch(apiUrl, {
     signal: AbortSignal.timeout(15000) // Increase to 15 seconds
   });
   ```

4. Check API status:
   ```
   https://the-odds-api.com/
   ```
   Look for service status indicators

5. Try from different network:
   - Mobile hotspot
   - Different wifi network
   - VPN on/off

**Debug Network Issues:**
```bash
# Test DNS resolution
nslookup api.the-odds-api.com

# Test with verbose curl
curl -v "https://api.the-odds-api.com/v4/sports?apiKey=YOUR_KEY"

# Check if SSL/TLS is working
openssl s_client -connect api.the-odds-api.com:443
```

---

### 6. Cards Showing Placeholder Data

**Symptom:** UI shows generic cards like "NBA Live Odds" instead of real games

**Root Causes:**
- API returns no games (off-season)
- Arbitrage detection finds no opportunities
- Cards generator fallback to placeholders

**Current Behavior (Feb 2026):**
- NBA: Off-season (Feb-Oct) - Shows informative "no games" message
- NFL: Off-season (Feb-Aug) - Shows informative "no games" message  
- NHL: In-season (Oct-Jun) - Should show real game odds

**Solution Steps:**

1. Check debug logs for sport:
   ```
   [v0] [ARBITRAGE] Analyzing 8 events for arbitrage opportunities
   [v0] [ARBITRAGE] Found 0 arbitrage opportunities
   [v0] [ARBITRAGE] Creating 3 regular odds cards from 8 games
   ```

2. If seeing "No odds data available":
   - Sport is likely off-season
   - Try a different sport
   - Check `/api/odds/sports` for active sports

3. If seeing "Found 0 arbitrage opportunities":
   - This is normal (arbitrage is rare)
   - System should still create odds cards
   - Check logs for "Creating X regular odds cards"

4. Verify cards have real data:
   ```typescript
   // Cards should contain:
   {
     matchup: "Toronto Maple Leafs @ Boston Bruins",
     homeOdds: "-165",
     awayOdds: "+140",
     bookmaker: "DraftKings",
     realData: true
   }
   ```

**Expected Messages:**
- **Off-season:** "No NHL games scheduled in the next 48 hours" (informative)
- **In-season:** Real matchups with teams, odds, bookmakers
- **Arbitrage rare:** "No arbitrage found in 8 games, showing regular odds"

---

### 7. "Trust metrics timeout, using defaults"

**Symptom:** Warning appears in logs about trust metrics

**Impact:** Non-critical - defaults are used, no functionality loss

**Root Causes:**
- Database query taking >5 seconds
- Missing database indexes
- Large historical dataset

**Solution:**

1. Run performance indexes (one-time):
   ```sql
   -- In Supabase SQL Editor:
   \i scripts/performance-indexes.sql
   ```

2. Verify indexes created:
   ```sql
   SELECT * FROM pg_indexes 
   WHERE tablename = 'ai_response_trust';
   ```

3. This warning is expected behavior:
   - Trust metrics run in background
   - Defaults used until complete
   - Does not affect core functionality

**Performance Improvement:**
- Before indexes: 5-10 seconds (timeout)
- After indexes: <100ms (instant)

---

## Development vs Production

### Development Setup

**Environment File:**
- Use `.env.local` (git-ignored)
- Contains development API keys
- Can use real or test keys

**Testing:**
- Free tier is fine for development
- Use test endpoint frequently
- Monitor quota usage

**Caching:**
- Shorter cache (60 seconds)
- Faster iteration
- More API calls consumed

### Production Setup

**Environment Variables:**
- Use Vercel environment variables
- Never commit keys to git
- Use production API keys

**Optimization:**
- Longer cache (3-5 minutes)
- Monitor quota closely
- Consider paid tier for high traffic

**Monitoring:**
- Track API quota usage
- Set up alerts for low quota
- Log all API errors

---

## Quick Command Reference

```bash
# Check environment file
ls -la .env.local
cat .env.local

# Test API key format
echo $ODDS_API_KEY | wc -c  # Should be 33

# Direct API test
curl "https://api.the-odds-api.com/v4/sports?apiKey=YOUR_KEY"

# Check server logs
npm run dev  # Watch for [v0] logs

# Test endpoints
open http://localhost:3000/api/test-odds-connection
open http://localhost:3000/api/health/system
open http://localhost:3000/api/odds/sports
```

---

## Getting Help

If you've tried all troubleshooting steps and still have issues:

1. **Check Documentation:**
   - `docs/ODDS_API_SETUP.md` - Complete setup guide
   - `docs/API_FIXES_SUMMARY.md` - Recent fixes and known issues
   - `docs/ERROR_HANDLING.md` - Error handling patterns

2. **Review Logs:**
   - Browser console (F12)
   - Terminal output from `npm run dev`
   - Look for `[v0]` prefixed logs

3. **Test Endpoints:**
   - `/api/test-odds-connection` - Connection test
   - `/api/health/system` - System health
   - `/api/odds/sports` - Available sports

4. **External Resources:**
   - [The Odds API Docs](https://the-odds-api.com/liveapi/guides/v4/)
   - [API Status Page](https://the-odds-api.com/)
   - [Account Dashboard](https://the-odds-api.com/account/)
   - [Support Contact](https://the-odds-api.com/contact/)

5. **Verify Configuration:**
   - API key active and valid
   - Quota not exceeded
   - No firewall blocking
   - Server restarted after changes
