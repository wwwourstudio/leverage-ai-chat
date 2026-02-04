# 🚀 START HERE - NFC Assistant Setup & Troubleshooting

## Current Issue: "Fetch Failed" Error

You're seeing a **fetch failed** error because the database tables haven't been created yet. This is normal for a fresh setup!

## ⚡ 60-Second Fix

1. **Open Supabase Dashboard**
   - Go to: https://app.supabase.com
   - Select your project

2. **Run the Migration**
   - Click "SQL Editor" in sidebar
   - Click "New Query"
   - Open file: `supabase/migrations/20260201_trust_integrity_system.sql`
   - Copy all contents → Paste in SQL Editor
   - Click "Run" (or Cmd+Enter)

3. **Verify**
   - Go to your app
   - Visit: `http://localhost:3000/api/health` (or your deployed URL)
   - Look for: `"allTablesExist": true`

4. **Refresh Your App**
   - Everything should now work!

## 🔍 What Changed

I've added comprehensive error handling and diagnostics to help you troubleshoot issues:

### New Features

1. **System Status Banner**
   - Displays at the top when there are configuration issues
   - Shows which integrations are configured
   - Lists missing database tables
   - Provides step-by-step troubleshooting

2. **Enhanced Health Check** (`/api/health`)
   - Tests all environment variables
   - Checks database connection
   - Verifies each table exists
   - Returns detailed status for debugging

3. **Better Error Messages**
   - APIs now return specific error causes
   - Console logs include troubleshooting hints
   - Users see actionable guidance instead of "fatal error"

4. **Troubleshooting Components**
   - Toast notifications with fix suggestions
   - Error boundary to catch initialization failures
   - Links to documentation from error messages

### What Was Fixed

✅ **Before:**
```
Fatal error during initialization. Please try again.
```

✅ **After:**
```
Configuration Required

Database Tables Missing: The ai_predictions table does not exist in your Supabase database

Solution:
1. Open Supabase Dashboard → SQL Editor
2. Copy content from supabase/migrations/20260201_trust_integrity_system.sql
3. Execute the SQL script
4. Refresh this page

[Recheck Status] [Setup Guide] [Troubleshooting]
```

## 📚 Documentation

I've created several guides to help you:

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **FETCH_FAILED_FIX_SUMMARY.md** | Complete guide to fixing fetch errors | You're seeing "fetch failed" or "query validation failure" |
| **SETUP_GUIDE.md** | Full application setup walkthrough | First time setting up the project |
| **DEPLOYMENT_TROUBLESHOOTING.md** | Comprehensive error diagnostics | Any deployment or runtime issues |
| **QUICK_FIX_README.md** | Common problems and solutions | Need a fast fix for a known issue |
| **scripts/setup-database.md** | Database migration instructions | Setting up Supabase tables |

## 🔧 Diagnostic Tools

### 1. Health Check Endpoint

Visit `/api/health` to see complete system status:

```bash
# Local development
http://localhost:3000/api/health

# Production
https://your-app.vercel.app/api/health
```

**What it checks:**
- ✓ Environment variables set correctly
- ✓ Supabase connection working
- ✓ All database tables exist
- ✓ Grok AI configured
- ✓ Odds API configured

### 2. System Status Banner

The app now displays a banner at the top when issues are detected:
- Automatic health check on page load
- Expandable troubleshooting details
- Quick action buttons
- Links to documentation

### 3. Browser Console

Enhanced logging with prefixes:
```
[v0] - Client-side events
[API] - API route activity
[DataService] - Data fetching operations
[Database] - Database queries
[Health] - Health check operations
```

## 🐛 Common Issues & Solutions

### Issue 1: "Fetch Failed" Error

**Symptom:** App fails to load, shows error toast

**Cause:** Database tables don't exist

**Fix:** Run the migration (see 60-second fix above)

**Verify:** `/api/health` shows `"allTablesExist": true`

---

### Issue 2: "Permission Denied" Error

**Symptom:** Tables exist but queries fail

**Cause:** Row Level Security (RLS) blocking access

**Fix:**
1. Go to Supabase Dashboard → Authentication → Policies
2. For each table, add this policy:
   ```sql
   CREATE POLICY "Enable read for all" 
   ON table_name FOR SELECT 
   TO public 
   USING (true);
   ```
3. Or temporarily disable RLS (development only)

---

### Issue 3: Environment Variables Not Set

**Symptom:** Health check shows missing variables

**Cause:** `.env.local` not configured or Vercel vars not set

**Fix:**
1. **Local:** Create `.env.local` with:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
   XAI_API_KEY=your-grok-key
   ODDS_API_KEY=your-odds-key
   ```

2. **Production:** Set in Vercel Dashboard
   - Go to Project Settings → Environment Variables
   - Add each variable
   - Redeploy

---

### Issue 4: Supabase Project Paused

**Symptom:** Connection timeouts

**Cause:** Free tier projects pause after inactivity

**Fix:**
1. Go to Supabase Dashboard
2. Click "Resume Project"
3. Wait 1-2 minutes
4. Refresh your app

---

### Issue 5: "ERR_PNPM_BROKEN_LOCKFILE"

**Symptom:** Build fails during package installation

**Cause:** Corrupted or conflicting lockfile

**Fix:** Already applied - lockfile was deleted and will regenerate

## ✅ Verification Checklist

Before you consider the setup complete:

- [ ] Run database migration in Supabase
- [ ] All environment variables set (check `/api/health`)
- [ ] Health endpoint returns `"status": "healthy"`
- [ ] All tables exist: `"allTablesExist": true`
- [ ] App loads without errors
- [ ] System Status Banner doesn't show (or shows all green)
- [ ] Console has no critical errors
- [ ] Can navigate the app and see default data

## 🚦 What to Expect

### With Database Configured
- App loads successfully
- Insights show default/calculated data
- No error banners
- `/api/health` shows green status

### Without Database (Safe Fallback Mode)
- App still loads and works
- Uses default demo data
- System Status Banner explains what's missing
- Clear path to full configuration

## 📞 Still Having Issues?

1. **Check the health endpoint first:**
   ```bash
   curl http://localhost:3000/api/health | json_pp
   ```

2. **Review console logs:**
   - Look for `[v0]`, `[API]`, `[DataService]` prefixes
   - Note any error messages

3. **Check the System Status Banner:**
   - Should appear at top of app if issues exist
   - Click to expand for detailed troubleshooting

4. **Review documentation:**
   - Start with `FETCH_FAILED_FIX_SUMMARY.md`
   - Check `DEPLOYMENT_TROUBLESHOOTING.md` for specific errors

5. **Verify Supabase:**
   - Project is active (not paused)
   - Tables exist in Table Editor
   - RLS policies allow access
   - Environment variables are correct

## 🎯 Next Steps

1. **Run the 60-second fix** (database migration)
2. **Visit `/api/health`** to verify everything is configured
3. **Refresh the app** and verify it loads without errors
4. **Start using the app!**

The app is designed to provide helpful guidance when things go wrong. Pay attention to:
- System Status Banner (top of page)
- Error toasts (bottom right)
- Console logs (browser DevTools)
- Health check JSON (diagnostic endpoint)

---

**Need help?** Check `DEPLOYMENT_TROUBLESHOOTING.md` for detailed error-specific solutions.
