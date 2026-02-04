# 🚨 Quick Fix Guide - Start Here!

If you're seeing errors or deployment failures, follow these steps in order.

---

## ⚡ 60-Second Fix

### Step 1: Check What's Wrong

Visit your health endpoint:
```bash
https://your-app.vercel.app/api/health
```

Or locally:
```bash
http://localhost:3000/api/health
```

### Step 2: Fix Based on Health Check

**If you see: `"allTablesExist": false`**
→ **Problem:** Database not set up  
→ **Fix:** Run migration (see below)

**If you see: `"grokAI": { "configured": false }`**
→ **Problem:** Missing XAI_API_KEY  
→ **Fix:** Add environment variable

**If you see: `"supabase": { "configured": false }`**
→ **Problem:** Missing Supabase credentials  
→ **Fix:** Add SUPABASE_URL and SUPABASE_ANON_KEY

---

## 🔥 Most Common Issues

### Issue #1: "Fatal error during initialization"

**Quick Fix:**
1. Go to Supabase Dashboard → SQL Editor
2. Copy all code from `supabase/migrations/20260201_trust_integrity_system.sql`
3. Paste and run in SQL Editor
4. Verify tables created in Database → Tables
5. Redeploy

**Time:** 2 minutes

---

### Issue #2: "Failed to install packages"

**Quick Fix:**
```bash
# Add missing dependencies
npm install --save-dev eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-config-next

# Then redeploy
vercel --prod
```

**Time:** 1 minute

---

### Issue #3: "API not configured"

**Quick Fix:**

In Vercel Dashboard → Settings → Environment Variables, add:

```
XAI_API_KEY=your-key-here
NEXT_PUBLIC_SUPABASE_URL=your-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key-here
```

Then redeploy.

**Time:** 2 minutes

---

## 📋 Complete Setup (First Time)

### 1. Environment Variables

Create `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
XAI_API_KEY=xai-xxx...
ODDS_API_KEY=xxx... # Optional
```

### 2. Run Database Migration

**Via Supabase Dashboard:**
1. Open SQL Editor
2. Copy `supabase/migrations/20260201_trust_integrity_system.sql`
3. Paste and execute
4. Verify 5 tables created

### 3. Install & Run

```bash
npm install
npm run dev
```

### 4. Verify

Check: http://localhost:3000/api/health

Should show:
```json
{
  "status": "healthy",
  "ready": true
}
```

**Total Time:** 5 minutes

---

## 🆘 Emergency Troubleshooting

### App Won't Start

```bash
# Nuclear option - fresh start
rm -rf node_modules package-lock.json .next
npm install
npm run dev
```

### Deployment Failing

1. Clear build cache in Vercel
2. Check all env vars are set
3. Run migration in Supabase
4. Redeploy

### Database Errors

1. Check migration ran successfully
2. Verify all 5 tables exist
3. Check RLS policies allow access
4. Use service role key if needed

---

## 📚 Detailed Guides

**For specific issues, check:**

- `SETUP_GUIDE.md` - Complete setup walkthrough
- `DEPLOYMENT_TROUBLESHOOTING.md` - All error solutions
- `INITIALIZATION_FIX_PLAN.md` - Technical details
- `scripts/setup-database.md` - Database help

---

## ✅ Verification Checklist

After fixes, verify:

- [ ] Health endpoint returns `"ready": true`
- [ ] No console errors (F12)
- [ ] Can send messages
- [ ] API responses work
- [ ] Database queries succeed

---

## 🎯 Common Error Messages → Solutions

| Error | Solution |
|-------|----------|
| "Fatal error during initialization" | Run database migration |
| "Table does not exist" | Execute migration SQL |
| "Invalid API key" | Check XAI_API_KEY is set |
| "Failed to install packages" | Add eslint to devDependencies |
| "Permission denied" | Check Supabase RLS policies |
| "Service unavailable" | Check all env vars set |

---

## 🔍 Debug Commands

```bash
# Check health
curl http://localhost:3000/api/health | json_pp

# Test insights API
curl http://localhost:3000/api/insights

# View logs
npm run dev # Watch console

# Build test
npm run build
```

---

## 💡 Pro Tips

1. **Always check health endpoint first** - it tells you exactly what's wrong
2. **Run migration before first deploy** - prevents initialization errors
3. **Verify env vars locally** - test with `.env.local` before deploying
4. **Check browser console** - most errors show detailed info
5. **Use Vercel logs** - real-time debugging in dashboard

---

## 🚀 Quick Deploy

```bash
# Make sure everything works locally first
npm run build

# Then deploy
vercel --prod

# Check it works
curl https://your-app.vercel.app/api/health
```

---

## ⚠️ Don't Forget

- **Database migration** must run before app works
- **Environment variables** must be in Vercel dashboard
- **API keys** must be valid and active
- **Health check** is your best friend

---

**Still stuck?** Check the health endpoint - it will tell you exactly what needs to be fixed!

```bash
curl https://your-app.vercel.app/api/health | json_pp
```

The response shows exactly which services need attention.
