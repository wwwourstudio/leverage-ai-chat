# Integration Setup Guide

This document explains how to set up and configure the API integrations for the NFC Assistant application.

## Overview

The application has been refactored to securely manage API keys and integrate with external services:

- **Sports Odds API** - Live sports betting odds and market data
- **Grok AI (xAI)** - Advanced sports analysis and predictions
- **Supabase** - Database, authentication, and edge functions

## Architecture

All sensitive API keys are managed server-side through:

1. **Next.js Route Handlers** (`/app/api/*`) - Server-side endpoints that securely call external APIs
2. **Environment Variables** - API keys stored in Vercel environment variables (never exposed to client)
3. **Supabase Edge Functions** - Serverless functions for AI validation and trust metrics

## Required API Keys

### 1. Sports Odds API Key

**Purpose:** Fetch live sports betting odds, lines, and market data

**How to get it:**
1. Visit [The Odds API](https://the-odds-api.com/)
2. Sign up for a free account (500 requests/month free tier)
3. Navigate to your dashboard to get your API key
4. Add to Vercel environment variables as `ODDS_API_KEY`

**Environment Variable:**


### 2. Grok AI API Key (xAI)

**Purpose:** Power AI-driven sports analysis and predictions

**How to get it:**
1. Visit [xAI](https://x.ai/)
2. Sign up for API access
3. Generate an API key from your dashboard
4. Add to Vercel environment variables as `XAI_API_KEY`

**Environment Variable:**


### 3. Supabase Configuration

**Purpose:** Database storage, authentication, and edge functions

**How to configure:**

The Supabase integration is already installed (as shown in your screenshot). The following environment variables are automatically configured:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Additional Supabase Edge Function Variables:**

For the `validate-ai-response` edge function to work properly, you need to add `ODDS_API_KEY` to Supabase:

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** → **Environment Variables**
3. Add `ODDS_API_KEY` with the same value as your Vercel environment variable

## API Routes

The application exposes the following server-side API routes:

### `/api/odds` (POST)

Fetch sports odds data

**Request:**

{
  "sport": "nfl",
  "marketType": "h2h",
  "eventId": "optional-event-id"
}

{
  "sport": "nfl",
  "marketType": "h2h",
  "events": [...],
  "timestamp": "2026-02-02T...",
  "remainingRequests": "450",
  "usedRequests": "50"
}


### `/api/analyze` (POST)

Get AI-powered sports analysis

**Request:**

{
  "query": "Should I bet on Lakers -4.5?",
  "context": {
    "sport": "nba",
    "marketType": "spreads",
    "oddsData": {...}
  }
}


**Response:**
```json
{
  "response": "Based on my analysis...",
  "trustMetrics": {
    "finalConfidence": 87,
    "trustLevel": "high",
    "riskLevel": "low",
    ...
  },

  "processingTime": 1250
}
```

## Client-Side Usage

The application provides a secure API client library at `/lib/api-client.ts`:

### Fetch Odds Example


import { fetchOddsWithCache } from '@/lib/api-client';

const oddsData = await fetchOddsWithCache('nfl', 'h2h');
console.log(oddsData.events);

import { getAIAnalysis } from '@/lib/api-client';

const analysis = await getAIAnalysis(
  'What are the best NFL bets this week?',
  {
    sport: 'nfl',
    marketType: 'spreads'
  }
);

console.log(analysis.response);
console.log(analysis.trustMetrics);

## Security Best Practices

✅ **What we did:**

1. **No hardcoded API keys** - All keys managed via environment variables
2. **Server-side API calls** - API keys never exposed to client/browser
3. **Edge runtime** - Fast, secure serverless functions
4. **Caching** - Reduce API calls with intelligent caching
5. **Error handling** - Graceful fallbacks if APIs are unavailable
6. **Trust metrics** - AI validation system for quality assurance

❌ **What to avoid:**

1. Never commit `.env` files to git
2. Never use API keys in client-side code
3. Never expose API keys in browser network requests
4. Don't skip environment variable validation

## Testing the Integration

### 1. Verify Environment Variables

## Troubleshooting

### Error: "ODDS_API_KEY not configured"

**Solution:** Add the `ODDS_API_KEY` environment variable to your Vercel project settings

### Error: "AI service not configured"

**Solution:** Add the `XAI_API_KEY` environment variable to your Vercel project settings

### Error: "Failed to fetch odds"

**Possible causes:**
- Invalid API key
- API rate limit exceeded
- Network connectivity issues
- Invalid sport/market type

**Solution:** Check your API key, verify rate limits, and ensure correct sport codes

### Supabase Edge Function Errors

**Solution:** 
1. Verify `ODDS_API_KEY` is set in Supabase Edge Function environment variables
2. Redeploy edge functions after adding environment variables
3. Check Supabase logs for detailed error messages

## Migration from Mock Data

The application previously used simulated responses. The refactoring maintains backward compatibility:

**Before (mock data):**


## Cost Optimization

### Free Tier Limits

- **The Odds API:** 500 requests/month free
- **xAI Grok:** Check current pricing at x.ai
- **Supabase:** 500MB database, 2GB bandwidth free

### Caching Strategy

The application implements intelligent caching to minimize API calls:

- **Odds data:** Cached for 5 minutes
- **AI responses:** Can be cached per user session
- **Trust metrics:** Stored in Supabase for historical analysis

### Rate Limiting

Consider implementing rate limiting at the route handler level to prevent abuse:

## Production Checklist

- [ ] Add `ODDS_API_KEY` to Vercel environment variables
- [ ] Add `XAI_API_KEY` to Vercel environment variables
- [ ] Add `ODDS_API_KEY` to Supabase Edge Functions
- [ ] Verify Supabase integration is connected
- [ ] Test all API endpoints in production
- [ ] Monitor API usage and costs
- [ ] Set up error alerting (optional)
- [ ] Review and adjust caching duration
- [ ] Implement rate limiting (optional)

## Support

For issues or questions:

- **The Odds API:** https://the-odds-api.com/contact
- **xAI:** https://x.ai/support
- **Supabase:** https://supabase.com/docs
- **Vercel:** https://vercel.com/help

## Next Steps

1. Add API keys through the Vercel dashboard or v0 sidebar
2. Test the integration using the provided examples
3. Monitor usage and adjust rate limits as needed
4. Expand AI prompts for more sophisticated analysis
5. Implement user-specific caching for personalized experiences
