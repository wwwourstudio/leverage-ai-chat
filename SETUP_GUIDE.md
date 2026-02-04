# 🚀 NFC Assistant Setup Guide

Complete guide to set up and deploy your NFC Assistant application.

---

## Prerequisites

- Node.js 18+ installed
- Supabase account (free tier works)
- xAI API key for Grok AI
- The Odds API key (optional, for live betting odds)

---

## Step 1: Environment Variables

### Required Variables

Create a `.env.local` file in the project root:

```bash
# Supabase Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Configuration (Required for AI features)
XAI_API_KEY=your-xai-api-key

# Optional APIs
ODDS_API_KEY=your-odds-api-key
```

### How to Get API Keys

**Supabase:**
1. Go to https://supabase.com
2. Create a new project
3. Go to Settings → API
4. Copy `URL` and `anon/public` key

**xAI Grok:**
1. Go to https://console.x.ai
2. Create an account
3. Generate API key
4. Copy the key

**The Odds API:**
1. Go to https://the-odds-api.com
2. Sign up for free tier (500 requests/month)
3. Copy your API key

---

## Step 2: Database Setup

### Execute Migration

The app requires specific database tables. You must run the migration:

1. Open your Supabase dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `supabase/migrations/20260201_trust_integrity_system.sql`
5. Paste into the SQL editor
6. Click **Run** or press `Ctrl/Cmd + Enter`

### Verify Tables Created

After running the migration, verify these tables exist:

- ✅ `ai_response_trust`
- ✅ `ai_audit_log`
- ✅ `odds_benford_baselines`
- ✅ `validation_thresholds`
- ✅ `live_odds_cache`

Check in: **Database** → **Tables** in Supabase dashboard

---

## Step 3: Install Dependencies

```bash
npm install
```

If you encounter issues:

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## Step 4: Run Development Server

```bash
npm run dev
```

Open http://localhost:3000 to see your app.

---

## Step 5: Verify Setup

### Health Check

Visit: `http://localhost:3000/api/health`

You should see:

```json
{
  "status": "healthy",
  "ready": true,
  "database": {
    "allTablesExist": true
  }
}
```

### Common Issues

**Status: "degraded"**
- Check environment variables are set correctly
- Verify API keys are valid
- Run database migration if tables are missing

**Database tables: false**
- Migration not executed
- Go back to Step 2 and run the migration

---

## Step 6: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard

1. Go to https://vercel.com
2. Click **Add New** → **Project**
3. Import your Git repository
4. Add environment variables in Vercel dashboard:
   - Settings → Environment Variables
   - Add all variables from `.env.local`
5. Deploy

### Option B: Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add XAI_API_KEY
# ... add all other env vars

# Redeploy with new env vars
vercel --prod
```

---

## Step 7: Post-Deployment Verification

After deploying:

1. Visit your deployed URL
2. Check health endpoint: `https://your-app.vercel.app/api/health`
3. Verify all services show "configured: true"
4. Test the app by sending a message

---

## Troubleshooting

### "Fatal error during initialization"

**Causes:**
- Database tables don't exist
- Environment variables not set
- API keys invalid

**Fixes:**
1. Check health endpoint for specific issues
2. Run database migration
3. Verify all env vars in Vercel dashboard
4. Check API key validity

### "Failed to install packages"

**Causes:**
- Network issues
- Version conflicts
- Missing dependencies

**Fixes:**
1. Clear build cache in Vercel
2. Check `package.json` for syntax errors
3. Ensure all peer dependencies are met
4. Try local build: `npm run build`

### "Table does not exist" errors

**Cause:** Database migration not executed

**Fix:**
1. Go to Supabase SQL Editor
2. Run `supabase/migrations/20260201_trust_integrity_system.sql`
3. Verify tables created
4. Redeploy

### API returns 401 Unauthorized

**Cause:** Invalid API key

**Fix:**
1. Verify API key in environment variables
2. Check key hasn't expired
3. Regenerate key if needed
4. Update in Vercel dashboard
5. Redeploy

---

## Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | For admin operations |
| `XAI_API_KEY` | Yes* | xAI Grok API key |
| `ODDS_API_KEY` | No | The Odds API key |

*Required for AI features. App runs in degraded mode without it.

---

## Development Tips

### Run Health Check

```bash
curl http://localhost:3000/api/health | json_pp
```

### View Logs

```bash
# Development
npm run dev

# Production (Vercel)
vercel logs
```

### Test API Endpoints

```bash
# Health check
curl http://localhost:3000/api/health

# Insights
curl http://localhost:3000/api/insights

# Analyze (requires XAI_API_KEY)
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"query": "Analyze Lakers vs Warriors"}'
```

---

## Getting Help

1. **Check health endpoint** - `GET /api/health` for diagnostics
2. **Review logs** - Browser console (F12) for client errors
3. **Check documentation**:
   - `INITIALIZATION_FIX_PLAN.md` - Detailed troubleshooting
   - `TROUBLESHOOTING.md` - Common issues
   - `ENV_CONFIGURATION.md` - Environment setup

---

## Next Steps

After successful setup:

1. ✅ Customize welcome messages
2. ✅ Add your branding
3. ✅ Configure authentication (optional)
4. ✅ Set up monitoring
5. ✅ Deploy to production

---

## Support

Need help? Check these resources:

- **Health Check**: `/api/health` - System status
- **Documentation**: Project `*.md` files
- **Vercel Support**: https://vercel.com/help
- **Supabase Docs**: https://supabase.com/docs

---

✨ **Your NFC Assistant is ready to go!**
