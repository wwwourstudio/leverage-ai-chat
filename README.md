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

## 📚 Documentation

**[→ COMPLETE_DOCUMENTATION.md](./COMPLETE_DOCUMENTATION.md)** - **Single consolidated documentation file**

All project documentation has been merged into one comprehensive guide covering:

- ✅ Quick Start (3-step setup)
- ✅ Environment Configuration  
- ✅ Integration Setup (Supabase, Grok, The Odds API)
- ✅ Core Features (Real-time odds, AI analysis, dynamic config)
- ✅ System Architecture & Validation
- ✅ Troubleshooting & Common Issues
- ✅ API Reference
- ✅ Development Guide
- ✅ Migration & Updates

### Quick Links

| Section | Jump To |
|---------|---------|
| New Users | [Quick Start](./COMPLETE_DOCUMENTATION.md#quick-start) |
| Configuration | [Environment Setup](./COMPLETE_DOCUMENTATION.md#environment-configuration) |
| Features | [Core Features](./COMPLETE_DOCUMENTATION.md#core-features) |
| Issues | [Troubleshooting](./COMPLETE_DOCUMENTATION.md#troubleshooting) |
| API Docs | [API Reference](./COMPLETE_DOCUMENTATION.md#api-reference) |
| Development | [Dev Guide](./COMPLETE_DOCUMENTATION.md#development-guide) |

## Common Issues

Having trouble? See the **[Troubleshooting Section](./COMPLETE_DOCUMENTATION.md#troubleshooting)** in the complete documentation.

Quick fixes:

| Issue | Solution |
|-------|----------|
| JSON parsing errors | Automatically handled with safe parsing |
| Supabase query errors | Validation with graceful fallbacks |
| 404 "Unknown sport" | Sport code auto-correction |
| API not configured | Check environment variables at `/api/health` |
| Missing database tables | See [Database Schema Plan](./docs/DATABASE_SCHEMA_PLAN.md) for setup instructions |
