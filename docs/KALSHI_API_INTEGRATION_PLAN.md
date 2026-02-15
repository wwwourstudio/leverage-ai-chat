# Kalshi API Integration Plan

**Document Version:** 1.0  
**Last Updated:** February 14, 2026  
**Status:** Phase 1 Complete - Planning for Phase 2 Enhancement

---

## Executive Summary

This document provides a comprehensive integration plan for the Kalshi Prediction Markets API within the LeverageAI sports betting platform. Kalshi provides real-time prediction market data that complements traditional sports betting odds, offering users insights into market sentiment, implied probabilities, and arbitrage opportunities across sports and political events.

**Current Status:**
- ✅ Basic read-only integration complete (Phase 1)
- ✅ Market data fetching operational
- ⏳ Trading functionality not implemented (requires user authentication)
- ⏳ WebSocket real-time streaming not implemented

**API Base URL:** `https://api.elections.kalshi.com/trade-api/v2`  
**Documentation:** https://docs.kalshi.com/welcome  
**Authentication:** Not required for public market data (Phase 1), API keys required for trading (Phase 2)

---

## Table of Contents

1. [Current Integration Status](#current-integration-status)
2. [Kalshi API Overview](#kalshi-api-overview)
3. [Architecture & Data Flow](#architecture--data-flow)
4. [Phase 1: Read-Only Market Data (Complete)](#phase-1-read-only-market-data-complete)
5. [Phase 2: Enhanced Integration (Planned)](#phase-2-enhanced-integration-planned)
6. [Authentication Strategy](#authentication-strategy)
7. [Real-Time Data (WebSocket)](#real-time-data-websocket)
8. [Error Handling & Reliability](#error-handling--reliability)
9. [Security Considerations](#security-considerations)
10. [Rate Limits & Performance](#rate-limits--performance)
11. [Data Mapping & Transformations](#data-mapping--transformations)
12. [Testing Strategy](#testing-strategy)
13. [Monitoring & Observability](#monitoring--observability)
14. [Future Enhancements](#future-enhancements)

---

## Current Integration Status

### Implemented Features (Phase 1)

**1. Core API Client (`/lib/kalshi-client.ts`)**
- ✅ `fetchKalshiMarkets()` - Retrieve markets by category, status, limit
- ✅ `fetchSportsMarkets()` - Get all sports-related markets (NFL, NBA, MLB, NHL)
- ✅ `getMarketByTicker()` - Fetch specific market by ticker symbol
- ✅ `kalshiMarketToCard()` - Convert market data to UI card format
- ✅ `getKalshiCardsForSport()` - Generate cards for specific sport

**2. API Route (`/app/api/kalshi/route.ts`)**
- ✅ `GET /api/kalshi` - Query markets with filters
- ✅ `POST /api/kalshi` - Generate cards for UI display
- ✅ Query parameter support: `category`, `ticker`, `sport`, `limit`

**3. UI Components**
- ✅ `KalshiCard.tsx` - Display prediction market data
- ✅ Integration with main card rendering system
- ✅ Status indicators: opportunity, edge, synergy

**4. Data Types & Interfaces**
```typescript
interface KalshiMarket {
  ticker: string;
  title: string;
  category: string;
  subtitle: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  openInterest: number;
  closeTime: string;
  status: 'open' | 'closed' | 'settled';
}
```

### Not Yet Implemented

- ❌ User authentication for trading
- ❌ Order placement and management
- ❌ Portfolio tracking
- ❌ WebSocket real-time price streaming
- ❌ Historical data analysis
- ❌ Advanced market analytics (volatility, momentum)
- ❌ Database persistence for market history

---

## Kalshi API Overview

### Key Features & Capabilities

**1. Market Data**
- Real-time bid/ask prices for YES/NO contracts
- Volume and open interest metrics
- Market metadata (title, subtitle, category)
- Settlement rules and close times
- Market status tracking (open, closed, settled)

**2. Supported Categories**
- **Sports:** NFL, NBA, MLB, NHL, college sports
- **Politics:** Elections, approval ratings, policy outcomes
- **Economics:** CPI, unemployment, Fed decisions
- **Entertainment:** Awards shows, box office numbers
- **Weather:** Temperature, precipitation events

**3. Market Types**
- **Binary Markets:** YES/NO contracts (most common)
- **Scalar Markets:** Range-based outcomes
- **Series Markets:** Multiple related binary markets
- **Multi-leg Markets:** Combined event outcomes

**4. Data Frequency**
- REST API: On-demand polling
- WebSocket: Real-time tick-by-tick updates
- Recommended polling: 1-5 seconds for active markets

### API Endpoints Reference

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/exchange/status` | GET | Check if trading is active | No |
| `/markets` | GET | List all markets | No |
| `/markets/{ticker}` | GET | Get specific market | No |
| `/series` | GET | Get market series | No |
| `/events` | GET | Get event data | No |
| `/login` | POST | Authenticate user | Yes (Credentials) |
| `/orders` | POST | Place order | Yes (API Key) |
| `/portfolio/balance` | GET | Get account balance | Yes (API Key) |
| `/trade-api/ws` | WebSocket | Real-time data stream | Optional |

---

## Architecture & Data Flow

### Current System Integration

```
┌─────────────────────────────────────────────────────────────┐
│                     User Query                              │
│          "Show me NFL prediction markets"                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  Main App (page.tsx)                        │
│  - Detects "kalshi" keyword in query                       │
│  - Checks isPoliticalMarket flag                           │
│  - Routes to Kalshi API instead of sports odds             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              API Route (/api/kalshi/route.ts)               │
│  - Validates request parameters                            │
│  - Maps sport to Kalshi category (NBA → "NBA")             │
│  - Calls kalshi-client functions                           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│            Kalshi Client (lib/kalshi-client.ts)             │
│  - Constructs API request to Kalshi                        │
│  - Fetches from: api.elections.kalshi.com                 │
│  - Parses response and transforms data                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Kalshi API (External Service)                  │
│  - Returns JSON with market data                           │
│  - No authentication required for public data              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Data Transformation Layer                      │
│  - Convert API response to KalshiMarket interface          │
│  - Calculate implied probabilities                         │
│  - Format prices (cents to ¢ display)                      │
│  - Map to UI card structure                                │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   UI Rendering                              │
│  - KalshiCard component displays market                    │
│  - Shows YES/NO prices, volume, open interest              │
│  - Status indicators and recommendations                   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Sequence

1. **User Input:** Query contains keywords like "kalshi", "election", "prediction market"
2. **Context Detection:** System sets `isPoliticalMarket = true`
3. **API Routing:** Request routed to `/api/kalshi` instead of `/api/odds`
4. **Parameter Mapping:** Sport names mapped to Kalshi categories
5. **External Call:** HTTP request to Kalshi API (no auth needed)
6. **Response Parsing:** JSON transformed to typed TypeScript objects
7. **Card Generation:** Market data converted to UI card format
8. **Rendering:** KalshiCard component displays in chat interface

---

## Phase 1: Read-Only Market Data (Complete)

### Implementation Details

**File:** `/lib/kalshi-client.ts` (242 lines)

**Key Functions:**

1. **fetchKalshiMarkets(params)**
   - Fetches markets with optional filters
   - Parameters: `category`, `status`, `limit`
   - Returns: Array of `KalshiMarket` objects
   - Error handling: Returns empty array on failure

2. **fetchSportsMarkets()**
   - Aggregates markets from NFL, NBA, MLB, NHL
   - Limit: 10 markets per sport
   - Parallel execution for performance

3. **getMarketByTicker(ticker)**
   - Single market lookup by ticker symbol
   - Used for deep-linking to specific markets
   - Returns null if not found

4. **kalshiMarketToCard(market)**
   - Transforms market data to card UI format
   - Calculates implied probability from YES price
   - Generates recommendations based on probability thresholds:
     - >70%: "Strong YES position"
     - <30%: "Strong NO position"
     - 30-70%: "Market appears efficient"

### API Request Format

```typescript
// Example: Fetch NBA markets
const url = 'https://trading-api.kalshi.com/trade-api/v2/markets?limit=10&status=open&series_ticker=NBA';

fetch(url, {
  headers: {
    'Accept': 'application/json',
  }
});
```

### Response Structure

```json
{
  "markets": [
    {
      "ticker": "NBA-LAKERS-WIN-2026-01-15",
      "title": "Will the Lakers win on Jan 15?",
      "category": "NBA",
      "subtitle": "Lakers vs Celtics",
      "yes_bid": 65,
      "no_bid": 35,
      "volume": 15000,
      "open_interest": 8500,
      "close_time": "2026-01-15T23:00:00Z",
      "status": "open"
    }
  ]
}
```

### Current Limitations

- No authentication (public data only)
- No trading capabilities
- REST API only (no WebSocket)
- Limited to sports categories mapped in code
- No historical data storage
- No volatility or momentum indicators

---

## Phase 2: Enhanced Integration (Planned)

### Priority 1: WebSocket Real-Time Streaming

**Objective:** Replace polling with WebSocket for instant price updates

**Endpoint:** `wss://api.elections.kalshi.com/trade-api/ws`

**Implementation Plan:**

1. **Create WebSocket Client** (`/lib/kalshi-websocket.ts`)
```typescript
export class KalshiWebSocket {
  private ws: WebSocket | null = null;
  private subscriptions: Set<string> = new Set();
  
  connect() {
    this.ws = new WebSocket('wss://api.elections.kalshi.com/trade-api/ws');
    
    this.ws.onopen = () => {
      console.log('[KALSHI WS] Connected');
      this.resubscribe();
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };
  }
  
  subscribe(ticker: string) {
    this.subscriptions.add(ticker);
    this.ws?.send(JSON.stringify({
      type: 'subscribe',
      channel: `market:${ticker}`
    }));
  }
  
  unsubscribe(ticker: string) {
    this.subscriptions.delete(ticker);
    this.ws?.send(JSON.stringify({
      type: 'unsubscribe',
      channel: `market:${ticker}`
    }));
  }
}
```

2. **Message Types to Handle**
   - `market_update`: Price changes
   - `trade`: New trade executed
   - `order_book`: Depth of market changes
   - `settlement`: Market resolved

3. **State Management**
   - Use React Context or Zustand for real-time price updates
   - Update UI without full re-render
   - Cache latest prices in memory

4. **Reconnection Logic**
   - Automatic reconnect on disconnect
   - Exponential backoff strategy
   - Re-subscribe to active markets

### Priority 2: User Authentication & Trading

**Objective:** Enable users to trade on Kalshi markets directly from app

**Requirements:**
- User Kalshi account
- API key generation
- Secure key storage

**Authentication Flow:**

```typescript
// 1. Login endpoint
POST /api/kalshi/auth/login
Body: { email, password }
Response: { token, userId, memberId }

// 2. Store token securely (server-side only)
// Use Supabase user metadata or secure cookie

// 3. API key generation
POST /api/kalshi/auth/api-key
Headers: { Authorization: Bearer {token} }
Response: { apiKey }

// 4. Store encrypted in database
// Never expose to client-side
```

**Order Placement:**

```typescript
export async function placeOrder(params: {
  ticker: string;
  action: 'buy' | 'sell';
  side: 'yes' | 'no';
  quantity: number;
  price: number; // in cents
  type: 'limit' | 'market';
  apiKey: string;
}) {
  const response = await fetch('https://api.elections.kalshi.com/trade-api/v2/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ticker: params.ticker,
      action: params.action,
      side: params.side,
      count: params.quantity,
      yes_price: params.side === 'yes' ? params.price : undefined,
      no_price: params.side === 'no' ? params.price : undefined,
      type: params.type,
    }),
  });
  
  return response.json();
}
```

**Database Schema:**

```sql
-- New tables required
CREATE TABLE kalshi_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  kalshi_member_id TEXT NOT NULL,
  api_key_encrypted TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ
);

CREATE TABLE kalshi_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  ticker TEXT NOT NULL,
  action TEXT NOT NULL, -- 'buy' | 'sell'
  side TEXT NOT NULL, -- 'yes' | 'no'
  quantity INTEGER NOT NULL,
  price INTEGER NOT NULL, -- in cents
  status TEXT NOT NULL, -- 'pending' | 'filled' | 'cancelled'
  filled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kalshi_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  ticker TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  avg_price INTEGER NOT NULL,
  current_price INTEGER,
  unrealized_pnl INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Priority 3: Advanced Analytics

**Volatility Tracking:**
- Already implemented: `/lib/kalshi/analyzeKalshiVolatility.ts`
- Calculate standard deviation of price changes
- Identify high-volatility opportunities

**Market Inefficiency Detection:**
- Compare Kalshi implied probability to:
  - Sports odds implied probability
  - Historical win rates
  - AI model predictions
- Flag markets with >5% edge

**Arbitrage Opportunities:**
- Cross-platform arbitrage (Kalshi vs sportsbooks)
- Intra-platform arbitrage (related markets)
- Real-time alert system for profitable opportunities

---

## Authentication Strategy

### Public API (Current - No Auth)

**Endpoints:**
- `/markets` - List markets
- `/markets/{ticker}` - Get market details
- `/series` - Get series data
- `/events` - Get event data

**Advantages:**
- No user onboarding required
- Instant access to market data
- No API key management
- Lower complexity

**Limitations:**
- Read-only access
- Cannot trade
- Cannot access user portfolio
- Limited to public data

### Authenticated API (Future)

**Tier 1: User Login (OAuth/Email)**
- Purpose: View personalized data
- Endpoints: Portfolio, order history
- Storage: Session token in secure cookie

**Tier 2: API Key (Trading)**
- Purpose: Execute trades programmatically
- Generation: Via Kalshi dashboard
- Storage: Encrypted in database, never client-side
- Rotation: 90-day automatic rotation

**Security Requirements:**
1. API keys stored encrypted with AES-256
2. Keys never sent to client browser
3. All trading requests proxied through backend
4. Rate limiting per user (10 requests/second)
5. IP whitelist for production environment
6. Audit log for all order placements

**Implementation:**

```typescript
// Server-side only
export async function getDecryptedApiKey(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('kalshi_users')
    .select('api_key_encrypted')
    .eq('user_id', userId)
    .single();
  
  if (error || !data) return null;
  
  // Decrypt using environment variable key
  const decrypted = decrypt(data.api_key_encrypted, process.env.ENCRYPTION_KEY!);
  return decrypted;
}

// Trading endpoint (server-side)
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const apiKey = await getDecryptedApiKey(session.user.id);
  if (!apiKey) {
    return NextResponse.json({ error: 'No API key configured' }, { status: 403 });
  }
  
  // Place order using decrypted key
  const result = await placeOrder({ ...body, apiKey });
  return NextResponse.json(result);
}
```

---

## Real-Time Data (WebSocket)

### WebSocket Architecture

**Connection Management:**
- Single shared WebSocket connection per client
- Automatic reconnection with exponential backoff
- Heartbeat mechanism to detect stale connections

**Subscription Model:**
```typescript
// Subscribe to specific markets
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: [
    'market:NBA-LAKERS-WIN',
    'market:NFL-CHIEFS-WIN',
  ]
}));

// Message format
{
  "type": "market_update",
  "ticker": "NBA-LAKERS-WIN",
  "yes_bid": 67,
  "yes_ask": 68,
  "no_bid": 32,
  "no_ask": 33,
  "volume": 16200,
  "timestamp": "2026-02-14T20:30:15Z"
}
```

**State Synchronization:**
```typescript
// Using Zustand for real-time state
export const useKalshiStore = create<KalshiState>((set) => ({
  markets: new Map(),
  
  updateMarket: (ticker, update) =>
    set((state) => {
      const markets = new Map(state.markets);
      const current = markets.get(ticker) || {};
      markets.set(ticker, { ...current, ...update });
      return { markets };
    }),
}));
```

**UI Updates:**
- Price changes highlighted with color flash
- Volume/open interest updated smoothly
- Recommendation recalculated on each update
- Notifications for significant moves (>5% in 5 min)

### Performance Optimization

- **Throttling:** Update UI max once per second
- **Batching:** Group multiple updates before re-render
- **Virtualization:** Only render visible cards
- **Caching:** Keep last 100 price updates in memory

---

## Error Handling & Reliability

### Current Error Handling

```typescript
try {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Kalshi API error: ${response.status}`);
  }
  const data = await response.json();
  return parseMarkets(data);
} catch (error) {
  console.error('[KALSHI] Failed to fetch markets:', error);
  return []; // Graceful degradation
}
```

### Enhanced Error Handling (Phase 2)

**1. Retry Logic**
```typescript
async function fetchWithRetry(url: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      
      if (response.status === 429) {
        // Rate limit - exponential backoff
        await sleep(2 ** i * 1000);
        continue;
      }
      
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (i === retries - 1) throw error;
      await sleep(1000);
    }
  }
}
```

**2. Circuit Breaker**
```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailTime > 60000) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailTime = Date.now();
    if (this.failures >= 5) {
      this.state = 'open';
    }
  }
}
```

**3. Fallback Strategies**
- Return cached data if API fails
- Show "Data temporarily unavailable" message
- Log errors to monitoring service (Sentry)
- Alert on-call if failures exceed threshold

**4. Timeout Configuration**
- Standard requests: 5 seconds
- WebSocket connect: 10 seconds
- Order placement: 15 seconds

---

## Security Considerations

### Data Privacy

1. **No PII Exposure:** Market data is public, no user data leakage
2. **API Key Protection:** Never log or expose API keys in responses
3. **Encrypted Storage:** All credentials encrypted at rest
4. **Secure Transport:** HTTPS/WSS only, no plain HTTP

### API Key Security

**Storage Pattern:**
```typescript
// CORRECT ✅
// Store encrypted on server, decrypt only when needed
const encryptedKey = encrypt(apiKey, process.env.ENCRYPTION_KEY);
await db.insert({ user_id, api_key_encrypted: encryptedKey });

// INCORRECT ❌
// Never store plain text or send to client
const apiKey = 'abc123'; // DANGER!
return { apiKey }; // DANGER!
```

**Encryption Implementation:**
```typescript
import crypto from 'crypto';

export function encrypt(text: string, key: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(text: string, key: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift()!, 'hex');
  const encrypted = parts.join(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### Rate Limiting

**Kalshi Limits:**
- Market data: 10 requests/second per IP
- Trading: 5 orders/second per user
- WebSocket: 100 subscriptions per connection

**Our Implementation:**
```typescript
// Server-side rate limiter
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1s'),
});

export async function middleware(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'anonymous';
  const { success } = await ratelimit.limit(ip);
  
  if (!success) {
    return new Response('Rate limit exceeded', { status: 429 });
  }
}
```

### Input Validation

**Sanitize User Input:**
```typescript
import { z } from 'zod';

const MarketQuerySchema = z.object({
  category: z.string().max(50).optional(),
  ticker: z.string().regex(/^[A-Z0-9-]+$/).optional(),
  limit: z.number().min(1).max(100).default(10),
});

// Validate before making API call
const params = MarketQuerySchema.parse(request.query);
```

---

## Rate Limits & Performance

### Kalshi API Limits

| Endpoint | Rate Limit | Time Window |
|----------|------------|-------------|
| Market data | 10 req/s | Per IP |
| Trading | 5 orders/s | Per user |
| Portfolio | 2 req/s | Per user |
| WebSocket | 100 subs | Per connection |

### Caching Strategy

**1. Market List Cache**
- Duration: 60 seconds
- Key: `kalshi:markets:{category}:{status}`
- Invalidation: Time-based

**2. Market Detail Cache**
- Duration: 5 seconds (active markets)
- Duration: 300 seconds (closed markets)
- Key: `kalshi:market:{ticker}`
- Invalidation: WebSocket update or TTL

**3. Implementation**
```typescript
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

async function getCachedMarkets(category: string): Promise<KalshiMarket[] | null> {
  const cached = await redis.get(`kalshi:markets:${category}`);
  return cached ? JSON.parse(cached as string) : null;
}

async function setCachedMarkets(category: string, markets: KalshiMarket[]) {
  await redis.setex(
    `kalshi:markets:${category}`,
    60, // 60 seconds
    JSON.stringify(markets)
  );
}
```

### Performance Benchmarks

**Current (Phase 1):**
- Market list fetch: 200-400ms (REST API)
- Market detail fetch: 150-300ms
- Card generation: 10-20ms
- Total latency: 250-450ms

**Target (Phase 2 with WebSocket):**
- Initial load: 200-400ms (same)
- Price updates: <50ms (WebSocket)
- UI update: <16ms (60fps)
- Total latency for updates: <100ms

---

## Data Mapping & Transformations

### Sport Name Mapping

```typescript
// Maps our internal sport keys to Kalshi categories
const sportCategoryMap: Record<string, string> = {
  'nfl': 'NFL',
  'nba': 'NBA',
  'mlb': 'MLB',
  'nhl': 'NHL',
  'americanfootball_nfl': 'NFL',
  'basketball_nba': 'NBA',
  'baseball_mlb': 'MLB',
  'icehockey_nhl': 'NHL',
  'ncaaf': 'NCAAF',
  'ncaab': 'NCAAB',
};
```

### Price Transformations

```typescript
// Kalshi prices are in cents (0-100)
// YES price of 65 = 65% implied probability

function kalshiPriceToImpliedProb(price: number): number {
  return price / 100;
}

function impliedProbToKalshiPrice(prob: number): number {
  return Math.round(prob * 100);
}

// Display formatting
function formatKalshiPrice(price: number): string {
  return `${price}¢`; // 65¢
}

function formatImpliedProb(price: number): string {
  return `${(price / 100 * 100).toFixed(1)}%`; // 65.0%
}
```

### Market Status Mapping

```typescript
type KalshiStatus = 'open' | 'closed' | 'settled' | 'suspended';
type UIStatus = 'active' | 'closed' | 'value' | 'edge';

function mapStatus(kalshiStatus: KalshiStatus): UIStatus {
  switch (kalshiStatus) {
    case 'open': return 'active';
    case 'closed': return 'closed';
    case 'settled': return 'value';
    case 'suspended': return 'edge';
  }
}
```

### Card Structure Mapping

```typescript
// Transform Kalshi market to UI card
function kalshiMarketToCard(market: KalshiMarket): Card {
  const impliedProb = market.yesPrice / 100;
  
  return {
    type: 'kalshi-market',
    title: market.title,
    icon: 'TrendingUp',
    category: 'KALSHI',
    subcategory: market.category,
    gradient: 'from-purple-600 to-pink-700',
    data: {
      ticker: market.ticker,
      subtitle: market.subtitle,
      yesPrice: `${market.yesPrice}¢`,
      noPrice: `${market.noPrice}¢`,
      impliedProbability: `${(impliedProb * 100).toFixed(1)}%`,
      volume: market.volume.toLocaleString(),
      openInterest: market.openInterest.toLocaleString(),
      closeTime: new Date(market.closeTime).toLocaleDateString(),
      recommendation: getRecommendation(impliedProb),
    },
    status: market.status === 'open' ? 'active' : 'closed',
    realData: true,
    metadata: {
      source: 'Kalshi',
      timestamp: new Date().toISOString(),
    },
  };
}

function getRecommendation(prob: number): string {
  if (prob > 0.7) return 'Strong YES position';
  if (prob < 0.3) return 'Strong NO position';
  return 'Market appears efficient';
}
```

---

## Testing Strategy

### Unit Tests

**Test File:** `/lib/__tests__/kalshi-client.test.ts`

```typescript
import { fetchKalshiMarkets, kalshiMarketToCard } from '../kalshi-client';

describe('Kalshi Client', () => {
  describe('fetchKalshiMarkets', () => {
    it('should fetch markets successfully', async () => {
      const markets = await fetchKalshiMarkets({ limit: 5 });
      expect(Array.isArray(markets)).toBe(true);
    });
    
    it('should filter by category', async () => {
      const markets = await fetchKalshiMarkets({ category: 'NBA' });
      markets.forEach(m => {
        expect(m.category).toBe('NBA');
      });
    });
    
    it('should handle errors gracefully', async () => {
      // Mock fetch to fail
      global.fetch = jest.fn(() => Promise.reject('Network error'));
      
      const markets = await fetchKalshiMarkets();
      expect(markets).toEqual([]);
    });
  });
  
  describe('kalshiMarketToCard', () => {
    it('should transform market to card correctly', () => {
      const market = {
        ticker: 'TEST-MARKET',
        title: 'Test Market',
        category: 'TEST',
        subtitle: 'Test subtitle',
        yesPrice: 65,
        noPrice: 35,
        volume: 10000,
        openInterest: 5000,
        closeTime: '2026-12-31T23:59:59Z',
        status: 'open' as const,
      };
      
      const card = kalshiMarketToCard(market);
      
      expect(card.type).toBe('kalshi-market');
      expect(card.data.yesPrice).toBe('65¢');
      expect(card.data.impliedProbability).toBe('65.0%');
      expect(card.status).toBe('active');
    });
  });
});
```

### Integration Tests

**Test File:** `/app/api/kalshi/__tests__/route.test.ts`

```typescript
describe('Kalshi API Route', () => {
  it('GET /api/kalshi should return markets', async () => {
    const response = await fetch('/api/kalshi?limit=5');
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.markets)).toBe(true);
  });
  
  it('POST /api/kalshi should return cards', async () => {
    const response = await fetch('/api/kalshi', {
      method: 'POST',
      body: JSON.stringify({ sport: 'nba', limit: 3 }),
    });
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.cards.length).toBeLessThanOrEqual(3);
  });
});
```

### E2E Tests

**Test File:** `/e2e/kalshi.spec.ts` (Playwright)

```typescript
test('User can view Kalshi markets', async ({ page }) => {
  await page.goto('/');
  
  // Type query
  await page.fill('[data-testid="chat-input"]', 'Show me NBA prediction markets on Kalshi');
  await page.click('[data-testid="send-button"]');
  
  // Wait for response
  await page.waitForSelector('[data-testid="kalshi-card"]');
  
  // Verify card content
  const card = page.locator('[data-testid="kalshi-card"]').first();
  await expect(card).toContainText('NBA');
  await expect(card).toContainText('¢'); // Price in cents
});
```

### Load Testing

**Tool:** k6 or Artillery

```javascript
// load-test-kalshi.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 10 }, // Ramp up
    { duration: '3m', target: 10 }, // Stay at 10 users
    { duration: '1m', target: 0 },  // Ramp down
  ],
};

export default function () {
  const res = http.get('http://localhost:3000/api/kalshi?limit=10');
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has markets': (r) => JSON.parse(r.body).markets.length > 0,
  });
  
  sleep(1);
}
```

---

## Monitoring & Observability

### Metrics to Track

**1. API Performance**
- Response time (p50, p95, p99)
- Error rate (4xx, 5xx)
- Request volume
- Cache hit rate

**2. Business Metrics**
- Markets displayed per session
- User engagement with Kalshi cards
- Click-through rate on markets
- Trading volume (Phase 2)

**3. System Health**
- WebSocket connection uptime
- Reconnection frequency
- Message processing lag
- Memory usage

### Logging

```typescript
// Structured logging
console.log('[v0] [KALSHI] [FETCH]', {
  category: 'NBA',
  limit: 10,
  duration: 250,
  count: 8,
  cached: false,
});

console.log('[v0] [KALSHI] [ERROR]', {
  operation: 'fetchMarkets',
  error: error.message,
  category: 'NBA',
  retries: 3,
});
```

### Alerts

**Critical (PagerDuty):**
- Error rate > 5% for 5 minutes
- All Kalshi requests failing
- WebSocket disconnected for > 60 seconds

**Warning (Slack):**
- Response time p95 > 1000ms
- Cache hit rate < 50%
- Individual market fetch failures

**Info (Dashboard):**
- Daily request volume
- Popular market categories
- Geographic distribution

### Dashboard Visualization

**Grafana Dashboard:**
- Request volume by category (time series)
- Error rate (gauge)
- Response time distribution (histogram)
- Top markets by volume (table)
- WebSocket status (status panel)

---

## Future Enhancements

### Phase 3: AI-Powered Predictions

**Market Prediction Model:**
- Train ML model on historical market outcomes
- Features: price history, volume, external events
- Predict probability of YES outcome
- Compare to current market price for edge detection

**Sentiment Analysis:**
- Scrape social media for event mentions
- Analyze sentiment towards outcomes
- Correlate with market movements
- Generate trading signals

### Phase 4: Portfolio Management

**Features:**
- Real-time P&L tracking
- Position sizing recommendations
- Risk management (max exposure per market)
- Performance analytics (Sharpe ratio, win rate)
- Tax reporting integration

### Phase 5: Social Features

**Community Trading:**
- Follow top traders
- Copy trading functionality
- Share predictions and reasoning
- Leaderboard by performance

**Market Commentary:**
- User-generated analysis
- Expert picks
- Discussion threads per market

### Phase 6: Advanced Order Types

**Implementation:**
- Stop-loss orders
- Take-profit orders
- Conditional orders (if-then)
- Time-based orders (fill before X time)

---

## Appendix

### Useful Links

- **Kalshi Homepage:** https://kalshi.com
- **API Documentation:** https://docs.kalshi.com
- **Developer Agreement:** https://kalshi.com/developer-agreement
- **Trading Console:** https://kalshi.com/trade
- **OpenAPI Spec:** https://docs.kalshi.com/openapi.yaml
- **AsyncAPI Spec:** https://docs.kalshi.com/asyncapi.yaml

### Contact & Support

- **Email:** support@kalshi.com
- **Discord:** Kalshi Developer Community
- **Status Page:** https://status.kalshi.com

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Feb 14, 2026 | Initial integration plan created |

---

**Document Status:** Complete  
**Next Review Date:** March 15, 2026  
**Owner:** LeverageAI Engineering Team
