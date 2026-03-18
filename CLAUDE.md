# CLAUDE.md — Leverage AI Chat

This file provides context for AI assistants (Claude, Copilot, etc.) working in this repository. Read it before making any changes.

---

## Project Overview

**Leverage AI** is a Next.js 16 sports intelligence platform that combines:
- Real-time sports betting odds (The Odds API)
- AI-powered analysis (Grok 3 Fast via xAI)
- Fantasy sports draft/waiver engine
- Prediction market insights (Kalshi)
- Weather impact analysis (Open-Meteo, no key needed)
- MLB projections + Statcast analytics
- Quantitative trading and arbitrage detection
- Supabase for auth, persistence, and realtime data

The app was initially scaffolded with [v0.app](https://v0.app) and deployed on Vercel. It syncs automatically from `v0.app` deployments.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4, shadcn/ui |
| AI | Grok 3 Fast via `@ai-sdk/xai` + Vercel AI SDK 6 |
| Database | Supabase (PostgreSQL, `api` schema) |
| State | Zustand 5 |
| Testing | Vitest 4 + @testing-library/react |
| Package Manager | **pnpm** (required — do not use npm or yarn) |
| Deployment | Vercel |

---

## Repository Structure

```
leverage-ai-chat/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Root layout (Geist font, Analytics)
│   ├── page.tsx                      # Server Component — fetches data, passes to client
│   ├── page-client.tsx               # Main client UI (~4,300 lines — use search, not scroll)
│   ├── loading.tsx                   # Suspense loading state
│   ├── globals.css                   # Global styles + Tailwind v4 + CSS vars
│   ├── api/                          # API Route Handlers (44 routes)
│   │   ├── analyze/route.ts          # POST — AI chat analysis (Grok) [60s timeout]
│   │   ├── cards/route.ts            # GET  — live data cards [20s timeout]
│   │   ├── health/route.ts           # GET  — health check (edge runtime)
│   │   ├── insights/route.ts         # GET  — user betting insights
│   │   ├── odds/route.ts             # GET  — sports odds
│   │   ├── props/route.ts            # GET  — player props
│   │   ├── opportunities/route.ts    # GET  — betting opportunities feed
│   │   ├── kalshi/route.ts           # GET  — Kalshi prediction markets
│   │   ├── weather/route.ts          # GET  — weather data
│   │   ├── line-movement/route.ts    # GET  — historical line movement
│   │   ├── debug-ai/route.ts         # GET  — debug AI responses
│   │   ├── mlb-projections/route.ts  # GET  — MLB projections [25s timeout]
│   │   ├── statcast/query/route.ts   # POST — Baseball Statcast queries
│   │   ├── adp/upload/route.ts       # POST — ADP data upload
│   │   ├── arbitrage/route.ts        # GET  — arbitrage opportunities
│   │   ├── vpe3/route.ts             # POST — VPE3 value engine
│   │   ├── alerts/route.ts           # GET/POST — user alerts CRUD
│   │   ├── alerts/[id]/route.ts      # PATCH/DELETE — alert management
│   │   ├── alerts/check/route.ts     # GET  — alert checks
│   │   ├── alerts/suggest/route.ts   # GET  — alert suggestions
│   │   ├── chats/route.ts            # GET/POST — chat history
│   │   ├── chats/[id]/route.ts       # GET/PATCH/DELETE — chat management
│   │   ├── chats/[id]/messages/route.ts # GET/POST — chat messages
│   │   ├── settings/route.ts         # GET/PATCH — app settings
│   │   ├── settings/suggest/route.ts # GET  — settings suggestions
│   │   ├── user/profile/route.ts     # GET/PATCH — user profile
│   │   ├── user/files/route.ts       # GET/POST/DELETE — user file management
│   │   ├── user/instructions/route.ts # GET/PATCH — custom AI instructions
│   │   ├── credits/route.ts          # GET  — credit balance
│   │   ├── feedback/route.ts         # POST — user feedback
│   │   ├── metrics/historical/route.ts # GET — historical metrics
│   │   ├── trading/arbitrage/route.ts # GET — advanced arbitrage
│   │   ├── trading/quant/route.ts    # POST — quantitative trading engine
│   │   ├── fantasy/leagues/route.ts  # GET/POST — league CRUD
│   │   ├── fantasy/projections/route.ts # GET — player projections
│   │   ├── fantasy/waivers/route.ts  # GET — waiver wire analysis
│   │   ├── fantasy/draft/pick/route.ts # POST — draft pick
│   │   ├── fantasy/draft/simulate/route.ts # POST — draft simulation
│   │   ├── fantasy/subscription/route.ts # GET — subscription status
│   │   ├── stripe/checkout/route.ts  # POST — Stripe checkout session
│   │   ├── stripe/verify/route.ts    # POST — verify subscription
│   │   ├── stripe/webhook/route.ts   # POST — Stripe webhook handler
│   │   ├── admin/migrate/route.ts    # POST — DB migration runner
│   │   └── auth/callback/route.ts    # GET  — Supabase OAuth callback
│   ├── api-health/page.tsx           # Visual health check dashboard
│   ├── fantasy/leagues/new/page.tsx  # Fantasy league creation page
│   └── trading/page.tsx              # Quantitative trading page
│
├── components/                       # React components
│   ├── ui/                           # shadcn/ui primitives (button, card, input, badge)
│   ├── data-cards/                   # Card rendering system (see below)
│   ├── fantasy/                      # Fantasy sports UI
│   │   ├── draft/                    # DraftRoom, DraftBoard, PlayerQueue, PickRecommendation
│   │   ├── league-setup/             # LeagueCreator
│   │   └── shared/                   # PlayerCard, PositionBadge, TierGate
│   ├── AuthModals.tsx                # Supabase auth modal (sign in / sign up)
│   ├── Sidebar.tsx                   # Navigation sidebar
│   ├── SettingsLightbox.tsx          # App settings overlay
│   ├── AlertsLightbox.tsx            # Alert notifications overlay
│   ├── StripeLightbox.tsx            # Stripe subscription overlay
│   ├── UserLightbox.tsx              # User profile overlay
│   ├── ADPUploadModal.tsx            # ADP file upload modal
│   ├── chat-header.tsx               # Chat header with title/actions
│   ├── chat-input.tsx                # Chat message input field
│   ├── chat-message.tsx              # Individual chat message renderer (memoized)
│   ├── message-list.tsx              # Chat message list (SSE streaming)
│   ├── mobile-chat-input.tsx         # Mobile-optimized chat input
│   ├── suggested-prompts.tsx         # AI prompt suggestions
│   ├── ai-progress-indicator.tsx
│   ├── arbitrage-dashboard.tsx
│   ├── database-status-banner.tsx
│   ├── data-fallback.tsx
│   ├── error-boundary.tsx
│   ├── insights-dashboard.tsx
│   ├── line-movement-chart.tsx
│   ├── opportunities-feed.tsx
│   ├── toast-provider.tsx
│   ├── trust-metrics-display.tsx
│   └── theme-provider.tsx
│
├── lib/                              # Core business logic
│   ├── constants.ts                  # ALL constants (AI config, endpoints, sports map, prompts)
│   ├── config.ts                     # Env validation + service status checks
│   ├── types.ts                      # Shared TypeScript types + Result<T,E> pattern
│   ├── utils.ts                      # cn() utility (clsx + tailwind-merge)
│   ├── utils/index.ts                # Additional utility functions
│   ├── logger.ts                     # Structured logging
│   ├── error-handlers.ts             # Error classification + user messages
│   ├── env-validator.ts              # Environment variable validation
│   ├── dynamic-config.ts             # Runtime config from Supabase
│   ├── performance-utils.ts          # Performance optimization utilities
│   ├── data-service.ts               # fetchDynamicCards(), fetchUserInsights()
│   ├── server-data-loader.ts         # Server-side parallel data fetching
│   ├── unified-data-service.ts       # Unified data orchestration layer
│   ├── cards-generator.ts            # AI-assisted card generation
│   ├── chat-service.ts               # Chat history and context management
│   ├── data/index.ts                 # Static/fallback data
│   ├── unified-odds-fetcher.ts       # Central odds fetch layer
│   ├── odds/index.ts                 # Odds utilities and transformations
│   ├── odds-persistence.ts           # Odds caching to Supabase
│   ├── odds-transformer.ts           # Odds format conversion utilities
│   ├── odds-alignment.ts             # Cross-book odds comparison
│   ├── supabase-odds-service.ts      # Supabase odds storage
│   ├── player-projections.ts         # Player prop fetching from Odds API
│   ├── player-props-service.ts       # Extended player props service
│   ├── api-request-manager.ts        # Request deduplication + rate limiting
│   ├── grok-pipeline.ts              # Grok AI analysis pipeline
│   ├── hallucination-detector.ts     # AI output validation
│   ├── leveraged-ai.ts               # Core AI orchestration
│   ├── ai-database-orchestrator.ts   # AI + database coordination
│   ├── line-movement-tracker.ts      # Line movement tracking
│   ├── statistical-monitor.ts        # Statistical anomaly detection
│   ├── benford-validator.ts          # Benford's Law data integrity checks
│   ├── arbitrage/index.ts            # Arbitrage detection and analysis
│   ├── kelly/index.ts                # Kelly Criterion bet sizing
│   ├── engine/runTradingEngine.ts    # Quantitative trading engine
│   ├── quant/quantEngine.ts          # Quantitative analysis core
│   ├── kalshi-client.ts              # Legacy Kalshi API client
│   ├── kalshi/index.ts               # Kalshi utilities
│   ├── kalshi/kalshiClient.ts        # Current Kalshi client (api.elections.kalshi.com)
│   ├── weather-service.ts            # Weather fetching + impact analysis
│   ├── weather/index.ts              # Weather utilities
│   ├── seasonal-context.ts           # Season-aware data context
│   ├── active-sports-detector.ts     # Detects in-season sports
│   ├── sports-validator.ts           # Sport/team validation
│   ├── baseball-savant.ts            # Baseball Savant integration
│   ├── statcastQuery.ts              # Statcast data queries
│   ├── physics.ts                    # Physics calculations (e.g., home run distances)
│   ├── hrEngine.ts                   # Home run probability model
│   ├── monteCarlo.ts                 # Monte Carlo simulations
│   ├── adp-data.ts                   # ADP data utilities
│   ├── nfl-adp-data.ts               # NFL-specific ADP data
│   ├── supabase-data-service.ts      # Supabase data access layer
│   ├── supabase-validator.ts         # Supabase response validation
│   ├── supabase/client.ts            # Browser client (singleton)
│   ├── supabase/server.ts            # Server client (cookie-aware)
│   ├── supabase/proxy.ts             # Proxy configuration
│   ├── hooks/use-realtime.ts         # Supabase realtime React hook
│   ├── hooks/use-debounce.ts         # Debounce hook
│   ├── fantasy/                      # Fantasy sports engine
│   │   ├── types.ts                  # Fantasy type definitions
│   │   ├── vpe.ts                    # VPE (Value Per Expected) calculations
│   │   ├── projections-cache.ts      # Player projection caching
│   │   ├── projections-seeder.ts     # Projection data seeding
│   │   ├── cards/                    # Fantasy card generators
│   │   ├── draft/                    # VBD calculator, tier cliffs, simulation engine
│   │   │   ├── vbd-calculator.ts     # Value Based Drafting algorithm
│   │   │   ├── tier-cliff-detector.ts
│   │   │   ├── simulation-engine.ts
│   │   │   ├── opponent-model.ts
│   │   │   ├── roster-evaluator.ts
│   │   │   └── draft-utility.ts
│   │   ├── matchup/                  # Win probability, luck index
│   │   └── waiver/waiver-engine.ts   # Waiver wire engine
│   ├── mlb-projections/              # MLB projections pipeline (15 modules)
│   │   ├── index.ts                  # Entry point
│   │   ├── projection-pipeline.ts    # Core projection pipeline
│   │   ├── mlb-stats-api.ts          # MLB Stats API client
│   │   ├── statcast-client.ts        # Statcast data client
│   │   ├── matchup-engine.ts         # Pitcher vs batter matchups
│   │   ├── feature-engineering.ts    # ML feature generation
│   │   ├── models.ts                 # ML models
│   │   ├── monte-carlo.ts            # Monte Carlo simulation
│   │   ├── park-factors.ts           # Baseball park factors
│   │   ├── betting-edges.ts          # Betting edge detection
│   │   ├── dfs-adapter.ts            # DFS projection adapter
│   │   ├── fantasy-adapter.ts        # Season-long fantasy adapter
│   │   └── slate-builder.ts          # DFS slate building
│   └── vpe3/                         # VPE3 advanced value engine (13 modules)
│       ├── index.ts                  # Entry point
│       ├── engine.ts                 # Core engine
│       ├── core.ts                   # Core calculations
│       ├── types.ts                  # VPE3 type definitions
│       ├── constants.ts              # VPE3 constants
│       ├── simulation.ts             # Game simulation
│       ├── game-state.ts             # Game state tracking
│       ├── injury.ts                 # Injury impact modeling
│       ├── pitch-modeling.ts         # Pitch characteristics
│       ├── optimizer.ts              # Lineup optimization
│       ├── breakout.ts               # Breakout detection
│       ├── milb.ts                   # Minor league integration
│       └── mock-data.ts              # Mock data for testing
│
├── tests/                            # Test files (Vitest — 36 files total)
│   ├── components/                   # Component tests (7 files)
│   ├── integration/                  # API route integration tests (12 files)
│   ├── fantasy/                      # Fantasy engine unit tests (2 files)
│   ├── lib/                          # Library unit tests (14 files)
│   ├── vpe3/                         # VPE3 engine tests (1 file)
│   └── setup.ts                      # Test utilities
│
├── scripts/                          # Database and utility scripts
│   ├── master-schema.sql             # Complete DB schema (run once in Supabase)
│   ├── check-database-health.ts      # Database health check utility
│   ├── execute-migration.ts          # Migration runner
│   ├── backfill-historical-data.ts   # Historical data seeding
│   ├── diagnose-player-props.ts      # Player props diagnostics
│   └── *.sql                         # Migration and fix scripts (20+ files)
│
├── docs/                             # Technical documentation
├── .claude/                          # Claude AI workspace documentation
│   └── *.md                          # Implementation plans, troubleshooting guides
├── proxy.js                          # Supabase auth session refresh (Next.js 16)
├── next.config.mjs                   # Next.js config (TS errors ignored in build)
├── vercel.json                       # Function timeout overrides
├── vitest.config.ts                  # Test config
├── vitest.setup.ts                   # Global test setup (mocks)
├── tsconfig.json                     # TypeScript config (strict, paths: @/ → ./)
├── components.json                   # shadcn/ui config
├── postcss.config.mjs                # PostCSS with Tailwind v4 plugin
└── pnpm-workspace.yaml               # pnpm workspace config
```

---

## Data Cards System

The `components/data-cards/` directory contains a modular card rendering system with 14 specialized card types:

- **`DynamicCardRenderer`** — Routes card data to the correct specialized component
- **`BaseCard`** — Reusable wrapper with loading/error/empty states
- **`CardLayout`** — Card grid layout
- **`CardSkeleton`** — Loading skeleton
- **`DataRow`** — Reusable data row component
- **`BettingCard`** — Live odds, spreads, moneylines, totals
- **`DFSCard`** — Daily Fantasy Sports lineup strategies
- **`FantasyCard`** — Season-long fantasy insights
- **`KalshiCard`** — Prediction market opportunities
- **`WeatherCard`** — Game weather conditions
- **`ArbitrageCard`** — Cross-book arbitrage opportunities
- **`PropHitRateCard`** — Player prop historical hit rates
- **`MLBProjectionCard`** — MLB player projections
- **`StatcastCard`** — Baseball Statcast metrics
- **`ADPCard`** — Average Draft Position display
- **`VPECard`** — VPE3 engine results
- **`CompactCard`** — Compact variant for dense layouts

Card data shape:
```typescript
interface CardData {
  type: string;           // From CARD_TYPES constant
  title: string;
  category: string;       // e.g. "NBA", "DFS", "MLB"
  subcategory: string;    // e.g. "Point Spread"
  gradient: string;       // Tailwind gradient classes
  data: Record<string, string | number>;
  status: string;         // From CARD_STATUS constant
  realData?: boolean;     // true = live data, false = simulated
}
```

---

## Key Conventions

### TypeScript

- **Strict mode enabled** — no implicit `any`, always type your variables
- Use the `Result<T, E>` pattern from `lib/types.ts` for fallible operations
- Import type-only with `import type { ... }` where possible
- The `@/` alias maps to the root (e.g. `@/lib/constants`, `@/components/ui/button`)
- **Build ignores TS errors** (`ignoreBuildErrors: true`) — this is intentional for v0 compatibility, but keep code type-safe anyway

### Constants

- **Never hardcode configuration values** — use `lib/constants.ts`
- Sports identifiers use `SPORT_KEYS` (e.g. `SPORT_KEYS.NBA.API` → `'basketball_nba'`)
- Card types use `CARD_TYPES`, statuses use `CARD_STATUS`
- API endpoints use `API_ENDPOINTS`
- Log with prefixes from `LOG_PREFIXES` (e.g. `LOG_PREFIXES.API`)

### Error Handling

Use the functional `Result<T, E>` type from `lib/types.ts`:
```typescript
import { tryAsync, Ok, Err } from '@/lib/types';

const result = await tryAsync(() => fetchData());
if (!result.ok) {
  console.error(result.error.message);
}
```

All API routes return the standard `ApiResponse<T>` shape:
```typescript
{ success: boolean; data?: T; error?: string; details?: unknown }
```

### Logging

Always use the `[v0]` or service-specific prefix pattern:
```typescript
console.log('[v0] [API/analyze] Processing request...');
console.log(`${LOG_PREFIXES.API} Fetching odds...`);
```

### Supabase

- The database uses the `api` schema (configured in both client factories)
- Server-side: use `lib/supabase/server.ts` → `createClient()` (async, cookie-aware)
- Client-side: use `lib/supabase/client.ts` → `createClient()` (singleton)
- Auth session refresh is handled by `proxy.js` (not `middleware.ts`) on every request
- Auth is optional — the app degrades gracefully without a Supabase session

### Auth Middleware

**Important:** This project uses `proxy.js` (not `middleware.ts`) for auth session refresh in Next.js 16. Do not create or reference `middleware.ts` — it has been replaced.

### AI Integration

The AI pipeline uses Vercel AI SDK 6 with xAI (Grok):
```typescript
import { generateText } from 'ai';
import { createXai } from '@ai-sdk/xai';

const xai = createXai({ apiKey: process.env.XAI_API_KEY });
const { text } = await generateText({
  model: xai('grok-3-fast'),
  system: SYSTEM_PROMPT, // from lib/constants.ts
  prompt: userMessage,
});
```

The `SYSTEM_PROMPT` in `lib/constants.ts` encodes anti-hallucination rules and response formatting guidelines — do not modify it without careful consideration.

### SSE Streaming

The `/api/analyze` route uses Server-Sent Events (SSE) for streaming AI responses. The `message-list.tsx` component consumes this stream with rAF batching to prevent render storms. `chat-message.tsx` is memoized to avoid unnecessary re-renders.

### Components

- All UI primitives live in `components/ui/` (shadcn/ui: button, card, input, badge)
- Client components must declare `'use client'` at the top
- Server components handle data fetching; pass serialized props to client components
- Use `JSON.parse(JSON.stringify(data))` at the RSC→client boundary to ensure serializability
- The `ErrorBoundary` component wraps risky client sections

### Tailwind CSS v4

This project uses Tailwind CSS v4 with the `@tailwindcss/postcss` plugin. There is **no `tailwind.config.js`** file — theme configuration lives entirely in `app/globals.css` as CSS custom properties.

### Kalshi API

The current Kalshi client (`lib/kalshi/kalshiClient.ts`) uses `api.elections.kalshi.com` as the base URL. The legacy `lib/kalshi-client.ts` still exists but prefer the newer client. Do not use `trading-api.kalshi.com` or `api.kalshi.com` — both redirect with 401 errors.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `XAI_API_KEY` | **Yes** | Grok AI API key from [console.x.ai](https://console.x.ai/) |
| `ODDS_API_KEY` | **Yes** | Sports odds from [the-odds-api.com](https://the-odds-api.com/) |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | For admin/migration routes |
| `KALSHI_API_KEY_ID` | Optional | Kalshi API key ID for prediction markets |
| `KALSHI_PRIVATE_KEY` | Optional | Kalshi RSA private key for authenticated trading |
| `STRIPE_SECRET_KEY` | Optional | Stripe payment processing |

All env var access is centralized in `lib/config.ts`. Use `getGrokApiKey()`, `getOddsApiKey()`, `isSupabaseConfigured()`, etc. rather than reading `process.env` directly.

---

## Development Workflow

### Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (clears .next cache first)
pnpm build            # Production build (NODE_OPTIONS=--max-old-space-size=4096)
pnpm start            # Start production server
pnpm test             # Run Vitest tests once
pnpm test:watch       # Vitest watch mode
pnpm lint             # ESLint
```

### Local Setup

1. Copy environment variables: create `.env.local` with required vars (see above)
2. Set up Supabase database: run `scripts/master-schema.sql` in Supabase SQL Editor
3. Verify setup: `npx tsx scripts/check-database-health.ts`

### Health Check

```bash
curl http://localhost:3000/api/health | jq
```

Checks: Odds API quota, Weather API (Open-Meteo), Kalshi API, Supabase connection.

---

## Testing

Tests live in `tests/` with the following structure (36 test files total):

| Directory | Contents |
|---|---|
| `tests/components/` | 7 component tests (AuthModals, BettingCard, ChatMessage, etc.) |
| `tests/integration/` | 12 API route integration tests |
| `tests/fantasy/` | 2 fantasy engine unit tests |
| `tests/lib/` | 14 library unit tests (arbitrage, kelly, types, utils, etc.) |
| `tests/vpe3/` | 1 VPE3 engine test |

The vitest setup file (`vitest.setup.ts`) mocks:
- `next/headers` (cookies)
- `next/navigation` (router, pathname, searchParams)
- Global `fetch` (returns `{}` by default — override with `vi.spyOn`)
- Supabase env vars (uses localhost test values)

```bash
pnpm test                    # Run all tests
pnpm test:watch              # Watch mode
```

Test files must match `**/*.{test,spec}.{ts,tsx}`. The `scripts/` directory is excluded from tests.

---

## API Routes Reference

| Method | Route | Purpose | Timeout |
|---|---|---|---|
| `POST` | `/api/analyze` | AI chat analysis (Grok, SSE streaming) | **60s** |
| `GET` | `/api/cards` | Generate live data cards | 20s |
| `GET` | `/api/health` | Service health check | edge |
| `GET` | `/api/mlb-projections` | MLB player projections | 25s |
| `GET` | `/api/insights` | User betting insights | default |
| `GET` | `/api/odds` | Fetch sports odds | default |
| `GET` | `/api/props` | Player props | default |
| `GET` | `/api/opportunities` | Betting opportunities feed | default |
| `GET` | `/api/kalshi` | Kalshi market data | default |
| `GET` | `/api/weather` | Weather data for games | default |
| `GET` | `/api/line-movement` | Historical line movement | default |
| `GET` | `/api/arbitrage` | Arbitrage opportunities | default |
| `POST` | `/api/vpe3` | VPE3 value engine | default |
| `POST` | `/api/statcast/query` | Statcast baseball data | default |
| `POST` | `/api/adp/upload` | ADP data upload | default |
| `POST` | `/api/trading/quant` | Quantitative trading engine | default |
| `GET` | `/api/trading/arbitrage` | Advanced arbitrage analysis | default |
| `GET/POST` | `/api/alerts/*` | User alert management | default |
| `GET/POST` | `/api/chats/*` | Chat history management | default |
| `GET/PATCH` | `/api/settings` | App settings | default |
| `GET/PATCH` | `/api/user/*` | User profile, files, instructions | default |
| `GET/POST` | `/api/fantasy/*` | Fantasy league, draft, waivers | default |
| `POST` | `/api/stripe/checkout` | Create Stripe checkout session | default |
| `POST` | `/api/stripe/verify` | Verify subscription status | default |
| `POST` | `/api/stripe/webhook` | Stripe webhook handler | default |
| `POST` | `/api/admin/migrate` | Run DB migrations | default |
| `GET` | `/api/auth/callback` | Supabase OAuth callback | default |

The `/api/health` route uses Edge Runtime for fast global health checks.

---

## Database Schema

The Supabase database (schema: `api`) contains 13+ tables. Key ones:

| Table | Purpose |
|---|---|
| `ai_predictions` | Stored AI analysis results |
| `ai_response_trust` | Trust/confidence scores per response |
| `user_insights` | Per-user historical insights |
| `live_odds_cache` | Cached odds from The Odds API |
| `line_movement` | Historical line movement tracking |
| `player_props` | Player prop data |
| `kalshi_markets` | Kalshi prediction market data |
| `capital_state` | Trading engine bankroll state |
| `bet_allocations` | Kelly-sized bet allocations |
| `fantasy_leagues` | User fantasy league configurations |
| `fantasy_players` | Player projections and stats |
| `user_alerts` | User-defined price/odds alerts |
| `app_settings` | Per-user application settings |

RLS (Row Level Security) is enabled across all tables. The `api` schema is explicitly selected in Supabase client configuration.

---

## Subscription Tiers

The app has a multi-tier subscription model (Stripe):

| Tier | Price | DFS Lineups | Features |
|---|---|---|---|
| Free | $0 | 0 | Basic odds, public analysis |
| Core | $49/mo | 3 | Full betting analysis, fantasy tools |
| Pro | $149/mo | 150 | All features, priority AI |
| High Stakes | $999/yr | 150 | All Pro features, yearly discount |

Tier gating is enforced via `components/fantasy/shared/TierGate.tsx`.

---

## Important Files to Know

| File | Why it matters |
|---|---|
| `lib/constants.ts` | Single source of truth for all config, prompts, and enums |
| `lib/config.ts` | Env var access — use these helpers, not `process.env` directly |
| `lib/types.ts` | Error handling patterns (`Result<T,E>`, `tryAsync`, `Ok`, `Err`) |
| `app/page-client.tsx` | ~4,300-line main UI — navigate with search, not scrolling |
| `app/api/analyze/route.ts` | Core AI pipeline — Grok with SSE streaming and odds enrichment |
| `proxy.js` | Auth session management — runs on every request (replaces middleware.ts) |
| `lib/kalshi/kalshiClient.ts` | Current Kalshi client (api.elections.kalshi.com) |
| `lib/mlb-projections/index.ts` | MLB projections pipeline entry point |
| `lib/vpe3/engine.ts` | VPE3 advanced value engine |
| `scripts/master-schema.sql` | Complete DB schema — run this to set up a new environment |
| `vitest.setup.ts` | Test bootstrap — mocks Next.js internals |

---

## Deployment

Deployed on Vercel. Auto-syncs from `v0.app` for the `master` branch.

- Build command: `pnpm build` (with `NODE_OPTIONS='--max-old-space-size=4096'`)
- Framework: Next.js (auto-detected)
- Region: Global edge for `/api/health`, serverless for all other routes
- Analytics: `@vercel/analytics` injected in root layout
- Frames: iFrame embedding allowed for `v0.dev` preview

The `next.config.mjs` sets `ignoreBuildErrors: true` — this allows the Vercel build to succeed even with TypeScript errors. Do not rely on this as a reason to write sloppy types.

---

## Common Pitfalls

1. **Wrong package manager**: Always use `pnpm`. Running `npm install` will create a `package-lock.json` and break the workspace.

2. **Direct `process.env` access**: Use helpers from `lib/config.ts` — they provide type safety, validation, and error messages.

3. **Supabase schema**: The Supabase client is configured for the `api` schema. Raw queries targeting the `public` schema will fail.

4. **RSC/Client boundary**: Server components pass data to client components as props. Data must be JSON-serializable. Use `JSON.parse(JSON.stringify(data))` for complex objects.

5. **`NEXT_PUBLIC_` prefix**: Only env vars prefixed with `NEXT_PUBLIC_` are available in the browser. `XAI_API_KEY` and `ODDS_API_KEY` are server-only — never expose them to the client.

6. **Card types and statuses**: Always use `CARD_TYPES` and `CARD_STATUS` constants rather than string literals.

7. **`page-client.tsx` size**: The main client component is ~4,300 lines. Navigate with search rather than scrolling. Refactor large additions into sub-components.

8. **Fantasy types**: Sport positions are defined in `lib/fantasy/types.ts` and cover NFL, NBA, and MLB. Always use the `Position` union type.

9. **No `middleware.ts`**: Auth session refresh uses `proxy.js`, not `middleware.ts`. Do not create a `middleware.ts` file.

10. **Kalshi API hostname**: Use `api.elections.kalshi.com` (in `lib/kalshi/kalshiClient.ts`). The legacy `trading-api.kalshi.com` and `api.kalshi.com` hostnames redirect with 401 errors.

11. **Tailwind v4**: No `tailwind.config.js` — theme configuration is in `app/globals.css` as CSS variables. Use the `@tailwindcss/postcss` plugin convention.

12. **SSE streaming**: The `/api/analyze` route streams responses via SSE. Do not add `await` on the full response — consume the stream incrementally in `message-list.tsx`.
