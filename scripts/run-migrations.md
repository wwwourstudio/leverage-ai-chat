# Run Migrations Manually

Since the Supabase connection is timing out, follow these steps to run migrations manually.

## Step 1: Access Supabase SQL Editor

1. Go to https://app.supabase.com
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**

## Step 2: Execute Migrations in Order

### Migration 1: Core Schema (Required First)

Copy and paste this entire migration into the SQL Editor:

**File**: `supabase/migrations/20260202_core_application_schema.sql`

Key tables created:
- users (with credits tracking)
- chats (conversations by category)
- messages (with trust scores)
- credits_ledger (transaction log)

### Migration 2: Portfolio & Odds

**File**: `supabase/migrations/20260203_portfolio_odds_schema.sql`

Key tables created:
- odds_cache (The Odds API caching)
- user_portfolios (bet/fantasy tracking)
- portfolio_updates (historical values)

### Migration 3: Functions & Triggers

**File**: `supabase/migrations/20260204_functions_triggers.sql`

Key functions created:
- deduct_credits() - Auto-deduct on message
- update_chat_timestamp() - Update chat on new message
- cleanup_expired_odds() - Remove stale cache
- calculate_portfolio_value() - Real-time P&L

### Migration 4: RLS Policies

**File**: `supabase/migrations/20260205_rls_policies.sql`

Security policies created:
- User-specific data access
- Public read for odds cache
- Service role bypass for admin

## Step 3: Verify Tables

Run this query to verify all tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Expected tables:
- ai_audit_log
- ai_response_trust
- chats
- credits_ledger
- live_odds_cache
- messages
- odds_benford_baselines
- odds_cache
- portfolio_updates
- user_portfolios
- users
- validation_thresholds

## Step 4: Enable Realtime

1. Go to **Database** → **Replication** in Supabase Dashboard
2. Find the `messages` table and toggle **Enable**
3. Find the `credits_ledger` table and toggle **Enable**

## Step 5: Create Storage Bucket (Optional)

For file attachments in chat:

1. Go to **Storage** in Supabase Dashboard
2. Click **New Bucket**
3. Name: `chat-attachments`
4. Public: **Yes** (for image previews)
5. Set policies:
   - **INSERT**: `authenticated` users only
   - **SELECT**: `public` (anyone can view)

## Step 6: Test the Connection

Run this query to create a test user (replace with your auth.users ID):

```sql
-- Insert test user (use your actual auth.users ID)
INSERT INTO public.users (id, email, full_name, credits_balance)
VALUES (
  'YOUR_AUTH_USER_ID',
  'test@example.com',
  'Test User',
  100
);

-- Verify user was created
SELECT * FROM public.users;
```

## Common Issues

### "relation does not exist"
- Run migrations in order (1, 2, 3, 4)
- Check if previous migration completed successfully

### "violates foreign key constraint"
- Ensure auth.users table exists (it should by default)
- Check that parent tables are created first

### "permission denied"
- RLS policies might be blocking
- Use the SQL Editor (runs as service role)
- Disable RLS temporarily for testing: `ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;`

## Next Steps

After migrations complete:

1. Update environment variables in Vercel
2. Restart your Next.js dev server
3. Test authentication and chat creation
4. Monitor odds API usage in dashboard
