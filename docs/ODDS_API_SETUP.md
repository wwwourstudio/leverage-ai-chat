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

### Error: "ODDS_API_KEY not configured"

**Problem:** Environment variable not set

**Solution:**
1. Create `.env.local` in project root
2. Add: `ODDS_API_KEY=your_key_here`
3. Restart development server
4. Test with `/api/test-odds-connection`

### Error: "Invalid API key" (401)

**Problem:** API key is incorrect or expired

**Solution:**
1. Go to [https://the-odds-api.com/account/](https://the-odds-api.com/account/)
2. Verify your API key is active
3. Copy the key exactly (no extra spaces)
4. Update `.env.local`
5. Restart server

### Error: "Rate limit exceeded" (429)

**Problem:** You've used all your monthly requests

**Solution:**
1. Check usage at [https://the-odds-api.com/account/](https://the-odds-api.com/account/)
2. Wait for monthly reset
3. Optimize requests:
   - Reduce market types
   - Reduce regions
   - Cache results longer
   - Use /events endpoint (free) instead of /odds
4. Consider upgrading plan

### Error: "No events returned"

**Problem:** Sport might be out of season

**Solution:**
1. Check if sport is `active: true` in `/sports` endpoint
2. Try different sports (NFL, NBA, NHL, MLB)
3. Verify bookmakers have listed games
4. Check `commence_time` filters

### Connection Timeout

**Problem:** Request taking too long

**Solution:**
1. Check internet connection
2. Verify firewall allows HTTPS to `api.the-odds-api.com`
3. Try IPv6 endpoint: `https://ipv6-api.the-odds-api.com`
4. Increase timeout in code (currently 10s)

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
