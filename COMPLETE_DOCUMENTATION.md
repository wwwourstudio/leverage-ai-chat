# NFC Assistant - Complete Documentation

> **Single Source of Truth** - All project documentation consolidated into one comprehensive guide

**Last Updated**: February 2026  
**Version**: 2.0

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Environment Configuration](#environment-configuration)
3. [Integration Setup](#integration-setup)
4. [Core Features](#core-features)
   - [Real-Time Odds Integration](#real-time-odds-integration)
   - [AI Model (Grok-3)](#ai-model-grok-3)
   - [Dynamic Configuration System](#dynamic-configuration-system)
5. [System Architecture](#system-architecture)
   - [Data Flow](#data-flow)
   - [Validation Systems](#validation-systems)
6. [Troubleshooting](#troubleshooting)
7. [API Reference](#api-reference)
8. [Development Guide](#development-guide)
9. [Migration & Updates](#migration--updates)

---

# Quick Start

## Getting Started in 3 Steps

### 1. Set Up API Keys

```bash
# Required environment variables
XAI_API_KEY=your_xai_api_key              # Get from console.x.ai
ODDS_API_KEY=your_odds_api_key            # Get from the-odds-api.com
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

### 2. Choose Your Analysis Type

Click the platform buttons in the sidebar:
- **SPORTS BETTING** - For odds analysis and value bets
- **FANTASY (NFC)** - For NFBC/NFFC/NFBKC draft strategy
- **DFS** - For optimal lineup construction
- **KALSHI** - For prediction markets

### 3. Start a New Analysis

Click **"+ New Analysis"** button to get a personalized welcome message based on your selected analysis type.

### Health Check

Test your configuration:
```bash
curl https://your-domain.vercel.app/api/health | jq
```

Expected response:
```json
{
  "status": "healthy",
  "services": {
    "ai": { "configured": true, "model": "grok-3" },
    "odds": { "configured": true },
    "supabase": { "configured": true }
  }
}
```

---

# Environment Configuration

## Required Environment Variables

### Core Services

| Variable | Purpose | Where to Get It | Required |
|----------|---------|-----------------|----------|
| `XAI_API_KEY` | Grok-3 AI model access | [console.x.ai](https://console.x.ai/) | Yes |
| `ODDS_API_KEY` | Sports odds data | [the-odds-api.com](https://the-odds-api.com/) | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Database connection | Supabase project settings | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Database public access | Supabase project settings | Yes |

### Optional Services

| Variable | Purpose | Default |
|----------|---------|---------|
| `KALSHI_API_KEY` | Prediction markets | Not configured |
| `KALSHI_API_SECRET` | Prediction markets auth | Not configured |

## Vercel Setup

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add each variable with its value
4. Redeploy the application

## Local Development

Create a `.env.local` file:

```bash
# Copy from .env.example
cp .env.example .env.local

# Edit with your values
nano .env.local
```

## Environment Variable Validation

The application validates all environment variables on startup:

```typescript
// Automatic validation
const config = {
  xaiApiKey: process.env.XAI_API_KEY,
  oddsApiKey: process.env.ODDS_API_KEY,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
};

// Check /api/health for status
```

---

# Integration Setup

## Supabase Integration

### Initial Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key from Settings > API
3. Add to environment variables

### Database Schema

Run the migration scripts in order:

```bash
# 1. Trust integrity system
psql $SUPABASE_URL -f supabase/migrations/20260201_trust_integrity_system.sql

# 2. Dynamic configuration system
psql $SUPABASE_URL -f supabase/migrations/20260204_dynamic_config_system.sql
```

### Tables Created

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `ai_predictions` | Store AI predictions | model, sport, confidence, trust_metrics |
| `ai_response_trust` | Track prediction accuracy | model_id, final_confidence, flags |
| `app_config` | Dynamic configuration | key, value, category |
| `user_profiles` | User-specific data | user_id, total_invested, preferences |

### Row Level Security (RLS)

All tables have RLS enabled by default:

```sql
-- Example: app_config is readable by all
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON app_config
  FOR SELECT USING (true);
```

## The Odds API Integration

### Getting Started

1. Sign up at [the-odds-api.com](https://the-odds-api.com/)
2. Get your API key from the dashboard
3. Add to environment variables as `ODDS_API_KEY`

### Supported Sports

The application automatically validates and normalizes sport codes:

| Common Code | API Code | Sport Name |
|-------------|----------|------------|
| `nba` | `basketball_nba` | NBA Basketball |
| `nfl` | `americanfootball_nfl` | NFL Football |
| `mlb` | `baseball_mlb` | MLB Baseball |
| `nhl` | `icehockey_nhl` | NHL Hockey |
| `soccer` | `soccer_epl` | English Premier League |

### API Limits

Free tier: 500 requests/month  
Check usage: `/api/odds` response includes headers:
- `x-requests-remaining`
- `x-requests-used`

## Grok (xAI) Integration

### Setup

1. Visit [console.x.ai](https://console.x.ai/)
2. Create an API key
3. Add as `XAI_API_KEY`

### Model: Grok-3

Current version: `grok-3` (latest)

**Features:**
- Real-time sports data processing
- Superior betting market analysis
- Native probability calculations
- Fast response times (~1000ms)

### API Endpoints

Base URL: `https://api.x.ai/v1`

```typescript
// Example usage
const response = await fetch('https://api.x.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'grok-3',
    messages: [{ role: 'user', content: 'Analyze this game...' }]
  })
});
```

---

# Core Features

## Real-Time Odds Integration

### Overview

The application uses **100% live data** from The Odds API, providing:
- Live odds from multiple bookmakers
- Real-time market efficiency calculations
- Automatic line movement detection
- Best value identification across all books

### Architecture

```
Client Request → /api/cards → The Odds API → odds-transformer
                                                    ↓
                                    [Calculate Implied Probabilities]
                                    [Find Best Lines Per Bookmaker]
                                    [Detect Market Inefficiencies]
                                    [Sort by Value Opportunity]
                                                    ↓
                                    Dynamic Cards with Real Data
```

### Data Transformation Pipeline

**Step 1: Fetch Odds**
```typescript
// Validated sport code
const sportKey = validateSportKey('nba'); // → 'basketball_nba'

// Fetch from API
const odds = await fetch(
  `https://api.the-odds-api.com/v4/sports/${sportKey}/odds`
);
```

**Step 2: Transform Events**
```typescript
// Filter upcoming events (next 48 hours)
const filteredEvents = filterEventsByTimeRange(oddsData, 48);

// Calculate implied probabilities and market efficiency
const transformed = transformOddsEvents(filteredEvents);

// Sort by value opportunity
const sorted = sortEventsByValue(transformed);
```

**Step 3: Generate Cards**
```typescript
// Create betting opportunity cards
const cards = transformed.map(event => ({
  type: 'live-odds',
  matchup: `${event.home_team} vs ${event.away_team}`,
  bestLine: event.bestSpread,
  edge: event.marketEfficiency,
  confidence: event.impliedProbability,
  gameTime: event.commence_time,
  realData: true // Always live data
}));
```

### Market Efficiency Detection

The system calculates market inefficiency (opportunity) by:

1. **Comparing across bookmakers** - More price variance = more opportunity
2. **Finding outlier lines** - Lines significantly different from consensus
3. **Calculating implied probability gaps** - Difference between bookmaker odds

```typescript
// Example efficiency calculation
const efficiency = calculateMarketEfficiency(bookmakers);
// Returns: 0-10 scale (higher = more inefficiency = more opportunity)

if (efficiency > 3) {
  cardStatus = 'HOT'; // Significant value opportunity
} else {
  cardStatus = 'VALUE'; // Standard opportunity
}
```

### Supported Markets

| Market Type | API Key | Description |
|-------------|---------|-------------|
| Spread | `spreads` | Point spread betting |
| Moneyline | `h2h` | Head-to-head winner |
| Totals | `totals` | Over/under points |

### Card Types Generated

**1. Live Odds Card (Spread)**
```json
{
  "type": "live-odds",
  "title": "Live Spread Analysis",
  "data": {
    "matchup": "Lakers vs Celtics",
    "bestLine": "Lakers -5.5 (-110)",
    "book": "DraftKings",
    "edge": "+3.2%",
    "confidence": 87,
    "gameTime": "Tonight 8:00 PM"
  },
  "status": "HOT",
  "realData": true
}
```

**2. Moneyline Value Card**
```json
{
  "type": "moneyline-value",
  "title": "Moneyline Opportunity",
  "data": {
    "team": "Lakers",
    "line": "-180",
    "impliedWin": "64.3%",
    "book": "FanDuel",
    "recommendation": "Heavy favorite - consider parlay"
  },
  "status": "VALUE",
  "realData": true
}
```

**3. Totals Card**
```json
{
  "type": "totals-value",
  "title": "Total Points Analysis",
  "data": {
    "line": "Over 228.5",
    "odds": "-115",
    "book": "Caesars",
    "recommendation": "Check team pace and defensive ratings"
  },
  "status": "VALUE",
  "realData": true
}
```

### Caching Strategy

To optimize API usage and performance:

```typescript
// Cache duration by data type
const CACHE_DURATION = {
  CARDS: 5 * 60 * 1000,      // 5 minutes
  INSIGHTS: 10 * 60 * 1000,  // 10 minutes
  ODDS: 2 * 60 * 1000        // 2 minutes (most volatile)
};
```

---

## AI Model (Grok-3)

### Model Information

**Model**: `grok-3`  
**Provider**: xAI (X.AI)  
**Version**: Latest (Feb 2026)

### Why Grok-3?

| Feature | Grok-3 | GPT-4 |
|---------|--------|-------|
| Sports Context | Optimized | General |
| Response Time | ~1000ms | ~2000ms |
| Odds Analysis | Native | Requires context |
| Real-time Data | Built-in | Limited |
| Cost per 1M tokens | $5 | $30 |

### Key Capabilities

**1. Sports Intelligence**
- Understanding of betting terminology
- Knowledge of current teams, players, rosters
- Real-time game context
- Historical performance analysis

**2. Probability & Odds**
- Native probability calculations
- Implied odds understanding
- Value detection
- Risk assessment

**3. Multi-Platform Analysis**
- Sports betting strategy
- Fantasy sports advice (NFBC/NFFC)
- DFS lineup optimization
- Prediction market analysis (Kalshi)

### Trust Metrics System

Every AI response includes trust metrics:

```typescript
interface TrustMetrics {
  benfordIntegrity: number;      // 0-100: Data authenticity
  oddsAlignment: number;         // 0-100: Alignment with market
  marketConsensus: number;       // 0-100: Agreement with consensus
  historicalAccuracy: number;    // 0-100: Past prediction success
  finalConfidence: number;       // 0-100: Overall confidence
  flags: string[];              // Warnings or notes
}
```

**Example Trust Score:**
```json
{
  "benfordIntegrity": 92,
  "oddsAlignment": 88,
  "marketConsensus": 85,
  "historicalAccuracy": 87,
  "finalConfidence": 88,
  "flags": []
}
```

### System Prompt

The AI uses a specialized system prompt optimized for sports analysis:

```typescript
const SYSTEM_PROMPT = `You are an expert sports betting, fantasy sports, and prediction market analyst...

Core Capabilities:
- Sports betting analysis (NFL, NBA, MLB, NHL, Soccer)
- Fantasy sports strategy (NFBC, NFFC, NFBKC)
- DFS optimization (DraftKings, FanDuel)
- Prediction markets (Kalshi)

Analysis Guidelines:
- Provide specific, actionable insights
- Include probability assessments
- Cite real odds and market data when available
- Consider multiple perspectives
- Flag high-risk vs. high-confidence plays`;
```

### API Usage

```typescript
// Analyze endpoint
POST /api/analyze
{
  "message": "Analyze Lakers vs Celtics tonight",
  "context": {
    "sport": "NBA",
    "analysisType": "sports-betting"
  }
}

// Response includes
{
  "analysis": "...",
  "trustMetrics": { ... },
  "sources": [...],
  "dataQuality": { ... }
}
```

---

## Dynamic Configuration System

### Overview

All configuration values are stored in Supabase, eliminating hardcoded values and enabling instant updates without code deployment.

### Benefits

- **Runtime Updates**: Change settings without redeploying
- **User-Specific**: Personalize values per user
- **A/B Testing**: Test different configurations
- **Audit Trail**: Track all configuration changes
- **Fallback Support**: Graceful degradation if database unavailable

### Database Schema

**app_config table:**
```sql
CREATE TABLE app_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  category TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**user_profiles table:**
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT UNIQUE NOT NULL,
  total_invested DECIMAL(10,2) DEFAULT 0,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Configuration Keys

| Key | Category | Default | Description |
|-----|----------|---------|-------------|
| `default_invested_amount` | insights | 2500 | Default portfolio value |
| `high_confidence_threshold` | insights | 80 | Threshold for high confidence |
| `roi_scale_factor` | insights | 20 | ROI calculation multiplier |
| `default_confidence` | insights | 75 | Fallback confidence score |
| `default_win_rate` | insights | 65 | Fallback win rate percentage |

### Using Dynamic Config

**Fetch Configuration:**
```typescript
import { getConfigs } from '@/lib/dynamic-config';

const configs = await getConfigs([
  { key: 'default_invested_amount', defaultValue: 2500, category: 'insights' },
  { key: 'high_confidence_threshold', defaultValue: 80, category: 'insights' }
]);

// configs.default_invested_amount = 2500 (or DB value)
// configs.high_confidence_threshold = 80 (or DB value)
```

**Update Configuration:**
```typescript
// Via API
POST /api/config
{
  "key": "high_confidence_threshold",
  "value": 85,
  "category": "insights"
}

// Via SQL
UPDATE app_config 
SET value = '85'::jsonb, updated_at = NOW() 
WHERE key = 'high_confidence_threshold';
```

**Get User Profile:**
```typescript
import { getUserProfile } from '@/lib/dynamic-config';

const profile = await getUserProfile(userId);
// { user_id, total_invested, preferences, ... }
```

### Caching

Configuration is cached for 5 minutes to reduce database load:

```typescript
const CONFIG_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Automatic cache invalidation on updates
```

### Migration Script

```sql
-- Insert default configurations
INSERT INTO app_config (key, value, category, description) VALUES
  ('default_invested_amount', '2500', 'insights', 'Default portfolio value'),
  ('high_confidence_threshold', '80', 'insights', 'Threshold for high confidence'),
  ('roi_scale_factor', '20', 'insights', 'ROI calculation multiplier')
ON CONFLICT (key) DO NOTHING;
```

---

# System Architecture

## Data Flow

### Request Flow

```
User Input → Frontend → Data Service → API Routes → External APIs
                                            ↓
                                    [Validation Layer]
                                    [Transformation]
                                    [Caching]
                                            ↓
                                    Database (Supabase)
                                            ↓
                                    Response + Trust Metrics
```

### Component Structure

```
app/
├── api/
│   ├── analyze/route.ts      # AI analysis endpoint
│   ├── cards/route.ts        # Dynamic cards generation
│   ├── config/route.ts       # Configuration management
│   ├── health/route.ts       # Health check
│   ├── insights/route.ts     # User insights
│   └── odds/route.ts         # Odds data proxy
├── page.tsx                  # Main application UI
└── layout.tsx               # App shell

lib/
├── constants.ts             # Centralized constants
├── data-service.ts          # API client layer
├── dynamic-config.ts        # Configuration system
├── odds-transformer.ts      # Odds data processing
├── sports-validator.ts      # Sport code validation
└── supabase-validator.ts   # Database validation

supabase/
└── migrations/
    ├── 20260201_trust_integrity_system.sql
    └── 20260204_dynamic_config_system.sql
```

## Validation Systems

### 1. Sports Validation

**File**: `lib/sports-validator.ts`

**Purpose**: Validate and normalize sport codes to prevent 404 errors

```typescript
// Validates sport codes
validateSportKey('nba'); 
// Returns: { isValid: true, normalizedKey: 'basketball_nba' }

validateSportKey('invalid');
// Returns: { isValid: false, error: 'Unknown sport', suggestion: 'basketball_nba' }
```

**Features:**
- Automatic normalization (nba → basketball_nba)
- Fuzzy matching for typos
- Graceful fallback to 'upcoming'
- Comprehensive sport database

### 2. Database Validation

**File**: `lib/supabase-validator.ts`

**Purpose**: Prevent JSON parsing errors and handle missing tables

```typescript
// Safe query with validation
const result = await safeQuery(
  supabase,
  'ai_predictions',
  (builder) => builder.select('*').limit(10),
  { defaultValue: [], logErrors: true }
);

// Always returns valid data or fallback
```

**Features:**
- Table existence checking
- Data schema validation
- JSON parsing safety
- Automatic error recovery
- Detailed error logging

### 3. JSON Validation

**File**: `lib/data-service.ts`

**Purpose**: Safe JSON parsing of API responses

```typescript
// Safe JSON parser
async function safeJsonParse(response: Response) {
  const text = await response.text();
  
  if (!text || text.trim().length === 0) {
    throw new Error('Empty response');
  }
  
  try {
    return JSON.parse(text);
  } catch (error) {
    console.log('Parse error, first 200 chars:', text.substring(0, 200));
    throw new Error('Invalid JSON');
  }
}
```

**Features:**
- Empty response detection
- Detailed error logging
- Never crashes on bad JSON
- Provides debugging context

### Error Handling Strategy

**Principle**: Fail gracefully, log verbosely, always return valid data

```typescript
// Example pattern used throughout
try {
  const data = await fetchLiveData();
  return processData(data);
} catch (error) {
  console.log('[ERROR] Fetch failed:', error.message);
  console.log('[INFO] Using fallback data');
  return getFallbackData();
}
```

---

# Troubleshooting

## Common Issues

### JSON Parsing Errors

**Error**: `Unexpected token 'I', 'Invalid re'... is not valid JSON`

**Cause**: API returned error message instead of JSON

**Solutions:**
1. Check environment variables are set
2. Verify API keys are valid
3. Check database tables exist
4. Review server logs for actual error

**Status**: ✅ Fixed - Safe JSON parsing now handles all cases

### API Configuration Issues

**Error**: `API service not configured`

**Checklist:**
- [ ] `XAI_API_KEY` is set in environment
- [ ] `ODDS_API_KEY` is set in environment
- [ ] Keys haven't expired
- [ ] `/api/health` returns all services as configured

**Test API Keys:**
```bash
# Test Grok API
curl https://api.x.ai/v1/models \
  -H "Authorization: Bearer $XAI_API_KEY"

# Test Odds API
curl "https://api.the-odds-api.com/v4/sports?apiKey=$ODDS_API_KEY"
```

### Database Connection Errors

**Error**: `relation "app_config" does not exist`

**Cause**: Database migrations not run

**Solution:**
```bash
# Run migrations in order
psql $DATABASE_URL -f supabase/migrations/20260201_trust_integrity_system.sql
psql $DATABASE_URL -f supabase/migrations/20260204_dynamic_config_system.sql
```

### 404 "Unknown Sport" Error

**Error**: `Unknown sport: nba`

**Cause**: Invalid sport code sent to API

**Status**: ✅ Fixed - Sports validator automatically normalizes codes

**Manual Check:**
```typescript
import { validateSportKey } from '@/lib/sports-validator';

const result = validateSportKey('nba');
// result.normalizedKey = 'basketball_nba'
```

### Zero Dynamic Cards

**Symptom**: No cards generated despite having odds data

**Debug Steps:**

1. **Check logs for card generation:**
```
[API] Processing 5 live odds events
[API] → Step 1: Filtering events...
[API] → Step 2: Transforming odds...
[API] ✓ Generated 3 cards from live odds
```

2. **Verify odds API response:**
```bash
curl https://your-app.com/api/odds?sport=basketball_nba
```

3. **Check time filtering:**
- Events must be within next 48 hours
- Check event `commence_time` values

4. **Verify bookmaker data:**
- Events need bookmakers with markets
- Check `bookmakers` array has data

**Common Causes:**
- All events are past or too far future
- No bookmakers returned for sport
- API rate limit reached
- Sport not supported by API

### No Suggestions Generated

**Symptom**: Dynamic suggestions bar is empty

**Debug**: Check browser console for:
```
[v0] Generating dynamic suggestions based on response cards: 0
[v0] WARNING: Zero dynamic cards returned from API
```

**Causes:**
- No cards generated (see "Zero Dynamic Cards" above)
- Cards generated but conversion failed
- Frontend not receiving API response

**Solutions:**
1. Check network tab in browser DevTools
2. Verify `/api/cards` endpoint returns data
3. Check card type mapping in `convertToInsightCard()`

### Slow Response Times

**Expected Times:**
- Card generation: < 2 seconds
- AI analysis: < 3 seconds
- Odds fetching: < 1 second

**If slower:**

1. **Check caching:**
```typescript
// Should see cache hits in logs
[DataService] ✓ Returning 5 cached cards
```

2. **Check API latency:**
- Odds API should respond in ~500ms
- Grok API should respond in ~1000ms

3. **Check database performance:**
- Queries should return in < 100ms
- Check Supabase dashboard for slow queries

### Environment Variable Issues

**Error**: Variables not loading

**Vercel:**
1. Must start with `NEXT_PUBLIC_` for client-side
2. Redeploy after changing variables
3. Check Environment Variables tab in settings

**Local:**
1. Use `.env.local` (not `.env`)
2. Restart dev server after changes
3. Never commit `.env.local` to git

---

# API Reference

## Endpoints

### GET /api/health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-04T20:30:00Z",
  "services": {
    "ai": { "configured": true, "model": "grok-3" },
    "odds": { "configured": true, "requestsRemaining": 450 },
    "supabase": { "configured": true, "tables": ["app_config", "user_profiles"] }
  }
}
```

### POST /api/analyze

Analyze sports data with AI.

**Request:**
```json
{
  "message": "Should I bet on Lakers tonight?",
  "context": {
    "sport": "NBA",
    "analysisType": "sports-betting"
  },
  "attachments": []
}
```

**Response:**
```json
{
  "success": true,
  "analysis": "Based on current odds...",
  "trustMetrics": {
    "finalConfidence": 87,
    "flags": []
  },
  "sources": ["The Odds API", "Market Data"],
  "model": "grok-3"
}
```

### POST /api/cards

Generate dynamic betting cards.

**Request:**
```json
{
  "sport": "NBA",
  "category": "sports-betting",
  "limit": 5
}
```

**Response:**
```json
{
  "success": true,
  "cards": [
    {
      "type": "live-odds",
      "title": "Live Spread Analysis",
      "data": { ... },
      "realData": true
    }
  ],
  "dataSource": "live",
  "timestamp": "2026-02-04T20:30:00Z"
}
```

### GET /api/odds

Fetch live odds data.

**Query Parameters:**
- `sport` - Sport code (e.g., basketball_nba)
- `market` - Market type (spreads, h2h, totals)

**Response:**
```json
{
  "sport": "basketball_nba",
  "events": [
    {
      "id": "abc123",
      "home_team": "Lakers",
      "away_team": "Celtics",
      "commence_time": "2026-02-04T20:00:00Z",
      "bookmakers": [ ... ]
    }
  ]
}
```

### POST /api/config

Update configuration (requires auth).

**Request:**
```json
{
  "key": "high_confidence_threshold",
  "value": 85,
  "category": "insights"
}
```

**Response:**
```json
{
  "success": true,
  "config": {
    "key": "high_confidence_threshold",
    "value": 85,
    "updated_at": "2026-02-04T20:30:00Z"
  }
}
```

### GET /api/insights

Fetch user insights and statistics.

**Response:**
```json
{
  "success": true,
  "insights": {
    "totalValue": 2750,
    "winRate": 68.5,
    "roi": 10.2,
    "activeContests": 5,
    "totalInvested": 2500
  },
  "dataSource": "live"
}
```

---

# Development Guide

## Project Structure

```
nfc-assistant/
├── app/                    # Next.js 15 app directory
│   ├── api/               # API routes
│   ├── page.tsx           # Main UI
│   └── layout.tsx         # App shell
├── lib/                   # Shared utilities
│   ├── constants.ts       # App constants
│   ├── data-service.ts    # API client
│   ├── dynamic-config.ts  # Config system
│   ├── odds-transformer.ts # Odds processing
│   ├── sports-validator.ts # Sport validation
│   └── supabase-validator.ts # DB validation
├── components/            # UI components
│   └── ui/               # shadcn/ui components
├── supabase/             # Database
│   └── migrations/       # SQL migrations
└── styles/               # Global styles
```

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **UI**: React 19 + Tailwind CSS
- **Components**: shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **AI**: Grok-3 (xAI)
- **Odds**: The Odds API
- **Deployment**: Vercel

## Development Workflow

### 1. Clone and Setup

```bash
git clone <repo-url>
cd nfc-assistant
npm install
cp .env.example .env.local
# Edit .env.local with your keys
npm run dev
```

### 2. Running Locally

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### 3. Database Changes

```bash
# Create new migration
touch supabase/migrations/$(date +%Y%m%d)_description.sql

# Run migration
psql $DATABASE_URL -f supabase/migrations/20260204_description.sql
```

### 4. Testing

```bash
# Test health endpoint
curl http://localhost:3000/api/health | jq

# Test cards endpoint
curl -X POST http://localhost:3000/api/cards \
  -H "Content-Type: application/json" \
  -d '{"sport":"NBA","limit":3}' | jq
```

## Adding New Features

### Adding a New Sport

1. **Update sports validator:**
```typescript
// lib/sports-validator.ts
export const SUPPORTED_SPORTS = {
  // ... existing sports
  'tennis': {
    apiKey: 'tennis_atp',
    name: 'Tennis (ATP)',
    aliases: ['atp', 'tennis']
  }
};
```

2. **Update constants:**
```typescript
// lib/constants.ts
export const SPORTS_MAP = {
  // ... existing sports
  tennis: 'tennis_atp'
};
```

3. **Test validation:**
```typescript
const result = validateSportKey('tennis');
// Should return normalized key
```

### Adding a New Card Type

1. **Add type to constants:**
```typescript
// lib/constants.ts
export const CARD_TYPES = {
  // ... existing types
  NEW_TYPE: 'new-type'
};
```

2. **Create card generation logic:**
```typescript
// app/api/cards/route.ts
if (condition) {
  cards.push({
    type: CARD_TYPES.NEW_TYPE,
    title: 'New Card Title',
    data: { ... },
    realData: true
  });
}
```

3. **Add frontend rendering:**
```typescript
// app/page.tsx
function convertToInsightCard(card: DynamicCard) {
  if (card.type === 'new-type') {
    return {
      icon: NewIcon,
      title: card.title,
      content: card.data,
      category: card.category
    };
  }
}
```

### Adding Configuration Options

1. **Define in database:**
```sql
INSERT INTO app_config (key, value, category, description)
VALUES ('new_setting', '100', 'category', 'Description');
```

2. **Fetch in code:**
```typescript
const configs = await getConfigs([
  { key: 'new_setting', defaultValue: 100, category: 'category' }
]);
```

3. **Use in logic:**
```typescript
if (value > configs.new_setting) {
  // Apply logic
}
```

## Logging Best Practices

### Log Levels

```typescript
// INFO: Normal operation
console.log('[Service] Operation completed successfully');

// WARNING: Unexpected but handled
console.log('[Service] ⚠ Using fallback data');

// ERROR: Failed operation
console.log('[Service] ✗ Operation failed:', error.message);

// DEBUG: Detailed execution flow
console.log('[Service] → Step 1: Processing...');
console.log('[Service] ✓ Step 1 complete');
```

### Structured Logging

```typescript
console.log('[Service] ========================================');
console.log('[Service] OPERATION STARTING');
console.log('[Service] Parameters:', JSON.stringify(params, null, 2));
// ... operations ...
console.log('[Service] ✓ OPERATION COMPLETE');
console.log('[Service] ========================================');
```

## Performance Optimization

### Caching Strategy

```typescript
// Cache durations
const CACHE_DURATION = {
  CARDS: 5 * 60 * 1000,      // 5 minutes - betting cards
  INSIGHTS: 10 * 60 * 1000,  // 10 minutes - user stats
  ODDS: 2 * 60 * 1000,       // 2 minutes - live odds
  CONFIG: 5 * 60 * 1000      // 5 minutes - configuration
};
```

### Database Optimization

```sql
-- Index frequently queried columns
CREATE INDEX idx_predictions_sport ON ai_predictions(sport);
CREATE INDEX idx_predictions_created ON ai_predictions(created_at DESC);
CREATE INDEX idx_config_key ON app_config(key);
```

### API Optimization

- Use Edge Runtime for API routes
- Implement request deduplication
- Batch database queries
- Use Vercel Edge Config for hot data

---

# Migration & Updates

## Updating Dependencies

```bash
# Check for updates
npm outdated

# Update specific package
npm install <package>@latest

# Update all (careful!)
npm update
```

## Database Migrations

### Creating a Migration

```sql
-- supabase/migrations/20260204_add_new_table.sql

-- Add new table
CREATE TABLE IF NOT EXISTS new_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Enable read for all" ON new_table
  FOR SELECT USING (true);
```

### Running Migrations

```bash
# Run single migration
psql $DATABASE_URL -f supabase/migrations/20260204_add_new_table.sql

# Run all migrations
for file in supabase/migrations/*.sql; do
  psql $DATABASE_URL -f "$file"
done
```

### Rolling Back

```sql
-- Create rollback script
-- supabase/migrations/20260204_add_new_table.down.sql

DROP TABLE IF EXISTS new_table;
```

## Version History

### Version 2.0 (Feb 2026)

**Major Changes:**
- ✅ Real-time odds integration (100% live data)
- ✅ Dynamic configuration system
- ✅ Comprehensive validation layers
- ✅ Enhanced error handling and logging
- ✅ Grok-3 AI model upgrade

**Breaking Changes:**
- Removed hardcoded card generation
- Database schema changes (run migrations)
- New environment variables required

**Migration Path:**
1. Run database migrations
2. Update environment variables
3. Clear application cache
4. Redeploy

### Version 1.0 (Jan 2026)

**Initial Release:**
- Basic AI analysis
- Static card generation
- Manual configuration
- GPT-4 integration

---

# Support

## Getting Help

1. **Documentation**: You're reading it! (COMPLETE_DOCUMENTATION.md)
2. **Health Check**: Visit `/api/health` to diagnose issues
3. **Logs**: Check browser console and server logs
4. **Issues**: Create GitHub issue with:
   - Error message
   - Steps to reproduce
   - Environment (local/Vercel)
   - Browser/device info

## Debug Mode

Enable verbose logging:

```typescript
// In your code
console.log('[v0] Debug info:', debugData);

// Or set environment variable
DEBUG=true npm run dev
```

## Common Commands

```bash
# Health check
curl https://your-app.com/api/health | jq

# Test odds API
curl https://your-app.com/api/odds?sport=basketball_nba | jq

# Test AI
curl -X POST https://your-app.com/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"message":"Test"}' | jq

# Check environment
env | grep -E '(XAI|ODDS|SUPABASE)'
```

---

## Appendix

### Glossary

| Term | Definition |
|------|------------|
| **American Odds** | Betting odds format (-110, +150) |
| **Implied Probability** | Probability derived from odds |
| **Market Efficiency** | How well bookmaker odds reflect true probability |
| **Spread** | Point handicap betting |
| **Moneyline** | Straight winner betting |
| **Totals** | Over/under points betting |
| **RLS** | Row Level Security (Supabase) |
| **Edge** | Advantage over the market |
| **Trust Metrics** | AI prediction reliability scores |

### Useful Links

- **Supabase**: [supabase.com](https://supabase.com)
- **The Odds API**: [the-odds-api.com](https://the-odds-api.com)
- **xAI Console**: [console.x.ai](https://console.x.ai)
- **Vercel**: [vercel.com](https://vercel.com)
- **Next.js**: [nextjs.org](https://nextjs.org)

### License

See LICENSE file in repository.

---

**Last Updated**: February 2026  
**Version**: 2.0  
**Maintainer**: Leverage AI Team

For questions or issues, check the Troubleshooting section first or create a GitHub issue.
