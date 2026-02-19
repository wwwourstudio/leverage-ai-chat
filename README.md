# NFC Assistant

*Automatically synced with your [v0.app](https://v0.app) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/leverage-ai-sports/v0-nfc-assistant)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/md1TGPNkrhA)

## Overview

This repository will stay in sync with your deployed chats on [v0.app](https://v0.app).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.app](https://v0.app).

## Key Features

- **Real-Time Sports Odds** -- Live data from The Odds API with multi-bookmaker comparison
- **AI-Powered Analysis** -- Grok integration for intelligent betting insights
- **Market Efficiency Detection** -- Automatic identification of value opportunities
- **Dynamic Configuration** -- All settings stored in Supabase, no code changes needed
- **Smart Validation** -- Comprehensive error handling with graceful fallbacks
- **100% Live Data** -- Zero hardcoded values, everything fetched dynamically

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4, shadcn/ui
- **Database:** Supabase (PostgreSQL)
- **AI:** Grok via AI SDK 6
- **Data:** The Odds API
- **Hosting:** Vercel

## Configuration

Required environment variables:

| Variable | Description | Source |
|----------|-------------|--------|
| `XAI_API_KEY` | Grok AI API key | [console.x.ai](https://console.x.ai/) |
| `ODDS_API_KEY` | Sports odds API key | [the-odds-api.com](https://the-odds-api.com/) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Supabase dashboard |

### Health Check

Test your configuration:

```bash
curl https://your-domain.vercel.app/api/health | jq
```

## Development

```bash
pnpm install
pnpm dev
```

### Testing

```bash
pnpm test          # run tests once
pnpm test:watch    # watch mode
```

## Deployment

Your project is live at:
**[https://vercel.com/leverage-ai-sports/v0-nfc-assistant](https://vercel.com/leverage-ai-sports/v0-nfc-assistant)**

Build your app on:
**[https://v0.app/chat/md1TGPNkrhA](https://v0.app/chat/md1TGPNkrhA)**
