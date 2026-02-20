# API Endpoints Implementation & Troubleshooting Plan
## Sports Analytics Application - Comprehensive Resolution Guide

**Document Version:** 1.0  
**Last Updated:** February 20, 2026  
**Status:** Production Implementation Plan

---

## Executive Summary

This document outlines a comprehensive plan to troubleshoot, implement, and verify missing API endpoints for Odds, Weather, and Kalshi integrations, as well as resolve MLB data integration issues. The plan follows industry-standard practices for API development, deployment verification, and data consistency validation.

### Current Issues Identified

1. **Missing API Endpoints**: Odds API, Weather API, and Sports data endpoints are not properly exposed
2. **MLB Data Integration**: MLB data fetching is failing (HTTP 422 errors on all player prop markets)
3. **Player Props API Failures**: All sports experiencing HTTP 422 (Unprocessable Entity) errors
4. **Weather Service**: Infrastructure exists but API key configuration is missing
5. **Kalshi Integration**: Endpoint exists but may not be properly integrated into main data flow

---

## Section 1: Root Cause Analysis

### 1.1 Missing API Endpoints

**Diagnostic Findings:**
```typescript
// Current State (from codebase analysis):
✓ /app/api/kalshi/route.ts EXISTS
✗ /app/api/odds/route.ts MISSING
✗ /app/api/weather/route.ts MISSING  
✗ /app/api/sports/route.ts MISSING
✗ /app/api/props/route.ts MISSING
```

**Why Endpoints Are Missing:**

1. **Monolithic Architecture**: The application currently serves all data through the root page (`app/page.tsx`) using server-side data loading
2. **Direct Library Calls**: Services call library functions directly (e.g., `unified-odds-fetcher.ts`) without exposing HTTP endpoints
3. **No Client-Side Data Fetching**: No SWR/React Query setup for client-side API calls

**Impact:**
- Cannot call APIs from client components
- No endpoint for external integrations or mobile apps
- Difficult to debug data fetching issues
- Cannot leverage HTTP caching strategies

### 1.2 MLB Data Integration Failures

**Debug Log Evidence:**
```
GET https://api.the-odds-api.com/v4/sports/baseball_mlb/odds?
  apiKey=6a8cb1c42cfce3d33c97ab4b99875492&
  regions=us&
  markets=player_home_runs&
  oddsFormat=american 
422 Unprocessable Entity
```

**Root Causes:**

1. **Off-Season Period**: MLB is in pre-season (February 2026) - no active games scheduled
2. **Invalid Player Prop Markets**: The Odds API returns HTTP 422 when requesting player prop markets that don't exist for the sport/season
3. **API Market Validation**: The application correctly maps markets to sports, but The Odds API rejects valid market names during off-season

**Key Insight:**  
HTTP 422 is not a code error—it's the API's way of saying "this market doesn't exist right now." The system should detect this and provide better user feedback.

### 1.3 Weather Service Configuration Gap

**Current State:**
```typescript
// lib/weather/index.ts - Implementation exists
✓ fetchWeatherForLocation() implemented
✓ getGameTimeForecast() implemented
✓ analyzeWindDirection() implemented

// Environment Configuration
✗ WEATHER_API_KEY not configured
✗ No API endpoint exposed for weather data
```

**Issue**: Weather service is fully implemented but:
- Uses free Open-Meteo API (no key required)
- No API endpoint to serve weather data to client
- Not integrated into card generation flow

---

## Section 2: Implementation Strategy

### 2.1 Phase 1: Create Missing API Endpoints (Week 1)

#### Priority 1: Odds API Endpoint

**File:** `/app/api/odds/route.ts`

**Purpose:** Expose unified odds data from The Odds API and Supabase cache

**Spec:**
```typescript
/**
 * GET /api/odds
 * Fetch live sports odds with player props
 * 
 * Query Parameters:
 * - sport: Sport key (nfl, nba, mlb, nhl, ncaaf, ncaab, epl, mls)
 * - sports: Comma-separated list of sports (multi-sport fetch)
 * - market: Market type (h2h, spreads, totals, player_props)
 * - includeProps: boolean - Include player props (default: false)
 * - useCache: boolean - Use Supabase cache (default: true)
 * - limit: number - Games per sport (default: 10)
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     [sport: string]: OddsGame[]
 *   },
 *   metadata: {
 *     timestamp: string,
 *     sources: string[],
 *     sportsCount: number,
 *     gamesCount: number
 *   },
 *   errors: string[]
 * }
 */
```

**Implementation Checklist:**
- [ ] Create `/app/api/odds/route.ts`
- [ ] Import `unified-odds-fetcher.ts` functions
- [ ] Implement GET handler with query param validation
- [ ] Add error handling for rate limits (429), invalid sports (400)
- [ ] Add Supabase caching layer
- [ ] Add response compression for large datasets
- [ ] Document endpoint in `/docs/API_QUICK_REFERENCE.md`
- [ ] Write integration test in `/tests/integration/odds-route.test.ts`

---

#### Priority 2: Weather API Endpoint

**File:** `/app/api/weather/route.ts`

**Purpose:** Provide weather data and forecasts for sporting events

**Spec:**
```typescript
/**
 * GET /api/weather
 * Fetch weather conditions for games/locations
 * 
 * Query Parameters:
 * - team: Team name for stadium lookup (e.g., "Green Bay Packers")
 * - latitude: Manual lat/long (with longitude)
 * - longitude: Manual lat/long (with latitude)
 * - gameTime: ISO 8601 datetime for forecast (optional)
 * - forecast: boolean - Include hourly forecast (default: false)
 * 
 * Response:
 * {
 *   success: boolean,
 *   current: WeatherData,
 *   forecast?: GameTimeForecast,
 *   impact: string,
 *   status: 'favorable' | 'neutral' | 'alert',
 *   stadium?: {
 *     name: string,
 *     roofType: string,
 *     coordinates: { lat: number, lon: number }
 *   }
 * }
 */
```

**Implementation Checklist:**
- [ ] Create `/app/api/weather/route.ts`
- [ ] Import functions from `lib/weather/index.ts`
- [ ] Implement stadium lookup by team name
- [ ] Add 15-minute caching via `weatherCache`
- [ ] Handle Open-Meteo API errors gracefully
- [ ] Add temperature unit conversion (C to F)
- [ ] Return game impact analysis
- [ ] Document endpoint
- [ ] Write integration test

---

#### Priority 3: Sports API Endpoint

**File:** `/app/api/sports/route.ts`

**Purpose:** Provide sport metadata, active sports, and seasonal information

**Spec:**
```typescript
/**
 * GET /api/sports
 * Get sports metadata and availability
 * 
 * Query Parameters:
 * - active: boolean - Only return sports with live games (default: false)
 * - season: boolean - Include seasonal context (default: false)
 * 
 * Response:
 * {
 *   success: boolean,
 *   sports: Array<{
 *     key: string,
 *     name: string,
 *     category: string,
 *     isActive: boolean,
 *     seasonStatus: 'in-season' | 'off-season' | 'pre-season' | 'post-season',
 *     nextGameDate?: string,
 *     markets: string[]
 *   }>,
 *   timestamp: string
 * }
 */
```

**Implementation Checklist:**
- [ ] Create `/app/api/sports/route.ts`
- [ ] Use `SPORT_KEYS` from `constants.ts`
- [ ] Integrate `active-sports-detector.ts`
- [ ] Add seasonal context from `seasonal-context.ts`
- [ ] Cache response for 1 hour
- [ ] Document endpoint
- [ ] Write unit test

---

#### Priority 4: Player Props API Endpoint

**File:** `/app/api/props/route.ts`

**Purpose:** Dedicated endpoint for player prop markets

**Spec:**
```typescript
/**
 * GET /api/props
 * Fetch player prop markets with sport-specific validation
 * 
 * Query Parameters:
 * - sport: Sport key (required)
 * - game: Game ID from The Odds API (optional - all games if omitted)
 * - market: Specific market (optional - all valid markets if omitted)
 * - player: Player name filter (optional)
 * - useCache: boolean (default: true)
 * 
 * Response:
 * {
 *   success: boolean,
 *   props: PlayerProp[],
 *   markets: string[],
 *   gamesCount: number,
 *   propsCount: number,
 *   errors: string[],
 *   metadata: {
 *     sport: string,
 *     timestamp: string,
 *     cacheHit: boolean
 *   }
 * }
 */
```

**Implementation Checklist:**
- [ ] Create `/app/api/props/route.ts`
- [ ] Import `player-props-service.ts`
- [ ] Use `getValidMarketsForSport()` for validation
- [ ] Handle HTTP 422 gracefully (return empty array, not error)
- [ ] Add rate limiting via `api-request-manager.ts`
- [ ] Cache in Supabase `player_props_markets` table
- [ ] Document endpoint
- [ ] Write integration test

---

### 2.2 Phase 2: MLB Data Integration (Week 2)

#### 2.2.1 Enhance Seasonal Detection

**File:** `lib/seasonal-context.ts`

**Changes Needed:**
```typescript
// Add MLB-specific seasonal logic
export function getMLBSeasonStatus(date: Date = new Date()): SeasonStatus {
  const month = date.getMonth(); // 0-11
  
  // MLB Season: April (3) - October (9)
  if (month >= 3 && month <= 9) {
    return {
      status: 'in-season',
      phase: month === 3 ? 'early-season' : month >= 9 ? 'playoffs' : 'regular-season',
      message: 'MLB regular season in progress',
      nextGameExpected: null
    };
  }
  
  // Off-season: November (10) - March (2)
  return {
    status: 'off-season',
    phase: month >= 1 && month <= 2 ? 'spring-training' : 'off-season',
    message: 'MLB off-season - Spring Training in February',
    nextGameExpected: new Date(date.getFullYear(), 3, 1) // April 1
  };
}
```

**Implementation Checklist:**
- [ ] Add `getMLBSeasonStatus()` function
- [ ] Update `getSportSeasonStatus()` to use MLB-specific logic
- [ ] Add season calendar constant for MLB
- [ ] Test with February date (current)
- [ ] Test with June date (in-season)

---

#### 2.2.2 Improve Empty State Messaging

**File:** `components/data-cards/EmptyState.tsx`

**Enhancement:**
```typescript
// Add season-aware empty states
interface EmptyStateProps {
  sport: string;
  seasonStatus?: SeasonStatus;
  reason: 'off-season' | 'no-data' | 'error' | 'rate-limit';
}

export function EmptyState({ sport, seasonStatus, reason }: EmptyStateProps) {
  if (reason === 'off-season' && seasonStatus) {
    return (
      <Card>
        <CardHeader>
          <CalendarIcon />
          <CardTitle>{SPORT_KEYS[sport.toUpperCase()]?.NAME} Off-Season</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{seasonStatus.message}</p>
          {seasonStatus.nextGameExpected && (
            <p>Season resumes: {formatDate(seasonStatus.nextGameExpected)}</p>
          )}
        </CardContent>
      </Card>
    );
  }
  
  // ... other empty state variants
}
```

---

#### 2.2.3 Add MLB Data Source Fallbacks

**Strategy:**
1. **Primary**: The Odds API (when season active)
2. **Secondary**: Supabase cached historical data
3. **Tertiary**: MLB Stats API (public, no key required)
4. **Fallback**: Placeholder cards with season context

**File:** `lib/mlb-data-service.ts` (NEW)

```typescript
/**
 * MLB-Specific Data Service
 * Provides multiple data sources for MLB with intelligent fallback
 */

export async function fetchMLBData(options: {
  useOdds: boolean;
  useMLBStats: boolean;
  useCache: boolean;
}): Promise<MLBDataResult> {
  const result = {
    source: 'none',
    games: [],
    players: [],
    errors: []
  };
  
  // 1. Try Odds API first (best for betting lines)
  if (options.useOdds) {
    try {
      const oddsGames = await fetchLiveOdds('baseball_mlb');
      if (oddsGames.length > 0) {
        result.source = 'odds-api';
        result.games = oddsGames;
        return result;
      }
    } catch (error) {
      result.errors.push(`Odds API: ${error.message}`);
    }
  }
  
  // 2. Try MLB Stats API (public, free, no key)
  if (options.useMLBStats) {
    try {
      const statsGames = await fetchFromMLBStatsAPI();
      if (statsGames.length > 0) {
        result.source = 'mlb-stats-api';
        result.games = statsGames;
        return result;
      }
    } catch (error) {
      result.errors.push(`MLB Stats: ${error.message}`);
    }
  }
  
  // 3. Fall back to Supabase cache
  if (options.useCache) {
    const cachedGames = await fetchFromSupabaseCache('baseball_mlb');
    if (cachedGames.length > 0) {
      result.source = 'cache';
      result.games = cachedGames;
      return result;
    }
  }
  
  return result;
}

/**
 * MLB Stats API Integration (Public, Free)
 * API Docs: https://statsapi.mlb.com/docs/
 */
async function fetchFromMLBStatsAPI(): Promise<MLBGame[]> {
  const today = new Date().toISOString().split('T')[0];
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=team,linescore`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (!data.dates || data.dates.length === 0) {
    return [];
  }
  
  const games = data.dates[0].games.map((game: any) => ({
    id: String(game.gamePk),
    sport_key: 'baseball_mlb',
    commence_time: game.gameDate,
    home_team: game.teams.home.team.name,
    away_team: game.teams.away.team.name,
    bookmakers: [] // No odds from this API
  }));
  
  return games;
}
```

**Implementation Checklist:**
- [ ] Create `lib/mlb-data-service.ts`
- [ ] Implement `fetchMLBData()` with multi-source fallback
- [ ] Add `fetchFromMLBStatsAPI()` for public MLB data
- [ ] Integrate MLB Stats API (no key required)
- [ ] Update `unified-data-service.ts` to use MLB service
- [ ] Add MLB-specific error handling
- [ ] Cache MLB Stats API responses (15 min TTL)
- [ ] Document MLB Stats API integration
- [ ] Write integration test

---

### 2.3 Phase 3: Configuration & Environment Setup (Week 2)

#### 2.3.1 Environment Variable Audit

**Current Configuration:**
```env
# Confirmed Present
✓ XAI_API_KEY
✓ ODDS_API_KEY  
✓ KALSHI_API_KEY
✓ NEXT_PUBLIC_SUPABASE_URL
✓ NEXT_PUBLIC_SUPABASE_ANON_KEY

# Missing
✗ WEATHER_API_KEY (not needed - using free Open-Meteo)
✗ NEXT_PUBLIC_SITE_URL (affects SEO and sharing)
✗ MLB_STATS_API_KEY (not needed - public API)
```

**Action Items:**
- [ ] Add `NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app`
- [ ] Document that Weather API requires no key (Open-Meteo)
- [ ] Document that MLB Stats API requires no key
- [ ] Update `.env.example` with all variables
- [ ] Add environment validation in `lib/config.ts`

---

#### 2.3.2 API Key Validation Service

**File:** `lib/api-key-validator.ts` (NEW)

```typescript
/**
 * API Key Validation Service
 * Validates all API keys on startup and provides health status
 */

export interface APIKeyStatus {
  service: string;
  configured: boolean;
  valid: boolean;
  error?: string;
  lastChecked: string;
}

export async function validateAllAPIKeys(): Promise<APIKeyStatus[]> {
  const results: APIKeyStatus[] = [];
  
  // Validate Odds API
  results.push(await validateOddsAPI());
  
  // Validate Kalshi API
  results.push(await validateKalshiAPI());
  
  // Validate XAI/Grok API
  results.push(await validateXAIAPI());
  
  // Validate Supabase
  results.push(await validateSupabase());
  
  return results;
}

async function validateOddsAPI(): Promise<APIKeyStatus> {
  const apiKey = process.env.ODDS_API_KEY;
  
  if (!apiKey) {
    return {
      service: 'The Odds API',
      configured: false,
      valid: false,
      error: 'API key not configured',
      lastChecked: new Date().toISOString()
    };
  }
  
  try {
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports?apiKey=${apiKey}`,
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (response.ok) {
      return {
        service: 'The Odds API',
        configured: true,
        valid: true,
        lastChecked: new Date().toISOString()
      };
    }
    
    return {
      service: 'The Odds API',
      configured: true,
      valid: false,
      error: `HTTP ${response.status}: ${response.statusText}`,
      lastChecked: new Date().toISOString()
    };
  } catch (error) {
    return {
      service: 'The Odds API',
      configured: true,
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString()
    };
  }
}

// Similar functions for Kalshi, XAI, and Supabase...
```

**Implementation Checklist:**
- [ ] Create `lib/api-key-validator.ts`
- [ ] Implement `validateAllAPIKeys()`
- [ ] Add validation for each service
- [ ] Create `/api/health/keys` endpoint to expose status
- [ ] Add to application startup sequence
- [ ] Log validation results to console
- [ ] Cache validation results (5 min)
- [ ] Add to monitoring dashboard

---

### 2.4 Phase 4: Data Consistency & Caching (Week 3)

#### 2.4.1 Supabase Caching Strategy

**Current Tables:**
```sql
-- Existing
✓ ai_predictions
✓ ai_response_trust
✓ user_insights
✓ player_props_markets

-- Needed
✗ odds_games_cache
✗ weather_cache
✗ sports_schedule_cache
```

**Implementation:**

**File:** `scripts/create-cache-tables.sql` (NEW)

```sql
-- Odds Games Cache
CREATE TABLE IF NOT EXISTS odds_games_cache (
  id BIGSERIAL PRIMARY KEY,
  sport TEXT NOT NULL,
  game_id TEXT NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  odds_data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(sport, game_id)
);

CREATE INDEX idx_odds_games_sport_time ON odds_games_cache(sport, commence_time);
CREATE INDEX idx_odds_games_expires ON odds_games_cache(expires_at);

-- Weather Cache
CREATE TABLE IF NOT EXISTS weather_cache (
  id BIGSERIAL PRIMARY KEY,
  location_key TEXT NOT NULL, -- "lat,lon" or team name
  weather_data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(location_key)
);

CREATE INDEX idx_weather_expires ON weather_cache(expires_at);

-- Sports Schedule Cache
CREATE TABLE IF NOT EXISTS sports_schedule_cache (
  id BIGSERIAL PRIMARY KEY,
  sport TEXT NOT NULL,
  schedule_date DATE NOT NULL,
  games_count INTEGER NOT NULL,
  games_data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(sport, schedule_date)
);

CREATE INDEX idx_schedule_sport_date ON sports_schedule_cache(sport, schedule_date);
```

**Implementation Checklist:**
- [ ] Create cache tables SQL script
- [ ] Execute script against Supabase
- [ ] Create `lib/cache-service.ts` for unified caching
- [ ] Implement TTL-based cache invalidation
- [ ] Add cache hit/miss metrics
- [ ] Set up automatic cleanup job (delete expired entries)
- [ ] Document caching strategy

---

#### 2.4.2 Cache Service Implementation

**File:** `lib/cache-service.ts` (NEW)

```typescript
/**
 * Unified Cache Service
 * Handles all Supabase caching with TTL and invalidation
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface CacheOptions {
  ttl: number; // seconds
  skipCache?: boolean;
}

export async function getCachedOdds(
  sport: string,
  options: CacheOptions = { ttl: 300 }
): Promise<any[] | null> {
  if (options.skipCache) {
    return null;
  }
  
  const { data, error } = await supabase
    .from('odds_games_cache')
    .select('*')
    .eq('sport', sport)
    .gte('expires_at', new Date().toISOString())
    .order('commence_time', { ascending: true });
  
  if (error || !data || data.length === 0) {
    return null;
  }
  
  console.log(`[Cache] HIT: ${sport} odds (${data.length} games)`);
  return data.map(row => row.odds_data);
}

export async function setCachedOdds(
  sport: string,
  games: any[],
  ttl: number = 300
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
  
  const records = games.map(game => ({
    sport,
    game_id: game.id,
    commence_time: game.commence_time,
    home_team: game.home_team,
    away_team: game.away_team,
    odds_data: game,
    expires_at: expiresAt
  }));
  
  const { error } = await supabase
    .from('odds_games_cache')
    .upsert(records, { onConflict: 'sport,game_id' });
  
  if (error) {
    console.error('[Cache] Failed to save odds:', error);
  } else {
    console.log(`[Cache] SAVED: ${sport} odds (${games.length} games, TTL: ${ttl}s)`);
  }
}

// Similar functions for weather and schedule caching...
```

**Implementation Checklist:**
- [ ] Create `lib/cache-service.ts`
- [ ] Implement `getCachedOdds()` and `setCachedOdds()`
- [ ] Implement `getCachedWeather()` and `setCachedWeather()`
- [ ] Implement `getCachedSchedule()` and `setCachedSchedule()`
- [ ] Add cache statistics tracking
- [ ] Integrate into all data fetching services
- [ ] Write unit tests for cache logic

---

## Section 3: Deployment & Verification

### 3.1 Deployment Checklist

**Pre-Deployment:**
- [ ] All API routes created and tested locally
- [ ] Environment variables configured in Vercel
- [ ] Supabase cache tables created
- [ ] API key validation passing
- [ ] Integration tests passing
- [ ] Documentation updated

**Deployment:**
- [ ] Deploy to Vercel preview environment
- [ ] Verify all API endpoints are accessible
- [ ] Check environment variables are loaded
- [ ] Test API endpoints with curl/Postman
- [ ] Verify CORS configuration
- [ ] Check API response times
- [ ] Monitor error logs

**Post-Deployment:**
- [ ] Verify production API endpoints
- [ ] Check Supabase cache population
- [ ] Monitor API rate limits
- [ ] Verify weather data fetching
- [ ] Test MLB data integration
- [ ] Check player props functionality
- [ ] Verify Kalshi integration

---

### 3.2 API Endpoint Verification Script

**File:** `scripts/verify-api-endpoints.ts` (NEW)

```typescript
/**
 * API Endpoint Verification Script
 * Tests all API endpoints and reports status
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

const endpoints = [
  { path: '/api/health', expected: 200 },
  { path: '/api/odds?sport=nba', expected: 200 },
  { path: '/api/props?sport=nba', expected: 200 },
  { path: '/api/weather?team=Green Bay Packers', expected: 200 },
  { path: '/api/sports', expected: 200 },
  { path: '/api/kalshi?type=sports', expected: 200 },
];

async function verifyEndpoint(path: string, expectedStatus: number) {
  try {
    const response = await fetch(`${BASE_URL}${path}`);
    const isSuccess = response.status === expectedStatus;
    
    return {
      path,
      status: response.status,
      expected: expectedStatus,
      passed: isSuccess,
      error: null
    };
  } catch (error) {
    return {
      path,
      status: 0,
      expected: expectedStatus,
      passed: false,
      error: error.message
    };
  }
}

async function main() {
  console.log('🔍 Verifying API Endpoints...\n');
  
  const results = await Promise.all(
    endpoints.map(e => verifyEndpoint(e.path, e.expected))
  );
  
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.path}`);
    if (!result.passed) {
      console.log(`   Expected: ${result.expected}, Got: ${result.status}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
  });
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  console.log(`\n📊 Results: ${passed}/${total} passed`);
  
  process.exit(passed === total ? 0 : 1);
}

main();
```

**Usage:**
```bash
# Run locally
npm run verify:endpoints

# Run against production
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app npm run verify:endpoints
```

---

### 3.3 Data Consistency Validation

**File:** `scripts/validate-data-consistency.ts` (NEW)

```typescript
/**
 * Data Consistency Validation Script
 * Checks data integrity across all sources
 */

async function validateMLBData() {
  console.log('🔍 Validating MLB Data Integration...');
  
  // 1. Check seasonal status
  const seasonStatus = getMLBSeasonStatus();
  console.log(`  Season Status: ${seasonStatus.status} (${seasonStatus.phase})`);
  
  // 2. Try fetching from Odds API
  try {
    const oddsGames = await fetchLiveOdds('baseball_mlb');
    console.log(`  ✓ Odds API: ${oddsGames.length} games`);
  } catch (error) {
    console.log(`  ✗ Odds API: ${error.message}`);
  }
  
  // 3. Try fetching from MLB Stats API
  try {
    const statsGames = await fetchFromMLBStatsAPI();
    console.log(`  ✓ MLB Stats API: ${statsGames.length} games`);
  } catch (error) {
    console.log(`  ✗ MLB Stats API: ${error.message}`);
  }
  
  // 4. Check cache
  const cachedGames = await getCachedOdds('baseball_mlb');
  if (cachedGames) {
    console.log(`  ✓ Cache: ${cachedGames.length} games`);
  } else {
    console.log(`  ○ Cache: empty`);
  }
}

async function validatePlayerProps() {
  console.log('\n🔍 Validating Player Props Integration...');
  
  const sports = ['nba', 'nfl', 'mlb', 'nhl'];
  
  for (const sport of sports) {
    const markets = getValidMarketsForSport(sport);
    console.log(`  ${sport}: ${markets.length} valid markets`);
    
    try {
      const props = await fetchPlayerProps(sport);
      console.log(`    ✓ Fetched ${props.length} props`);
    } catch (error) {
      console.log(`    ✗ Error: ${error.message}`);
    }
  }
}

async function validateWeatherService() {
  console.log('\n🔍 Validating Weather Service...');
  
  const testTeam = 'Green Bay Packers';
  
  try {
    const stadium = getStadiumByTeam(testTeam);
    console.log(`  ✓ Stadium lookup: ${stadium.team}`);
    
    const weather = await fetchWeatherForLocation(
      stadium.latitude,
      stadium.longitude
    );
    
    if (weather) {
      console.log(`  ✓ Weather data: ${weather.temperature}°F, ${weather.condition}`);
      console.log(`  ✓ Impact: ${getGameImpact(weather)}`);
    } else {
      console.log(`  ✗ Weather fetch failed`);
    }
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
  }
}

async function main() {
  await validateMLBData();
  await validatePlayerProps();
  await validateWeatherService();
}

main();
```

---

## Section 4: Monitoring & Maintenance

### 4.1 Error Tracking

**Implement Structured Error Logging:**

```typescript
// lib/error-tracker.ts
export function trackAPIError(context: {
  endpoint: string;
  sport?: string;
  statusCode: number;
  errorMessage: string;
  timestamp: string;
}) {
  console.error('[API-ERROR]', JSON.stringify(context));
  
  // Send to monitoring service (Sentry, Datadog, etc.)
  // sentry.captureException(context);
}
```

**Monitoring Checklist:**
- [ ] Set up error tracking (Sentry/LogRocket)
- [ ] Create dashboard for API health
- [ ] Monitor rate limit usage
- [ ] Track cache hit/miss rates
- [ ] Alert on repeated 422/429 errors
- [ ] Monitor Supabase query performance

---

### 4.2 Maintenance Schedule

**Daily:**
- Check API rate limit usage
- Review error logs for patterns
- Verify cache population

**Weekly:**
- Validate all API keys
- Review seasonal status for all sports
- Clean up expired cache entries
- Update documentation if endpoints change

**Monthly:**
- Performance audit of all endpoints
- Review and optimize Supabase queries
- Update seasonal calendars
- Test failover scenarios

---

## Section 5: Documentation Updates

### 5.1 API Documentation

**File:** `/docs/API_REFERENCE.md` (EXPAND)

Add comprehensive documentation for:
- All new endpoints with request/response examples
- Authentication requirements
- Rate limiting policies
- Error codes and handling
- Cache behavior
- Integration examples

### 5.2 Developer Onboarding

**File:** `/docs/DEVELOPER_SETUP.md` (NEW)

Include:
- Environment setup guide
- API key acquisition instructions
- Local development workflow
- Testing procedures
- Deployment process

---

## Section 6: Success Metrics

### 6.1 Key Performance Indicators

**API Availability:**
- Target: 99.9% uptime for all endpoints
- Measure: Response time < 500ms for 95th percentile

**Data Freshness:**
- Odds data: < 5 minutes stale
- Weather data: < 15 minutes stale
- Player props: < 10 minutes stale

**Error Rates:**
- Target: < 1% error rate across all endpoints
- Zero uncaught exceptions in production

**Cache Performance:**
- Target: > 70% cache hit rate
- Supabase query time < 100ms

### 6.2 Validation Criteria

**Phase 1 Complete:**
- [ ] All 4 API endpoints deployed and accessible
- [ ] Each endpoint returns valid JSON responses
- [ ] Error handling working for all error scenarios

**Phase 2 Complete:**
- [ ] MLB data integration working with multiple sources
- [ ] Seasonal detection accurate for all sports
- [ ] Empty states showing contextual messages

**Phase 3 Complete:**
- [ ] All API keys validated and working
- [ ] Environment variables properly configured
- [ ] Health endpoint reporting accurate status

**Phase 4 Complete:**
- [ ] Supabase caching implemented and tested
- [ ] Cache hit rate > 70%
- [ ] TTL-based invalidation working

---

## Appendix A: Quick Reference Commands

```bash
# Start local development
npm run dev

# Verify API endpoints
npm run verify:endpoints

# Validate data consistency
npm run validate:data

# Run integration tests
npm test -- --grep "API Integration"

# Check TypeScript compilation
npm run type-check

# Deploy to preview
vercel --prod=false

# Deploy to production
vercel --prod
```

---

## Appendix B: Error Code Reference

| Code | Meaning | Resolution |
|------|---------|------------|
| 400  | Bad Request | Check query parameters |
| 401  | Unauthorized | Verify API key |
| 404  | Not Found | Check endpoint URL |
| 422  | Unprocessable Entity | Market/sport not available (expected during off-season) |
| 429  | Rate Limit Exceeded | Implement request throttling |
| 500  | Internal Server Error | Check server logs |
| 503  | Service Unavailable | External API down, use cache |

---

## Appendix C: External API Documentation Links

- **The Odds API:** https://the-odds-api.com/liveapi/guides/v4/
- **Kalshi API:** https://trading-api.readme.io/reference/
- **Open-Meteo Weather:** https://open-meteo.com/en/docs
- **MLB Stats API:** https://statsapi.mlb.com/docs/
- **Supabase Docs:** https://supabase.com/docs

---

## Document Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-20 | 1.0 | Initial comprehensive plan created |

---

**Next Steps:**
1. Review and approve this plan
2. Begin Phase 1 implementation (API endpoints)
3. Set up monitoring and validation scripts
4. Deploy to preview environment for testing
5. Iterate based on test results

**Estimated Timeline:** 3 weeks for full implementation and verification
