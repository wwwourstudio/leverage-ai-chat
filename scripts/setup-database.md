# Database Setup Instructions

This guide will help you set up the required database tables for the NFC Assistant.

## Method 1: Via Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com
   - Log in to your account
   - Select your project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy Migration SQL**
   - Open the file: `supabase/migrations/20260201_trust_integrity_system.sql`
   - Copy ALL the SQL code (Ctrl+A, Ctrl+C)

4. **Execute Migration**
   - Paste the SQL into the query editor
   - Click "Run" button (or press Ctrl/Cmd + Enter)
   - Wait for execution to complete (should take 1-2 seconds)

5. **Verify Success**
   - You should see "Success. No rows returned"
   - Go to "Database" → "Tables" in sidebar
   - Verify these tables exist:
     - ✅ ai_response_trust
     - ✅ ai_audit_log
     - ✅ odds_benford_baselines
     - ✅ validation_thresholds
     - ✅ live_odds_cache

## Method 2: Via Supabase CLI

If you have Supabase CLI installed:

```bash
# Link to your project
supabase link --project-ref your-project-ref

# Apply migration
supabase db push

# Or apply specific migration
supabase db push supabase/migrations/20260201_trust_integrity_system.sql
```

## Method 3: Via Node.js Script

Run this from your project root:

```bash
node scripts/run-migration.js
```

(Note: This requires `@supabase/supabase-js` to be installed)

## Troubleshooting

### "Permission denied" error

**Solution:** Make sure you're using the correct Supabase credentials with admin permissions.

### "Relation already exists" error

**Solution:** Tables already created! This is fine. You can skip the migration.

### "Could not connect to database"

**Solutions:**
- Check your Supabase project is not paused
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
- Check internet connection

## Verification

After running the migration, verify setup:

```bash
# Check if tables exist via API
curl http://localhost:3000/api/health
```

Look for:
```json
{
  "database": {
    "allTablesExist": true
  }
}
```

## What This Migration Creates

### Tables

1. **ai_response_trust** - Stores trust metrics for AI responses
2. **ai_audit_log** - Audit trail for all AI interactions
3. **odds_benford_baselines** - Statistical baselines for validation
4. **validation_thresholds** - Configurable validation rules
5. **live_odds_cache** - Cached odds data for performance

### Indexes

- Performance indexes on frequently queried columns
- Optimizes queries by sport, market type, and timestamps

### Views

- **model_trust_scores** - Aggregated trust metrics per AI model

### Functions & Triggers

- Automatic baseline updates when new odds are cached
- Cleanup function for expired cache data

### Row Level Security (RLS)

- Read access policies for all tables
- Prepares for multi-tenant deployments

## Post-Migration

After successful migration:

1. Restart your development server
2. Check health endpoint
3. Test the app
4. Deploy to production

## Need Help?

- Review `SETUP_GUIDE.md` for complete setup instructions
- Check `INITIALIZATION_FIX_PLAN.md` for troubleshooting
- Visit Supabase docs: https://supabase.com/docs
