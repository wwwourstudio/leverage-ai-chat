# Leverage AI — Sports Intelligence Platform

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://v0-leverage-ai-chat.vercel.app/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-Private-red?style=for-the-badge)](.)

**Leverage AI** is a production sports intelligence platform combining real-time odds ingestion, AI-powered betting analysis via Grok, MLB Statcast analytics, Kalshi prediction markets, fantasy draft tools, and quantitative trading engines — all delivered through a streaming chat interface.

**Live:** [v0-leverage-ai-chat.vercel.app](https://v0-leverage-ai-chat.vercel.app/)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Subscription Tiers](#subscription-tiers)

---

## Features

### AI Chat Engine
- **Streaming analysis** via Grok 3 Fast (xAI) with Server-Sent Events
- **Intent-aware routing** — automatically detects sport, market type, and query context from natural language
- **Live data injection** — odds, line movements, Statcast stats, and props are fetched and injected into every relevant prompt
- **Tool calling** — AI can call live endpoints mid-conversation: `get_live_odds`, `get_odds_movers`, `get_props_latest`, `query_adp`, `predict_hr`, `query_statcast`, `query_mlb_projections`, `kalshi_get_markets`
- **Anti-hallucination validation** — AI responses are cross-checked against real data
- **Deep Think mode** — extended reasoning with up to 5 tool call round-trips

### Real-Time Odds
- Live odds from [The Odds API](https://the-odds-api.com/) across NFL, NBA, MLB, NHL, NCAAF, NCAAB, MMA, tennis, soccer
- Markets: moneyline (h2h), spreads, totals, player props
- **Normalized ingestion pipeline** — flat relational schema (`games`, `sportsbooks`, `odds`, `odds_history`)
- **Line movement detection** — detects moves ≥ 1 point, stores in `line_movements` table
- **Circuit breaker + retry** — exponential backoff with jitter; circuit opens after 3 failures
- **Devigged (no-vig) probabilities** — fair probability calculations stripping bookmaker overround
- Cron ingest: odds refreshed every minute, props every 10 minutes

### Player Props
- MLB props: `batter_hits`, `batter_home_runs`, `batter_total_bases`, `pitcher_strikeouts`
- NBA/NFL/NHL props with full market coverage
- Prop line history tracking in `player_props_history`
- Prop movers endpoint — surfaces props with the biggest line changes
- Supabase persistence with 5-minute TTL cache

### Line Movement & Sharp Money
- `GET /api/odds/movers` — biggest game-level line moves via `get_biggest_line_moves()` SQL function
- `GET /api/props/movers` — prop lines with biggest deltas in a configurable window
- Sharp money signal detection (≥ 20-point move threshold)
- Direct query of `line_movements` table with full history

### MLB Analytics
- **Statcast integration** — exit velocity, barrel rate, hard-hit %, xwOBA, xBA, xSLG via Baseball Savant
- **HR probability model** — physics-based engine with live Open-Meteo weather, park factors, Statcast inputs
- **Vortex Projection Engine (VPE 3.0)** — batter and pitcher value modeling with Monte Carlo simulation
- **LeverageMetrics MLB pipeline** — DFS slate builder, fantasy adapters, betting edge cards, matchup engine
- **Benford's Law validator** — data integrity checks on statistical outputs

### Kalshi Prediction Markets
- Live market data from `api.elections.kalshi.com`
- Orderbook ingestion for top markets
- Real-time price updates via WebSocket (Zustand store)
- Sports market filtering (NBA, NFL, MLB, NHL keyword matching)
- Honest unavailability state — no fake data served when API is down

### Fantasy Sports
- **Draft engine** — Value Based Drafting (VBD) algorithm, tier cliff detection, opponent modeling
- **Waiver wire analysis** — rest-of-season projection engine
- **ADP data** — NFBC 2026 consensus (1,255 drafts, 120+ players), queryable via AI
- **DFS optimization** — lineup building with salary constraints
- Multi-sport: NFL, NBA, MLB positions all typed

### Quantitative Trading
- Kelly Criterion bet sizing with bankroll management
- Arbitrage detection across sportsbooks
- `capital_state` and `bet_allocations` persistence in Supabase
- Market intelligence signals and anomaly detection

### Weather Impact
- Live weather via [Open-Meteo](https://open-meteo.com/) (no API key required)
- Stadium coordinate database for NFL and MLB venues
- Wind direction × outfield bearing HR factor model (per-park bearing data for all 30 MLB stadiums)
- Dome detection — weather skipped for enclosed venues
- `enrichCardsWithWeather()` appends live weather cards for outdoor games

### Realtime Streaming
- `useOddsStream(sport?)` hook — subscribes to `odds`, `odds_history`, `player_props`, `line_movements` tables simultaneously
- Generic `useRealtime<T>(table, filter?)` base hook — postgres_changes INSERT/UPDATE/DELETE
- Kalshi WebSocket price feed via `useKalshiStore`

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.1 |
| Language | TypeScript (strict) | 5 |
| Styling | Tailwind CSS v4, shadcn/ui | 4.1 |
| AI | Grok 3 Fast via `@ai-sdk/xai` + Vercel AI SDK | 6.0 |
| Database | Supabase (PostgreSQL, `api` schema) | 2.93 |
| State | Zustand | 5.0 |
| Payments | Stripe | 20.4 |
| Testing | Vitest + @testing-library/react | 4.0 |
| Package Manager | **pnpm** (required) | — |
| Deployment | Vercel | — |

---

## Architecture

```
leverage-ai-chat/
├── app/
│   ├── page.tsx               # Server Component — parallel data fetch
│   ├── page-client.tsx        # Main UI (~4,300 lines)
│   └── api/                   # 45+ route handlers
│       ├── analyze/           # POST — Grok SSE streaming [60s timeout]
│       ├── odds/
│       │   ├── route.ts       # GET — live odds
│       │   ├── latest/        # GET — normalized latest odds
│       │   └── movers/        # GET — biggest line moves
│       ├── props/
│       │   ├── route.ts       # GET — player props
│       │   ├── latest/        # GET — normalized latest props
│       │   ├── movers/        # GET — prop line movers
│       │   └── history/       # GET — historical prop snapshots
│       ├── cron/
│       │   ├── odds/          # Cron — ingest odds every 1 min
│       │   └── props/         # Cron — ingest props every 10 min
│       └── ...
├── lib/
│   ├── odds/
│   │   ├── index.ts           # Core fetch with circuit breaker + cache
│   │   ├── normalizeOdds.ts   # Raw API → NormalizedOdd[]
│   │   ├── fetchOdds.ts       # Typed wrapper for fetchLiveOdds()
│   │   └── ingestOdds.ts      # Writes to normalized Supabase tables
│   ├── hooks/
│   │   ├── use-realtime.ts    # Generic Supabase realtime hook
│   │   └── useOddsStream.ts   # Composed 4-table odds stream
│   ├── mlb-projections/       # 12-module MLB pipeline
│   ├── vpe3/                  # 13-module VPE3 engine
│   ├── fantasy/               # Draft, waiver, matchup engines
│   └── ...
├── components/
│   ├── data-cards/            # 16 specialized card renderers
│   └── ...
└── scripts/
    ├── master-schema.sql      # Full DB schema (run once)
    └── add-normalized-odds-schema.sql  # Normalized odds tables migration
```

### Data Flow

```
User message
    │
    ▼
/api/analyze (Grok SSE)
    ├─ Intent detection (sport, market, tool)
    ├─ Server-side odds fetch (The Odds API)
    ├─ Line movement query (Supabase line_movement)
    ├─ Tool calls (get_live_odds / get_odds_movers / get_props_latest / ...)
    └─ Streaming response → client

Cron (every 1 min)              Cron (every 10 min)
    │                               │
    ▼                               ▼
/api/cron/odds               /api/cron/props
    │                               │
    ├─ fetchOdds(sport)             └─ fetchPlayerProps(sport)
    ├─ ingestOdds(sport)                ├─ Supabase player_props_markets
    │   ├─ api.games                    └─ line movement detection
    │   ├─ api.sportsbooks
    │   ├─ api.odds (upsert)
    │   ├─ api.odds_history (insert)
    │   └─ api.line_movements (if |Δ| ≥ 1)
    └─ live_odds_cache (upsert)
```

---

## API Reference

### Odds

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/odds` | Live odds (all formats) |
| `GET` | `/api/odds/latest` | Latest normalized odds. Params: `sport`, `market`, `limit` |
| `GET` | `/api/odds/movers` | Biggest line moves. Params: `hours` (default 24), `limit` |
| `GET` | `/api/arbitrage` | Cross-book arbitrage opportunities |
| `GET` | `/api/line-movement` | Historical line movement by `gameId` |

### Props

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/props` | Player props (cached) |
| `GET` | `/api/props/latest` | Latest normalized props. Params: `sport`, `player`, `market`, `limit` |
| `GET` | `/api/props/movers` | Props with biggest line changes. Params: `hours`, `sport`, `limit` |
| `GET` | `/api/props/history` | Prop snapshots. Params: `player_name` OR `game_id` required |

### AI & Analysis

| Method | Endpoint | Description | Timeout |
|---|---|---|---|
| `POST` | `/api/analyze` | Grok streaming analysis (SSE) | 60s |
| `GET` | `/api/cards` | Generate live data cards | 20s |
| `GET` | `/api/insights` | User betting insights | default |
| `GET` | `/api/opportunities` | Betting opportunities feed | default |
| `GET` | `/api/debug-ai` | Debug AI pipeline | default |

### MLB / Statcast

| Method | Endpoint | Description | Timeout |
|---|---|---|---|
| `GET` | `/api/mlb-projections` | MLB player projections pipeline | 25s |
| `POST` | `/api/statcast/query` | Baseball Savant Statcast query | default |
| `POST` | `/api/vpe3` | Vortex Projection Engine | default |

### Fantasy

| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/api/fantasy/leagues` | League CRUD |
| `GET` | `/api/fantasy/projections` | Player projections |
| `GET` | `/api/fantasy/waivers` | Waiver wire analysis |
| `POST` | `/api/fantasy/draft/pick` | Record draft pick |
| `POST` | `/api/fantasy/draft/simulate` | Draft simulation |
| `GET` | `/api/adp` | NFBC ADP data |

### Kalshi

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/kalshi` | Kalshi market data |
| `GET` | `/api/kalshi/markets` | All markets |
| `GET` | `/api/kalshi/trending` | Trending markets |
| `GET` | `/api/kalshi/market/[ticker]` | Single market |
| `GET` | `/api/kalshi/orderbook/[ticker]` | Market orderbook |

### System

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health check (edge runtime) |
| `GET` | `/api/weather` | Game weather (Open-Meteo) |
| `GET` | `/api/trading/arbitrage` | Advanced arbitrage analysis |
| `POST` | `/api/trading/quant` | Quantitative trading engine |

---

## Database Schema

All tables live in the `api` schema in Supabase. RLS is enabled on every table.

### Core Odds Tables (normalized pipeline)

```sql
api.games              -- sport, home_team, away_team, start_time
api.sportsbooks        -- name, key (e.g. "draftkings")
api.odds               -- game × book × market × selection (upsert)
api.odds_history       -- append-only price snapshots
api.line_movements     -- game-level moves ≥1pt (generated movement column)
```

### Props Tables

```sql
api.players            -- name, team, sport, position
api.prop_markets       -- sport, market_key, description
api.player_props       -- current lines per game × player × book × market
api.player_props_history  -- append-only prop snapshots
```

### Legacy / Cache Tables

```sql
api.live_odds_cache        -- JSONB bookmakers blob (5-min TTL)
api.player_props_markets   -- Flat prop rows (existing ingest path)
api.line_movement          -- Player-level odds deltas (singular)
```

### Analytics / Trading

```sql
api.ai_predictions         -- Stored AI analysis
api.ai_response_trust      -- Confidence scores
api.capital_state          -- Trading bankroll state
api.bet_allocations        -- Kelly-sized bet recommendations
api.arbitrage_opportunities
api.kalshi_markets
api.historical_games
```

### User / Auth

```sql
api.user_profiles
api.user_preferences
api.user_alerts
api.user_stats
api.user_insights
api.user_credits
api.chat_threads
api.chat_messages
api.app_settings
api.subscription_tiers
```

### Fantasy

```sql
api.fantasy_leagues
api.fantasy_teams
api.fantasy_rosters
api.fantasy_projections
api.waiver_transactions
api.draft_rooms
api.draft_picks
api.nfbc_adp
```

**Set up a new environment:**

```bash
# Run in Supabase SQL Editor
scripts/master-schema.sql                    # all core tables
scripts/add-normalized-odds-schema.sql       # normalized odds pipeline
```

---

## Environment Variables

| Variable | Required | Description | Source |
|---|---|---|---|
| `XAI_API_KEY` | **Yes** | Grok AI API key | [console.x.ai](https://console.x.ai/) |
| `ODDS_API_KEY` | **Yes** | Sports odds | [the-odds-api.com](https://the-odds-api.com/) |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase project URL | Supabase dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Supabase anon key | Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Admin/migration routes | Supabase dashboard |
| `KALSHI_API_KEY` | Optional | Kalshi prediction markets | [kalshi.com](https://kalshi.com/) |
| `STRIPE_SECRET_KEY` | Optional | Stripe payments | Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | Optional | Stripe webhook validation | Stripe dashboard |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Optional | Stripe client | Stripe dashboard |
| `CRON_SECRET` | Optional | Secure cron endpoints | any random string |
| `NEXT_PUBLIC_SITE_URL` | Optional | Absolute URL for internal tool calls | your Vercel URL |

> All env var access is centralized in `lib/config.ts`. Never read `process.env` directly — use `getOddsApiKey()`, `getGrokApiKey()`, `isSupabaseConfigured()`, etc.

---

## Local Development

### Prerequisites

- Node.js 20+
- **pnpm** (required — do not use npm or yarn)
- A Supabase project
- The Odds API key
- xAI API key

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/wwwourstudio/leverage-ai-chat.git
cd leverage-ai-chat

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your API keys

# 4. Set up the database
# Open Supabase SQL Editor and run:
#   scripts/master-schema.sql
#   scripts/add-normalized-odds-schema.sql

# 5. Verify setup
npx tsx scripts/check-database-health.ts

# 6. Start dev server
pnpm dev
```

The dev server runs at `http://localhost:3000`.

### Health check

```bash
curl http://localhost:3000/api/health | jq
```

Expected response:
```json
{
  "status": "healthy",
  "services": {
    "odds": { "configured": true },
    "ai": { "configured": true },
    "supabase": { "connected": true },
    "weather": { "available": true }
  }
}
```

### Key commands

```bash
pnpm dev          # Start dev server (clears .next cache first)
pnpm build        # Production build
pnpm start        # Start production server
pnpm test         # Run all tests once
pnpm test:watch   # Vitest watch mode
pnpm lint         # ESLint
```

---

## Testing

Tests live in `tests/` using Vitest + @testing-library/react.

```
tests/
├── components/     # 7 component tests
├── integration/    # 12 API route integration tests
├── fantasy/        # 2 fantasy engine unit tests
├── lib/            # 14 library unit tests
└── vpe3/           # 1 VPE3 engine test
```

The `vitest.setup.ts` mocks:
- `next/headers` and `next/navigation`
- Global `fetch` (override with `vi.spyOn`)
- Supabase env vars (localhost test values)

```bash
pnpm test                    # Run all 36 test files
pnpm test:watch              # Watch mode
pnpm test tests/lib/         # Run a specific directory
```

---

## Deployment

The app is deployed on **Vercel** and auto-syncs from the `master` branch.

### Vercel configuration

- **Build command:** `pnpm build`
- **Node version:** 20.x
- **Memory:** `NODE_OPTIONS='--max-old-space-size=4096'`
- **Function timeouts** (via `vercel.json`):
  - `/api/analyze` → 60s
  - `/api/mlb-projections` → 25s
  - `/api/cards` → 20s
  - All others → default (10s)
- **Edge runtime:** `/api/health` only
- **Cron jobs** (Vercel Cron):
  - `*/1 * * * *` → `/api/cron/odds`
  - `*/10 * * * *` → `/api/cron/props`

### Deploying a branch

Push to any branch — Vercel creates a preview deployment automatically. The `master` branch deploys to production.

### Auth middleware

This project uses `proxy.js` (not `middleware.ts`) for Supabase auth session refresh on every request. Do **not** create a `middleware.ts` file.

---

## Subscription Tiers

| Tier | Price | DFS Lineups | Features |
|---|---|---|---|
| **Free** | $0 | 0 | Basic odds, public AI analysis |
| **Core** | $49/mo | 3 | Full betting analysis, fantasy tools, props |
| **Pro** | $149/mo | 150 | All features, priority AI, advanced analytics |
| **High Stakes** | $999/yr | 150 | All Pro features, yearly discount |

Tier gating is enforced via `components/fantasy/shared/TierGate.tsx`.

---

## Key Architectural Decisions

**Why `api` schema in Supabase?**
All tables are namespaced under `api` (not `public`) for cleaner RLS and to avoid collisions with Supabase system tables.

**Why `proxy.js` instead of `middleware.ts`?**
Next.js 16 changed how middleware interacts with Supabase auth. `proxy.js` handles session refresh reliably without breaking the App Router streaming response.

**Why Tailwind v4 with no `tailwind.config.js`?**
Tailwind v4 moves all configuration into CSS custom properties in `app/globals.css`. This is the framework's recommended approach and keeps theme tokens co-located with styles.

**Why Zustand 5 with named imports?**
Zustand 5 dropped the default export. All stores use `import { create } from 'zustand'`. Both stores (`lib/store/ui-store.ts` and `lib/store/kalshi-store.ts`) are already updated.

**Why two `line_movement` tables?**
- `api.line_movement` (singular) — player-level odds delta tracking (props)
- `api.line_movements` (plural) — game-level spread/total/h2h moves from the normalized pipeline

---

## Contributing

1. Branch from `master`
2. Use `pnpm` — never `npm` or `yarn`
3. Never read `process.env` directly — use helpers from `lib/config.ts`
4. Follow the `Result<T, E>` pattern from `lib/types.ts` for fallible operations
5. All new constants in `lib/constants.ts`, never hardcoded
6. Run `pnpm test && pnpm build` before opening a PR

---

*Automatically synced with [v0.app](https://v0.app) deployments on the `master` branch.*
