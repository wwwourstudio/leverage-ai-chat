# Leverage AI

> AI-powered sports intelligence — live odds, player props, line movement, fantasy analytics, and Statcast metrics, all through a streaming chat interface.

**[Live app →](https://v0-leverage-ai-chat.vercel.app/)**

---

## What it does

You talk to it. It knows the lines.

Ask about tonight's NBA spreads and it pulls live odds across every major sportsbook. Ask about sharp money on the Chiefs and it surfaces line movement from the last 24 hours. Ask who to start in your fantasy lineup and it runs a projection engine. Ask about a pitcher's exit velocity allowed and it hits Baseball Savant directly.

The AI (Grok 3 Fast) has tool access to every data source — it decides what to fetch based on what you're asking, not based on what tab you're on.

---

## Stack

| | |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript (strict) |
| AI | Grok 3 Fast · Vercel AI SDK 6 · SSE streaming |
| Database | Supabase PostgreSQL (`api` schema) |
| Odds | The Odds API v4 |
| Styling | Tailwind CSS v4 · shadcn/ui |
| State | Zustand 5 |
| Payments | Stripe |
| Tests | Vitest · @testing-library/react |
| Deploy | Vercel |
| Package manager | pnpm (required) |

---

## Features

**Live odds**
- NFL, NBA, MLB, NHL, NCAAF, NCAAB, MMA, tennis, soccer
- Markets: moneyline, spreads, totals, player props
- Normalized ingestion into `games → sportsbooks → odds` relational tables
- Arbitrage detection across books
- Devigged (no-vig) probabilities

**Line movement**
- Every odds change ≥ 1 point written to `line_movements`
- `GET /api/odds/movers` — biggest moves in configurable window
- `get_biggest_line_moves(hours)` SQL function for fast aggregation
- Sharp money signals surfaced in AI responses

**Player props**
- MLB: hits, home runs, total bases, strikeouts
- NBA/NFL/NHL full market coverage
- Prop history tracking with `player_props_history`
- `GET /api/props/movers` — props with biggest line changes
- `GET /api/props/history` — snapshot timeline per player or game

**MLB analytics**
- Statcast data via Baseball Savant (exit velocity, barrel %, xwOBA, xBA, xSLG)
- HR probability model — physics engine + wind (Open-Meteo) + park factors
- VPE 3.0 — Vortex Projection Engine with Monte Carlo simulation
- Full DFS slate builder and fantasy adapters

**Kalshi prediction markets**
- Live market data from `api.elections.kalshi.com`
- Sports market filtering and orderbook ingestion
- Real-time price updates via WebSocket

**Fantasy sports**
- Value Based Drafting (VBD) algorithm with tier cliff detection
- Waiver wire projection engine
- NFBC 2026 ADP consensus (1,255 drafts, 120+ players)
- DFS lineup optimizer with salary constraints
- NFL, NBA, MLB

**Realtime data**
- `useOddsStream(sport?)` — subscribes to odds, history, player props, and line movements simultaneously
- Built on `useRealtime<T>()` — generic postgres_changes hook (INSERT/UPDATE/DELETE)

---

## API routes

### Odds
```
GET /api/odds/latest     ?sport &market &limit
GET /api/odds/movers     ?hours &limit
GET /api/odds            (cached, all formats)
GET /api/arbitrage
GET /api/line-movement   ?gameId
```

### Props
```
GET /api/props/latest    ?sport &player &market &limit
GET /api/props/movers    ?hours &sport &limit
GET /api/props/history   ?player_name OR game_id  &market &from &to
GET /api/props           (cached)
```

### AI
```
POST /api/analyze        SSE streaming · 60s timeout
GET  /api/cards          live data cards
GET  /api/insights
GET  /api/opportunities
```

### MLB
```
GET  /api/mlb-projections   25s timeout
POST /api/statcast/query
POST /api/vpe3
GET  /api/weather
```

### System
```
GET  /api/health         edge runtime
GET  /api/kalshi
GET  /api/trading/arbitrage
POST /api/trading/quant
```

---

## Database

All tables live in the `api` schema. RLS enabled on every table.

**Normalized odds pipeline**
```
api.games                unique on (sport, home_team, away_team, date)
api.sportsbooks          unique on key ("draftkings", "fanduel", ...)
api.odds                 current lines — upsert on game × book × market × selection
api.odds_history         append-only price snapshots
api.line_movements       moves ≥1pt · generated movement column
```

**Props**
```
api.players
api.prop_markets
api.player_props         current lines
api.player_props_history append-only snapshots
```

**User / fantasy / trading / analytics** tables are all defined in `scripts/master-schema.sql`.

**Set up:**
```bash
# Supabase SQL Editor
scripts/master-schema.sql
scripts/add-normalized-odds-schema.sql
```

---

## Environment variables

```bash
# Required
XAI_API_KEY=                        # console.x.ai
ODDS_API_KEY=                       # the-odds-api.com
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Optional
SUPABASE_SERVICE_ROLE_KEY=          # admin/migration routes
KALSHI_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
CRON_SECRET=                        # any random string
NEXT_PUBLIC_SITE_URL=               # your Vercel URL
```

All env vars are accessed via helpers in `lib/config.ts` — never `process.env` directly.

---

## Local setup

```bash
git clone https://github.com/wwwourstudio/leverage-ai-chat.git
cd leverage-ai-chat
pnpm install
cp .env.example .env.local   # fill in your keys
# run master-schema.sql and add-normalized-odds-schema.sql in Supabase
pnpm dev
```

```bash
pnpm dev          # dev server (clears .next first)
pnpm build        # production build
pnpm test         # run all tests
pnpm test:watch   # watch mode
pnpm lint
```

Health check: `curl http://localhost:3000/api/health | jq`

---

## Tests

36 test files across components, integration, library, and engine tests.

```bash
pnpm test
pnpm test tests/integration/   # specific directory
```

---

## Deployment

Auto-deploys to Vercel on push to `master`.

Function timeouts (via `vercel.json`): analyze → 60s, mlb-projections → 25s, cards → 20s.

Cron jobs: odds ingested every minute, props every 10 minutes.

Auth session refresh runs through `proxy.js` — not `middleware.ts`. Do not create a `middleware.ts`.

---

## Pricing

| Tier | Price | DFS lineups |
|---|---|---|
| Free | $0 | 0 |
| Core | $49/mo | 3 |
| Pro | $149/mo | 150 |
| High Stakes | $999/yr | 150 |
