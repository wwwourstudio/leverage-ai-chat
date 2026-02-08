# Supabase Database Setup Guide

## Current Status
✅ Supabase integration is **connected**  
❌ Database tables are **not created yet**

## Error You're Seeing
```
Could not find the table 'public.ai_response_trust' in the schema cache
```

This means the database tables haven't been created yet. The app will work with default/fallback values until the tables are set up.

## How to Fix

### Option 1: Run Migrations via Supabase Dashboard (Recommended)

1. **Open your Supabase project dashboard:**
   - Project: `leverge` (ID: rgiymwnjivfelmengeet)
   - Go to: https://supabase.com/dashboard/project/rgiymwnjivfelmengeet

2. **Navigate to SQL Editor:**
   - Click "SQL Editor" in the left sidebar

3. **Run the Trust System Migration:**
   - Copy the entire contents of `/supabase/migrations/20260201_trust_integrity_system.sql`
   - Paste into the SQL Editor
   - Click "Run" or press Cmd/Ctrl + Enter

4. **Run the Config System Migration:**
   - Copy the entire contents of `/supabase/migrations/20260204_dynamic_config_system.sql`
   - Paste into the SQL Editor
   - Click "Run"

5. **Verify tables were created:**
   - Go to "Table Editor" in the left sidebar
   - You should see these tables:
     - `ai_response_trust`
     - `ai_audit_log`
     - `odds_benford_baselines`
     - `validation_thresholds`
     - `live_odds_cache`
     - `app_config`
     - `user_profiles`

### Option 2: Use Supabase CLI (Advanced)

```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref rgiymwnjivfelmengeet

# Run migrations
supabase db push
```

## What Works Without Database

Even without the database tables created, the following features work:

✅ **Grok 4 AI Chat** - Full AI analysis and betting insights  
✅ **Live Odds Fetching** - Multi-sport odds from The Odds API  
✅ **Card Generation** - Dynamic betting opportunity cards  
✅ **LeveragedAI** - AI-enhanced operations with graceful fallbacks

### What Doesn't Work Yet

❌ **Insights Dashboard** - Shows zeros (needs `ai_response_trust` table)  
❌ **Historical Accuracy** - Can't calculate without data storage  
❌ **Trust Metrics Storage** - Can't persist AI trust scores  
❌ **User Profiles** - Can't save user-specific data  
❌ **Dynamic Configuration** - Uses hardcoded defaults

## After Creating Tables

Once you run the migrations, the app will automatically:
1. Start storing AI prediction trust metrics
2. Track historical accuracy over time
3. Calculate real ROI and win rates
4. Enable user-specific profiles and preferences
5. Use dynamic configuration from the database

## Testing the Connection

To verify everything is working after running migrations:

1. Refresh the app
2. Check the browser console - you should see:
   ```
   [Database] LeveragedAI: Supabase client initialized
   [Database] LeveragedAI: Grok AI initialized
   ```
3. The insights dashboard should start showing real data after you make predictions

## Need Help?

If you continue seeing errors after running migrations:
- Check Supabase project status (should not be paused)
- Verify RLS policies are set correctly
- Check that environment variables match your project
- Look at Supabase logs in the dashboard for detailed errors
