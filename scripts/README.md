# Database Setup Scripts

## Current Error Fix

If you're seeing database errors like:
- `Could not find the table 'public.ai_response_trust'`
- `column "model_id" does not exist`

**Run this file in Supabase SQL Editor:**
- Go to project root: `QUICK_DATABASE_SETUP.sql` 
- This creates 3 essential tables in 30 seconds

## Full Schema (All Features)

**For complete database with all features, run:**
- `scripts/setup-database.sql` (1112 lines)
- Creates 16 tables, 5 views, 11 triggers, 60+ indexes
- Includes: conversations, messages, predictions, bets, DFS lineups, etc.

## How to Run

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your LEVERAGEAI project
3. Click **SQL Editor** → **New Query**
4. Copy/paste the SQL file contents
5. Click **Run**
6. Wait for success message

## Files in This Directory

- `setup-database.sql` - Complete production schema (recommended)
- `README.md` - This file
