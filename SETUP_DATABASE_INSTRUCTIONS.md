# Database Setup Instructions

Your Supabase connection is active, but the database schema hasn't been created yet. Follow these steps to set up your database:

## Option 1: Supabase SQL Editor (Recommended - 2 minutes)

1. Open your Supabase project dashboard at: https://eybrsbslfyknmpyhkosz.supabase.co
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the contents of `/scripts/setup-database.sql`
5. Paste into the SQL Editor
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. Wait for "Success. No rows returned" message
8. Refresh your v0 application - data should now flow!

## Option 2: Supabase CLI (Advanced)

```bash
# Navigate to project root
cd /vercel/share/v0-project

# Run the migration
supabase db push --file scripts/setup-database.sql
```

## Option 3: Manual Table Creation via UI

If you prefer using Supabase's Table Editor:

1. Go to **Table Editor** in Supabase dashboard
2. Create the following 7 tables in order:

### Table 1: ai_response_trust
- id (uuid, primary key, default: gen_random_uuid())
- model_name (varchar)
- prompt_hash (varchar)
- response_hash (varchar)
- benford_score (numeric)
- odds_alignment_score (numeric)
- historical_accuracy (numeric)
- trust_level (varchar)
- created_at (timestamptz, default: now())
- updated_at (timestamptz, default: now())

### Table 2: ai_audit_log
- id (uuid, primary key)
- event_type (varchar)
- model_name (varchar)
- user_query (text)
- ai_response (text)
- trust_metrics (jsonb)
- flagged (boolean, default: false)
- flag_reason (text)
- created_at (timestamptz, default: now())

### Table 3: odds_benford_baselines
- id (uuid, primary key)
- sport (varchar)
- market_type (varchar)
- baseline_distribution (jsonb)
- sample_size (int4)
- confidence_level (numeric)
- last_updated (timestamptz, default: now())
- created_at (timestamptz, default: now())

### Table 4: validation_thresholds
- id (uuid, primary key)
- sport (varchar)
- market_type (varchar)
- min_benford_score (numeric, default: 0.85)
- min_odds_alignment (numeric, default: 0.90)
- min_historical_accuracy (numeric, default: 0.75)
- created_at (timestamptz, default: now())
- updated_at (timestamptz, default: now())

### Table 5: live_odds_cache
- id (uuid, primary key)
- sport (varchar)
- event_id (varchar)
- market_type (varchar)
- odds_data (jsonb)
- source (varchar)
- fetched_at (timestamptz, default: now())
- expires_at (timestamptz)
- created_at (timestamptz, default: now())

### Table 6: app_config
- id (uuid, primary key)
- config_key (varchar, unique)
- config_value (jsonb)
- category (varchar)
- description (text)
- is_public (boolean, default: true)
- created_at (timestamptz, default: now())
- updated_at (timestamptz, default: now())

### Table 7: user_profiles
- id (uuid, primary key)
- user_id (varchar, unique)
- email (varchar)
- predictions_made (int4, default: 0)
- predictions_correct (int4, default: 0)
- total_roi (numeric, default: 0)
- tier (varchar, default: 'free')
- rate_limit_remaining (int4, default: 100)
- rate_limit_reset_at (timestamptz)
- created_at (timestamptz, default: now())
- updated_at (timestamptz, default: now())

## After Setup

Once tables are created, the application will automatically:
- Query Supabase for real trust metrics
- Store AI response validation data
- Cache odds data to reduce API costs
- Track user performance and predictions

## Verification

After running the SQL, verify tables exist:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see all 7 tables listed.

## Troubleshooting

**Error: "Failed to execute code"**
- This means the migration hasn't been run yet
- Use Option 1 (SQL Editor) above

**Error: "permission denied for table"**
- Run this in SQL Editor:
```sql
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT INSERT ON ai_response_trust, ai_audit_log, live_odds_cache, user_profiles TO authenticated;
```

**Tables exist but no data showing**
- Check RLS policies are enabled
- Verify the seed data was inserted
- Try running the seed data section from `/scripts/setup-database.sql`

## Support

If you encounter issues:
1. Check Supabase logs in the **Logs** section
2. Verify all environment variables are set (they are!)
3. Open a support ticket at vercel.com/help
