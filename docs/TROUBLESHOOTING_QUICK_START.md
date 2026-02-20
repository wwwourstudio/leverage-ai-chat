# Troubleshooting Quick Start Guide
## Resolving Sports Analytics Application Issues

**Last Updated:** February 20, 2026  
**Estimated Reading Time:** 5 minutes

---

## TL;DR - The Real Issues

### ❌ FALSE ALARM: Missing API Endpoints
**Status:** All endpoints exist and are operational  
**No action needed** - Endpoints are at `/api/odds`, `/api/weather`, `/api/kalshi`

### ✅ REAL ISSUE: Off-Season User Experience  
**Status:** Users see "No data" instead of "MLB off-season, returns April 2026"  
**Action needed:** Improve empty state messaging

### ✅ REAL ISSUE: HTTP 422 is Not an Error
**Status:** The Odds API correctly returns 422 for unavailable markets  
**Action needed:** Better logging to distinguish expected vs unexpected 422s

---

## Quick Diagnosis: Is This You?

### Scenario 1: "I'm getting HTTP 422 errors for player props"
**Is this expected?**  
Yes, if:
- Sport is in off-season (MLB in February, NFL in March-July)
- No games scheduled today
- Player prop markets don't exist yet

**What to check:**
```bash
# Check seasonal status
node -e "console.log(new Date().getMonth())"
# MLB: 3-9 (Apr-Oct), NFL: 8-1 (Sep-Feb)

# Verify games exist
curl "https://api.the-odds-api.com/v4/sports/baseball_mlb/odds?apiKey=YOUR_KEY"
# If empty array → No games today → HTTP 422 is correct
```

**Fix:**  
No code changes needed. Update user messaging to show seasonal context.

---

### Scenario 2: "Weather API not working"
**Common misconception:** WEATHER_API_KEY is required  
**Reality:** Weather service uses free Open-Meteo API (no key needed)

**Quick test:**
```bash
# Test weather endpoint
curl "https://your-app.vercel.app/api/weather?team=Green Bay Packers"

# Should return 200 OK with weather data
# If 404 → Team name typo or stadium not in database
# If 500 → Check Open-Meteo service status
```

**Fix if broken:**
```typescript
// lib/weather/index.ts
// Verify stadium exists in STADIUM_DATABASE
const stadium = STADIUM_DATABASE.find(s => 
  s.team.toLowerCase().includes('green bay')
);
```

---

### Scenario 3: "MLB data not showing"
**Expected behavior in February:**
- The Odds API returns 422 (no games scheduled)
- App shows placeholder cards
- User sees "No data available" (NOT IDEAL)

**Ideal behavior:**
- Detect MLB off-season
- Show "MLB Off-Season - Spring Training in progress"
- Display next game date: "Opening Day: April 1, 2026"

**Quick fix (Priority 1):**

Edit `components/data-cards/EmptyState.tsx`:

```typescript
import { getSportSeasonStatus } from '@/lib/seasonal-context';

export function EmptyState({ sport }: { sport: string }) {
  const seasonStatus = getSportSeasonStatus(sport);
  
  if (seasonStatus.status === 'off-season') {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>{getSportName(sport)} Off-Season</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{seasonStatus.message}</p>
          {seasonStatus.nextGameDate && (
            <p className="mt-2">
              Season resumes: {formatDate(seasonStatus.nextGameDate)}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }
  
  // ... default empty state
}
```

---

### Scenario 4: "Kalshi integration not working"
**Most common cause:** Trying to use it during off-season when no markets exist

**Test the endpoint:**
```bash
# Get sports markets
curl "https://your-app.vercel.app/api/kalshi?type=sports"

# Get election markets (should always have data in 2026)
curl "https://your-app.vercel.app/api/kalshi?type=election&year=2026"
```

**If election markets work but sports don't:**  
This is expected - Kalshi may not have active sports markets during off-season.

**Fix:**  
Add fallback messaging when no markets returned.

---

## 5-Minute Implementation: Better User Messaging

### Step 1: Update Empty State Component (2 min)

File: `components/data-cards/EmptyState.tsx`

```typescript
import { CalendarIcon } from '@radix-ui/react-icons';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface EmptyStateProps {
  sport: string;
  reason?: 'off-season' | 'no-data' | 'error';
}

export function EmptyState({ sport, reason = 'no-data' }: EmptyStateProps) {
  const seasonInfo = getSeasonInfo(sport);
  
  if (reason === 'off-season') {
    return (
      <Card className="border-dashed border-2">
        <CardHeader className="text-center">
          <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground" />
          <CardTitle className="mt-4">{seasonInfo.name} Off-Season</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">{seasonInfo.message}</p>
          {seasonInfo.nextDate && (
            <p className="mt-3 font-medium">
              Resumes: {seasonInfo.nextDate}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }
  
  // ... other cases
}

function getSeasonInfo(sport: string) {
  const sportUpper = sport.toUpperCase();
  const month = new Date().getMonth(); // 0-11
  
  if (sportUpper === 'MLB' || sportUpper === 'BASEBALL_MLB') {
    if (month < 3 || month > 9) {
      return {
        name: 'MLB',
        message: 'MLB season runs April through October. Spring Training in progress.',
        nextDate: 'April 1, 2026'
      };
    }
  }
  
  if (sportUpper === 'NFL' || sportUpper === 'AMERICANFOOTBALL_NFL') {
    if (month < 8 || month > 1) {
      return {
        name: 'NFL',
        message: 'NFL season runs September through February.',
        nextDate: 'September 2026'
      };
    }
  }
  
  return {
    name: getSportDisplayName(sport),
    message: 'No games currently scheduled.',
    nextDate: null
  };
}
```

### Step 2: Update Cards Generator to Use New EmptyState (2 min)

File: `lib/cards-generator.ts`

```typescript
import { getSportSeasonStatus } from '@/lib/seasonal-context';

async function generateCardsForSport(sport: string) {
  const seasonStatus = getSportSeasonStatus(sport);
  
  // Try fetching data...
  const games = await fetchLiveOdds(sport);
  
  if (games.length === 0) {
    // Check if it's off-season
    if (seasonStatus.status === 'off-season') {
      return [{
        id: `${sport}-off-season`,
        type: 'empty-state',
        sport,
        reason: 'off-season',
        seasonInfo: seasonStatus
      }];
    }
    
    // Otherwise, just no data available
    return [{
      id: `${sport}-no-data`,
      type: 'empty-state',
      sport,
      reason: 'no-data'
    }];
  }
  
  return games.map(g => convertToCard(g));
}
```

### Step 3: Test It (1 min)

```bash
# Restart dev server
npm run dev

# Visit app - you should now see season-aware messages
# for MLB, NFL, etc. when in off-season
```

---

## Common Pitfalls & Solutions

### Pitfall 1: Checking Wrong Environment
**Issue:** Testing locally without API keys

**Solution:**
```bash
# Check if API keys are loaded
node -e "console.log(process.env.ODDS_API_KEY ? 'Key present' : 'Key missing')"

# Run with keys
ODDS_API_KEY=your_key npm run dev
```

---

### Pitfall 2: Expecting Data During Off-Season
**Issue:** MLB queries in February return 422

**Reality:** This is correct behavior  
**Fix:** Improve messaging, not the API call

---

### Pitfall 3: Weather "Not Working"
**Issue:** Assuming WEATHER_API_KEY is required

**Reality:** Open-Meteo is free and requires no key  
**Actual issue:** Stadium name mismatch or network error

**Debug:**
```typescript
// Check stadium database
import { getStadiumByTeam } from '@/lib/weather/index';

console.log(getStadiumByTeam('Green Bay Packers'));
// Should return: { team: 'Green Bay Packers', latitude: 44.5013, ... }
```

---

## Monitoring Checklist

### Daily Health Check (1 minute)
```bash
# 1. Check API health endpoint
curl https://your-app.vercel.app/api/health

# 2. Verify Odds API quota
# (Check The Odds API dashboard for remaining requests)

# 3. Check error logs in Vercel
# Look for patterns: repeated 500s (real errors) vs 422s (expected)
```

### Weekly Maintenance (5 minutes)
- [ ] Review Vercel logs for error trends
- [ ] Check Supabase cache population
- [ ] Verify seasonal status updates correctly
- [ ] Test one endpoint per service (odds, weather, kalshi)

---

## When to Escalate

### ✅ These are NORMAL (don't escalate):
- HTTP 422 during off-season
- Empty player props arrays
- "No games available" for off-season sports
- Weather cache misses (fills on next request)

### 🚨 These are REAL ISSUES (escalate):
- HTTP 500 from your API endpoints
- Repeated 429 (rate limit) without recovery
- Supabase connection errors
- All sports returning empty simultaneously during season
- Weather endpoint returning 500 consistently

---

## Quick Reference: Error Codes

| Code | Meaning | Is This Bad? | Action |
|------|---------|--------------|--------|
| 200  | OK | ✅ Good | None |
| 404  | Not Found | ⚠️  Check URL | Verify endpoint path |
| 422  | Unprocessable Entity | ⚠️  Maybe | Check if off-season (expected) or bug (unexpected) |
| 429  | Rate Limit | ⚠️  Moderate | Add caching, reduce requests |
| 500  | Internal Error | 🚨 Bad | Check logs immediately |
| 503  | Service Unavailable | 🚨 Bad | External API down or config issue |

---

## Contact & Resources

### Documentation
- **Full Implementation Plan:** `/docs/API_ENDPOINTS_IMPLEMENTATION_PLAN.md`
- **Endpoint Status:** `/docs/ENDPOINT_STATUS_AND_ACTION_ITEMS.md`
- **API Reference:** `/docs/API_QUICK_REFERENCE.md`

### External APIs
- **The Odds API Docs:** https://the-odds-api.com/liveapi/guides/v4/
- **Kalshi API Docs:** https://trading-api.readme.io/reference/
- **Open-Meteo Docs:** https://open-meteo.com/en/docs
- **MLB Stats API:** https://statsapi.mlb.com/docs/

### Getting Help
1. Check debug logs in Vercel dashboard
2. Review this troubleshooting guide
3. Test endpoints with curl commands above
4. Review seasonal calendar in `/lib/seasonal-context.ts`

---

## Success Checklist

After following this guide, you should have:

- [ ] Confirmed all API endpoints are accessible
- [ ] Understood that HTTP 422 is expected during off-season
- [ ] Implemented season-aware empty state messaging
- [ ] Verified weather API works (no key needed)
- [ ] Tested at least one endpoint per service
- [ ] Reviewed current month vs sport seasons

**Total time to complete:** ~30 minutes for reading + implementation

---

**Remember:** The infrastructure is solid. Focus on user experience, not fixing "broken" endpoints that are actually working correctly.
