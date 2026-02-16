# Testing Guide

Comprehensive test endpoints to verify system functionality.

## Test Endpoints

### 1. NHL Odds API Integration
```bash
GET /api/test-nhl
```

Tests:
- API key configuration
- NHL odds API connectivity
- Real game data retrieval
- Response structure validation

Expected Response:
```json
{
  "success": true,
  "gamesFound": 8,
  "sampleGame": {
    "matchup": "Buffalo Sabres @ New Jersey Devils",
    "gameTime": "2026-02-26T05:00:00Z",
    "bookmakers": 12,
    "markets": ["h2h", "spreads", "totals"]
  }
}
```

### 2. Card Categories
```bash
GET /api/test-cards
GET /api/test-cards?category=arbitrage
GET /api/test-cards?category=lines
GET /api/test-cards?category=portfolio
GET /api/test-cards?category=props
GET /api/test-cards?category=kalshi
```

Tests all card categories:
- betting (live odds)
- arbitrage (cross-book opportunities)
- lines (line movement/steam)
- portfolio (Kelly sizing)
- props (player props)
- kalshi (prediction markets)

Expected Response:
```json
{
  "success": true,
  "results": {
    "arbitrage": {
      "success": true,
      "cardsGenerated": 3,
      "cardTypes": ["ARBITRAGE", "ARBITRAGE", "ARBITRAGE"]
    }
  }
}
```

### 3. Database Schema Validation
```bash
GET /api/test-schema
```

Tests:
- All 11 required tables exist
- Tables are queryable
- Identifies missing tables

Expected Response:
```json
{
  "success": true,
  "existingTables": 11,
  "missingTables": 0,
  "message": "All required tables exist and are queryable"
}
```

If tables are missing:
```json
{
  "success": false,
  "missing": ["live_odds_cache", "arbitrage_opportunities"],
  "instructions": "Execute scripts/master-schema.sql in Supabase SQL Editor"
}
```

### 4. End-to-End Flow
```bash
GET /api/test-e2e?query=show+me+nhl+games
GET /api/test-e2e?query=find+arbitrage+opportunities
GET /api/test-e2e?query=what+are+the+line+movements
```

Tests complete user flow:
1. Query intent detection
2. Cards generation
3. AI response generation
4. Card data integrity validation

Expected Response:
```json
{
  "success": true,
  "steps": [
    {
      "step": 1,
      "name": "Query Intent Detection",
      "success": true
    },
    {
      "step": 2,
      "name": "Cards Generation",
      "cardsGenerated": 3,
      "success": true
    }
  ],
  "result": {
    "aiResponse": "Found 3 live games...",
    "cardsGenerated": 3
  }
}
```

## Quick Health Check

Run all tests in sequence:
```bash
curl http://localhost:3000/api/test-nhl
curl http://localhost:3000/api/test-cards
curl http://localhost:3000/api/test-schema
curl "http://localhost:3000/api/test-e2e?query=show+me+nhl+games"
```

## Troubleshooting

### API Key Not Found
```json
{"success": false, "error": "ODDS_API_KEY not configured"}
```
Solution: Set ODDS_API_KEY in Vercel environment variables

### No Games Found
```json
{"success": true, "gamesFound": 0}
```
This is normal if:
- NHL has no games today (off-season or rest day)
- Testing during morning hours (games start evening EST)

### Missing Tables
```json
{"success": false, "missingTables": 11}
```
Solution: Run `scripts/master-schema.sql` in Supabase SQL Editor

### Cards Not Generating
Check:
1. API key is set correctly
2. Database tables exist (run /api/test-schema)
3. Sport has games today (run /api/test-nhl)
4. Check browser console for detailed logs

## Production Monitoring

Add these endpoints to your monitoring:
- `/api/test-nhl` - Verify API connectivity
- `/api/test-schema` - Database health
- `/api/ping` - Sandbox keepalive

## Next Steps

Once all tests pass:
1. Execute `scripts/master-schema.sql` in Supabase (if schema test fails)
2. Test live in UI: Ask "Show me NHL games"
3. Verify cards appear with real game data
4. Test all categories: arbitrage, lines, portfolio, props
