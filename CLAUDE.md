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
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout (Geist font, Analytics)
│   ├── page.tsx                # Server Component — fetches data, passes to client
│   ├── page-client.tsx         # Main client UI (large: ~1600 lines)
│   ├── loading.tsx             # Suspense loading state
│   ├── globals.css             # Global styles + Tailwind + CSS vars
│   ├── api/                    # API Route Handlers
│   │   ├── analyze/route.ts    # POST — AI chat analysis (Grok)
│   │   ├── cards/route.ts      # GET  — live data cards
│   │   ├── health/route.ts     # GET  — health check (edge runtime)
│   │   ├── insights/route.ts   # GET  — user insights
│   │   ├── odds/route.ts       # GET  — sports odds
│   │   ├── kalshi/route.ts     # GET  — Kalshi prediction markets
│   │   ├── weather/route.ts    # GET  — weather data
│   │   ├── fantasy/            # Fantasy sports APIs
│   │   │   ├── leagues/        # League CRUD
│   │   │   ├── projections/    # Player projections
│   │   │   ├── waivers/        # Waiver wire analysis
│   │   │   ├── draft/pick/     # Draft pick endpoint
│   │   │   └── draft/simulate/ # Draft simulation
│   │   ├── stripe/checkout/    # Stripe payment checkout
│   │   └── admin/migrate/      # DB migration runner
│   ├── api-health/page.tsx     # Visual health check dashboard
│   ├── fantasy/leagues/new/    # Fantasy league creation page
│   └── trading/page.tsx        # Quantitative trading page
│
├── components/                 # React components
│   ├── ui/                     # shadcn/ui primitives (button, card, input, badge)
│   ├── data-cards/             # Card rendering system (see below)
│   ├── fantasy/                # Fantasy sports UI
│   │   ├── draft/              # DraftRoom, DraftBoard, PlayerQueue, PickRecommendation
│   │   ├── league-setup/       # LeagueCreator
│   │   └── shared/             # PlayerCard, PositionBadge, TierGate
│   ├── AuthModals.tsx          # Supabase auth modal (sign in / sign up)
│   ├── SettingsLightbox.tsx    # App settings overlay
│   ├── AlertsLightbox.tsx      # Alert notifications overlay
│   ├── StripeLightbox.tsx      # Stripe subscription overlay
│   ├── UserLightbox.tsx        # User profile overlay
│   ├── chat-message.tsx        # Individual chat message renderer
│   ├── message-list.tsx        # Chat message list
│   ├── mobile-chat-input.tsx   # Mobile-optimized chat input
│   ├── ai-progress-indicator.tsx
│   ├── arbitrage-dashboard.tsx
│   ├── database-status-banner.tsx
│   ├── error-boundary.tsx
│   ├── insights-dashboard.tsx
│   ├── line-movement-chart.tsx
│   ├── opportunities-feed.tsx
│   ├── trust-metrics-display.tsx
│   └── theme-provider.tsx
│
├── lib/                        # Core business logic
│   ├── constants.ts            # ALL constants (AI config, endpoints, sports map, prompts)
│   ├── config.ts               # Env validation + service status checks
│   ├── types.ts                # Shared TypeScript types + Result<T,E> pattern
│   ├── utils.ts                # cn() utility (clsx + tailwind-merge)
│   ├── data-service.ts         # fetchDynamicCards(), fetchUserInsights()
│   ├── server-data-loader.ts   # Server-side parallel data fetching
│   ├── unified-data-service.ts # Unified data orchestration layer
│   ├── cards-generator.ts      # AI-assisted card generation
│   ├── grok-pipeline.ts        # Grok AI analysis pipeline
│   ├── hallucination-detector.ts # AI output validation
│   ├── player-projections.ts   # Player prop fetching from Odds API
│   ├── player-props-service.ts # Extended player props service
│   ├── odds-transformer.ts     # Odds format conversion utilities
│   ├── odds-persistence.ts     # Odds caching to Supabase
│   ├── odds-alignment.ts       # Cross-book odds comparison
│   ├── unified-odds-fetcher.ts # Central odds fetch layer
│   ├── line-movement-tracker.ts
│   ├── statistical-monitor.ts
│   ├── benford-validator.ts    # Benford's Law data integrity checks
│   ├── logger.ts               # Structured logging
│   ├── error-handlers.ts       # Error classification + user messages
│   ├── env-validator.ts        # Environment variable validation
│   ├── dynamic-config.ts       # Runtime config from Supabase
│   ├── api-request-manager.ts  # Request deduplication + rate limiting
│   ├── active-sports-detector.ts # Detects in-season sports
│   ├── seasonal-context.ts     # Season-aware data context
│   ├── sports-validator.ts     # Sport/team validation
│   ├── weather-service.ts      # Weather fetching + impact analysis
│   ├── kalshi-client.ts        # Kalshi API client
│   ├── leveraged-ai.ts         # Core AI orchestration
│   ├── ai-database-orchestrator.ts # AI + DB coordination
│   ├── supabase-data-service.ts # Supabase data access layer
│   ├── supabase-odds-service.ts # Odds storage in Supabase
│   ├── supabase-validator.ts   # Supabase response validation
│   ├── supabase/               # Supabase client factories
│   │   ├── client.ts           # Browser client (singleton)
│   │   └── server.ts           # Server client (cookie-aware)
│   ├── fantasy/                # Fantasy sports engine
│   │   ├── types.ts            # Fantasy type definitions
│   │   ├── cards/              # Fantasy card generators
│   │   ├── draft/              # VBD calculator, tier cliffs, simulation engine
│   │   ├── matchup/            # Win probability, luck index
│   │   └── waiver/             # Waiver wire engine
│   ├── arbitrage/index.ts      # Arbitrage detection
│   ├── kelly/index.ts          # Kelly Criterion calculator
│   ├── kalshi/index.ts         # Kalshi market analysis
│   ├── odds/index.ts           # Odds utilities
│   ├── weather/index.ts        # Weather utilities
│   ├── engine/runTradingEngine.ts # Quantitative trading engine
│   ├── hooks/use-realtime.ts   # Supabase realtime React hook
│   └── data/index.ts           # Static/fallback data
│
├── tests/                      # Test files (Vitest)
│   ├── integration/            # API route integration tests
│   └── fantasy/                # Fantasy engine unit tests
│
├── scripts/                    # Database and utility scripts
│   ├── master-schema.sql       # Complete DB schema (run once in Supabase)
│   ├── check-database-health.ts
│   └── *.sql                   # Migration and fix scripts
│
├── docs/                       # Technical documentation
├── middleware.ts               # Supabase auth session refresh
├── next.config.mjs             # Next.js config (TS errors ignored in build)
├── vercel.json                 # Function timeout overrides
├── vitest.config.ts            # Test config
├── vitest.setup.ts             # Global test setup (mocks)
├── tsconfig.json               # TypeScript config (strict, paths: @/ → ./)
├── components.json             # shadcn/ui config
└── pnpm-workspace.yaml         # pnpm workspace config
```

---

## Data Cards System

The `components/data-cards/` directory contains a modular card rendering system:

- **`DynamicCardRenderer`** — Routes card data to the correct specialized component
- **`BaseCard`** — Reusable wrapper with loading/error/empty states
- **`BettingCard`** — Live odds, spreads, moneylines, totals
- **`DFSCard`** — Daily Fantasy Sports lineup strategies
- **`FantasyCard`** — Season-long fantasy insights
- **`KalshiCard`** — Prediction market opportunities
- **`WeatherCard`** — Game weather conditions
- **`ArbitrageCard`** — Cross-book arbitrage opportunities
- **`PropHitRateCard`** — Player prop historical hit rates

Card data shape:
```typescript
interface CardData {
  type: string;           // From CARD_TYPES constant
  title: string;
  category: string;       // e.g. "NBA", "DFS"
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
- Middleware (`middleware.ts`) automatically refreshes auth sessions on every request
- Auth is optional — the app degrades gracefully without a Supabase session

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

### Components

- All UI primitives live in `components/ui/` (shadcn/ui: button, card, input, badge)
- Client components must declare `'use client'` at the top
- Server components handle data fetching; pass serialized props to client components
- Use `JSON.parse(JSON.stringify(data))` at the RSC→client boundary to ensure serializability
- The `ErrorBoundary` component wraps risky client sections

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `XAI_API_KEY` | **Yes** | Grok AI API key from [console.x.ai](https://console.x.ai/) |
| `ODDS_API_KEY` | **Yes** | Sports odds from [the-odds-api.com](https://the-odds-api.com/) |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | For admin/migration routes |
| `KALSHI_API_KEY` | Optional | Kalshi prediction markets (degraded without it) |
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

Tests live in `tests/` (integration) and `tests/fantasy/` (unit). The vitest setup file (`vitest.setup.ts`) mocks:
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
| `POST` | `/api/analyze` | AI chat analysis (Grok) | 30s |
| `GET` | `/api/cards` | Generate live data cards | 20s |
| `GET` | `/api/health` | Service health check | edge |
| `GET` | `/api/insights` | User betting insights | default |
| `GET` | `/api/odds` | Fetch sports odds | default |
| `GET` | `/api/kalshi` | Kalshi market data | default |
| `GET` | `/api/weather` | Weather data for games | default |
| `GET/POST` | `/api/fantasy/*` | Fantasy league, draft, waivers | default |
| `POST` | `/api/stripe/checkout` | Create Stripe checkout session | default |
| `POST` | `/api/admin/migrate` | Run DB migrations | default |

The `/api/health` route uses Edge Runtime for fast global health checks.

---

## Database Schema

The Supabase database (schema: `api`) contains 13 tables. Key ones:

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

RLS (Row Level Security) is enabled. The `api` schema is explicitly selected in Supabase client configuration.

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
| `app/page-client.tsx` | ~1600-line main UI — the heart of the user experience |
| `app/api/analyze/route.ts` | Core AI pipeline — Grok call with odds enrichment |
| `middleware.ts` | Auth session management — runs on every request |
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

7. **`page-client.tsx` size**: The main client component is large. Navigate with search rather than scrolling. Consider refactoring large additions into sub-components.

8. **Fantasy types**: Sport positions are defined in `lib/fantasy/types.ts` and cover NFL, NBA, and MLB. Always use the `Position` union type.
