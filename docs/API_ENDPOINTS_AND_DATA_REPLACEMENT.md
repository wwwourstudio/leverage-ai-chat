# API Endpoints and Data Replacement Guide

## Status: Current API Implementation

### Existing Endpoints (Fully Functional)

#### 1. `/api/analyze` - POST
**Purpose**: AI-powered analysis of user queries
**Status**: ✅ Production Ready
**Data Source**: Vercel AI Gateway (Grok AI)
**Features**:
- Real-time AI text generation
- Trust metrics calculation
- Response validation
- UUID-based response tracking

**Request Format**:
```typescript
POST /api/analyze
{
  "message": string,
  "context": {
    "sport": string | null,
    "marketType": string,
    "platform": string | null,
    "previousMessages": Array<Message>
  }
}
```

**Response Format**:
```typescript
{
  "success": boolean,
  "text": string,
  "cards": Array<InsightCard>,
  "trustMetrics": TrustMetrics,
  "model": string,
  "timestamp": string
}
```

#### 2. `/api/cards` - POST
**Purpose**: Generate dynamic insight cards from live odds data
**Status**: ✅ Production Ready  
**Data Source**: The Odds API (real-time sports betting data)
**Features**:
- Multi-sport odds fetching (NFL, NBA, MLB, NHL)
- Live odds transformation
- Market efficiency analysis
- Weather enrichment for outdoor sports

**Request Format**:
```typescript
POST /api/cards
{
  "sport": string | undefined,
  "category": string | undefined,
  "userContext": object,
  "limit": number
}
```

**Response Format**:
```typescript
{
  "success": boolean,
  "cards": Array<DynamicCard>,
  "dataSource": "live" | "simulated",
  "sportValidation": object,
  "timestamp": string
}
```

**Card Types Generated**:
- `live-odds` - Real-time spread analysis
- `moneyline-value` - Moneyline opportunities
- `totals-value` - Over/under analysis
- `dfs-strategy` - DFS insights (contextual)
- `fantasy-insight` - Fantasy draft strategy (contextual)
- `kalshi-insight` - Prediction markets (contextual)

#### 3. `/api/odds` - POST & GET
**Purpose**: Direct odds data fetching for specific sports
**Status**: ✅ Production Ready
**Data Source**: The Odds API
**Features**:
- Sport-specific odds retrieval
- Market type filtering (H2H, spreads, totals)
- Event-specific odds lookup
- Implied probability calculation

**POST Request**:
```typescript
POST /api/odds
{
  "sport": string,
  "marketType": string,
  "eventId": string | undefined
}
```

**GET Request**:
```typescript
GET /api/odds?sport=nba
```

#### 4. `/api/insights` - GET
**Purpose**: User statistics and performance insights
**Status**: ✅ Production Ready (with fallback)
**Data Source**: Supabase `ai_response_trust` table
**Features**:
- AI-enhanced database queries
- Real metrics calculation from predictions
- Dynamic configuration integration
- Schema validation
- Fallback to default insights

**Response Format**:
```typescript
{
  "success": boolean,
  "insights": {
    "totalValue": number,
    "winRate": number,
    "roi": number,
    "activeContests": number,
    "totalInvested": number,
    "avgConfidence": number
  },
  "dataSource": "live" | "default" | "fallback",
  "aiSummary": string,
  "sampleSize": number
}
```

#### 5. `/api/config` - GET & POST
**Purpose**: Dynamic configuration management
**Status**: ✅ Production Ready
**Data Source**: Supabase `system_config` table
**Features**:
- Single/multiple config fetching
- Welcome message customization
- Category-based filtering
- Cache management

#### 6. `/api/health` - GET
**Purpose**: System health check
**Status**: ✅ Production Ready
**Data Source**: All integrated services
**Features**:
- Service status monitoring
- Integration validation
- Environment variable checks

---

## Missing Endpoints (To Implement)

### Priority 1: Critical Functionality

#### `/api/dfs/lineup` - POST
**Purpose**: Generate optimal DFS lineups
**Status**: ❌ Not Implemented
**Required For**: DFS category functionality

**Implementation Plan**:
```typescript
// File: app/api/dfs/lineup/route.ts
export async function POST(req: NextRequest) {
  const { sport, slate, budget, constraints } = await req.json();
  
  // 1. Fetch player projections from Supabase
  // 2. Apply constraints (max salary, positions, exposures)
  // 3. Run optimization algorithm
  // 4. Generate multiple lineups for tournaments
  // 5. Return formatted lineup data
  
  return NextResponse.json({
    lineups: Array<Lineup>,
    totalGenerated: number,
    constraints: object,
    projections: Array<PlayerProjection>
  });
}
```

**Data Requirements**:
- Player salaries (DraftKings, FanDuel, Yahoo)
- Projections (points, ownership)
- Game info (start times, weather)
- Correlation data (QB-WR stacks)

**Database Tables Needed**:
```sql
CREATE TABLE dfs_players (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform varchar(20) NOT NULL, -- 'draftkings', 'fanduel', 'yahoo'
  sport varchar(20) NOT NULL,
  slate_id varchar(50),
  player_name varchar(100) NOT NULL,
  position varchar(10) NOT NULL,
  team varchar(10) NOT NULL,
  opponent varchar(10),
  salary integer NOT NULL,
  projected_points decimal(5,2),
  projected_ownership decimal(5,2),
  game_time timestamptz,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_dfs_players_slate ON dfs_players(slate_id, platform);
CREATE INDEX idx_dfs_players_sport ON dfs_players(sport, slate_id);
```

---

#### `/api/fantasy/draft` - POST
**Purpose**: Draft strategy and ADP analysis
**Status**: ❌ Not Implemented
**Required For**: Fantasy (NFC) category

**Implementation Plan**:
```typescript
// File: app/api/fantasy/draft/route.ts
export async function POST(req: NextRequest) {
  const { league, position, round, pickNumber, draftedPlayers } = await req.json();
  
  // 1. Fetch current ADP data from Supabase
  // 2. Calculate value over replacement (VOR)
  // 3. Identify positional runs and tier breaks
  // 4. Generate recommendations based on draft strategy
  // 5. Return player targets with reasoning
  
  return NextResponse.json({
    recommendations: Array<PlayerRecommendation>,
    tierBreaks: object,
    adpData: Array<ADPEntry>,
    strategy: string
  });
}
```

**Data Requirements**:
- Average Draft Position (ADP) by platform (NFBC, NFFC, NFBKC)
- Player projections (points, stats)
- Positional eligibility
- Injury reports
- News and updates

**Database Tables Needed**:
```sql
CREATE TABLE fantasy_adp (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform varchar(20) NOT NULL, -- 'nfbc', 'nffc', 'nfbkc'
  sport varchar(20) NOT NULL, -- 'mlb', 'nfl', 'nba'
  player_name varchar(100) NOT NULL,
  position varchar(10) NOT NULL,
  team varchar(10) NOT NULL,
  adp decimal(5,2) NOT NULL,
  min_pick integer,
  max_pick integer,
  std_dev decimal(5,2),
  sample_size integer,
  last_updated timestamptz DEFAULT NOW(),
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_fantasy_adp_platform ON fantasy_adp(platform, sport);
CREATE INDEX idx_fantasy_adp_position ON fantasy_adp(position, adp);
```

---

#### `/api/kalshi/markets` - GET
**Purpose**: Fetch Kalshi prediction markets
**Status**: ❌ Not Implemented
**Required For**: Kalshi category functionality

**Implementation Plan**:
```typescript
// File: app/api/kalshi/markets/route.ts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category'); // sports, weather, politics
  
  // 1. Fetch active markets from Kalshi API
  // 2. Calculate implied probabilities
  // 3. Compare with sportsbook odds for arbitrage
  // 4. Enrich with AI analysis
  
  return NextResponse.json({
    markets: Array<KalshiMarket>,
    arbitrageOpportunities: Array<Arbitrage>,
    recommendations: Array<string>
  });
}
```

**API Integration**:
- Kalshi API: https://api.elections.kalshi.com/docs
- Authentication: API key required
- Rate limits: Consider caching

**Environment Variable**:
```bash
KALSHI_API_KEY=your_kalshi_api_key_here
```

---

### Priority 2: Enhanced Features

#### `/api/player/props` - POST
**Purpose**: Player prop analysis and recommendations
**Status**: ❌ Not Implemented

**Implementation Plan**:
```typescript
// File: app/api/player/props/route.ts
export async function POST(req: NextRequest) {
  const { player, propType, sport } = await req.json();
  
  // 1. Fetch player statistics from database
  // 2. Get current prop lines from odds API
  // 3. Calculate historical hit rates
  // 4. Factor in matchup, pace, and usage
  // 5. Generate edge analysis
  
  return NextResponse.json({
    props: Array<PropBet>,
    analysis: string,
    confidence: number,
    historicalData: object
  });
}
```

---

#### `/api/arbitrage/scan` - GET
**Purpose**: Cross-platform arbitrage detection
**Status**: ❌ Not Implemented

**Implementation Plan**:
```typescript
// File: app/api/arbitrage/scan/route.ts
export async function GET(req: NextRequest) {
  // 1. Fetch odds from multiple sportsbooks
  // 2. Compare with Kalshi market prices
  // 3. Identify guaranteed profit opportunities
  // 4. Calculate required stakes for each side
  
  return NextResponse.json({
    opportunities: Array<ArbitrageOpportunity>,
    potentialProfit: number,
    expirationTime: string
  });
}
```

---

#### `/api/weather/impact` - POST
**Purpose**: Weather impact analysis for games
**Status**: ⚠️ Partial (enrichment exists in cards API)

**Current**: Weather enrichment is embedded in `/api/cards`
**Enhancement**: Standalone endpoint for detailed weather analysis

---

#### `/api/user/profile` - GET & PUT
**Purpose**: User profile and preferences management
**Status**: ❌ Not Implemented

**Implementation Plan**:
```typescript
// File: app/api/user/profile/route.ts
export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  
  // 1. Fetch user profile from Supabase
  // 2. Get preferences and settings
  // 3. Return portfolio and history
  
  return NextResponse.json({
    profile: UserProfile,
    preferences: object,
    stats: UserStats
  });
}

export async function PUT(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  const updates = await req.json();
  
  // 1. Validate update payload
  // 2. Update Supabase profile
  // 3. Clear relevant caches
  
  return NextResponse.json({
    success: boolean,
    profile: UserProfile
  });
}
```

**Database Table**:
```sql
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name varchar(100),
  total_invested decimal(10,2) DEFAULT 0,
  preferred_sports varchar[] DEFAULT '{}',
  preferred_platforms varchar[] DEFAULT '{}',
  risk_tolerance varchar(20) DEFAULT 'moderate',
  notification_preferences jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
```

---

## Replacing Demo Content with Production Data

### Step 1: Database Setup

**Run Migration Scripts**:
```bash
# Navigate to project root
cd /vercel/share/v0-project

# Execute migration on Supabase (if not already done)
# Option A: Via Supabase Dashboard
# 1. Go to SQL Editor in Supabase dashboard
# 2. Copy content from supabase/migrations/20260207_complete_database_setup.sql
# 3. Execute

# Option B: Via CLI
npx supabase db push
```

**Verify Tables**:
```sql
-- Run in Supabase SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'ai_response_trust',
  'system_config',
  'user_profiles',
  'dfs_players',
  'fantasy_adp'
);
```

---

### Step 2: API Key Configuration

**Required Environment Variables**:
```bash
# .env.local
ODDS_API_KEY=your_odds_api_key
XAI_API_KEY=your_xai_api_key
KALSHI_API_KEY=your_kalshi_api_key
WEATHER_API_KEY=your_openweather_api_key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Get API Keys**:
1. **The Odds API**: https://the-odds-api.com/ (free tier: 500 requests/month)
2. **xAI (Grok)**: Already configured via Vercel AI Gateway
3. **Kalshi**: https://kalshi.com/api
4. **OpenWeather**: https://openweathermap.org/api (free tier)

---

### Step 3: Data Population

#### Seed DFS Player Data:
```typescript
// scripts/seed-dfs-data.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seedDFSPlayers() {
  // Fetch from DraftKings/FanDuel APIs or scrape
  // Insert into dfs_players table
  
  const players = [
    {
      platform: 'draftkings',
      sport: 'nba',
      slate_id: 'main-2026-02-09',
      player_name: 'LeBron James',
      position: 'SF',
      team: 'LAL',
      opponent: 'GSW',
      salary: 9500,
      projected_points: 48.5,
      projected_ownership: 22.3,
      game_time: '2026-02-09T19:00:00Z'
    }
    // ... more players
  ];
  
  const { data, error } = await supabase
    .from('dfs_players')
    .insert(players);
    
  if (error) {
    console.error('Error seeding DFS data:', error);
  } else {
    console.log(`✓ Seeded ${data.length} DFS players`);
  }
}

seedDFSPlayers();
```

**Execute**:
```bash
npx tsx scripts/seed-dfs-data.ts
```

#### Seed Fantasy ADP Data:
```typescript
// scripts/seed-fantasy-adp.ts
async function seedFantasyADP() {
  // Scrape from NFBC, NFFC, NFBKC ADP pages
  // Or use fantasy API providers
  
  const adpData = [
    {
      platform: 'nfbc',
      sport: 'mlb',
      player_name: 'Shohei Ohtani',
      position: 'SP/DH',
      team: 'LAD',
      adp: 1.2,
      min_pick: 1,
      max_pick: 3,
      std_dev: 0.5,
      sample_size: 1500
    }
    // ... more players
  ];
  
  const { data, error } = await supabase
    .from('fantasy_adp')
    .insert(adpData);
}
```

---

### Step 4: Update Data Service

**Current State**: `lib/data-service.ts` uses API endpoints
**Action**: Ensure all fetch calls point to correct endpoints

**Verify Data Flow**:
```typescript
// lib/data-service.ts

// ✓ Already configured correctly
export async function fetchDynamicCards(params) {
  const response = await fetch('/api/cards', {
    method: 'POST',
    body: JSON.stringify(params)
  });
  return response.json();
}

export async function fetchUserInsights() {
  const response = await fetch('/api/insights');
  return response.json();
}
```

---

### Step 5: Remove Hardcoded Data

**Files to Check**:

1. **app/page.tsx**:
   - ✅ Already using dynamic data from `/api/insights`
   - ✅ Cards fetched from `/api/cards`
   - ✅ AI analysis from `/api/analyze`

2. **lib/data-service.ts**:
   - ✅ No hardcoded data, all API-driven

3. **app/api/cards/route.ts**:
   - ⚠️ Contextual cards (DFS, Fantasy, Kalshi) use placeholder data
   - **Action**: Replace `generateContextualCards()` with real data

**Replace Contextual Cards**:
```typescript
// app/api/cards/route.ts
function generateContextualCards(category, sport, count) {
  const cards = [];
  
  // DFS contextual card - REPLACE WITH REAL DATA
  if (category === 'dfs' || !category) {
    // BEFORE (Demo):
    cards.push({
      type: 'dfs-strategy',
      title: 'DFS Strategy Insight',
      data: {
        focus: 'Value identification in today\'s slate',
        // ... generic advice
      },
      realData: false // ❌ Demo data flag
    });
    
    // AFTER (Production):
    // Fetch from /api/dfs/lineup or database
    const topValue = await fetchTopValueDFSPlayers(sport);
    cards.push({
      type: 'dfs-lineup',
      title: 'Top Value DFS Plays',
      data: {
        players: topValue.map(p => ({
          name: p.player_name,
          salary: p.salary,
          projection: p.projected_points,
          value: p.projected_points / (p.salary / 1000)
        })),
        slate: topValue[0]?.slate_id,
        platform: 'draftkings'
      },
      realData: true // ✅ Real data
    });
  }
  
  return cards;
}
```

---

### Step 6: Testing Production Data

**Test Each Endpoint**:

```bash
# 1. Test Odds API
curl -X POST http://localhost:3000/api/odds \
  -H "Content-Type: application/json" \
  -d '{"sport":"nba","marketType":"h2h"}'

# 2. Test Cards API
curl -X POST http://localhost:3000/api/cards \
  -H "Content-Type: application/json" \
  -d '{"category":"betting","sport":"nba","limit":3}'

# 3. Test Insights API
curl http://localhost:3000/api/insights

# 4. Test Analyze API
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"message":"Best NBA bets tonight","context":{"sport":"nba","marketType":"h2h"}}'
```

**Verify Responses**:
- Check `realData: true` flag in card responses
- Verify `dataSource: "live"` instead of `"simulated"`
- Confirm actual player names, teams, odds

---

## Summary Checklist

### Currently Working (Production Ready)
- [x] `/api/analyze` - AI analysis with Grok
- [x] `/api/cards` - Dynamic cards from live odds
- [x] `/api/odds` - Sports odds fetching
- [x] `/api/insights` - User statistics (with fallback)
- [x] `/api/config` - Dynamic configuration
- [x] `/api/health` - System health check

### Missing Endpoints (Need Implementation)
- [ ] `/api/dfs/lineup` - DFS lineup optimizer
- [ ] `/api/fantasy/draft` - Fantasy draft assistant
- [ ] `/api/kalshi/markets` - Prediction markets
- [ ] `/api/player/props` - Player props analysis
- [ ] `/api/arbitrage/scan` - Arbitrage opportunities
- [ ] `/api/user/profile` - User profile management

### Data Migration Tasks
- [ ] Create `dfs_players` table
- [ ] Create `fantasy_adp` table
- [ ] Create `user_profiles` table
- [ ] Seed DFS player data
- [ ] Seed fantasy ADP data
- [ ] Configure Kalshi API integration
- [ ] Replace contextual card placeholders
- [ ] Add data refresh cron jobs

### Environment Setup
- [x] ODDS_API_KEY configured
- [x] XAI_API_KEY configured (via AI Gateway)
- [x] SUPABASE credentials configured
- [ ] KALSHI_API_KEY (needs setup)
- [x] WEATHER_API_KEY (enrichment ready)

---

## Next Steps

1. **Immediate**: Test existing production endpoints with real API keys
2. **Priority 1**: Implement DFS lineup endpoint with database
3. **Priority 2**: Implement fantasy draft endpoint
4. **Priority 3**: Integrate Kalshi markets API
5. **Ongoing**: Replace all contextual placeholders with real data
6. **Future**: Add user authentication and profile management

