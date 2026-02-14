# The Odds API Setup Guide

Complete guide for setting up and troubleshooting The Odds API integration based on the official [v4 API documentation](https://the-odds-api.com/liveapi/guides/v4/).

## Quick Start (3 Steps)

### Step 1: Get Your API Key

1. Visit [The Odds API](https://the-odds-api.com/)
2. Sign up for a free account
3. Get your API key from the [Account Dashboard](https://the-odds-api.com/account/)

**Free Plan Includes:**
- 500 requests per month
- Access to all sports and bookmakers
- No credit card required

### Step 2: Add API Key to Environment

Add the following to your `.env.local` file:

```bash
ODDS_API_KEY=your_api_key_here
```

**Important:**
- Do NOT add quotes around the key
- Remove any extra spaces
- Do NOT commit this file to git

### Step 3: Test the Connection

Visit the test endpoint to verify your setup:

```
http://localhost:3000/api/test-odds-connection
```

This will show you:
- Whether your API key is valid
- Your remaining request quota
- Available active sports
- Any configuration issues

---

## API Key Configuration

### Correct Implementation

According to [The Odds API v4 documentation](https://the-odds-api.com/liveapi/guides/v4/), the API key must be passed as a **query parameter**:

```typescript
// ✅ CORRECT - Query parameter
const url = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?apiKey=${apiKey}&regions=us`;

// ❌ WRONG - Header
const headers = { 'Authorization': `Bearer ${apiKey}` };
```

### Current Implementation

Our application correctly implements the API key as a query parameter in:

1. **lib/config.ts** - Environment variable retrieval
2. **app/api/odds/route.ts** - Main odds fetching endpoint
3. **supabase/functions/** - Edge functions

---

## API Endpoints

### 1. GET /sports (Free)

Returns list of in-season sports. **Does not count against quota.**

```bash
GET https://api.the-odds-api.com/v4/sports?apiKey=YOUR_API_KEY
```

**Response:**
```json
[
  {
    "key": "americanfootball_nfl",
    "group": "American Football",
    "title": "NFL",
    "description": "US Football",
    "active": true,
    "has_outrights": false
  }
]
```

### 2. GET /odds (Paid)

Returns upcoming games with odds from bookmakers.

```bash
GET https://api.the-odds-api.com/v4/sports/{sport}/odds?apiKey={apiKey}&regions={regions}&markets={markets}
```

**Parameters:**
- `sport` - Sport key from /sports endpoint (e.g., `americanfootball_nfl`)
- `apiKey` - Your API key
- `regions` - Bookmaker regions: `us`, `uk`, `au`, `eu` (comma-separated)
- `markets` - Market types: `h2h`, `spreads`, `totals` (comma-separated)
- `oddsFormat` - Format: `decimal` or `american`

**Quota Cost:**
```
cost = [number of markets] × [number of regions]
```

**Examples:**
- 1 market, 1 region = 1 request
- 3 markets, 1 region = 3 requests
- 1 market, 3 regions = 3 requests
- 3 markets, 3 regions = 9 requests

**Response Headers:**
- `x-requests-remaining` - Remaining quota
- `x-requests-used` - Used quota since reset
- `x-requests-last` - Cost of this request

---

## Troubleshooting

### Diagnostic Steps

Before diving into specific errors, run these diagnostic checks:

1. **Test Connection:** `http://localhost:3000/api/test-odds-connection`
2. **Check System Health:** `http://localhost:3000/api/health/system`
3. **View Debug Logs:** Check browser console and terminal output

---

### Error: "ODDS_API_KEY not configured"

**Problem:** Environment variable not set or not loaded

**Root Cause Analysis:**
- `.env.local` file missing
- API key not defined in environment variables
- Server not restarted after adding key
- Key contains syntax errors (quotes, spaces)

**Step-by-Step Solution:**

1. **Create Environment File**
   ```bash
   touch .env.local
   ```

2. **Add API Key** (no quotes, no spaces)
   ```bash
   ODDS_API_KEY=6a8cb1c4d3e2f1a0b9c8d7e6f5a4b3c2
   ```

3. **Verify File Location**
   - Must be in project root (same directory as `package.json`)
   - File should start with a dot: `.env.local`

4. **Restart Development Server**
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   # or
   pnpm dev
   ```

5. **Test Configuration**
   - Visit: `http://localhost:3000/api/test-odds-connection`
   - Should show: "API Key: Configured (6a8cb1c4...)"

**Validation:**
```bash
# Check if file exists
ls -la .env.local

# View contents (be careful not to expose in production)
cat .env.local
```

---

### Error: "Invalid API key" (401)

**Problem:** API key is incorrect, expired, or malformed

**Root Cause Analysis:**
- Typo when copying API key
- Extra spaces or invisible characters
- API key has been regenerated on The Odds API dashboard
- Account suspended or key revoked

**Step-by-Step Solution:**

1. **Login to The Odds API**
   - Go to: [https://the-odds-api.com/account/](https://the-odds-api.com/account/)
   - Verify you're logged in

2. **Locate Your API Key**
   - Look for "API Key" section
   - Key format: 32 hexadecimal characters (0-9, a-f)

3. **Copy Key Carefully**
   ```bash
   # Use "Copy" button, don't manually select
   # Correct format: 6a8cb1c4d3e2f1a0b9c8d7e6f5a4b3c2
   # Length: exactly 32 characters
   ```

4. **Update `.env.local`**
   ```bash
   # Remove old key
   ODDS_API_KEY=6a8cb1c4d3e2f1a0b9c8d7e6f5a4b3c2
   
   # Common mistakes to avoid:
   # ❌ ODDS_API_KEY="6a8cb1c4d3e2f1a0b9c8d7e6f5a4b3c2"  (no quotes)
   # ❌ ODDS_API_KEY= 6a8cb1c4d3e2f1a0b9c8d7e6f5a4b3c2  (no space after =)
   # ❌ ODDS_API_KEY=6a8cb1c4...                       (must be complete)
   ```

5. **Restart Server**
   ```bash
   # Ctrl+C to stop
   npm run dev
   ```

6. **Test**
   - Visit test endpoint
   - Check for "Valid API key" message
   - Verify quota shows correct numbers

**Advanced Validation:**
```bash
# Test API key directly with curl
curl "https://api.the-odds-api.com/v4/sports?apiKey=YOUR_KEY_HERE"

# Should return JSON with sport list, not 401 error
```

---

### Error: "Rate limit exceeded" (429)

**Problem:** You've exhausted your monthly request quota

**Root Cause Analysis:**
- All 500 free requests used
- Too many markets/regions per request
- Inefficient caching or duplicate requests
- Development testing consuming quota

**Step-by-Step Solution:**

1. **Check Current Usage**
   - Dashboard: [https://the-odds-api.com/account/](https://the-odds-api.com/account/)
   - Look for "Requests this month" metric

2. **Wait for Reset** (if quota exhausted)
   - Free plan resets monthly
   - Reset date shown on dashboard

3. **Optimize Requests** (reduce future usage)

   **A. Use Free Endpoints**
   ```typescript
   // Free (doesn't count against quota)
   GET /v4/sports
   GET /v4/sports/{sport}/events
   
   // Costs quota
   GET /v4/sports/{sport}/odds
   ```

   **B. Reduce Market/Region Multiplier**
   ```typescript
   // Bad: 9 requests per call
   markets: 'h2h,spreads,totals',
   regions: 'us,uk,eu'
   
   // Good: 1 request per call
   markets: 'h2h',
   regions: 'us'
   ```

   **C. Increase Cache Duration**
   ```typescript
   // Current: 60 seconds
   const CACHE_TTL = 60000;
   
   // Recommended: 120-300 seconds
   const CACHE_TTL = 180000; // 3 minutes
   ```

   **D. Implement Request Deduplication**
   - Use `lib/fetch-with-dedupe.ts`
   - Prevents duplicate in-flight requests
   - Already implemented in `/api/odds` endpoint

4. **Monitor Quota in Application**
   ```typescript
   // Check response headers
   const remaining = response.headers.get('x-requests-remaining');
   if (parseInt(remaining) < 10) {
     console.warn('Low quota: ', remaining);
   }
   ```

5. **Consider Upgrading**
   - Starter Plan: 10,000 requests/month ($10/month)
   - Pro Plan: 100,000 requests/month ($50/month)
   - [View pricing](https://the-odds-api.com/#pricing)

**Quota Usage Calculator:**
```
Cost = [Markets] × [Regions] × [Request Frequency] × [Sports]

Example:
- 1 market (h2h) × 1 region (us) × 30 requests/day × 4 sports = 120 requests/day
- Monthly: 120 × 30 = 3,600 requests (exceeds free tier)

Optimized:
- 1 market × 1 region × 10 requests/day × 2 sports = 20 requests/day
- Monthly: 20 × 30 = 600 requests (within free tier with buffer)
```

---

### Error: "No events returned" / Empty Array

**Problem:** API returns empty array `[]` despite successful request

**Root Cause Analysis:**
- Sport is out of season (`active: false`)
- No games scheduled for next 7 days
- Bookmakers haven't listed odds yet
- Wrong sport key used

**Step-by-Step Solution:**

1. **Check Sport Status**
   ```bash
   # Visit:
   http://localhost:3000/api/odds/sports
   
   # Look for "active": true
   ```

2. **Verify Active Sports**
   ```json
   {
     "key": "icehockey_nhl",
     "active": true,  // ✅ In season
     "title": "NHL"
   }
   
   {
     "key": "baseball_mlb",
     "active": false, // ❌ Off season (Feb-Mar)
     "title": "MLB"
   }
   ```

3. **Try Alternative Sports**
   - **Winter (Dec-Mar):** NHL, NBA, College Basketball
   - **Spring (Apr-Jun):** MLB, NBA Playoffs
   - **Summer (Jul-Sep):** MLB
   - **Fall (Sep-Dec):** NFL, College Football, NHL (starts Oct)

4. **Check Upcoming Events**
   ```bash
   # Use free events endpoint
   curl "https://api.the-odds-api.com/v4/sports/icehockey_nhl/events?apiKey=YOUR_KEY"
   
   # If this returns events but /odds doesn't, odds aren't listed yet
   ```

5. **Verify Application Logic**
   - Check logs: "Found X live games"
   - Verify sport key matches: `icehockey_nhl` not `nhl`
   - Check date filters aren't excluding events

**Seasonal Sports Calendar:**
```
NFL:       Sep - Feb
NBA:       Oct - Jun  
NHL:       Oct - Jun
MLB:       Apr - Oct
Soccer:    Year-round (various leagues)
```

---

### Error: Connection Timeout / Network Error

**Problem:** Request exceeds timeout or fails to connect

**Root Cause Analysis:**
- Slow internet connection
- Firewall blocking HTTPS requests
- DNS resolution issues
- API server temporarily down

**Step-by-Step Solution:**

1. **Test Direct Connection**
   ```bash
   # Test if you can reach the API
   curl -I https://api.the-odds-api.com
   
   # Should return: HTTP/2 200
   ```

2. **Check Firewall Settings**
   - Allow HTTPS (port 443) to `api.the-odds-api.com`
   - Corporate networks may block external APIs

3. **Try IPv6 Endpoint** (if available)
   ```typescript
   const BASE_URL = 'https://ipv6-api.the-odds-api.com/v4';
   ```

4. **Increase Timeout** (in `/api/odds/route.ts`)
   ```typescript
   const response = await fetch(apiUrl, {
     signal: AbortSignal.timeout(15000) // Increase to 15 seconds
   });
   ```

5. **Check API Status**
   - Status page: [https://the-odds-api.com/](https://the-odds-api.com/)
   - Look for "All Systems Operational"

6. **Debug Network in Browser**
   ```javascript
   // Open DevTools → Network tab
   // Look for failed requests to api.the-odds-api.com
   // Check status code and timing
   ```

---

### Warning: "Trust metrics timeout, using defaults"

**Problem:** Trust metrics calculation taking too long

**Impact:** Non-critical - System uses sensible defaults

**Root Cause Analysis:**
- Database query taking >5 seconds
- Large dataset causing slow aggregation
- Database not indexed properly

**Solution:**

1. **Run Performance Indexes** (one-time setup)
   ```sql
   -- In Supabase SQL Editor:
   \i scripts/performance-indexes.sql
   ```

2. **Verify Indexes Created**
   ```sql
   SELECT * FROM pg_indexes WHERE tablename = 'ai_response_trust';
   ```

3. **This is Expected Behavior**
   - Trust metrics run async in background
   - Defaults are used until calculation completes
   - Does not affect functionality

**Performance:**
- Before indexes: 5-10 seconds (timeout)
- After indexes: <100ms (instant)

---

## Best Practices

### 1. Monitor Your Quota

Always check response headers:

```typescript
const response = await fetch(url);
const remaining = response.headers.get('x-requests-remaining');
const used = response.headers.get('x-requests-used');

console.log(`Quota: ${used} used, ${remaining} remaining`);
```

### 2. Cache Aggressively

Odds don't change every second:

```typescript
// Cache for 1-2 minutes
const CACHE_TTL = 60000; // 1 minute
```

### 3. Use Free Endpoints When Possible

- `/sports` - Get sport list (free)
- `/events` - Get event schedule (free)
- `/odds` - Get odds (costs quota)

### 4. Optimize Market Requests

Only request markets you need:

```typescript
// ❌ Expensive (3 requests)
markets: 'h2h,spreads,totals'

// ✅ Cheaper (1 request)
markets: 'h2h'
```

### 5. Handle Errors Gracefully

```typescript
try {
  const response = await fetch(url);
  
  if (response.status === 401) {
    // Invalid API key
  }
  
  if (response.status === 429) {
    // Rate limit exceeded
  }
  
  if (!response.ok) {
    // Other error
  }
} catch (error) {
  // Network error
}
```

---

## Application Integration

### Our Implementation

**Environment Configuration:**
- `lib/config.ts` - Environment variable management
- `getOddsApiKey()` - Safe API key retrieval

**API Routes:**
- `/api/odds` - Main odds fetching with retry logic
- `/api/odds/sports` - Available sports list
- `/api/test-odds-connection` - Connection tester

**Features:**
- ✅ Automatic retry with exponential backoff
- ✅ In-memory caching (1 minute TTL)
- ✅ Request timeout protection (10 seconds)
- ✅ Quota monitoring via headers
- ✅ Multi-sport parallel fetching
- ✅ Error handling with actionable messages

---

## API Response Examples

### Sports List

```json
{
  "key": "basketball_nba",
  "group": "Basketball",
  "title": "NBA",
  "description": "US Basketball",
  "active": true,
  "has_outrights": false
}
```

### Odds Data

```json
{
  "id": "abc123",
  "sport_key": "basketball_nba",
  "commence_time": "2026-02-14T00:00:00Z",
  "home_team": "Los Angeles Lakers",
  "away_team": "Boston Celtics",
  "bookmakers": [
    {
      "key": "fanduel",
      "title": "FanDuel",
      "last_update": "2026-02-13T23:45:00Z",
      "markets": [
        {
          "key": "h2h",
          "outcomes": [
            {
              "name": "Los Angeles Lakers",
              "price": -150
            },
            {
              "name": "Boston Celtics",
              "price": +130
            }
          ]
        }
      ]
    }
  ]
}
```

---

## Additional Resources

- [Official Documentation](https://the-odds-api.com/liveapi/guides/v4/)
- [API Status Page](https://the-odds-api.com/)
- [Swagger API Docs](https://api.the-odds-api.com/v4/docs)
- [Account Dashboard](https://the-odds-api.com/account/)
- [Support](https://the-odds-api.com/contact/)

---

## Quick Reference

| Endpoint | Cost | Description |
|----------|------|-------------|
| `/sports` | Free | List all sports |
| `/events` | Free | Event schedule (no odds) |
| `/odds` | 1+ per request | Live odds data |
| `/scores` | 1 or 2 | Live scores |
| `/historical/*` | 10x cost | Historical data |

**Default Configuration:**
- Host: `https://api.the-odds-api.com`
- Version: v4
- Format: JSON
- Timeout: 10 seconds
- Cache: 1 minute

**Supported Sports:**
- NFL (americanfootball_nfl)
- NBA (basketball_nba)
- MLB (baseball_mlb)
- NHL (icehockey_nhl)
- [View all sports](https://the-odds-api.com/sports-odds-data/sports-apis.html)
