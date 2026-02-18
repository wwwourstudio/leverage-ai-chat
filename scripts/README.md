# Scripts Directory - Consolidated & Streamlined

All scripts have been refactored into a unified, maintainable codebase.

## 🚀 Quick Start

### 1. Database Setup (Execute ONCE in Supabase SQL Editor)

```sql
-- Copy/paste: scripts/master-schema.sql
-- Creates all 13 tables with indexes, RLS policies, and realtime subscriptions
```

### 2. Verify Installation

```bash
npx tsx scripts/test-system.ts --all
```

## 📁 Core Files

### Production Files (Use These)

- **master-schema.sql** - Complete unified database schema (336 lines)
  - All 13 tables: live_odds_cache, sport-specific odds, line_movement, arbitrage, props, kalshi, capital_state, etc.
  - Indexes on all query paths
  - RLS policies for security
  - Realtime subscriptions enabled
  
- **test-system.ts** - Unified testing suite (296 lines)
  - Database health checks
  - API integration tests
  - Cards generator validation
  - Odds calculation verification
  - Run with: `--all`, `--database`, `--api`, `--cards`, or `--odds`

- **check-database-health.ts** - Automated database diagnostics
  - Checks all required tables exist
  - Verifies column integrity
  - Tests data freshness
  - Validates indexes

### Migration Files (Apply as Needed)

- **fix-missing-columns.sql** - Adds `sport_key` and `consensus_score` columns
- **quantitative-trading-schema.sql** - Trading engine tables (capital_state, bet_allocations)
- **performance-indexes.sql** - Additional query optimizations
- **rls-policies.sql** - Security policies (already in master-schema.sql)
- **enable-realtime.sql** - Realtime config (already in master-schema.sql)

### Utility Files

- **backfill-historical-data.ts** - Populate historical_games table
- **execute-migration.ts** - Run SQL migrations programmatically
- **fix-security-warnings.sql** - Security audit fixes
- **odds-storage-by-sport.sql** - Sport-specific optimizations

## 🧪 Testing

### Run All Tests
```bash
npx tsx scripts/test-system.ts --all
```

### Run Specific Test Suites
```bash
npx tsx scripts/test-system.ts --database  # Database connectivity and schema
npx tsx scripts/test-system.ts --api       # Odds API integration
npx tsx scripts/test-system.ts --cards     # Card generation for all categories
npx tsx scripts/test-system.ts --odds      # Math validation (conversions, arbitrage)
```

### Expected Output
```
✓ [Database] Connection: Supabase connection successful
✓ [Database] Table live_odds_cache: Table exists and accessible
✓ [API] API Key: API key configured (a1b2c3d4...)
✓ [API] Fetch NHL odds: Received 8 games
✓ [Cards] Category: arbitrage: Generated 3 cards
✓ [Odds] Convert +150: Converted to 2.50 (expected 2.5)

📊 TEST SUMMARY
✓ Passed: 42/45
✗ Failed: 0/45
⚠ Warnings: 3/45
```

## 🗑️ Removed Redundant Files

### Consolidated into master-schema.sql
- ❌ DEPLOY_THIS_SCHEMA.sql
- ❌ complete-database-schema.sql
- ❌ setup-database.sql
- ❌ trading-engine-schema.sql
- ❌ add-performance-indexes.sql

### Consolidated into test-system.ts
- ❌ test-odds-api.ts
- ❌ test-odds-apis.ts
- ❌ test-integration.ts
- ❌ test-end-to-end.ts
- ❌ test-cards-generator.ts
- ❌ validate-odds-calculations.ts
- ❌ diagnose-api-response.ts

### Consolidated into check-database-health.ts
- ❌ verify-database-setup.sql
- ❌ verify-database.sql
- ❌ verify-odds-tables.ts
- ❌ verify-config.ts

**Result:** Reduced from 26 files to 12 files while maintaining all functionality.

## 🔧 Setup Workflow

### First-Time Installation

1. **Execute Master Schema**
   - Open Supabase SQL Editor
   - Copy/paste `scripts/master-schema.sql`
   - Click "Run"
   - Wait for success message

2. **Verify Database**
   ```bash
   npx tsx scripts/test-system.ts --database
   ```

3. **Test API Integration**
   ```bash
   npx tsx scripts/test-system.ts --api
   ```

4. **Run Full Test Suite**
   ```bash
   npx tsx scripts/test-system.ts --all
   ```

### Troubleshooting

If database tests fail:
1. Run `scripts/fix-missing-columns.sql` in Supabase SQL Editor
2. Check environment variables are set correctly
3. Run health check: `npx tsx scripts/check-database-health.ts`

If API tests fail:
1. Verify ODDS_API_KEY is set
2. Check API quota at https://the-odds-api.com/
3. Confirm sport has games scheduled today

## 📊 What Gets Tested

### Database Tests (--database)
- ✓ Supabase connection
- ✓ All 13 required tables exist
- ✓ sport_key column in live_odds_cache
- ✓ consensus_score column in ai_response_trust
- ✓ Data freshness (< 60 minutes old)

### API Tests (--api)
- ✓ ODDS_API_KEY configured
- ✓ Fetch live NHL odds
- ✓ Response contains h2h, spreads, totals markets
- ✓ Data structure validation

### Cards Generator Tests (--cards)
- ✓ betting category (live odds with 3-card minimum)
- ✓ arbitrage category (cross-book opportunities)
- ✓ lines category (steam moves and sharp money)
- ✓ portfolio category (Kelly sizing and bankroll)
- ✓ props category (player prop markets)
- ✓ kalshi category (prediction markets)

### Odds Calculation Tests (--odds)
- ✓ American to decimal conversion
- ✓ Implied probability calculations
- ✓ Arbitrage detection math
- ✓ Kelly Criterion validation

## 🎯 Best Practices

1. **Always run master-schema.sql first** - Creates all tables with proper constraints
2. **Use test-system.ts for validation** - Catches issues before production
3. **Run tests after any schema changes** - Ensures nothing broke
4. **Monitor /api/health endpoint** - Production health monitoring
5. **Keep API keys in .env.local** - Never commit credentials

## 📝 Maintenance

When updating the system:

- **Database schema changes**: Update master-schema.sql
- **New test scenarios**: Add to test-system.ts
- **Health check additions**: Update check-database-health.ts
- **New migrations**: Create timestamped file with clear name

## 🔍 Health Check Endpoint

Production monitoring via API:

```bash
# Local
curl http://localhost:3000/api/health

# Production
curl https://your-app.vercel.app/api/health
```

Returns JSON with:
- Database connectivity status
- API key validation
- Service health (odds, Supabase, Kalshi)
- System uptime

## 📞 Common Issues

**"Table does not exist" error**
→ Run master-schema.sql in Supabase SQL Editor

**"Column 'sport_key' does not exist"**
→ Run fix-missing-columns.sql in Supabase SQL Editor

**API returns 0 games**
→ Check if sport has games scheduled today (off-season, no games)

**"ODDS_API_KEY not configured"**
→ Set ODDS_API_KEY in Vercel environment variables

**Tests pass but cards show placeholder data**
→ API likely returning 0 games (check logs with --api flag)
