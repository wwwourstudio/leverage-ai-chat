# 🔧 Deployment Troubleshooting Guide

Complete troubleshooting guide for initialization and deployment issues.

---

## Quick Diagnosis

Run these checks first:

```bash
# 1. Check health endpoint
curl https://your-app.vercel.app/api/health | json_pp

# 2. Check build logs in Vercel dashboard

# 3. Check browser console (F12)
```

---

## Common Errors & Solutions

### 1. "Fatal error during initialization. Please try again."

**Symptoms:**
- App shows error on load
- White screen or error boundary displayed
- Console shows initialization errors

**Root Causes & Fixes:**

#### A. Database Tables Missing

**Check:**
```bash
curl https://your-app.vercel.app/api/health
# Look at "database.allTablesExist"
```

**Fix:**
1. Go to Supabase Dashboard → SQL Editor
2. Open `supabase/migrations/20260201_trust_integrity_system.sql`
3. Copy all SQL code
4. Paste into SQL Editor and run
5. Verify tables exist in Database → Tables
6. Redeploy app

**Prevention:**
- Always run migrations before first deployment
- Add migration to CI/CD pipeline

#### B. Environment Variables Not Set

**Check:**
```bash
# In Vercel dashboard: Settings → Environment Variables
```

**Required Variables:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `XAI_API_KEY`

**Fix:**
1. Go to Vercel dashboard
2. Settings → Environment Variables
3. Add missing variables
4. Redeploy

#### C. API Routes Failing

**Check browser console:**
```
Failed to fetch from /api/insights
Failed to fetch from /api/analyze
```

**Fix:**
1. Check API routes are deployed (visit them directly)
2. Verify edge runtime compatibility
3. Check server logs in Vercel
4. Ensure no Node.js-only code in edge routes

---

### 2. "Failed to install packages during PREVIEW"

**Symptoms:**
- Build fails during npm install
- "Cannot find module" errors
- Dependency resolution errors

**Root Causes & Fixes:**

#### A. Missing Dependencies

**Check:**
```json
// package.json
{
  "scripts": {
    "lint": "eslint ." // ← eslint must be in devDependencies
  }
}
```

**Fix:**
```bash
npm install --save-dev eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

#### B. Version Conflicts

**Symptoms:**
```
npm ERR! peer dependency conflict
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Fix:**
```bash
# Option 1: Force install
npm install --legacy-peer-deps

# Option 2: Update conflicting packages
npm update

# Option 3: Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### C. Registry/Network Issues

**Symptoms:**
```
npm ERR! network timeout
npm ERR! 404 Not Found
```

**Fix:**
1. Check npm registry status: https://status.npmjs.org
2. Clear npm cache: `npm cache clean --force`
3. Try different registry: `npm config set registry https://registry.npmjs.org/`
4. Retry deployment

#### D. Build Cache Issues

**Fix in Vercel:**
1. Go to deployment settings
2. Enable "Clear build cache"
3. Redeploy

---

### 3. "Table 'ai_response_trust' does not exist"

**Symptom:**
- API routes return errors
- Console shows database errors
- Health check shows `allTablesExist: false`

**Root Cause:**
Migration SQL not executed in Supabase

**Fix:**

**Step-by-step:**
1. Open https://supabase.com
2. Select your project
3. Click "SQL Editor"
4. Click "New Query"
5. Copy contents of `supabase/migrations/20260201_trust_integrity_system.sql`
6. Paste into editor
7. Click "Run" (or Ctrl+Enter)
8. Wait for "Success" message
9. Go to "Database" → "Tables"
10. Verify tables exist:
    - ai_response_trust ✅
    - ai_audit_log ✅
    - odds_benford_baselines ✅
    - validation_thresholds ✅
    - live_odds_cache ✅

**Verification:**
```bash
curl https://your-app.vercel.app/api/health
# Should show "allTablesExist": true
```

---

### 4. "Invalid API key" / 401 Unauthorized

**Symptoms:**
- AI features don't work
- API returns 401 errors
- Health check shows grok: not configured

**Fix:**

**For xAI Grok:**
1. Visit https://console.x.ai
2. Generate new API key
3. Copy key
4. Add to Vercel: `XAI_API_KEY=xai-...`
5. Redeploy

**For Supabase:**
1. Visit Supabase dashboard
2. Settings → API
3. Copy `URL` and `anon public` key
4. Update in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Redeploy

**Verification:**
```bash
curl https://your-app.vercel.app/api/health
# Check "integrations" section
```

---

### 5. Edge Runtime Errors

**Symptoms:**
```
Error: Dynamic Code Evaluation not allowed in Edge Runtime
Error: process.cwd() is not available in Edge Runtime
```

**Causes:**
- Using Node.js-only APIs in edge routes
- Dynamic require/eval
- File system operations

**Fix:**

Check API routes have:
```typescript
export const runtime = 'edge';
```

Avoid in edge routes:
- `fs` module
- `process.cwd()`
- `child_process`
- Dynamic `require()`

**Solution:**
Move Node.js code to middleware or use serverless runtime:
```typescript
export const runtime = 'nodejs'; // Instead of 'edge'
```

---

### 6. Row Level Security (RLS) Issues

**Symptoms:**
```
Error: new row violates row-level security policy
Permission denied for table
```

**Fix:**

**Option 1: Use service role key (not recommended for production)**
```typescript
const supabase = createClient(url, serviceRoleKey);
```

**Option 2: Update RLS policies**
```sql
-- Allow inserts for authenticated users
CREATE POLICY "Allow insert for authenticated users"
  ON ai_response_trust FOR INSERT
  WITH CHECK (true);
```

**Option 3: Temporarily disable RLS (development only)**
```sql
ALTER TABLE ai_response_trust DISABLE ROW LEVEL SECURITY;
```

---

## Debugging Steps

### Step 1: Check Health Endpoint

```bash
curl https://your-app.vercel.app/api/health | json_pp
```

**Look for:**
- `status`: Should be "healthy"
- `ready`: Should be `true`
- `integrations`: All should show `configured: true`
- `database.allTablesExist`: Should be `true`

### Step 2: Check Vercel Logs

1. Go to Vercel dashboard
2. Select your deployment
3. Click "Functions" tab
4. View real-time logs
5. Look for error messages

### Step 3: Check Browser Console

1. Open your app
2. Press F12 (Developer Tools)
3. Go to Console tab
4. Look for red errors
5. Check Network tab for failed requests

### Step 4: Test API Endpoints Individually

```bash
# Test insights API
curl https://your-app.vercel.app/api/insights

# Test analyze API (requires XAI_API_KEY)
curl -X POST https://your-app.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'

# Test health check
curl https://your-app.vercel.app/api/health
```

---

## Prevention Best Practices

### Before Deployment

- [ ] Run `npm run build` locally
- [ ] Test all environment variables
- [ ] Execute database migrations
- [ ] Check health endpoint locally
- [ ] Review Vercel logs

### Deployment Checklist

- [ ] All env vars set in Vercel
- [ ] Database migration executed
- [ ] API keys are valid
- [ ] Health check passes
- [ ] No console errors
- [ ] Test user flow works

### Monitoring

Set up:
- Health check monitoring (pingdom, uptime robot)
- Error tracking (Sentry, LogRocket)
- Analytics (Vercel Analytics)
- Log aggregation (Vercel Logs, Datadog)

---

## Getting Help

### 1. Check Documentation
- `SETUP_GUIDE.md` - Complete setup instructions
- `INITIALIZATION_FIX_PLAN.md` - Detailed troubleshooting
- `scripts/setup-database.md` - Database setup help

### 2. Use Health Endpoint
```bash
curl https://your-app.vercel.app/api/health
```

### 3. Check Logs
- Vercel dashboard logs
- Browser console (F12)
- Supabase logs

### 4. Common Resources
- Vercel Support: https://vercel.com/help
- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs

---

## Emergency Fixes

### If app is completely broken:

1. **Rollback deployment:**
   ```bash
   vercel rollback
   ```

2. **Check previous working deployment:**
   - Go to Vercel dashboard
   - Deployments tab
   - Find last working version
   - Click "..." → "Promote to Production"

3. **Start fresh:**
   ```bash
   # Clear everything
   rm -rf node_modules package-lock.json .next
   npm install
   npm run build
   vercel --prod
   ```

---

## Success Verification

After fixes, verify:

✅ Health endpoint returns `status: "healthy"`  
✅ App loads without errors  
✅ Can send messages and get responses  
✅ No console errors  
✅ All API endpoints work  
✅ Database queries succeed  

---

**Need more help?** Check the health endpoint first - it will tell you exactly what's wrong!
