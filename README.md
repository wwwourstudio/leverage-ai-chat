# NFC Assistant

*Automatically synced with your [v0.app](https://v0.app) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/leverage-ai-sports/v0-nfc-assistant)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/md1TGPNkrhA)

## Overview

This repository will stay in sync with your deployed chats on [v0.app](https://v0.app).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.app](https://v0.app).

## Deployment

Your project is live at:

**[https://vercel.com/leverage-ai-sports/v0-nfc-assistant](https://vercel.com/leverage-ai-sports/v0-nfc-assistant)**

## Build your app

Continue building your app on:

**[https://v0.app/chat/md1TGPNkrhA](https://v0.app/chat/md1TGPNkrhA)**

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

## Configuration

### Quick Start

See **[ENV_CONFIGURATION.md](./ENV_CONFIGURATION.md)** for complete environment variable setup.

Required environment variables:
- `XAI_API_KEY` - Grok AI API key (get from [console.x.ai](https://console.x.ai/))
- `ODDS_API_KEY` - Sports odds API key (get from [the-odds-api.com](https://the-odds-api.com/))
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

### Health Check

Test your configuration:
```bash
curl https://your-domain.vercel.app/api/health | jq
```

## Documentation

- **[ENV_CONFIGURATION.md](./ENV_CONFIGURATION.md)** - Complete environment setup guide
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues and solutions
- **[FIXES_APPLIED.md](./FIXES_APPLIED.md)** - Recent bug fixes and improvements
- **[INTEGRATION_SETUP.md](./INTEGRATION_SETUP.md)** - Integration setup instructions
- **[REAL_DATA_INTEGRATION.md](./REAL_DATA_INTEGRATION.md)** - Real-time data integration guide

## Common Issues

Having trouble? Check **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** for solutions to common problems including:
- JSON parsing errors
- API configuration issues
- Database connection problems
- Environment variable setup
