# Sports Odds API Documentation

Complete API reference for the live sports odds system with caching and comparison features.

## Base URL

```
https://your-domain.vercel.app/api
```

## Authentication

All endpoints are currently public. For production, implement API key authentication via headers.

## Rate Limiting

- API uses cached data with 5-minute TTL to minimize external API calls
- Upstream API (The Odds API): 20,000 requests/month
- Recommended: Use `cached=true` parameter when possible

---

## Endpoints

### 1. Get Live Odds

Fetch live odds with automatic caching.

**Endpoint:** `GET /api/odds`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `sport` | string | Yes | - | Sport key (see available sports) |
| `markets` | string | No | `h2h,spreads,totals` | Comma-separated market types |
| `regions` | string | No | `us` | Comma-separated regions (us, uk, eu, au) |
| `forceRefresh` | boolean | No | `false` | Force fresh API call instead of cache |
| `cached` | boolean | No | `false` | Only return cached data, no API call |

**Supported Sports:**
- `americanfootball_nfl` - NFL
- `basketball_nba` - NBA
- `baseball_mlb` - MLB
- `icehockey_nhl` - NHL
- `soccer_epl` - English Premier League
- `soccer_uefa_champs_league` - UEFA Champions League

**Market Types:**
- `h2h` - Head-to-head (moneyline)
- `spreads` - Point spreads
- `totals` - Over/Under

**Example Requests:**

```bash
# Get NBA odds (cached)
GET /api/odds?sport=basketball_nba

# Get NFL odds with all markets, force refresh
GET /api/odds?sport=americanfootball_nfl&markets=h2h,spreads,totals&forceRefresh=true

# Get EPL odds, cached only
GET /api/odds?sport=soccer_epl&cached=true
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "event_123",
      "sport_key": "basketball_nba",
      "sport_title": "NBA",
      "commence_time": "2026-02-03T00:00:00Z",
      "home_team": "Los Angeles Lakers",
      "away_team": "Boston Celtics",
      "bookmakers": [
        {
          "key": "fanduel",
          "title": "FanDuel",
          "last_update": "2026-02-02T12:00:00Z",
          "markets": [
            {
              "key": "h2h",
              "outcomes": [
                { "name": "Boston Celtics", "price": 150 },
                { "name": "Los Angeles Lakers", "price": -170 }
              ]
            }
          ]
        }
      ]
    }
  ],
  "count": 15,
  "timestamp": "2026-02-02T12:00:00Z"
}
```

---

### 2. Get Best Odds

Find the best odds across all bookmakers for a specific event.

**Endpoint:** `GET /api/odds/best`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `eventId` | string | Yes | - | Event ID from odds data |
| `market` | string | No | `h2h` | Market type (h2h, spreads, totals) |
| `compareAll` | boolean | No | `false` | Compare all markets at once |

**Example Requests:**

```bash
# Get best h2h odds for event
GET /api/odds/best?eventId=abc123

# Get best spread odds
GET /api/odds/best?eventId=abc123&market=spreads

# Compare all markets
GET /api/odds/best?eventId=abc123&compareAll=true
```

**Response (Single Market):**

```json
{
  "success": true,
  "event": {
    "id": "abc123",
    "sport": "basketball_nba",
    "teams": "Boston Celtics @ Los Angeles Lakers",
    "commenceTime": "2026-02-03T00:00:00Z"
  },
  "bestOdds": [
    {
      "team": "Boston Celtics",
      "bestPrice": 160,
      "bookmaker": "DraftKings",
      "allOdds": [
        { "bookmaker": "DraftKings", "price": 160 },
        { "bookmaker": "FanDuel", "price": 150 },
        { "bookmaker": "BetMGM", "price": 155 }
      ]
    },
    {
      "team": "Los Angeles Lakers",
      "bestPrice": -165,
      "bookmaker": "FanDuel",
      "allOdds": [
        { "bookmaker": "FanDuel", "price": -165 },
        { "bookmaker": "DraftKings", "price": -180 }
      ]
    }
  ],
  "marketType": "h2h"
}
```

**Response (Compare All):**

```json
{
  "success": true,
  "event": { ... },
  "comparison": {
    "h2h": [ ... ],
    "spreads": [ ... ],
    "totals": [ ... ]
  }
}
```

---

### 3. Find Arbitrage Opportunities

Identify arbitrage betting opportunities for an event.

**Endpoint:** `GET /api/odds/arbitrage`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `eventId` | string | Yes | - | Event ID from odds data |
| `market` | string | No | `h2h` | Market type (h2h, spreads, totals) |

**Example Request:**

```bash
GET /api/odds/arbitrage?eventId=abc123&market=h2h
```

**Response (Arbitrage Found):**

```json
{
  "success": true,
  "event": {
    "id": "abc123",
    "sport": "basketball_nba",
    "teams": "Boston Celtics @ Los Angeles Lakers",
    "commenceTime": "2026-02-03T00:00:00Z"
  },
  "arbitrage": {
    "hasArbitrage": true,
    "profit": 2.5,
    "bets": [
      {
        "team": "Boston Celtics",
        "bookmaker": "DraftKings",
        "price": 160,
        "stake": 38.46
      },
      {
        "team": "Los Angeles Lakers",
        "bookmaker": "FanDuel",
        "price": -165,
        "stake": 61.54
      }
    ]
  },
  "marketType": "h2h"
}
```

**Response (No Arbitrage):**

```json
{
  "success": true,
  "event": { ... },
  "arbitrage": {
    "hasArbitrage": false
  },
  "marketType": "h2h"
}
```

---

### 4. Get Available Sports

List all available sports for betting.

**Endpoint:** `GET /api/odds/sports`

**No Parameters Required**

**Example Request:**

```bash
GET /api/odds/sports
```

**Response:**

```json
{
  "success": true,
  "sports": [
    { "key": "americanfootball_nfl", "title": "NFL" },
    { "key": "basketball_nba", "title": "NBA" },
    { "key": "baseball_mlb", "title": "MLB" },
    { "key": "icehockey_nhl", "title": "NHL" },
    { "key": "soccer_epl", "title": "EPL" }
  ]
}
```

---

### 5. Scheduled Refresh (Cron)

Automated endpoint for scheduled odds refresh. Runs every 5 minutes via Vercel Cron.

**Endpoint:** `GET /api/cron/refresh-odds`

**Headers:**

```
Authorization: Bearer YOUR_CRON_SECRET
```

**Example Request:**

```bash
curl -H "Authorization: Bearer your-secret" \
  https://your-domain.vercel.app/api/cron/refresh-odds
```

**Response:**

```json
{
  "success": true,
  "timestamp": "2026-02-02T12:00:00Z",
  "fetch": {
    "success": true,
    "results": {
      "successful": 5,
      "failed": 0,
      "total": 5
    }
  },
  "cleanup": {
    "success": true,
    "deletedCount": 120
  }
}
```

---

## Caching Strategy

The system implements a multi-layer caching strategy:

### 1. Database Cache (Supabase)
- **TTL:** 5 minutes
- **Storage:** `odds_cache` table
- **Automatic cleanup:** Via cron job

### 2. HTTP Cache Headers
- **odds endpoint:** `s-maxage=300` (5 min), `stale-while-revalidate=60`
- **best/arbitrage:** `s-maxage=60` (1 min), `stale-while-revalidate=30`
- **sports list:** `s-maxage=3600` (1 hour), `stale-while-revalidate=1800`

### 3. Next.js Cache
- **API responses:** 5-minute revalidation via `next.revalidate`
- **Static data:** 1-hour caching for sports list

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message description"
}
```

**HTTP Status Codes:**
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing/invalid auth)
- `404` - Not Found (event not found)
- `500` - Internal Server Error

---

## Server Actions

For Next.js server-side usage, import from `/app/actions/odds`:

```typescript
import {
  fetchLiveOdds,
  getBestOddsForEvent,
  findArbitrageForEvent,
  getAvailableSports,
} from '@/app/actions/odds'

// In a Server Component or Server Action
const result = await fetchLiveOdds('basketball_nba')
```

---

## Rate Limiting Best Practices

1. **Use cached endpoints** when real-time data isn't critical
2. **Set `cached=true`** for historical lookups
3. **Implement client-side caching** for repeated requests
4. **Monitor usage** via The Odds API dashboard

---

## Production Deployment

### Environment Variables

```env
# Required
ODDS_API_KEY=6a8cb1c42cfce3d33c97ab4b99875492
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional (for cron security)
CRON_SECRET=your-random-secret
```

### Vercel Configuration

The `vercel.json` file configures automatic odds refresh:

```json
{
  "crons": [
    {
      "path": "/api/cron/refresh-odds",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

---

## Usage Examples

### JavaScript/TypeScript

```typescript
// Fetch NBA odds
const response = await fetch('/api/odds?sport=basketball_nba')
const data = await response.json()

// Get best odds for specific event
const bestOdds = await fetch('/api/odds/best?eventId=abc123')
const odds = await bestOdds.json()

// Check for arbitrage
const arbitrage = await fetch('/api/odds/arbitrage?eventId=abc123')
const opportunity = await arbitrage.json()
```

### React Component

```tsx
'use client'

import { useEffect, useState } from 'react'

export function OddsDisplay() {
  const [odds, setOdds] = useState([])
  
  useEffect(() => {
    fetch('/api/odds?sport=basketball_nba')
      .then(res => res.json())
      .then(data => setOdds(data.data))
  }, [])
  
  return (
    <div>
      {odds.map(event => (
        <div key={event.id}>
          {event.away_team} @ {event.home_team}
        </div>
      ))}
    </div>
  )
}
```

---

## Support

For issues or questions:
- Check database migrations in `/supabase/migrations/`
- Review odds service code in `/lib/services/odds-api.ts`
- Monitor API usage at https://the-odds-api.com/account/
