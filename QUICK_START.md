# Quick Start Guide - Leverage AI Platform

## 🚀 Get Your Database Running in 2 Minutes

Your application is **ready to go** but needs the database tables created. Follow these simple steps:

### Option 1: Supabase SQL Editor (Recommended - Fastest)

1. **Open Supabase SQL Editor**
   - Click this link: [Open SQL Editor](https://eybrsbslfyknmpyhkosz.supabase.co/project/eybrsbslfyknmpyhkosz/sql/new)
   - Or navigate to: Supabase Dashboard → SQL Editor → New Query

2. **Copy the Migration SQL**
   - Open the file: `/scripts/setup-database.sql`
   - Select all (Cmd/Ctrl + A) and copy (Cmd/Ctrl + C)

3. **Run the Migration**
   - Paste into SQL Editor (Cmd/Ctrl + V)
   - Click **Run** button (or press Cmd/Ctrl + Enter)
   - Wait 5-10 seconds for completion
   - You'll see "Success. No rows returned"

4. **Verify Setup**
   - Refresh your v0 application
   - The database status banner should turn green and disappear
   - Start chatting to see real trust metrics!

### Option 2: Verification Script (Optional)

After running the migration, verify everything works:

```bash
cd /vercel/share/v0-project
node scripts/verify-database-setup.js
```

This will check:
- ✓ All 7 tables created
- ✓ Seed data loaded
- ✓ RLS policies working
- ✓ Read/write permissions correct

---

## 📊 What You Get

### 7 Core Tables
1. **ai_response_trust** - Validates AI predictions with Benford's Law
2. **ai_audit_log** - Tracks all AI interactions for compliance
3. **odds_benford_baselines** - Sport-specific statistical baselines
4. **validation_thresholds** - Configurable quality thresholds
5. **live_odds_cache** - Reduces API costs with smart caching
6. **app_config** - Dynamic settings without code deployments
7. **user_profiles** - User performance tracking & rate limiting

### AI-Powered Features
- **Trust Metrics Visualization** - See confidence scores for every prediction
- **Real-time Validation** - Benford's Law checks on all odds data
- **Market Consensus** - Cross-book verification of predictions
- **Historical Accuracy** - Track AI performance over time
- **Risk Assessment** - Automatic risk level calculation

### Production-Ready
- Row Level Security (RLS) on all tables
- Automatic timestamp management
- Optimized indexes for fast queries
- Cache cleanup automation
- Audit logging for compliance

---

## 🎯 What Happens Next

### After Database Setup

1. **The application will automatically:**
   - Start fetching real data from Supabase
   - Calculate trust metrics for AI predictions
   - Display validation scores in the UI
   - Track user predictions and performance
   - Cache odds data to reduce API costs

2. **You'll see in the UI:**
   - Database status: ✅ Connected (banner disappears)
   - Trust metrics: Full breakdown with scores
   - Validation badges: High/Medium/Low trust indicators
   - Data attribution: "Verified by Grok AI" badges

3. **Every AI prediction will show:**
   - **Benford Integrity**: Statistical anomaly detection (0-100%)
   - **Odds Alignment**: Market consensus verification (0-100%)
   - **Historical Accuracy**: Past performance tracking (0-100%)
   - **Final Confidence**: Overall trust score (0-100%)
   - **Risk Level**: Low/Medium/High assessment

---

## 🔍 Troubleshooting

### "Failed to execute code" Error
- **Cause**: Migration hasn't been run yet
- **Fix**: Follow Option 1 above to run the SQL script

### Tables Exist But No Data Showing
- **Cause**: RLS policies may need permissions
- **Fix**: Run this in SQL Editor:
```sql
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT INSERT ON ai_response_trust, ai_audit_log TO authenticated;
```

### Verification Script Shows Missing Tables
- **Cause**: SQL script didn't complete fully
- **Fix**: Re-run the migration SQL in Supabase SQL Editor

### Database Banner Still Shows Warning
- **Cause**: Browser cache or app needs refresh
- **Fix**: Hard refresh (Cmd/Ctrl + Shift + R) or clear cache

---

## 📚 Additional Documentation

- **Detailed Setup**: `/SETUP_DATABASE_INSTRUCTIONS.md`
- **Implementation Summary**: `/IMPLEMENTATION_SUMMARY.md`
- **Database Schema**: `/docs/DATABASE_SCHEMA_PLAN.md`
- **Migration SQL**: `/scripts/setup-database.sql`
- **Verification Script**: `/scripts/verify-database-setup.js`

---

## 🆘 Need Help?

1. **Check the logs**: Look for `[v0]` prefixed console messages
2. **Verify environment variables**: All Supabase vars should be set
3. **Check Supabase dashboard**: Look for error logs in Logs section
4. **Open support ticket**: vercel.com/help

---

## 🎉 Ready to Go!

Your Leverage AI platform is fully built and ready. Just run the migration SQL and you're live with:

- ✅ AI-powered sports betting analysis
- ✅ Real-time odds validation
- ✅ Trust metrics visualization
- ✅ DFS lineup optimization
- ✅ Fantasy draft strategy
- ✅ Kalshi prediction markets
- ✅ Production-ready database
- ✅ Secure authentication
- ✅ Comprehensive audit logging

**Let's get started! Open that SQL Editor and paste the migration.**
