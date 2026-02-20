# API Quick Reference Guide

## Available Endpoints

### 🎲 Odds API
```bash
POST /api/odds
Body: { "sport": "nba", "marketType": "h2h" }
```

### 🔮 Kalshi Prediction Markets
```bash
GET  /api/kalshi?type=sports&limit=10
POST /api/kalshi
Body: { "sport": "nba", "limit": 5 }
```

### ☁️ Weather API ✅ NEW
```bash
# By coordinates
GET /api/weather?latitude=40.8&longitude=-74.0

# By team name
GET /api/weather?team=Green+Bay+Packers

# Game forecast
POST /api/weather
Body: {
  "team": "Chicago Bears",
  "gameTime": "2026-09-10T19:00:00Z"
}
```

### 🏥 Health Check ✅ NEW
```bash
GET /api/health
```

Returns:
```json
{
  "status": "healthy",
  "services": {
    "odds": { "status": "healthy" },
    "weather": { "status": "healthy" },
    "kalshi": { "status": "healthy" },
    "database": { "status": "healthy" }
  }
}
```

---

## Diagnostic Tools

### Player Props Investigation
```bash
npx tsx scripts/diagnose-player-props.ts
```

Systematically tests The-Odds-API player props endpoints to determine:
- Premium tier requirements
- Event-specific endpoint availability
- Market compatibility per sport

Output: `scripts/player-props-diagnostic-report.json`

---

## Environment Variables

### Required
```bash
ODDS_API_KEY=<your-key>
XAI_API_KEY=<your-key>
NEXT_PUBLIC_SUPABASE_URL=<your-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-key>
```

### Optional
```bash
KALSHI_API_KEY=<your-key>
NEXT_PUBLIC_SITE_URL=<your-domain>
```

### Not Required
```bash
WEATHER_API_KEY=<not-needed>  # Open-Meteo is free
```

---

## Common Commands

### Development
```bash
npm run dev                    # Start dev server
npm run build                  # Production build
npm run lint                   # Run linting
```

### Testing
```bash
npx tsx scripts/diagnose-player-props.ts    # Test player props
curl http://localhost:3000/api/health       # Test health check
curl http://localhost:3000/api/weather?team=Chicago+Bears
```

### Deployment
```bash
git push origin main           # Triggers Vercel deployment
vercel logs                    # View production logs
```

---

## Issue Resolution

### Problem: Weather API returns 404
**Solution**: Verify `/app/api/weather/route.ts` exists and redeploy

### Problem: Player props return HTTP 422
**Action**: Run `npx tsx scripts/diagnose-player-props.ts`

### Problem: No MLB games shown
**Reason**: Off-season (Feb-March). Not a bug.

### Problem: API quota exhausted
**Check**: `curl http://localhost:3000/api/health`  
**Solution**: Monitor usage via health endpoint

---

## Documentation

- 📘 **Full Troubleshooting**: `/docs/API_TROUBLESHOOTING_AND_INTEGRATION_PLAN.md`
- 📗 **Implementation Summary**: `/docs/IMPLEMENTATION_SUMMARY.md`
- 📙 **This Quick Reference**: `/docs/API_QUICK_REFERENCE.md`

---

## Status at a Glance

| Service | Status | Endpoint |
|---------|--------|----------|
| Odds API | ✅ Working | `/api/odds` |
| Kalshi API | ✅ Working | `/api/kalshi` |
| Weather API | ✅ NEW | `/api/weather` |
| Health Check | ✅ NEW | `/api/health` |
| Player Props | ⚠️ Investigating | See diagnostic tool |
| MLB Data | ✅ Working | Off-season (normal) |

---

*Last Updated: February 19, 2026*
