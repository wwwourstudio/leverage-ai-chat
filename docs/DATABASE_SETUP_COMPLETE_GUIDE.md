# Database Setup Guide - Complete Instructions

**Status:** Database successfully deployed to Supabase (February 13, 2026)  
**Version:** v2.0 - Production-Ready Schema

---

## Overview

The LeverageAI database schema has been successfully deployed with 16 tables, 5 views, 5 functions, 11 triggers, and comprehensive Row Level Security policies.

### What Was Created

**Core Tables:**
- `user_profiles` - Extended user information with performance metrics
- `user_preferences` - UI and notification preferences
- `conversations` - Chat session management
- `messages` - Individual chat messages
- `message_attachments` - File uploads and media
- `predictions` - Betting predictions with results tracking
- `user_bets` - Manual bet tracking for portfolio
- `odds_history` - Historical odds data for analysis
- `player_projections` - DFS and fantasy projections
- `dfs_lineups` - Daily fantasy lineup tracking
- `live_odds_cache` - Cached odds data with TTL
- `ai_response_trust` - Trust metrics for AI responses
- `ai_audit_log` - Complete audit trail for AI operations
- `odds_benford_baselines` - Statistical baselines for odds validation
- `validation_thresholds` - Configurable validation rules
- `app_config` - Application-wide configuration

**Views:**
- `user_performance_summary` - Aggregated user stats
- `config_by_category` - Categorized configuration
- `model_trust_scores` - AI model performance metrics
- `recent_predictions` - Latest prediction activity
- `user_chat_summary` - Conversation statistics

**Functions:**
- `calculate_user_win_rate()` - User performance calculation
- `cleanup_expired_odds_cache()` - Automatic cache cleanup
- `update_conversation_on_message()` - Message count tracking
- `update_user_stats_on_prediction()` - Auto-update user metrics
- `update_updated_at_column()` - Timestamp management

---

## Setup Instructions

### Step 1: Run Main Schema Script

1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to your project: **LeverageAI**
3. Go to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy contents of `scripts/setup-database.sql`
6. Paste into SQL Editor
7. Click **Run** (or press Cmd/Ctrl + Enter)

**Expected Output:**
```
LEVERAGEAI DATABASE SCHEMA V2 -- MIGRATION COMPLETE
Created 16 tables, 5 views, 5 functions, 11 triggers, and comprehensive RLS policies
Database is ready for production use
```

**Duration:** ~5-10 seconds

---

### Step 2: Fix Security Warnings (Optional but Recommended)

After running the main script, you'll see security warnings in Supabase. These are expected but should be fixed for production.

**Warning Types:**
- **Security Definer View** - Views that bypass RLS for aggregation
- **Function Search Path Mutable** - Functions without explicit search_path

**To Fix:**
1. In SQL Editor, open new query
2. Copy contents of `scripts/fix-security-warnings.sql`
3. Run the script

**Expected Output:**
```
SECURITY FIXES APPLIED SUCCESSFULLY
Fixed 5 functions with explicit search_path
Security warnings should now be resolved
```

**What This Does:**
- Sets explicit `search_path = public, pg_temp` on all functions
- Prevents SQL injection via search_path manipulation
- Resolves Supabase security advisor warnings

---

### Step 3: Verify Setup (Recommended)

Verify everything was created correctly:

1. Open new SQL query
2. Copy contents of `scripts/verify-database-setup.sql`
3. Run the script

**Expected Output:**
```
VERIFICATION COMPLETE
Summary:
  - Tables: 16
  - Views: 5
  - Functions: 7
  - Triggers: 11
  - Indexes: 40+
  - RLS Policies: 30+

STATUS: SUCCESS - All database objects created correctly
```

---

## Troubleshooting Guide

### Issue 1: FOR Loop Syntax Error (verify-database-setup.sql)

**Error:**
```
ERROR: syntax error at or near "table_name"
LINE 33: FOR table_name IN
```

**Root Cause:**
PostgreSQL FOR loops require proper record variable naming when iterating over SELECT results. Using column names directly as loop variables causes syntax errors because PostgreSQL expects a record type variable that contains the selected columns.

**Incorrect Syntax:**
```sql
FOR table_name IN 
  SELECT tablename FROM pg_tables WHERE schemaname = 'public'
LOOP
  RAISE NOTICE '   - %', table_name;  -- ERROR: ambiguous reference
END LOOP;
```

**Correct Syntax:**
```sql
FOR table_record IN 
  SELECT tablename FROM pg_tables WHERE schemaname = 'public'
LOOP
  RAISE NOTICE '   - %', table_record.tablename;  -- Access via record.column
END LOOP;
```

**Why This Happens:**
- PostgreSQL creates a record variable for each iteration
- Column values must be accessed via `record_variable.column_name`
- Using just the column name creates ambiguity and syntax errors
- This is particularly important for multi-column SELECT statements

**Solution Applied (February 13, 2026):**
Fixed in `scripts/verify-database-setup.sql`:
- Changed `table_name` → `table_record.tablename` (line 33)
- Changed `view_name` → `view_record.viewname` (line 47)
- Changed `func_name` → `func_record.proname` (line 62)
- Updated RLS status loop to use aliased columns (line 98)

**Prevention:**
Always use descriptive record variable names in FOR loops and access columns via dot notation:
```sql
FOR my_record IN SELECT col1, col2 FROM my_table LOOP
  RAISE NOTICE '%, %', my_record.col1, my_record.col2;
END LOOP;
```

---

### Issue 2: Permission Denied Error

**Error:**
```
ERROR: permission denied for schema public
```

**Cause:** Insufficient database permissions

**Solution:**
1. Ensure you're logged in as the database owner
2. In Supabase, you should have admin access by default
3. Check project settings → Database → Connection info
4. Verify you're on the correct project

---

### Issue 2: Table Already Exists

**Error:**
```
ERROR: relation "user_profiles" already exists
```

**Cause:** Script was run multiple times

**Solution:**
The script includes `DROP TABLE IF EXISTS` statements, so this shouldn't happen. If it does:
1. Check if you modified the script
2. Run the drop statements manually:
```sql
DROP TABLE IF EXISTS user_profiles CASCADE;
-- Repeat for all tables
```
3. Re-run the full script

---

### Issue 3: Foreign Key Constraint Violation

**Error:**
```
ERROR: violates foreign key constraint
```

**Cause:** Data exists that doesn't match new constraints

**Solution:**
1. This should only happen if you have existing data
2. The script drops all tables first, so this is rare
3. Manually delete conflicting data:
```sql
DELETE FROM table_name WHERE condition;
```
4. Re-run the script

---

### Issue 4: RLS Policy Conflict

**Error:**
```
ERROR: policy "policy_name" already exists
```

**Cause:** Policies from previous setup still exist

**Solution:**
```sql
-- Drop all policies for a table
DROP POLICY IF EXISTS policy_name ON table_name;

-- Re-run the RLS section of the script
```

---

### Issue 5: Function Already Exists with Different Signature

**Error:**
```
ERROR: function "function_name" already exists with different argument types
```

**Cause:** Function signature changed between versions

**Solution:**
```sql
-- Drop the function with CASCADE to remove dependencies
DROP FUNCTION IF EXISTS function_name CASCADE;

-- Re-run the function creation section
```

---

## Post-Setup Verification Checklist

After successful setup, verify the following:

### 1. Tables Created
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```
Should return 16 tables.

### 2. RLS Enabled
```sql
SELECT 
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' AND c.relkind = 'r';
```
All tables should show `rls_enabled = true`.

### 3. Indexes Created
```sql
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```
Should show 40+ indexes.

### 4. Functions Work
```sql
SELECT calculate_user_win_rate('00000000-0000-0000-0000-000000000000'::UUID);
```
Should return `0.00` (no user data yet).

### 5. Test Insert
```sql
-- This will fail due to RLS, which is correct
INSERT INTO user_profiles (user_id, email) 
VALUES ('00000000-0000-0000-0000-000000000000'::UUID, 'test@example.com');
```
Should return RLS error (expected behavior).

---

## Security Considerations

### Row Level Security (RLS)

All tables have RLS enabled with the following policies:

**user_profiles:**
- Users can read their own profile
- Users can update their own profile
- Admins can read all profiles

**conversations & messages:**
- Users can only access their own conversations
- Messages inherit conversation permissions

**predictions & user_bets:**
- Users can only see their own data
- No cross-user data access

**System tables (ai_response_trust, app_config):**
- Read access for authenticated users
- Write access for service role only

### Function Security

All functions use `SECURITY DEFINER` with explicit `search_path`:
```sql
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;
```

This prevents SQL injection via search_path manipulation.

---

## Maintenance

### Daily Tasks

**Cleanup expired odds cache:**
```sql
SELECT cleanup_expired_odds_cache();
```
Returns number of deleted rows.

### Weekly Tasks

**Check database size:**
```sql
SELECT pg_size_pretty(pg_database_size(current_database()));
```

**Analyze performance:**
```sql
ANALYZE;
```

### Monthly Tasks

**Vacuum database:**
```sql
VACUUM ANALYZE;
```

**Review unused indexes:**
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## Migration from V1 to V2

If you're upgrading from a previous schema version:

1. **Backup your data:**
```sql
-- Export to CSV
COPY user_profiles TO '/tmp/user_profiles_backup.csv' CSV HEADER;
```

2. **Run the new schema script** (includes DROP statements)

3. **Re-import data if needed:**
```sql
COPY user_profiles FROM '/tmp/user_profiles_backup.csv' CSV HEADER;
```

**Note:** V2 schema is not backward compatible with V1.

---

## Support & Resources

**Files:**
- `scripts/setup-database.sql` - Main schema creation
- `scripts/fix-security-warnings.sql` - Security fixes
- `scripts/verify-database-setup.sql` - Verification script

**Supabase Resources:**
- Dashboard: https://supabase.com/dashboard
- Docs: https://supabase.com/docs
- RLS Guide: https://supabase.com/docs/guides/auth/row-level-security

**Project Resources:**
- PROJECT_TASKS.md - Feature roadmap
- PERFORMANCE_ANALYSIS.md - Performance metrics
- ERROR_HANDLING.md - Error handling guide

---

## Success Confirmation

If you see this output, your database is ready:

```
========================================================
LEVERAGEAI DATABASE SCHEMA V2 -- MIGRATION COMPLETE
========================================================
Created 16 tables, 5 views, 5 functions, 11 triggers, and comprehensive RLS policies
Database is ready for production use
========================================================
```

**Security Warnings:** Expected initially, fix with `fix-security-warnings.sql`

**Next Steps:**
1. Configure environment variables in Vercel
2. Test API endpoints with Postman or curl
3. Deploy application and verify database connectivity

---

**Last Updated:** February 13, 2026  
**Schema Version:** 2.0  
**Status:** Production Ready
