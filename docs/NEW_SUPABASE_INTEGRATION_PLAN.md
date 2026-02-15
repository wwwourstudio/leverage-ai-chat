# New Supabase Backend Integration Plan
**Production-Ready Setup for Sports Betting AI Platform**

---

## Executive Summary

This plan outlines a comprehensive approach to integrate a fresh Supabase backend that fixes all current issues and establishes a scalable, secure, real-time data infrastructure.

**Current Status:**
- ✅ Supabase connected (13 env vars configured)
- ❌ Database schema incomplete (missing tables/columns)
- ❌ Real-time features not configured
- ❌ Authentication not implemented
- ❌ RLS policies incomplete

**Outcome:** Production-ready backend with real-time sync, secure auth, and complete data flow

---

## Phase 1: Database Schema Deployment (15 minutes)

### 1.1 Core Application Schema

**File:** `/scripts/complete-database-schema.sql` (463 lines)

**Execute in Supabase SQL Editor:**

```bash
# Tables Created (10):
1. live_odds_cache         - Real-time odds with TTL
2. mlb_odds, nfl_odds, nba_odds, nhl_odds  - Sport-specific tables
3. line_movement          - Historical odds tracking
4. player_stats           - Player performance data
5. player_props_markets   - Prop betting markets
6. historical_games       - Completed game results
7. kalshi_markets         - Prediction market integration
8. arbitrage_opportunities - Cross-book arb detection
9. ai_response_trust      - AI confidence scoring
10. user_predictions      - User bet tracking
```

**Key Features:**
- Automatic sport_key column with proper indexing
- consensus_score column in ai_response_trust
- Proper foreign key relationships
- TTL-based cache expiration
- Composite indexes for performance

### 1.2 Quantitative Trading Schema

**File:** `/scripts/quantitative-trading-schema.sql` (338 lines)

**Execute in Supabase SQL Editor:**

```bash
# Tables Created (11):
1. capital_state          - Bankroll management
2. bet_allocations        - Kelly-sized positions
3. projection_priors      - Bayesian player models
4. bayesian_updates       - Update history
5. edge_opportunities     - Value bet detection
6. sharp_signals          - Line movement signals
7. ml_projections         - Model predictions
8. arbitrage_opportunities - Risk-free opportunities
9. benford_results        - Integrity analysis
10. portfolio_performance - Daily P&L tracking
11. system_metrics        - System health monitoring
```

**Key Features:**
- Strict capital validation (cannot exceed bankroll)
- Risk budget enforcement (max 25% at risk)
- Kelly fraction calculations
- Real-time portfolio tracking
- Helper functions for stats

### 1.3 Authentication & User Management

**Execute this SQL:**

```sql
-- Enable auth schema
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bankroll NUMERIC DEFAULT 0,
  total_profit_loss NUMERIC DEFAULT 0,
  total_bets INTEGER DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  roi NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## Phase 2: Real-Time Synchronization Setup (10 minutes)

### 2.1 Enable Realtime on Tables

**Execute in Supabase:**

```sql
-- Enable realtime on odds tables
ALTER PUBLICATION supabase_realtime ADD TABLE live_odds_cache;
ALTER PUBLICATION supabase_realtime ADD TABLE mlb_odds;
ALTER PUBLICATION supabase_realtime ADD TABLE nfl_odds;
ALTER PUBLICATION supabase_realtime ADD TABLE nba_odds;
ALTER PUBLICATION supabase_realtime ADD TABLE nhl_odds;
ALTER PUBLICATION supabase_realtime ADD TABLE line_movement;
ALTER PUBLICATION supabase_realtime ADD TABLE arbitrage_opportunities;
ALTER PUBLICATION supabase_realtime ADD TABLE edge_opportunities;
ALTER PUBLICATION supabase_realtime ADD TABLE bet_allocations;
ALTER PUBLICATION supabase_realtime ADD TABLE portfolio_performance;

-- Configure realtime messages
ALTER TABLE live_odds_cache REPLICA IDENTITY FULL;
ALTER TABLE bet_allocations REPLICA IDENTITY FULL;
ALTER TABLE arbitrage_opportunities REPLICA IDENTITY FULL;
```

### 2.2 Create Realtime Client Hook

**File:** `/lib/hooks/use-realtime.ts`

```typescript
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtime<T>(
  table: string,
  filter?: { column: string; value: any }
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let channel: RealtimeChannel;

    async function setupRealtime() {
      // Initial fetch
      let query = supabase.from(table).select('*');
      if (filter) {
        query = query.eq(filter.column, filter.value);
      }
      
      const { data: initialData } = await query;
      setData(initialData || []);
      setLoading(false);

      // Subscribe to changes
      channel = supabase
        .channel(`${table}_changes`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
            filter: filter ? `${filter.column}=eq.${filter.value}` : undefined
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setData((prev) => [...prev, payload.new as T]);
            } else if (payload.eventType === 'UPDATE') {
              setData((prev) =>
                prev.map((item: any) =>
                  item.id === payload.new.id ? (payload.new as T) : item
                )
              );
            } else if (payload.eventType === 'DELETE') {
              setData((prev) =>
                prev.filter((item: any) => item.id !== payload.old.id)
              );
            }
          }
        )
        .subscribe();
    }

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [table, filter?.column, filter?.value]);

  return { data, loading };
}
```

### 2.3 Usage Example

```typescript
// In a component:
import { useRealtime } from '@/lib/hooks/use-realtime';

function LiveOdds() {
  const { data: odds, loading } = useRealtime('live_odds_cache', {
    column: 'sport',
    value: 'NBA'
  });

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {odds.map(game => (
        <div key={game.id}>
          {game.away_team} @ {game.home_team}
        </div>
      ))}
    </div>
  );
}
```

---

## Phase 3: Secure Authentication Implementation (15 minutes)

### 3.1 Create Supabase Client Utilities

**File:** `/lib/supabase/client.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**File:** `/lib/supabase/server.ts`

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component - can't set cookies
          }
        },
      },
    }
  );
}
```

### 3.2 Create Middleware

**File:** `/middleware.ts`

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

### 3.3 Authentication Components

**File:** `/components/auth/sign-in-form.tsx`

```typescript
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      router.push('/dashboard');
      router.refresh();
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSignIn} className="space-y-4">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}
```

---

## Phase 4: Dynamic Data Source Integration (20 minutes)

### 4.1 Create Unified Data Service

**File:** `/lib/services/data-service.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { fetchLiveOdds } from '@/lib/odds-api-client';
import { fetchKalshiMarkets } from '@/lib/kalshi-client';

export class DataService {
  private supabase: any;

  constructor() {
    this.supabase = null;
  }

  async init() {
    this.supabase = await createClient();
  }

  async getOdds(sport: string, forceRefresh = false) {
    if (!this.supabase) await this.init();

    // Check cache first
    if (!forceRefresh) {
      const { data: cached } = await this.supabase
        .from('live_odds_cache')
        .select('*')
        .eq('sport_key', sport)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (cached && cached.length > 0) {
        console.log(`[DataService] Cache hit for ${sport}`);
        return cached;
      }
    }

    // Fetch from API
    console.log(`[DataService] Fetching fresh odds for ${sport}`);
    const apiKey = process.env.ODDS_API_KEY!;
    const oddsData = await fetchLiveOdds(sport, {
      markets: ['h2h', 'spreads', 'totals'],
      regions: ['us'],
      oddsFormat: 'american',
      apiKey,
      skipCache: true
    });

    // Store in database
    if (oddsData && oddsData.length > 0) {
      const records = oddsData.map(game => ({
        sport_key: sport,
        game_id: game.id,
        home_team: game.home_team,
        away_team: game.away_team,
        commence_time: game.commence_time,
        odds_data: game,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 min TTL
      }));

      await this.supabase
        .from('live_odds_cache')
        .upsert(records, { onConflict: 'game_id' });
    }

    return oddsData;
  }

  async getKalshiMarkets(ticker?: string) {
    if (!this.supabase) await this.init();

    // Check cache
    const { data: cached } = await this.supabase
      .from('kalshi_markets')
      .select('*')
      .gt('expires_at', new Date().toISOString());

    if (cached && cached.length > 0) {
      return cached;
    }

    // Fetch from Kalshi API
    const markets = await fetchKalshiMarkets(ticker);

    // Store in database
    if (markets && markets.length > 0) {
      const records = markets.map(market => ({
        ticker: market.ticker,
        title: market.title,
        yes_price: market.yes_bid,
        no_price: market.no_bid,
        volume: market.volume,
        market_data: market,
        expires_at: new Date(Date.now() + 60 * 1000).toISOString() // 1 min TTL
      }));

      await this.supabase
        .from('kalshi_markets')
        .upsert(records, { onConflict: 'ticker' });
    }

    return markets;
  }

  async storePlayerStats(playerId: string, stats: any) {
    if (!this.supabase) await this.init();

    return await this.supabase
      .from('player_stats')
      .upsert({
        player_id: playerId,
        ...stats
      }, { onConflict: 'player_id' });
  }

  async detectArbitrage(sport: string) {
    if (!this.supabase) await this.init();

    // Get recent odds
    const odds = await this.getOdds(sport);

    // Run arbitrage detection logic
    // ... (use existing arbitrage-detector.ts)

    // Store opportunities
    // await this.supabase.from('arbitrage_opportunities').insert(...)
  }
}

export const dataService = new DataService();
```

### 4.2 API Route Integration

**File:** `/app/api/odds/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { dataService } from '@/lib/services/data-service';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sport = searchParams.get('sport') || 'basketball_nba';
  const forceRefresh = searchParams.get('refresh') === 'true';

  try {
    const odds = await dataService.getOdds(sport, forceRefresh);
    return NextResponse.json({ success: true, data: odds });
  } catch (error) {
    console.error('[API] Error fetching odds:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch odds' },
      { status: 500 }
    );
  }
}
```

---

## Phase 5: Row-Level Security (RLS) Policies (15 minutes)

### 5.1 User Data Isolation

```sql
-- Bet allocations: Users can only see their own
ALTER TABLE bet_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own allocations"
  ON bet_allocations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own allocations"
  ON bet_allocations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own allocations"
  ON bet_allocations FOR UPDATE
  USING (auth.uid() = user_id);

-- User predictions
ALTER TABLE user_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own predictions"
  ON user_predictions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own predictions"
  ON user_predictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### 5.2 Public Data Access

```sql
-- Live odds cache: Read-only for all authenticated users
ALTER TABLE live_odds_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read odds"
  ON live_odds_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage odds"
  ON live_odds_cache FOR ALL
  TO service_role
  USING (true);

-- Similar policies for other public tables
ALTER TABLE mlb_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfl_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE nba_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE nhl_odds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read mlb_odds"
  ON mlb_odds FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read nfl_odds"
  ON nfl_odds FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read nba_odds"
  ON nba_odds FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read nhl_odds"
  ON nhl_odds FOR SELECT TO authenticated USING (true);
```

---

## Phase 6: Data Flow Architecture

### 6.1 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL APIs                             │
│  The Odds API  │  Kalshi  │  Weather API  │  Player Stats   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              API ROUTES (Next.js)                            │
│  /api/odds  │  /api/kalshi  │  /api/players                 │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│           DATA SERVICE LAYER                                 │
│  - Fetch from APIs                                           │
│  - Transform & validate                                      │
│  - Cache in Supabase                                         │
│  - Apply business logic                                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              SUPABASE DATABASE                               │
│  ┌──────────────┬──────────────┬──────────────┐            │
│  │ Cached Data  │  User Data   │ Trading Data │            │
│  │  - Odds      │  - Profiles  │  - Capital   │            │
│  │  - Markets   │  - Bets      │  - Bayesian  │            │
│  │  - Players   │  - Prefs     │  - Edge      │            │
│  └──────────────┴──────────────┴──────────────┘            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│           REAL-TIME SUBSCRIPTIONS                            │
│  Supabase Realtime broadcasts changes to clients            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND COMPONENTS                             │
│  - Live odds display                                         │
│  - Kelly calculator                                          │
│  - Portfolio tracker                                         │
│  - Chat interface                                            │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Data Update Flow

**1. External API → Database:**
```typescript
// Scheduled job or user trigger
async function syncOdds() {
  // Fetch from The Odds API
  const odds = await fetchLiveOdds('basketball_nba');
  
  // Store in Supabase
  await supabase.from('live_odds_cache').upsert(odds);
  
  // Detect arbitrage
  await detectAndStoreArbitrage(odds);
  
  // Calculate edge opportunities
  await calculateAndStoreEdge(odds);
}
```

**2. Database → Frontend (Real-time):**
```typescript
// Component automatically updates
function OddsDisplay() {
  const { data } = useRealtime('live_odds_cache');
  
  return <div>{data.map(game => <Card {...game} />)}</div>;
}
```

**3. User Action → Database:**
```typescript
// User places bet
async function placeBet(allocation: Allocation) {
  const { data, error } = await supabase
    .from('bet_allocations')
    .insert({
      ...allocation,
      user_id: user.id,
      status: 'pending'
    });
    
  // Real-time subscribers automatically see new bet
}
```

---

## Phase 7: Performance Optimization (10 minutes)

### 7.1 Create Indexes

```sql
-- Odds cache indexes
CREATE INDEX IF NOT EXISTS idx_live_odds_sport 
  ON live_odds_cache(sport_key, expires_at);

CREATE INDEX IF NOT EXISTS idx_live_odds_game 
  ON live_odds_cache(game_id);

CREATE INDEX IF NOT EXISTS idx_live_odds_time 
  ON live_odds_cache(commence_time);

-- Allocation indexes
CREATE INDEX IF NOT EXISTS idx_allocations_user 
  ON bet_allocations(user_id, status);

CREATE INDEX IF NOT EXISTS idx_allocations_sport 
  ON bet_allocations(sport, created_at DESC);

-- Player stats indexes
CREATE INDEX IF NOT EXISTS idx_player_stats_player 
  ON player_stats(player_id, season);

-- Arbitrage indexes
CREATE INDEX IF NOT EXISTS idx_arb_active 
  ON arbitrage_opportunities(status, profit_margin DESC);
```

### 7.2 Enable Query Caching

```typescript
// In DataService
private cache = new Map<string, { data: any; expires: number }>();

async getCached<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = this.cache.get(key);
  
  if (cached && Date.now() < cached.expires) {
    return cached.data as T;
  }
  
  const data = await fetcher();
  this.cache.set(key, { data, expires: Date.now() + ttl });
  
  return data;
}
```

---

## Phase 8: Testing & Verification (20 minutes)

### 8.1 Database Tests

```sql
-- Test 1: Verify all tables exist
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'live_odds_cache', 'mlb_odds', 'nfl_odds', 'nba_odds', 'nhl_odds',
  'ai_response_trust', 'capital_state', 'bet_allocations', 'user_profiles'
);
-- Expected: 9

-- Test 2: Verify RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'bet_allocations';
-- Expected: rowsecurity = true

-- Test 3: Test user isolation
-- As user A:
INSERT INTO bet_allocations (user_id, market_id, ...) VALUES (...);
-- As user B:
SELECT * FROM bet_allocations WHERE user_id = 'user_a_id';
-- Expected: Empty result (RLS blocks)

-- Test 4: Test realtime
-- Subscribe to changes in terminal 1
-- Insert/update in terminal 2
-- Verify terminal 1 receives update
```

### 8.2 Integration Tests

```typescript
// tests/integration/data-service.test.ts
import { dataService } from '@/lib/services/data-service';

describe('DataService Integration', () => {
  it('should fetch and cache odds', async () => {
    const odds = await dataService.getOdds('basketball_nba');
    expect(odds).toBeDefined();
    expect(odds.length).toBeGreaterThan(0);
    
    // Second call should use cache
    const cached = await dataService.getOdds('basketball_nba');
    expect(cached).toEqual(odds);
  });

  it('should detect arbitrage opportunities', async () => {
    await dataService.detectArbitrage('basketball_nba');
    
    const { data } = await supabase
      .from('arbitrage_opportunities')
      .select('*')
      .eq('status', 'active');
      
    expect(data).toBeDefined();
  });
});
```

---

## Phase 9: Deployment & Monitoring (15 minutes)

### 9.1 Environment Variables

Verify in Vercel/Environment:

```bash
# Supabase (13 vars - already set ✅)
SUPABASE_URL
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_JWT_SECRET
POSTGRES_URL
POSTGRES_PRISMA_URL
POSTGRES_URL_NON_POOLING
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_HOST
POSTGRES_DATABASE

# External APIs
ODDS_API_KEY
KALSHI_API_KEY
KALSHI_API_SECRET
OPENWEATHERMAP_API_KEY
```

### 9.2 Database Monitoring

```sql
-- Create monitoring view
CREATE OR REPLACE VIEW system_health AS
SELECT 
  (SELECT COUNT(*) FROM live_odds_cache WHERE expires_at > now()) as cached_games,
  (SELECT COUNT(*) FROM bet_allocations WHERE status = 'pending') as pending_bets,
  (SELECT COUNT(*) FROM arbitrage_opportunities WHERE status = 'active') as active_arbs,
  (SELECT COUNT(*) FROM user_profiles) as total_users,
  (SELECT pg_size_pretty(pg_database_size(current_database()))) as db_size,
  now() as checked_at;

-- Query health status
SELECT * FROM system_health;
```

### 9.3 Setup Cron Jobs

```sql
-- In Supabase Dashboard → Database → Cron Jobs

-- Clean expired odds cache (every 5 minutes)
SELECT cron.schedule(
  'cleanup-expired-odds',
  '*/5 * * * *',
  $$
  DELETE FROM live_odds_cache WHERE expires_at < now();
  $$
);

-- Archive old allocations (daily at 2 AM)
SELECT cron.schedule(
  'archive-old-allocations',
  '0 2 * * *',
  $$
  UPDATE bet_allocations 
  SET status = 'archived' 
  WHERE settled_at < now() - INTERVAL '30 days';
  $$
);
```

---

## Phase 10: Documentation & Handoff (10 minutes)

### 10.1 Create API Documentation

**File:** `/docs/API_REFERENCE.md`

```markdown
# API Reference

## GET /api/odds
Fetch live odds for a sport

**Parameters:**
- sport: string (e.g., 'basketball_nba')
- refresh: boolean (force API call)

**Response:**
```json
{
  "success": true,
  "data": [...]
}
```

## POST /api/allocations
Create Kelly-sized allocation

**Body:**
```json
{
  "opportunities": [...]
}
```

## GET /api/arbitrage
Get active arbitrage opportunities

**Response:**
```json
{
  "opportunities": [...]
}
```
```

### 10.2 Create Developer Guide

**File:** `/docs/DEVELOPER_GUIDE.md`

```markdown
# Developer Guide

## Getting Started

1. Clone repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local`
4. Run database migrations (see Phase 1)
5. Start dev server: `npm run dev`

## Architecture

- Next.js 16 App Router
- Supabase for database & auth
- Real-time subscriptions via Supabase Realtime
- TypeScript throughout
- Tailwind CSS for styling

## Common Tasks

### Adding a New Table
1. Write SQL in `/scripts/`
2. Execute in Supabase SQL Editor
3. Add RLS policies
4. Create TypeScript types
5. Update DataService

### Adding Real-Time Feature
1. Enable realtime on table
2. Use `useRealtime` hook
3. Test subscription

## Testing
- Unit tests: `npm test`
- Integration tests: `npm run test:integration`
- E2E tests: `npm run test:e2e`
```

---

## Success Metrics

After completing this integration, you should have:

### Functional Metrics:
- ✅ Database responds in <100ms
- ✅ Real-time updates arrive in <500ms
- ✅ API endpoints return data successfully
- ✅ Authentication works (signup/login/logout)
- ✅ RLS policies prevent unauthorized access
- ✅ Cron jobs run on schedule

### Data Metrics:
- ✅ Live odds cached with <5% staleness
- ✅ Arbitrage detected within 1 minute of odds change
- ✅ Kelly allocations calculated correctly
- ✅ Portfolio P&L tracked accurately

### User Experience:
- ✅ No "table not found" errors
- ✅ Cards show real game data (not placeholders)
- ✅ Trust metrics save successfully
- ✅ Real-time updates visible to users

---

## Troubleshooting

### Issue: RLS blocking legitimate queries

**Solution:** Check policies match user auth state
```sql
-- Debug query
SELECT * FROM auth.users WHERE id = auth.uid();
```

### Issue: Realtime not updating

**Solution:** Verify publication and subscription
```sql
-- Check publication
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Verify REPLICA IDENTITY
SELECT relname, relreplident 
FROM pg_class 
WHERE relname IN ('live_odds_cache', 'bet_allocations');
```

### Issue: Slow queries

**Solution:** Add indexes
```sql
-- Find slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

---

## Timeline Summary

- **Phase 1:** Database Schema (15 min)
- **Phase 2:** Real-Time Setup (10 min)
- **Phase 3:** Authentication (15 min)
- **Phase 4:** Data Integration (20 min)
- **Phase 5:** RLS Policies (15 min)
- **Phase 6:** Data Flow (10 min - planning only)
- **Phase 7:** Performance (10 min)
- **Phase 8:** Testing (20 min)
- **Phase 9:** Deployment (15 min)
- **Phase 10:** Documentation (10 min)

**Total:** ~2 hours for complete production-ready setup

---

## Next Steps

1. **Execute Phase 1** (Database Schema) first
2. **Test basic connectivity** before proceeding
3. **Enable real-time** once data flow works
4. **Add authentication** when core features stable
5. **Deploy incrementally** - don't wait for everything

---

**This plan provides a complete, scalable, secure Supabase backend that fixes all current issues and establishes a foundation for long-term growth.**
