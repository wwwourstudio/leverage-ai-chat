# AI Sports Betting & Fantasy Assistant

*Production-ready SaaS application for sports betting, fantasy, DFS, and prediction markets*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/leverage-ai-sports/v0-nfc-assistant)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/md1TGPNkrhA)

## Overview

An AI-powered assistant for sports betting and fantasy sports with real-time odds integration, trust-based validation, and portfolio tracking. Built with Next.js 16, Supabase, and The Odds API.

## Features

- **AI Chat Interface**: Category-specific conversations (betting, fantasy, DFS, Kalshi)
- **Trust & Validation**: Multi-layer trust scoring with confidence levels
- **Live Odds Integration**: Real-time odds from The Odds API with multi-bookmaker comparison
- **Credits System**: Pay-per-message with automatic deduction and refunds
- **Portfolio Tracking**: Track bets, fantasy positions, and DFS entries
- **Benford's Law Validation**: Fraud detection on numeric predictions
- **Real-time Updates**: Live chat and credit updates via Supabase Realtime

## Tech Stack

- **Framework**: Next.js 16 (App Router, React Server Components)
- **Database**: Supabase (PostgreSQL with RLS)
- **AI**: xAI Grok via AI SDK
- **Odds API**: The Odds API (20K requests/month)
- **Auth**: Supabase Auth
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Deployment**: Vercel

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd v0-nfc-assistant
npm install
```

### 2. Environment Variables

Create `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# The Odds API
ODDS_API_KEY=6a8cb1c42cfce3d33c97ab4b99875492

# xAI Grok
XAI_API_KEY=your-xai-api-key
```

### 3. Database Setup

**IMPORTANT**: Run database migrations manually due to connection timeout.

See detailed instructions: `/scripts/run-migrations.md`

Quick steps:
1. Go to [Supabase Dashboard](https://app.supabase.com) → SQL Editor
2. Execute migration files in order:
   - `supabase/migrations/20260202_core_application_schema.sql`
   - `supabase/migrations/20260203_portfolio_odds_schema.sql`
   - `supabase/migrations/20260204_functions_triggers.sql`
   - `supabase/migrations/20260205_rls_policies.sql`

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
├── app/
│   ├── actions/          # Server actions
│   │   ├── ai.ts         # AI chat with streaming
│   │   ├── auth.ts       # Authentication
│   │   ├── chat.ts       # Chat management
│   │   └── credits.ts    # Credits system
│   ├── login/            # Login page
│   ├── signup/           # Sign up page
│   └── page.tsx          # Main chat interface
├── components/
│   ├── chat-interface.tsx    # Main chat UI
│   └── ui/                   # shadcn/ui components
├── lib/
│   ├── services/
│   │   └── odds-api.ts       # The Odds API integration
│   ├── supabase/             # Supabase clients
│   └── types/
│       └── database.ts       # TypeScript types
├── supabase/
│   ├── migrations/           # Database migrations
│   └── README.md            # Database documentation
└── scripts/
    └── run-migrations.md     # Migration instructions
```

## Database Schema

See `/supabase/README.md` for detailed schema documentation.

**Core tables**: users, chats, messages, credits_ledger  
**Portfolio tables**: odds_cache, user_portfolios, portfolio_updates  
**Trust tables**: ai_response_trust, ai_audit_log, validation_thresholds

## API Integration

### The Odds API

- **Plan**: 20K requests/month
- **Key**: 6a8cb1c42cfce3d33c97ab4b99875492
- **Usage**: Monitor in `/lib/services/odds-api.ts`
- **Caching**: 5-minute TTL in `odds_cache` table

Supported sports:
- NFL, NBA, MLB, NHL
- Soccer (EPL, Champions League)
- Many more via API

## Current Status

See `/SETUP_STATUS.md` for detailed progress.

**Completed**: Database schema, server actions, odds API, TypeScript types  
**Pending**: Run migrations manually, enable Realtime, UI enhancements

## Next Steps

1. Run database migrations (see `/scripts/run-migrations.md`)
2. Test authentication and chat functionality
3. Build trust metrics visualization
4. Add live odds display components
5. Create portfolio dashboard

## Documentation

- **Database**: `/supabase/README.md`
- **Migrations**: `/scripts/run-migrations.md`
- **Setup Status**: `/SETUP_STATUS.md`
- **The Odds API**: https://the-odds-api.com/liveapi/guides/v4/
- **Supabase**: https://supabase.com/docs

## Deployment

Deploy to Vercel:

```bash
vercel
```

Or push to your connected GitHub repository for automatic deployments.

**Live URL**: [https://vercel.com/leverage-ai-sports/v0-nfc-assistant](https://vercel.com/leverage-ai-sports/v0-nfc-assistant)

## Support

For issues or questions:
- Check `/supabase/README.md` for database troubleshooting
- See `/SETUP_STATUS.md` for current progress
- Open a GitHub issue for bugs
