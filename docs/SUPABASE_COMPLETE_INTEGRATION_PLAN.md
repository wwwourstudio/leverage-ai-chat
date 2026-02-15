# Supabase Backend Integration - Complete Setup Plan

**Status:** Production-Ready Integration Guide  
**Version:** 3.0  
**Last Updated:** February 15, 2026

---

## Executive Summary

This document provides a comprehensive plan for integrating Supabase as your backend database, including initialization, schema configuration, real-time synchronization, authentication, and scalable data management. The plan supports both **fixing your current Supabase instance** (recommended, 5 minutes) and **creating a new instance** (30+ minutes).

### Recommendation: Fix Current Instance

Your current Supabase instance is **fully functional** with all 13 environment variables configured correctly. The only issue is **missing database tables**. Creating a new instance would require reconfiguring everything and result in the same problem (tables still need to be created).

---

## Part 1: Quick Fix for Current Instance (5 Minutes)

### Step 1: Access Supabase Dashboard

1. Navigate to: https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in left sidebar

### Step 2: Execute Database Schemas

**Execute these scripts in order:**

#### Script 1: Main Database Schema (2 minutes)
```bash
File: /scripts/complete-database-schema.sql (463 lines)
```

**What it creates:**
- `live_odds_cache` - Real-time odds with TTL
- `mlb_odds`, `nfl_odds`, `nba_odds`, `nhl_odds` - Sport-specific tables  
- `line_movement` - Track odds changes over time
- `player_stats` - Season stats with vs opponent splits
- `player_props_markets` - Player prop odds
- `historical_games` - Completed games with final scores
- `kalshi_markets` - Kalshi prediction markets
- `arbitrage_opportunities` - Auto-detected arbitrage
- `ai_response_trust` (with `consensus_score` column) - Trust metrics
- `user_predictions` - User bet tracking

#### Script 2: Quantitative Trading Schema (2 minutes)
```bash
File: /scripts/quantitative-trading-schema.sql (338 lines)
```

**What it creates:**
- `capital_state` - Bankroll management
- `bet_allocations` - Position tracking  
- `projection_priors` - Bayesian priors for players
- `bayesian_updates` - Update history
- `edge_opportunities` - Value bet detection
- `sharp_signals` - Line movement signals
- `ml_projections` - Model predictions
- `portfolio_performance` - P&L tracking
- `system_metrics` - System health
- `benford_results` - Integrity analysis

### Step 3: Verify Success (30 seconds)

```sql
-- Check all tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```

**Expected:** 20+ tables including mlb_odds, nfl_odds, nba_odds, nhl_odds, ai_response_trust, capital_state

---

## Part 2: Fresh Supabase Instance Setup (If Needed)

### Phase 1: Create New Project (5 minutes)

1. Go to https://supabase.com/dashboard
2. Click **New Project**
3. Configure:
   - **Organization:** Your organization
   - **Project Name:** leverageai-sports-betting
   - **Database Password:** (Generate strong password - save securely!)
   - **Region:** Choose closest to users (us-east-1, eu-west-1, etc.)
   - **Pricing Plan:** Free tier (can upgrade later)
4. Click **Create New Project**
5. Wait 2-3 minutes for provisioning

### Phase 2: Configure Environment Variables (5 minutes)

#### 2.1 Get Supabase Credentials

In Supabase Dashboard:
1. Go to **Project Settings** → **API**
2. Copy the following values:

```bash
Project URL: https://[your-project-ref].supabase.co
anon public key: eyJhbG...
service_role key: eyJhbG... (keep secret!)
```

3. Go to **Project Settings** → **Database**
4. Copy connection strings:

```bash
Connection string: postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
Direct connection: postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

#### 2.2 Update Vercel Environment Variables

In Vercel Dashboard (https://vercel.com):
1. Select your project
2. Go to **Settings** → **Environment Variables**
3. Add/Update the following 13 variables:

```bash
# Supabase API
NEXT_PUBLIC_SUPABASE_URL=https://[your-project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_ANON_KEY=eyJhbG... (same as above)
SUPABASE_SERVICE_ROLE_KEY=eyJhbG... (secret key)
SUPABASE_URL=https://[your-project-ref].supabase.co
SUPABASE_JWT_SECRET=[from Project Settings → API → JWT Secret]

# PostgreSQL Direct Connection
POSTGRES_URL=postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
POSTGRES_URL_NON_POOLING=postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
POSTGRES_PRISMA_URL=postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?pgbouncer=true

# PostgreSQL Components
POSTGRES_HOST=aws-0-[region].pooler.supabase.com
POSTGRES_USER=postgres.[project-ref]
POSTGRES_PASSWORD=[your-database-password]
POSTGRES_DATABASE=postgres
```

4. Select **All Environments** (Production, Preview, Development)
5. Click **Save**
6. Redeploy application: Go to **Deployments** → **...** → **Redeploy**

### Phase 3: Execute Database Schemas (5 minutes)

Follow the same scripts as in Part 1, Step 2:
1. Execute `/scripts/complete-database-schema.sql`
2. Execute `/scripts/quantitative-trading-schema.sql`
3. Verify with table count query

---

## Part 3: Application Integration

### 3.1 Supabase Client Setup

The application already has Supabase client configured at `/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### 3.2 Server-Side Client (for API routes)

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})
```

### 3.3 Real-Time Subscriptions

#### Example: Live Odds Updates

```typescript
import { supabase } from '@/lib/supabase'

// Subscribe to live odds changes
const subscription = supabase
  .channel('live-odds-updates')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'live_odds_cache'
    },
    (payload) => {
      console.log('New odds:', payload.new)
      // Update UI with new odds
    }
  )
  .subscribe()

// Cleanup
return () => subscription.unsubscribe()
```

#### Example: Portfolio Updates

```typescript
// Subscribe to bet allocation changes
const portfolioSub = supabase
  .channel('portfolio-updates')
  .on(
    'postgres_changes',
    {
      event: '*',  // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'bet_allocations',
      filter: `user_id=eq.${userId}`
    },
    (payload) => {
      console.log('Portfolio change:', payload)
      // Refresh portfolio stats
    }
  )
  .subscribe()
```

### 3.4 Data Operations

#### Insert Odds Data

```typescript
const { data, error } = await supabase
  .from('live_odds_cache')
  .insert({
    sport_key: 'basketball_nba',
    game_id: 'lakers_celtics_2026_02_15',
    home_team: 'Boston Celtics',
    away_team: 'Los Angeles Lakers',
    commence_time: new Date('2026-02-15T19:30:00Z'),
    bookmakers: JSON.stringify([...]),
    created_at: new Date(),
    expires_at: new Date(Date.now() + 3600000) // 1 hour TTL
  })
```

#### Query with Filters

```typescript
const { data: nbaGames, error } = await supabase
  .from('live_odds_cache')
  .select('*')
  .eq('sport_key', 'basketball_nba')
  .gte('expires_at', new Date().toISOString())
  .order('commence_time', { ascending: true })
  .limit(10)
```

#### Update Records

```typescript
const { data, error } = await supabase
  .from('bet_allocations')
  .update({ 
    status: 'won',
    actual_return: 600,
    settled_at: new Date()
  })
  .eq('market_id', 'lakers_ml')
  .select()
```

#### Delete with Cascade

```typescript
const { error } = await supabase
  .from('user_predictions')
  .delete()
  .eq('user_id', userId)
```

---

## Part 4: Authentication Integration

### 4.1 Enable Authentication

In Supabase Dashboard:
1. Go to **Authentication** → **Providers**
2. Enable desired providers:
   - Email (default, always enabled)
   - Google OAuth
   - GitHub OAuth
   - Twitter OAuth

### 4.2 Configure OAuth Providers

#### Google OAuth Example:

1. Go to Google Cloud Console
2. Create OAuth 2.0 Client ID
3. Set authorized redirect URI:
   ```
   https://[your-project-ref].supabase.co/auth/v1/callback
   ```
4. Copy Client ID and Secret to Supabase
5. Enable in Supabase Auth settings

### 4.3 Authentication Middleware

Create `/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  await supabase.auth.getSession()

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### 4.4 Sign Up/Sign In Example

```typescript
'use client'

import { supabase } from '@/lib/supabase'
import { useState } from 'react'

export function AuthForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const signUp = async () => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })
    if (error) console.error('Error:', error.message)
    else console.log('Check your email for verification!')
  }

  const signIn = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) console.error('Error:', error.message)
    else console.log('Logged in!')
  }

  return (
    <div>
      <input 
        type="email" 
        value={email} 
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input 
        type="password" 
        value={password} 
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button onClick={signUp}>Sign Up</button>
      <button onClick={signIn}>Sign In</button>
    </div>
  )
}
```

---

## Part 5: Row Level Security (RLS)

### 5.1 Enable RLS on All Tables

```sql
-- Enable RLS on all tables
ALTER TABLE live_odds_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE bet_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_predictions ENABLE ROW LEVEL SECURITY;
-- ... repeat for all tables
```

### 5.2 Create RLS Policies

#### Example: User-specific data access

```sql
-- Users can only read/write their own bet allocations
CREATE POLICY "Users can view their own bets"
ON bet_allocations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bets"
ON bet_allocations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bets"
ON bet_allocations FOR UPDATE
USING (auth.uid() = user_id);
```

#### Example: Public read, authenticated write

```sql
-- Anyone can read live odds
CREATE POLICY "Public can view live odds"
ON live_odds_cache FOR SELECT
TO public
USING (true);

-- Only authenticated users can write
CREATE POLICY "Authenticated users can insert odds"
ON live_odds_cache FOR INSERT
TO authenticated
WITH CHECK (true);
```

#### Example: Service role bypass

```sql
-- Service role (backend) can do anything
CREATE POLICY "Service role full access"
ON ai_response_trust FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

---

## Part 6: Performance Optimization

### 6.1 Indexes

All required indexes are created by the schema scripts. Key indexes include:

```sql
-- Composite index for common queries
CREATE INDEX idx_live_odds_sport_time 
ON live_odds_cache(sport_key, commence_time);

-- Index for filtering expired records
CREATE INDEX idx_live_odds_expires 
ON live_odds_cache(expires_at) 
WHERE expires_at > now();

-- Index for user queries
CREATE INDEX idx_bet_allocations_user_status 
ON bet_allocations(user_id, status);
```

### 6.2 Connection Pooling

Supabase provides PgBouncer by default. Use pooled connections for serverless:

```typescript
// Use pooled connection (port 5432)
const pooledUrl = process.env.POSTGRES_URL  // Includes pgbouncer=true

// Use direct connection for migrations (port 6543)
const directUrl = process.env.POSTGRES_URL_NON_POOLING
```

### 6.3 Caching Strategy

```typescript
// Cache TTL configuration
const CACHE_TTL = {
  liveOdds: 60,        // 60 seconds
  playerStats: 3600,    // 1 hour
  historical: 86400     // 24 hours
}

// Automatic cleanup function (runs every hour)
SELECT cleanup_expired_odds_cache();
```

---

## Part 7: Data Relationships

### 7.1 Entity Relationship Diagram

```
users (Supabase Auth)
  ├── user_profiles (1:1)
  ├── user_preferences (1:1)
  ├── conversations (1:many)
  │   └── messages (1:many)
  │       └── message_attachments (1:many)
  ├── predictions (1:many)
  ├── user_bets (1:many)
  └── dfs_lineups (1:many)

sports_data
  ├── live_odds_cache (time-series)
  ├── mlb_odds, nfl_odds, nba_odds, nhl_odds (sport-specific)
  ├── line_movement (historical tracking)
  ├── player_stats (player-specific)
  └── historical_games (completed games)

trading_engine
  ├── capital_state (singleton per user)
  ├── bet_allocations (many:1 to capital_state)
  ├── projection_priors (player projections)
  ├── bayesian_updates (update history)
  ├── edge_opportunities (value bets)
  └── arbitrage_opportunities (cross-book arbs)

ai_system
  ├── ai_response_trust (trust metrics)
  ├── ai_audit_log (audit trail)
  └── ml_projections (model outputs)
```

### 7.2 Foreign Key Relationships

```sql
-- Bet allocations reference capital state
ALTER TABLE bet_allocations
ADD CONSTRAINT fk_capital_state
FOREIGN KEY (capital_state_id) 
REFERENCES capital_state(id)
ON DELETE CASCADE;

-- Messages reference conversations
ALTER TABLE messages
ADD CONSTRAINT fk_conversation
FOREIGN KEY (conversation_id)
REFERENCES conversations(id)
ON DELETE CASCADE;

-- User bets reference users
ALTER TABLE user_bets
ADD CONSTRAINT fk_user
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;
```

---

## Part 8: Data Flow Architecture

### 8.1 Odds Data Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                  EXTERNAL ODDS API                           │
│           (The Odds API, Kalshi, etc.)                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              ODDS API CLIENT (/lib/odds-api-client.ts)      │
│  - Fetch odds with markets: h2h, spreads, totals            │
│  - Convert odds formats (American ↔ Decimal)                │
│  - Cache responses (60s TTL)                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           SUPABASE: live_odds_cache TABLE                    │
│  - Insert/Update odds data                                   │
│  - Auto-expire old records (TTL)                             │
│  - Trigger real-time updates                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ├──────────────┬──────────────┬───────────┤
                     ▼              ▼              ▼           ▼
         ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
         │   MLB_ODDS   │  │   NFL_ODDS   │  │   NBA_ODDS   │  │   NHL_ODDS   │
         │  Sport-      │  │  Sport-      │  │  Sport-      │  │  Sport-      │
         │  Specific    │  │  Specific    │  │  Specific    │  │  Specific    │
         │  Storage     │  │  Storage     │  │  Storage     │  │  Storage     │
         └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
                │                  │                  │                  │
                └──────────────────┴──────────────────┴──────────────────┘
                                        │
                                        ▼
                        ┌──────────────────────────────┐
                        │   CARDS GENERATOR            │
                        │   - Create UI cards          │
                        │   - Display odds data        │
                        │   - Show arbitrage opps      │
                        └──────────────────────────────┘
```

### 8.2 Trading Engine Flow

```
┌─────────────────────────────────────────────────────────────┐
│              ODDS + MODEL PREDICTIONS                        │
│        (Combined from API and ML models)                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│             EDGE CALCULATOR (/lib/edge.ts)                   │
│  Edge = Model Prob - Market Prob                             │
│  Filter: edge > 2%                                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           ARBITRAGE DETECTOR (/lib/arbitrage.ts)             │
│  Detect cross-bookmaker risk-free opportunities              │
│  Condition: Sum(implied probs) < 1                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           KELLY CALCULATOR (/lib/kelly.ts)                   │
│  f* = (p × decimal - 1) / b                                  │
│  Apply Kelly scale (1/4 Kelly default)                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         CAPITAL ALLOCATOR (/lib/allocator.ts)                │
│  - Sort opportunities by edge × confidence                   │
│  - Apply risk budget (25% max)                               │
│  - Cap single positions (5% max)                             │
│  - Enforce bankroll protection                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         SUPABASE: bet_allocations TABLE                      │
│  - Store all allocations                                     │
│  - Track status: pending → placed → settled                  │
│  - Calculate returns and P&L                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│       REAL-TIME UPDATES (Supabase Realtime)                  │
│  - Stream allocation changes to frontend                     │
│  - Update portfolio stats live                               │
│  - Notify on settlement                                      │
└─────────────────────────────────────────────────────────────┘
```

### 8.3 Bayesian Update Flow

```
┌─────────────────────────────────────────────────────────────┐
│              PLAYER SEASON STATS                             │
│         (Historical average and variance)                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│     SUPABASE: projection_priors TABLE                        │
│  - Prior mean (season average)                               │
│  - Prior variance (season variability)                       │
│  - Sample size (games played)                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ├──────────── Recent Games Data
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         BAYESIAN ENGINE (/lib/bayesian.ts)                   │
│  Normal-Normal Conjugate Prior Update                        │
│  Posterior = Prior + Weighted Recent Performance             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│     SUPABASE: bayesian_updates TABLE                         │
│  - Log all updates with credible intervals                   │
│  - Track update history                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│          UPDATED PLAYER PROJECTIONS                          │
│  - Use posterior mean for prop betting                       │
│  - Consider credible interval for confidence                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 9: Scalability Considerations

### 9.1 Database Size Management

```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size(current_database()));

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 9.2 Archival Strategy

```sql
-- Archive old odds data (keep last 7 days only)
DELETE FROM live_odds_cache
WHERE created_at < now() - INTERVAL '7 days';

-- Archive settled bets to historical table
INSERT INTO bet_allocations_archive
SELECT * FROM bet_allocations
WHERE status IN ('won', 'lost', 'void')
AND settled_at < now() - INTERVAL '90 days';

DELETE FROM bet_allocations
WHERE status IN ('won', 'lost', 'void')
AND settled_at < now() - INTERVAL '90 days';
```

### 9.3 Read Replicas (Pro Plan)

For high-read workloads:
1. Upgrade to Supabase Pro
2. Enable read replicas in Dashboard
3. Use replica connection for analytics queries:

```typescript
const analyticsClient = createClient(
  process.env.SUPABASE_READ_REPLICA_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

### 9.4 Connection Limits

**Free Tier:** 60 connections  
**Pro Tier:** 200 connections  
**Enterprise:** Unlimited

Monitor connections:

```sql
SELECT count(*) FROM pg_stat_activity;
```

---

## Part 10: Monitoring and Maintenance

### 10.1 Dashboard Monitoring

Supabase Dashboard provides:
- Database size and growth
- Active connections
- Query performance
- RLS policy checks
- API request counts

### 10.2 Query Performance

```sql
-- Find slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### 10.3 Automated Maintenance

Create daily cleanup job:

```sql
-- Schedule with pg_cron (if available) or external cron
SELECT cron.schedule(
  'cleanup-expired-odds',
  '0 * * * *',  -- Every hour
  $$SELECT cleanup_expired_odds_cache()$$
);
```

### 10.4 Backup Strategy

Supabase automatically backs up your database:
- **Free tier:** Daily backups, 7 days retention
- **Pro tier:** Daily backups, 30 days retention  
- **Enterprise:** Custom retention

Manual backup:

```bash
pg_dump -h db.xxx.supabase.co -U postgres -d postgres > backup.sql
```

---

## Part 11: Security Best Practices

### 11.1 Environment Variables

Never commit secrets to Git. Use Vercel environment variables:

```bash
# ❌ DON'T DO THIS
const supabaseKey = 'eyJhbGc...'  // Hardcoded secret

# ✅ DO THIS
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
```

### 11.2 Service Role Key Protection

Service role bypasses RLS. Only use in:
- Server-side API routes
- Background jobs
- Admin operations

Never expose to frontend:

```typescript
// ❌ DON'T DO THIS (client component)
'use client'
const supabaseAdmin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// ✅ DO THIS (server component or API route)
import { supabaseAdmin } from '@/lib/supabase-admin'
```

### 11.3 SQL Injection Prevention

Always use parameterized queries:

```typescript
// ❌ DON'T DO THIS
const { data } = await supabase
  .from('users')
  .select('*')
  .filter('name', 'eq', userInput)  // Vulnerable!

// ✅ DO THIS  
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('name', userInput)  // Parameterized, safe
```

### 11.4 RLS Policy Testing

Test policies before production:

```sql
-- Test as specific user
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'user-uuid';

-- Try query
SELECT * FROM bet_allocations;  -- Should only return user's bets

-- Reset
RESET ROLE;
```

---

## Part 12: Troubleshooting

### Issue 1: "Failed to execute code" / Database schema error

**Cause:** Database tables don't exist  
**Solution:** Execute `/scripts/complete-database-schema.sql` in SQL Editor

### Issue 2: "Permission denied for schema public"

**Cause:** Using wrong credentials  
**Solution:** Use service role key for admin operations

### Issue 3: RLS blocking queries

**Cause:** RLS policies too restrictive  
**Solution:** Check policies or use service role for backend operations

```sql
-- Check policies for table
SELECT * FROM pg_policies WHERE tablename = 'bet_allocations';
```

### Issue 4: Connection pool exhausted

**Cause:** Too many open connections  
**Solution:** Use connection pooling, close connections properly

```typescript
// ❌ DON'T DO THIS
const supabase = createClient(...)  // Creates new connection every time

// ✅ DO THIS
import { supabase } from '@/lib/supabase'  // Reuse singleton
```

### Issue 5: Slow queries

**Cause:** Missing indexes  
**Solution:** Add indexes for common query patterns

```sql
-- Check if index is being used
EXPLAIN ANALYZE
SELECT * FROM live_odds_cache
WHERE sport_key = 'basketball_nba'
AND expires_at > now();
```

---

## Part 13: Migration Checklist

### Before Migration
- [ ] Backup current database (if applicable)
- [ ] Export critical data
- [ ] Document current schema
- [ ] Test scripts on staging

### During Migration
- [ ] Create Supabase project OR fix current
- [ ] Configure environment variables
- [ ] Execute schema scripts in order
- [ ] Verify table creation
- [ ] Test database connections
- [ ] Enable RLS policies
- [ ] Create indexes

### After Migration
- [ ] Verify all tables exist
- [ ] Test authentication flow
- [ ] Test real-time subscriptions
- [ ] Run performance tests
- [ ] Monitor error logs
- [ ] Update documentation

### Production Deployment
- [ ] Update Vercel env vars
- [ ] Redeploy application
- [ ] Smoke test all features
- [ ] Monitor for 24 hours
- [ ] Schedule backup verification

---

## Part 14: Next Steps

### Immediate (Week 1)
1. ✅ Fix current Supabase instance by executing SQL scripts
2. ✅ Verify all tables created successfully
3. ✅ Test data insertion and retrieval
4. ✅ Confirm real-time updates working

### Short-term (Month 1)
1. Set up monitoring and alerting
2. Implement automated backups
3. Add additional RLS policies as needed
4. Optimize queries based on usage patterns
5. Document API endpoints

### Long-term (Quarter 1)
1. Implement read replicas for scaling
2. Add database caching layer (Redis)
3. Set up data analytics pipeline
4. Create admin dashboard for monitoring
5. Implement automated testing suite

---

## Conclusion

This comprehensive guide provides everything needed to integrate Supabase as your backend database. The recommended approach is to **fix your current instance** (5 minutes) rather than creating a new one (30+ minutes), as the database connection is working correctly and only tables need to be created.

### Key Takeaways

1. **Current instance is functional** - All 13 env vars configured correctly
2. **Missing tables** - Execute 2 SQL scripts to create all required tables
3. **Real-time ready** - Supabase Realtime configured for live updates
4. **Production-ready** - RLS policies, indexes, and helper functions included
5. **Scalable architecture** - Designed for growth with proper data relationships

### Support Resources

- **Supabase Docs:** https://supabase.com/docs
- **Database Scripts:** `/scripts/complete-database-schema.sql`, `/scripts/quantitative-trading-schema.sql`
- **Integration Examples:** `/lib/supabase.ts`, `/lib/supabase-data-service.ts`
- **PROJECT_TASKS.md:** Complete feature roadmap and implementation details

---

**Last Updated:** February 15, 2026  
**Version:** 3.0 - Complete Integration Plan  
**Status:** Production Ready
