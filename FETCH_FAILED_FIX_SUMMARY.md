# Fetch Failed Error - Complete Fix Summary

## Problem Diagnosis

The "fetch failed" error you're experiencing is caused by **missing database tables** in your Supabase instance. Here's what's happening:

1. **Client Request**: The app tries to load user insights on mount
2. **API Call**: `/api/insights` attempts to query `ai_predictions` table
3. **Database Error**: Table doesn't exist → Supabase returns error
4. **Network Failure**: The error propagates as "fetch failed"
5. **Generic Message**: User sees unhelpful "Fatal error during initialization"

## Root Cause

The database migration file exists (`supabase/migrations/20260201_trust_integrity_system.sql`) but **has not been executed** in your Supabase database.

## Fixes Applied

### 1. Enhanced Error Handling & User Guidance

#### `/app/api/insights/route.ts`
- ✅ Detects specific error types (missing tables, permissions, connections)
- ✅ Returns actionable troubleshooting information
- ✅ Provides step-by-step solutions for each error type
- ✅ Links to relevant documentation

**What changed:**
```typescript
// Before: Generic error
return NextResponse.json({
  insights: getDefaultInsights(),
  message: 'Table not yet created'
});

// After: Detailed troubleshooting
return NextResponse.json({
  insights: getDefaultInsights(),
  message: 'Database tables not configured',
  troubleshooting: {
    issue: 'The ai_predictions table does not exist',
    solution: 'Run the database migration',
    steps: [...],
    documentationLink: '/SETUP_GUIDE.md#database-setup'
  }
});
```

### 2. Improved Client-Side Error Messaging

#### `/lib/data-service.ts`
- ✅ Catches and logs detailed error information
- ✅ Provides user-friendly error messages
- ✅ Includes troubleshooting hints in console
- ✅ Directs users to `/api/health` for diagnostics

**Console output now includes:**
```
[DataService] Error fetching insights: fetch failed
[DataService] TROUBLESHOOTING: This is typically caused by:
  1. Database tables not created (run migration in Supabase)
  2. Missing or incorrect environment variables
  3. Supabase project is paused or unavailable
  4. Row Level Security blocking anonymous access
[DataService] Visit /api/health to diagnose the issue
```

### 3. System Status Banner Component

#### `/components/system-status-banner.tsx`
- ✅ Displays real-time system health at the top of the app
- ✅ Shows which integrations are configured
- ✅ Lists missing database tables
- ✅ Provides expandable troubleshooting guide
- ✅ Links to documentation and setup guides
- ✅ "Recheck Status" button to verify fixes

**Features:**
- Auto-checks `/api/health` on mount
- Only displays when issues detected
- Expandable UI with detailed diagnostics
- Quick action buttons for common tasks

### 4. Enhanced Health Check API

#### `/app/api/health/route.ts`
- ✅ Verifies all environment variables
- ✅ Tests Supabase connection
- ✅ Checks if each required table exists
- ✅ Returns detailed status for every integration
- ✅ Provides troubleshooting context in errors

**Now checks:**
- ✓ Supabase URL and anon key
- ✓ Grok AI configuration
- ✓ Odds API key
- ✓ Database connection
- ✓ Table existence: `ai_predictions`, `ai_response_trust`, `ai_audit_log`, etc.

### 5. Troubleshooting Toast Component

#### `/components/troubleshooting-toast.tsx`
- ✅ Shows detailed error information in a dismissible toast
- ✅ Expandable troubleshooting steps
- ✅ Quick action buttons (Retry, Check Status)
- ✅ Links to full documentation
- ✅ Auto-hide option

**Usage:**
```typescript
const { showToast } = useTroubleshootingToast();

showToast('Fetch failed', {
  issue: 'Cannot connect to database',
  solution: 'Run migration script',
  steps: ['Open Supabase', 'Run SQL', 'Refresh page']
});
```

### 6. Error Boundary Improvements

#### `/components/providers.tsx`
- ✅ Wraps entire app in error boundary
- ✅ Catches initialization failures
- ✅ Displays helpful error UI instead of blank screen
- ✅ Server/client component compatibility fix

## How to Resolve the Fetch Failed Error

### Quick Fix (5 minutes)

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the Migration**
   - Open `/supabase/migrations/20260201_trust_integrity_system.sql` in your code
   - Copy the entire contents
   - Paste into the SQL Editor
   - Click "Run" or press Cmd+Enter

4. **Verify Tables Created**
   - Go to "Table Editor" in Supabase
   - Confirm you see these tables:
     - `ai_predictions`
     - `ai_response_trust`
     - `ai_audit_log`
     - `validation_thresholds`
     - `live_odds_cache`
     - `odds_benford_baselines`

5. **Refresh Your App**
   - Go back to your app
   - Refresh the page
   - Visit `/api/health` to verify everything is green

### Detailed Diagnosis

Visit `/api/health` in your browser to see:
- ✓ Which environment variables are set
- ✓ Which database tables exist
- ✓ Which integrations are configured
- ✗ What's missing or misconfigured

## Common Fetch Failed Scenarios

### Scenario 1: Missing Tables
**Error:** `Query validation failure for 'ai_predictions' due to 'fetch failed'`

**Cause:** Database migration not run

**Solution:** Run the migration SQL (steps above)

---

### Scenario 2: Permission Denied
**Error:** `Permission denied for table ai_predictions`

**Cause:** Row Level Security (RLS) blocking access

**Solution:**
1. Open Supabase Dashboard → Authentication → Policies
2. For each table, either:
   - **Option A:** Disable RLS temporarily (easier for development)
   - **Option B:** Add policy: `CREATE POLICY "Enable read access for all users" ON ai_predictions FOR SELECT TO public USING (true);`

---

### Scenario 3: Connection Error
**Error:** `fetch failed` or `NetworkError`

**Cause:** Missing or incorrect environment variables

**Solution:**
1. Check `.env.local` or Vercel environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
2. Verify variables in Vercel Dashboard → Settings → Environment Variables
3. Redeploy if variables were just added

---

### Scenario 4: Supabase Project Paused
**Error:** `fetch failed` or timeout

**Cause:** Free tier Supabase projects pause after inactivity

**Solution:**
1. Go to Supabase Dashboard
2. Click "Resume Project" if you see that option
3. Wait 1-2 minutes for project to wake up
4. Refresh your app

## Testing Your Fix

### 1. Check Health Endpoint
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "ready": true,
  "database": {
    "connected": true,
    "allTablesExist": true,
    "tables": {
      "ai_predictions": true,
      "ai_response_trust": true,
      ...
    }
  }
}
```

### 2. Check Insights Endpoint
```bash
curl http://localhost:3000/api/insights
```

Expected response:
```json
{
  "success": true,
  "insights": { ... },
  "dataSource": "live" or "default"
}
```

### 3. Open the App
- Should load without errors
- System Status Banner should either:
  - Not appear (everything configured)
  - Show green checkmarks for all items

## Prevention

To avoid this in the future:

1. **Always run migrations after cloning**
   ```bash
   # Copy migration to Supabase SQL Editor
   # or use Supabase CLI:
   supabase db push
   ```

2. **Check health on deploy**
   - Visit `/api/health` after each deployment
   - Verify all tables exist

3. **Use System Status Banner**
   - Keep it visible during development
   - It will automatically warn about missing configuration

4. **Set up RLS policies early**
   - Don't rely on disabled RLS in production
   - Create proper policies for authenticated and anonymous access

## Documentation

- **Full Setup Guide:** `/SETUP_GUIDE.md`
- **Detailed Troubleshooting:** `/DEPLOYMENT_TROUBLESHOOTING.md`
- **Database Setup:** `/scripts/setup-database.md`
- **Quick Fixes:** `/QUICK_FIX_README.md`

## Support

If you're still experiencing issues after following these steps:

1. Check the console logs for detailed error messages
2. Visit `/api/health` and share the full JSON response
3. Verify your Supabase project is active and accessible
4. Ensure all environment variables are correctly set
5. Review the browser network tab to see the exact API error

The new error handling provides much more context, so check:
- Browser console (`[v0]` and `[DataService]` prefixes)
- System Status Banner (top of the page)
- Health endpoint JSON response
- API route logs (server console)

---

## Summary

✅ **Fixed:** Vague "fatal error" → Detailed troubleshooting guidance
✅ **Fixed:** Silent failures → Comprehensive error logging
✅ **Fixed:** No diagnostics → Health check endpoint + UI banner
✅ **Fixed:** No user guidance → Step-by-step solutions in-app

**Next step:** Run the database migration and your fetch errors will be resolved!
