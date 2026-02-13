# Database Setup Guide - LEVERAGEAI

---

## 🚨 URGENT: Fix Current Database Errors (30 seconds)

**You're seeing these errors:**
```
Could not find the table 'public.ai_response_trust' in the schema cache
column "model_id" does not exist
```

**Quick Fix - Do This RIGHT NOW:**

1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/_) → Select your LEVERAGEAI project
2. Click **SQL Editor** in left sidebar → Click **New Query**
3. Open `QUICK_DATABASE_SETUP.sql` from project root, copy everything
4. Paste into SQL Editor → Click **Run** button
5. Wait 5 seconds for ✅ SUCCESS message
6. **Refresh your app** - errors are gone!

This creates the 3 critical tables (`ai_response_trust`, `user_profiles`, `app_config`) needed immediately.

**Then optionally** run the full schema below for all features (conversations, predictions, DFS, etc.)

---

## Complete Setup (2 minutes) - Recommended After Quick Fix

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase project dashboard at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project: **LEVERAGEAI**
3. Click **SQL Editor** in the left sidebar
4. Click **New Query** button

### Step 2: Run the Migration
1. Open the file `/scripts/setup-database.sql` in this repository
2. Copy the **entire file contents** (1112 lines)
3. Paste into the Supabase SQL Editor
4. Click **Run** (or press `Cmd/Ctrl + Enter`)
5. Wait for "Success. No rows returned" message (~5-10 seconds)

### Step 3: Verify
Run this query in SQL Editor to verify:
```sql
SELECT 
  'Tables' as type, count(*) as count 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 
  'Views' as type, count(*) as count 
FROM information_schema.views 
WHERE table_schema = 'public';
```

Expected result: **16 tables, 5 views**

---

## What Gets Created

### Core Tables (16 total)

#### User Management
- **user_profiles** - User accounts, tiers, credits, performance metrics
- **user_preferences** - UI settings, notifications, sports preferences

#### Conversations & Messaging
- **conversations** - Chat sessions with metadata
- **messages** - Individual messages with AI metadata
- **message_attachments** - Files attached to messages (images, CSV, TSV)

#### Betting & Predictions
- **predictions** - AI-generated predictions with trust scores
- **user_bets** - Actual bets placed by users
- **odds_history** - Line movement tracking
- **live_odds_cache** - Cached real-time odds (6hr TTL)
- **player_projections** - Player prop projections

#### DFS & Fantasy
- **dfs_lineups** - DraftKings/FanDuel lineups with results

#### AI Trust & Validation
- **ai_response_trust** - Trust scores for AI responses
- **ai_audit_log** - Compliance audit trail
- **odds_benford_baselines** - Benford's Law baselines
- **validation_thresholds** - Sport-specific validation rules

#### Configuration
- **app_config** - Dynamic app configuration

### Views (5 total)
- **user_performance_summary** - User stats and metrics
- **model_trust_scores** - AI model performance
- **config_by_category** - Grouped configuration
- **recent_predictions** - Last 30 days predictions
- **user_chat_summary** - Conversation analytics

### Functions (5 total)
- **update_updated_at_column()** - Auto-timestamp updates
- **update_conversation_on_message()** - Conversation metadata sync
- **update_user_stats_on_prediction()** - User performance tracking
- **cleanup_expired_odds_cache()** - Cache cleanup
- **calculate_user_win_rate()** - Win rate calculation

### Triggers (11 total)
- Auto-update `updated_at` on all tables
- Conversation metadata updates on new messages
- User stats updates on prediction results

### Row Level Security
- **16 tables protected** with RLS policies
- Users can only access their own data
- Public read access for odds/projections/config
- Service role bypasses all restrictions

---

## Schema Highlights

### ✅ Production-Ready Features

1. **Supabase Auth Integration**
   - All user tables reference `auth.users(id)`
   - Automatic user isolation via RLS
   - Secure by default

2. **Complete Data Model**
   - Conversations persist across sessions
   - Messages stored with AI metadata
   - Predictions tracked for accuracy
   - Bets recorded for ROI calculation

3. **Performance Optimized**
   - 60+ strategic indexes
   - JSONB for flexible data
   - Efficient foreign key relationships
   - Views for complex queries

4. **Scalability**
   - UUID primary keys (distributed-ready)
   - Partitioning strategy planned
   - Cache tables with auto-expiration
   - Audit log for compliance

5. **Data Integrity**
   - Foreign key constraints
   - Check constraints on scores (0-1)
   - Unique constraints prevent duplicates
   - Triggers maintain consistency

---

## Configuration Seed Data

The migration includes default configuration for:

### AI Settings
- **Model**: `xai/grok-4-fast` (default), `xai/grok-2-1212` (fallback)
- **Max Tokens**: 2000
- **Temperature**: 0.7

### Rate Limits
- **Free Tier**: 100 calls/day, 15 credits/month, 5 chats
- **Pro Tier**: 1000 calls/day, 500 credits/month
- **Expert Tier**: 10,000 calls/day, 5000 credits/month

### Trust Thresholds
- **High Trust**: ≥0.85
- **Medium Trust**: ≥0.70
- **Low Trust**: ≥0.50

### Validation Thresholds (by sport)
- **NFL**: Benford 0.85, Odds Alignment 0.90, Accuracy 0.75
- **NBA**: Benford 0.83, Odds Alignment 0.88, Accuracy 0.72
- **MLB/NHL**: Benford 0.82, Odds Alignment 0.87, Accuracy 0.70

---

## After Setup

### 1. Update Application Code
The schema is already integrated with your codebase via:
- `/lib/supabase/client.ts` - Browser client
- `/lib/supabase/server.ts` - Server client
- `/lib/leveraged-ai.ts` - AI-enhanced queries

### 2. Test Database Connection
Visit your app at `localhost:3000` and:
1. Sign up / Sign in (creates user_profile automatically)
2. Start a new chat (creates conversation + messages)
3. Ask about a game (creates predictions, caches odds)
4. Verify data in Supabase Dashboard > Table Editor

### 3. Monitor Performance
Use Supabase Dashboard > Database > Query Performance to:
- Check slow queries
- Monitor index usage
- Track table growth

---

## Maintenance

### Cache Cleanup (Recommended: Daily Cron)
```sql
SELECT cleanup_expired_odds_cache();
```

### Audit Log Pruning (Recommended: Weekly)
```sql
DELETE FROM ai_audit_log 
WHERE created_at < NOW() - INTERVAL '90 days';
```

### User Stats Refresh (If needed)
```sql
SELECT calculate_user_win_rate('USER_UUID_HERE');
```

---

## Troubleshooting

### Issue: "relation does not exist"
**Solution**: Schema not created yet. Run `/scripts/setup-database.sql` in Supabase SQL Editor.

### Issue: "permission denied for table"
**Solution**: RLS is blocking access. Ensure user is authenticated and accessing their own data.

### Issue: "duplicate key value violates unique constraint"
**Solution**: Trying to insert duplicate data. Check UNIQUE constraints in schema.

### Issue: Tables exist but app shows no data
**Solution**: 
1. Check RLS policies are correct
2. Verify user is authenticated (`auth.uid()` returns value)
3. Check browser console for Supabase errors

---

## Schema Design Philosophy

This schema follows these principles:

1. **Normalization**: 3NF compliance, minimal redundancy
2. **User-Centric**: All data tied to authenticated users
3. **Audit Trail**: Complete history of AI responses and predictions
4. **Performance**: Strategic indexes, cached data, efficient queries
5. **Flexibility**: JSONB for evolving data structures
6. **Security**: RLS on all tables, user data isolation
7. **Scalability**: UUID keys, partitioning-ready, distributed-friendly

---

## Need Help?

- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **RLS Guide**: [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- **Database Functions**: [PostgreSQL Functions](https://supabase.com/docs/guides/database/functions)

---

## Version History

- **V2 (2026-02-11)**: Complete rewrite with 16 tables, full conversation persistence, betting tracking, DFS support
- **V1 (2026-01-XX)**: Initial schema with AI trust tables only (deprecated)

---

**Ready to build!** Your database is now production-ready with complete data persistence for all application features.
