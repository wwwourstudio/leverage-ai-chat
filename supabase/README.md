# Database Setup & Migration Guide

## Overview

This application uses **Supabase** as the backend database with a comprehensive schema for sports betting and fantasy AI assistance.

## Schema Architecture

### Core Tables
- **users**: User profiles with credits and preferences
- **chats**: Conversations categorized by betting/fantasy/DFS/Kalshi
- **messages**: Chat messages with AI trust scores and validation
- **credits_ledger**: Immutable transaction log with running balance

### Portfolio & Odds Tables
- **odds_cache**: Cached odds from The Odds API with TTL
- **user_portfolios**: Bet/fantasy position tracking
- **portfolio_updates**: Historical value changes

### Trust & Integrity Tables
- **ai_response_trust**: Trust metrics for AI responses
- **ai_audit_log**: Audit trail of AI operations
- **odds_benford_baselines**: Benford's Law baseline data
- **validation_thresholds**: Dynamic validation thresholds
- **live_odds_cache**: Real-time odds monitoring

## Migration Files

Execute these migrations **in order**:

1. **20260201_trust_integrity_system.sql** - Trust validation system
2. **20260202_core_application_schema.sql** - Core tables (users, chats, messages, credits)
3. **20260203_portfolio_odds_schema.sql** - Portfolio and odds caching
4. **20260204_functions_triggers.sql** - Database functions and triggers
5. **20260205_rls_policies.sql** - Row Level Security policies

## How to Run Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **SQL Editor**
3. Copy the content of each migration file
4. Paste and execute in order
5. Verify success in the **Table Editor**

### Option 2: Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Apply migrations
supabase db push
```

### Option 3: Direct SQL Execution

```bash
# Using psql
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/migrations/20260202_core_application_schema.sql
```

## Environment Variables

Add these to your Vercel project or `.env.local`:

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

## Post-Migration Setup

### 1. Enable Realtime

In Supabase Dashboard → Database → Replication:

- Enable `messages` table
- Enable `credits_ledger` table

### 2. Create Storage Bucket

In Storage section:
- Create bucket: `chat-attachments`
- Set to **public read**, **authenticated write**

### 3. Deploy Edge Function

```bash
supabase functions deploy validate-ai-response
```

### 4. Verify RLS Policies

Check that Row Level Security is enabled on:
- ✅ users
- ✅ chats
- ✅ messages
- ✅ credits_ledger
- ✅ user_portfolios

## Database Schema Diagram

```
┌─────────────────┐
│  auth.users     │
│  (Supabase)     │
└────────┬────────┘
         │
         ├─────────────────────────────────────────┐
         │                                         │
┌────────▼─────────┐                    ┌─────────▼──────────┐
│  users           │                    │  chats             │
│  ─────────────   │                    │  ───────────────   │
│  credits_balance │◄───────────────────│  user_id           │
│  preferences     │                    │  category          │
│  metadata        │                    │  is_starred        │
└────────┬─────────┘                    └──────────┬─────────┘
         │                                         │
         │                              ┌──────────▼─────────┐
         │                              │  messages          │
         │                              │  ────────────────  │
         │                              │  role              │
         │                              │  content           │
         │                              │  trust_score       │
         │                              │  confidence_level  │
         │                              │  validation_status │
         │                              └──────────┬─────────┘
         │                                         │
         │                              ┌──────────▼─────────┐
         └──────────────────────────────►  credits_ledger    │
                                        │  ────────────────  │
                                        │  amount            │
                                        │  balance_after     │
                                        │  transaction_type  │
                                        │  message_id        │
                                        └────────────────────┘
```

## Key Features

### 1. Credits System
- **Starting balance**: 100 credits
- **Message cost**: Configurable per model
- **Ledger tracking**: Every transaction logged with balance snapshot
- **Refund support**: Automatic refund on validation failures

### 2. Trust Validation
- **Multi-layer scoring**: Statistical, cross-validation, historical accuracy
- **Benford's Law**: Fraud detection on numeric predictions
- **Confidence levels**: very_high, high, medium, low, very_low
- **Real-time validation**: Edge function validates responses

### 3. Odds Caching
- **TTL-based**: 5-minute expiration
- **Multi-bookmaker**: Compare odds across sportsbooks
- **Event tracking**: Historical odds changes
- **Best odds finder**: Automatic best price detection

### 4. Portfolio Tracking
- **Multi-category**: Betting, Fantasy, DFS, Kalshi
- **Real-time value**: Current position values
- **P&L tracking**: Win/loss/push results
- **Historical updates**: Value snapshots over time

## Troubleshooting

### Migration Failed
- Check if tables already exist
- Verify foreign key constraints
- Ensure RLS is disabled during migration

### Connection Timeout
- Check if Supabase project is paused
- Verify environment variables
- Check network connectivity

### RLS Blocking Queries
- Verify user is authenticated
- Check RLS policies match your use case
- Use service role for admin operations

## API Usage Tracking

The Odds API has a 20K request/month limit. Monitor usage:

```sql
-- Check cached odds count
SELECT COUNT(*) FROM odds_cache WHERE expires_at > NOW();

-- Check API call frequency
SELECT DATE(created_at), COUNT(*) 
FROM odds_cache 
GROUP BY DATE(created_at) 
ORDER BY DATE(created_at) DESC;
```

## Support

- **Supabase Docs**: https://supabase.com/docs
- **The Odds API Docs**: https://the-odds-api.com/liveapi/guides/v4/
- **Issues**: Open a GitHub issue for bugs or questions
