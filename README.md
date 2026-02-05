# NFC Assistant

*Automatically synced with your [v0.app](https://v0.app) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/leverage-ai-sports/v0-nfc-assistant)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/md1TGPNkrhA)

## Overview

This repository will stay in sync with your deployed chats on [v0.app](https://v0.app).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.app](https://v0.app).

## Key Features

✅ **Real-Time Sports Odds** - Live data from The Odds API with multi-bookmaker comparison  
✅ **AI-Powered Analysis** - Grok-3 integration for intelligent betting insights  
✅ **Market Efficiency Detection** - Automatic identification of value opportunities  
✅ **Dynamic Configuration** - All settings stored in Supabase, no code changes needed  
✅ **Smart Validation** - Comprehensive error handling with graceful fallbacks  
✅ **100% Live Data** - Zero hardcoded values, everything fetched dynamically

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

## 🚀 Quick Start

**New to Leverage AI?** Check out the **[QUICK_START_GUIDE.md](./QUICK_START_GUIDE.md)** for a 3-step setup and feature overview.

## AI Model

This application is powered by **Grok-3**, xAI's latest AI model optimized for sports betting, fantasy sports, DFS, and prediction market analysis. 

✅ **Not GPT-4** - We use Grok-3 for superior sports intelligence and real-time data processing.

See **[AI_MODEL_DOCUMENTATION.md](./AI_MODEL_DOCUMENTATION.md)** for complete details about the AI model.

## Configuration

### Quick Start

See **[ENV_CONFIGURATION.md](./ENV_CONFIGURATION.md)** for complete environment variable setup.

Required environment variables:
- `XAI_API_KEY` - Grok-3 AI API key (get from [console.x.ai](https://console.x.ai/))
- `ODDS_API_KEY` - Sports odds API key (get from [the-odds-api.com](https://the-odds-api.com/))
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

### Health Check

Test your configuration:
```bash
curl https://your-domain.vercel.app/api/health | jq
```

## Features

### Dynamic Welcome Messages
When clicking "New Analysis" in the sidebar, you'll receive a personalized welcome message based on your selected analysis type:

- **Sports Betting** - Tailored guidance for odds analysis and value detection
- **Fantasy Sports (NFC)** - Specialized advice for NFBC/NFFC/NFBKC draft strategy  
- **DFS** - Focused assistance for optimal lineup construction
- **Kalshi Markets** - Expert help with prediction market opportunities
- **All Platforms** - Comprehensive overview of all analysis types

Each welcome message explicitly mentions the analysis type and provides context-specific guidance powered by Grok-3 AI.

### Real-Time Analysis
- Live odds monitoring across major sportsbooks
- Dynamic lineup optimization for DFS
- ADP tracking for fantasy drafts
- Prediction market probability modeling

## Documentation

**[📚 Complete Documentation Index](./DOCUMENTATION_INDEX.md)** - Full guide to all documentation

### Core Documentation

**Getting Started:**
- **[QUICK_START_GUIDE.md](./QUICK_START_GUIDE.md)** - 3-step setup guide
- **[ENV_CONFIGURATION.md](./ENV_CONFIGURATION.md)** - Environment variables
- **[INTEGRATION_SETUP.md](./INTEGRATION_SETUP.md)** - External services setup

**Key Features:**
- **[REALTIME_ODDS_INTEGRATION.md](./REALTIME_ODDS_INTEGRATION.md)** - Live sports odds (100% live data)
- **[DYNAMIC_CONFIGURATION_SYSTEM.md](./DYNAMIC_CONFIGURATION_SYSTEM.md)** - Database-driven config
- **[AI_MODEL_DOCUMENTATION.md](./AI_MODEL_DOCUMENTATION.md)** - Grok-3 AI integration

**System Validation:**
- **[SUPABASE_VALIDATION_SYSTEM.md](./SUPABASE_VALIDATION_SYSTEM.md)** - Database error prevention
- **[SPORTS_VALIDATION_SYSTEM.md](./SPORTS_VALIDATION_SYSTEM.md)** - Sports API validation
- **[JSON_VALIDATION_IMPROVEMENTS.md](./JSON_VALIDATION_IMPROVEMENTS.md)** - Safe JSON parsing

**Support:**
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues and solutions

## Common Issues

Having trouble? Check **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** for detailed solutions.

Quick fixes for common problems:

| Issue | Solution | Documentation |
|-------|----------|---------------|
| JSON parsing errors | Automatically handled with safe parsing | [JSON_VALIDATION_IMPROVEMENTS.md](./JSON_VALIDATION_IMPROVEMENTS.md) |
| Supabase query errors | Validation with graceful fallbacks | [SUPABASE_VALIDATION_SYSTEM.md](./SUPABASE_VALIDATION_SYSTEM.md) |
| 404 "Unknown sport" | Sport code validation and correction | [SPORTS_VALIDATION_SYSTEM.md](./SPORTS_VALIDATION_SYSTEM.md) |
| API not configured | Check environment variables | [ENV_CONFIGURATION.md](./ENV_CONFIGURATION.md) |
| Missing database tables | Run migration scripts | [DYNAMIC_CONFIGURATION_SYSTEM.md](./DYNAMIC_CONFIGURATION_SYSTEM.md) |
