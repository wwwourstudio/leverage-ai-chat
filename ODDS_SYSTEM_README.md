# Live Sports Odds System

Production-ready backend system for fetching, caching, and analyzing live sports betting odds.

## Overview

This system integrates with The Odds API to provide:
- **Live odds fetching** for multiple sports and market types
- **Intelligent caching** with 5-minute TTL in Supabase
- **Best odds comparison** across all bookmakers
- **Arbitrage detection** for profitable betting opportunities
- **Automatic refresh** via scheduled cron jobs
- **RESTful API** for external integrations

## Architecture

```
┌─────────────────┐
│  The Odds API   │ (External - 20K requests/month)
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Odds Service   │ (/lib/services/odds-api.ts)
│   - Fetch       │
│   - Transform   │
│   - Analyze     │
└────────┬────────┘
         │
         ├─────────→ Server Actions (/app/actions/odds.ts)
         │
         ├─────────→ API Routes (/app/api/odds/*)
         │
         ↓
┌─────────────────┐
│  Supabase DB    │ (odds_cache table - 5 min TTL)
│   - Cache       │
│   - History     │
└─────────────────┘
```

## Features

### 1. Multi-Sport Support

Supported sports:
- NFL (American Football)
- NBA (Basketball)
- MLB (Baseball)
- NHL (Ice Hockey)
- EPL (Soccer)
- UEFA Champions League (Soccer)

### 2. Market Types

- **h2h** (Head-to-Head/Moneyline)
- **spreads** (Point Spreads)
- **totals** (Over/Under)

### 3. Intelligent Caching

- **Database cache:** 5-minute TTL in Supabase `odds_cache` table
- **HTTP caching:** CDN-friendly cache headers
- **Next.js caching:** Built-in revalidation
- **Automatic cleanup:** Scheduled removal of expired entries

### 4. Best Odds Finder

Analyzes all bookmakers to find:
- Best price for each outcome
- All available odds sorted by value
- Price differences across bookmakers

### 5. Arbitrage Detection

Identifies risk-free betting opportunities by:
- Calculating implied probabilities
- Finding market inefficiencies
- Suggesting optimal stake distribution

### 6. Scheduled Refresh

Vercel Cron job runs every 5 minutes to:
- Refresh major sports odds
- Clean up expired cache
- Maintain data freshness

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/odds` | GET | Fetch live odds with caching |
| `/api/odds/best` | GET | Get best odds for an event |
| `/api/odds/arbitrage` | GET | Find arbitrage opportunities |
| `/api/odds/sports` | GET | List available sports |
| `/api/cron/refresh-odds` | GET/POST | Scheduled refresh (cron) |

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete API reference.

## Quick Start

### 1. Environment Setup

```env
# The Odds API
ODDS_API_KEY=6a8cb1c42cfce3d33c97ab4b99875492

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Cron security (optional)
CRON_SECRET=your-random-secret
```

### 2. Database Setup

Run the odds cache migration:

```sql
-- Already created in: /supabase/migrations/20260203_portfolio_odds_schema.sql
-- Table: odds_cache
```

### 3. Fetch Live Odds

```typescript
import { fetchLiveOdds } from '@/app/actions/odds'

// Fetch NBA odds with all markets
const result = await fetchLiveOdds('basketball_nba', ['h2h', 'spreads', 'totals'])

if (result.success) {
  console.log('Fetched', result.count, 'events')
  console.log(result.data)
}
```

### 4. Get Best Odds

```typescript
import { getBestOddsForEvent } from '@/app/actions/odds'

const result = await getBestOddsForEvent('event_123', 'h2h')

if (result.success) {
  result.bestOdds.forEach(odd => {
    console.log(`${odd.team}: ${odd.bestPrice} at ${odd.bookmaker}`)
  })
}
```

### 5. Find Arbitrage

```typescript
import { findArbitrageForEvent } from '@/app/actions/odds'

const result = await findArbitrageForEvent('event_123', 'h2h')

if (result.success && result.arbitrage.hasArbitrage) {
  console.log('Arbitrage profit:', result.arbitrage.profit, '%')
  console.log('Bets:', result.arbitrage.bets)
}
```

## Code Examples

### Server Component

```tsx
// app/odds/page.tsx
import { fetchLiveOdds } from '@/app/actions/odds'

export default async function OddsPage() {
  const result = await fetchLiveOdds('basketball_nba')
  
  if (!result.success) {
    return <div>Error: {result.error}</div>
  }
  
  return (
    <div>
      <h1>NBA Odds</h1>
      {result.data.map(event => (
        <div key={event.id}>
          <h2>{event.away_team} @ {event.home_team}</h2>
          {event.bookmakers.map(bookmaker => (
            <div key={bookmaker.key}>
              <strong>{bookmaker.title}</strong>
              {/* Display odds */}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
```

### Client Component with API

```tsx
'use client'

import { useEffect, useState } from 'react'

export function LiveOdds({ sport }: { sport: string }) {
  const [odds, setOdds] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetch(`/api/odds?sport=${sport}`)
      .then(res => res.json())
      .then(data => {
        setOdds(data.data || [])
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching odds:', err)
        setLoading(false)
      })
  }, [sport])
  
  if (loading) return <div>Loading...</div>
  
  return (
    <div>
      {odds.map(event => (
        <div key={event.id}>
          {/* Render odds */}
        </div>
      ))}
    </div>
  )
}
```

### Best Odds Comparison

```tsx
import { getBestOddsForEvent } from '@/app/actions/odds'

export async function BestOddsDisplay({ eventId }: { eventId: string }) {
  const result = await getBestOddsForEvent(eventId, 'h2h')
  
  if (!result.success) return null
  
  return (
    <div>
      <h3>{result.event.teams}</h3>
      {result.bestOdds.map(odd => (
        <div key={odd.team}>
          <div className="font-bold">{odd.team}</div>
          <div className="text-green-600">
            Best: {odd.bestPrice} @ {odd.bookmaker}
          </div>
          <details>
            <summary>All odds</summary>
            {odd.allOdds.map((o, i) => (
              <div key={i}>
                {o.bookmaker}: {o.price}
              </div>
            ))}
          </details>
        </div>
      ))}
    </div>
  )
}
```

## Caching Strategy

### 1. Database Cache (Primary)

```typescript
// Automatic caching on fetch
const events = await fetchOdds('basketball_nba', ['h2h'])
await cacheOdds(events) // 5-minute TTL

// Retrieve from cache
const cached = await getCachedOdds('basketball_nba')
```

### 2. Smart Cache Usage

```typescript
// Use cache by default (recommended)
const result = await fetchLiveOdds('basketball_nba')

// Force fresh data (only when needed)
const fresh = await fetchLiveOdds('basketball_nba', ['h2h'], ['us'], true)

// Only use cache, never fetch
const cachedOnly = await getCachedOddsAction('basketball_nba')
```

### 3. HTTP Cache Headers

```typescript
// API responses include cache headers
return NextResponse.json(result, {
  headers: {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
  },
})
```

## Rate Limit Management

The Odds API has a limit of **20,000 requests/month** (20K plan).

### Optimization Strategies

1. **Use caching aggressively**
   ```typescript
   // Good: Uses 5-minute cache
   await fetchLiveOdds('basketball_nba')
   
   // Bad: Forces new API call
   await fetchLiveOdds('basketball_nba', ['h2h'], ['us'], true)
   ```

2. **Fetch multiple markets at once**
   ```typescript
   // Good: 1 API call for all markets
   await fetchLiveOdds('basketball_nba', ['h2h', 'spreads', 'totals'])
   
   // Bad: 3 separate API calls
   await fetchLiveOdds('basketball_nba', ['h2h'])
   await fetchLiveOdds('basketball_nba', ['spreads'])
   await fetchLiveOdds('basketball_nba', ['totals'])
   ```

3. **Schedule strategic refreshes**
   ```typescript
   // Refresh only popular sports every 5 minutes via cron
   // Let cache serve less popular sports
   ```

4. **Monitor usage**
   - Check The Odds API dashboard: https://the-odds-api.com/account/
   - Track API calls in application logs

### Expected Usage

With cron job running every 5 minutes for 5 major sports:
- **5 sports × 12 calls/hour × 24 hours = 1,440 calls/day**
- **1,440 × 30 days = 43,200 calls/month**

To stay under 20K limit:
- Reduce cron frequency to every 10 minutes: **21,600 calls/month**
- Or refresh only 3 sports: **25,920 calls/month**

## Scheduled Jobs

### Vercel Cron Configuration

File: `vercel.json`

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

Schedule format: `minute hour day month dayOfWeek`

Examples:
- `*/5 * * * *` - Every 5 minutes
- `*/10 * * * *` - Every 10 minutes
- `0 * * * *` - Every hour
- `0 */2 * * *` - Every 2 hours

### Manual Trigger

```bash
# Via API
curl -X POST \
  -H "Authorization: Bearer your-cron-secret" \
  https://your-domain.vercel.app/api/cron/refresh-odds

# Via server action
import { fetchMultipleSports } from '@/app/actions/odds'
await fetchMultipleSports(['basketball_nba', 'americanfootball_nfl'])
```

## Security

### 1. API Key Protection

```typescript
// Store in environment variables (never commit)
const ODDS_API_KEY = process.env.ODDS_API_KEY!

// Use only in server-side code
export async function fetchOdds() {
  // Server-side only - API key never exposed to client
}
```

### 2. Cron Job Authentication

```typescript
// Verify cron secret
const authHeader = request.headers.get('authorization')
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### 3. Rate Limiting (Future Enhancement)

```typescript
// Add API key authentication for public endpoints
// Implement per-user rate limits
// Track usage in database
```

## Monitoring

### 1. Application Logs

```typescript
// All functions use [v0] prefix for easy filtering
console.log('[v0] Fetching odds for basketball_nba')
console.log('[v0] Cached 150 odds records')
console.error('[v0] Error fetching odds:', error)
```

### 2. The Odds API Dashboard

Monitor at: https://the-odds-api.com/account/
- Requests used this month
- Remaining requests
- Usage history

### 3. Supabase Monitoring

Check in Supabase Dashboard:
- `odds_cache` table row count
- Cache hit/miss rates
- Query performance

## Troubleshooting

### Odds not updating

```typescript
// Force refresh to bypass cache
await fetchLiveOdds('basketball_nba', ['h2h'], ['us'], true)

// Check if cron job is running
// View logs in Vercel Dashboard
```

### High API usage

```typescript
// Check for unnecessary forceRefresh calls
// Increase cron interval
// Reduce number of sports in cron job
```

### Cache not working

```sql
-- Check if odds_cache table exists
SELECT * FROM odds_cache LIMIT 10;

-- Check cache expiration
SELECT COUNT(*) FROM odds_cache WHERE expires_at > NOW();

-- Manually cleanup
DELETE FROM odds_cache WHERE expires_at < NOW();
```

### Missing events

```typescript
// Check if sport/event is available
const sports = await getAvailableSports()
console.log(sports)

// Verify event hasn't started
// The Odds API removes events after they start
```

## File Structure

```
├── lib/services/
│   └── odds-api.ts              # Core odds service (400+ lines)
├── app/actions/
│   └── odds.ts                  # Server actions (280+ lines)
├── app/api/
│   ├── odds/
│   │   ├── route.ts             # Main odds endpoint
│   │   ├── best/route.ts        # Best odds comparison
│   │   ├── arbitrage/route.ts   # Arbitrage finder
│   │   └── sports/route.ts      # Sports list
│   └── cron/
│       └── refresh-odds/route.ts # Scheduled refresh
├── supabase/migrations/
│   └── 20260203_portfolio_odds_schema.sql # odds_cache table
├── vercel.json                  # Cron configuration
├── API_DOCUMENTATION.md         # Complete API reference
└── ODDS_SYSTEM_README.md        # This file
```

## Production Checklist

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Supabase RLS policies enabled
- [ ] Cron secret generated and set
- [ ] Vercel cron job deployed
- [ ] API endpoints tested
- [ ] Rate limit monitoring enabled
- [ ] Error logging configured

## Future Enhancements

1. **Historical odds tracking**
   - Store odds changes over time
   - Visualize line movements
   - Analyze bookmaker patterns

2. **Advanced analytics**
   - Sharp money indicators
   - Reverse line movement detection
   - Public betting percentages

3. **User preferences**
   - Favorite sports/teams
   - Custom alert thresholds
   - Bookmaker filtering

4. **Performance optimization**
   - Redis caching layer
   - GraphQL API
   - WebSocket real-time updates

5. **Enhanced security**
   - API key authentication
   - Per-user rate limiting
   - IP-based restrictions

## Support

For issues or questions:
- Review [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- Check [QUICK_START.md](./QUICK_START.md)
- Monitor The Odds API status: https://status.the-odds-api.com
- Contact: support@the-odds-api.com
