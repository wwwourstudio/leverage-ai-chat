# Dynamic Cards Troubleshooting Guide

## Overview

This guide provides a systematic approach to diagnosing and resolving issues with dynamic card generation in the application. The enhanced logging system now provides complete visibility into the entire data pipeline.

## Problem: Zero Dynamic Cards Generated

### Diagnostic Approach

The application now has comprehensive logging at every critical step. Follow the logs in this order:

#### 1. Frontend Card Request (page.tsx)

Look for these log messages:

```
[v0] ==========================================
[v0] GENERATING CONTEXTUAL SUGGESTIONS
[v0] Requesting dynamic cards with params: {...}
```

**What to Check:**
- Are the parameters being extracted correctly?
- Is the sport name being passed?
- Is the category detected?

**Common Issues:**
- Sport name extraction fails from user message
- Category detection logic doesn't match user intent
- API endpoint not configured (check constants)

#### 2. Data Service Layer (lib/data-service.ts)

Look for these log messages:

```
[DataService] ========================================
[DataService] FETCHING DYNAMIC CARDS
[DataService] Parameters: {...}
[DataService] API Endpoint: /api/cards
```

**What to Check:**
- Is the request reaching the data service?
- Are parameters being serialized correctly?
- Is the API endpoint correct?
- Is the response status 200?
- Is the content-type JSON?

**Common Issues:**
- Fetch fails silently (network error)
- API returns non-200 status
- Response is not JSON
- Empty response body

#### 3. Cards API Route (app/api/cards/route.ts)

Look for these log messages:

```
[API] ========================================
[API] CARDS API: POST REQUEST RECEIVED
[API] Request body parsed: {...}
[API] Odds API Key configured: YES/NO
```

**What to Check:**
- Is the request reaching the API route?
- Is the body being parsed correctly?
- Is the Odds API key configured?
- Are odds being fetched successfully?

**Common Issues:**
- Missing ODDS_API_KEY environment variable
- Invalid sport code causing 404 from Odds API
- Odds API rate limit exceeded
- No upcoming games in the next 48 hours

#### 4. Card Generation Logic

Look for these log messages:

```
[API] ----------------------------------------
[API] generateDynamicCards() called
[API] → Step 1: Filtering events by time range...
[API] → Step 2: Transforming odds events...
[API] → Step 3: Sorting by value...
[API] → Step 4: Selected top N events...
[API] → Step 5: Generating cards from top events...
```

**What to Check:**
- How many events remain after filtering?
- How many events were transformed?
- Are cards being created in the loop?
- Is the limit being reached?

**Common Issues:**
- All events filtered out (no games in next 48 hours)
- Transformation fails due to missing odds data
- Card generation conditions not met (missing bestSpread, bestMoneyline)
- Limit set too low

## Complete Diagnostic Log Flow

### Success Path

```
[v0] Requesting dynamic cards...
[DataService] FETCHING DYNAMIC CARDS
[DataService] API Endpoint: /api/cards
[DataService] → Making POST request...
[DataService] ← Response status: 200 OK
[DataService] ✓ JSON parsed successfully
[DataService] ✓ Extracted 3 cards from response
[DataService] Card types: ['live-odds', 'moneyline-value', 'totals-value']
[API] CARDS API: POST REQUEST RECEIVED
[API] - Sport: basketball_nba
[API] - Category: betting
[API] Odds API Key configured: YES
[API] Fetched live odds: 15 events for NBA
[API] → Calling generateDynamicCards...
[API] generateDynamicCards() called
[API] ✓ Odds data validation passed
[API] Processing 15 live odds events
[API] → Step 1: Filtering events by time range (48 hours)...
[API]   Filtered to 15 upcoming events
[API] → Step 2: Transforming odds events...
[API]   Transformed 15 events
[API] → Step 3: Sorting by value...
[API]   Sorted 15 events by market value
[API] → Step 4: Selected top 6 events for card generation
[API] → Step 5: Generating cards from top events...
[API]   Processing: Lakers vs Warriors
[API]     ✓ Adding spread card
[API]   Processing: Celtics vs Heat
[API]     ✓ Adding moneyline card
[API] ✓ Generated 3 cards from live odds data
[API] ✓ Final result: 3 total cards
[API] ← Sending response with 3 cards
[v0] Received dynamic cards response: 3 cards
[v0] Returning 3 converted insight cards
```

### Failure Path Examples

#### Example 1: No Odds API Key

```
[API] CARDS API: POST REQUEST RECEIVED
[API] Odds API Key configured: NO
[API] → Calling generateDynamicCards...
[API] generateDynamicCards() called
[API] ⚠ No odds data available for card generation
[API] Reasons: oddsData=false, isArray=false, length=0
[API] → Step 6: Need 3 more cards, generating contextual cards...
[API]   Generated 3 contextual cards
[API] ✓ Final result: 3 total cards
```

**Solution:** Add ODDS_API_KEY environment variable

#### Example 2: No Upcoming Games

```
[API] Fetched live odds: 15 events for NFL
[API] → Step 1: Filtering events by time range (48 hours)...
[API]   Filtered to 0 upcoming events
[API] → Step 2: Transforming odds events...
[API]   Transformed 0 events
[API] ⚠ Generated 0 cards from live odds data
[API] → Step 6: Need 3 more cards, generating contextual cards...
```

**Solution:** All games are >48 hours away. Increase time range or wait for games to be closer.

#### Example 3: Invalid Sport Code

```
[API] - Sport: nba
[API] Invalid sport key: Sport code not found - Did you mean basketball_nba?
[API] Odds API returned 404: Unknown sport
[API] → Calling generateDynamicCards...
[API] ⚠ No odds data available for card generation
```

**Solution:** Sport validation should handle this, but verify sport code mapping

#### Example 4: API Timeout

```
[DataService] → Making POST request...
[DataService] ✗ FETCH ERROR: Failed to fetch
[DataService] Returning empty array as fallback
[v0] Received dynamic cards response: 0 cards
[v0] ⚠ WARNING: Zero cards returned from API
```

**Solution:** Check network connectivity, API endpoint, or Edge runtime timeout limits

## Systematic Troubleshooting Steps

### Step 1: Verify Environment Configuration

```bash
# Check environment variables
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- ODDS_API_KEY (critical for live odds)
```

### Step 2: Check API Endpoint Configuration

```typescript
// In lib/constants.ts
API_ENDPOINTS: {
  CARDS: '/api/cards',
  INSIGHTS: '/api/insights',
  ODDS: '/api/odds',
}
```

### Step 3: Test API Directly

```bash
# Test cards API directly
curl -X POST http://localhost:3000/api/cards \
  -H "Content-Type: application/json" \
  -d '{"sport": "basketball_nba", "category": "betting", "limit": 3}'
```

### Step 4: Check Odds API Status

```bash
# Test Odds API directly
curl "https://api.the-odds-api.com/v4/sports/basketball_nba/odds?apiKey=YOUR_KEY&regions=us"
```

### Step 5: Review Debug Logs

1. Open browser DevTools Console
2. Filter for `[v0]`, `[DataService]`, or `[API]`
3. Follow the log flow from frontend → data service → API → card generation
4. Identify where the flow breaks

## Common Root Causes

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Missing API Key | "Odds API Key configured: NO" | Add ODDS_API_KEY to environment |
| Invalid Sport Code | "Invalid sport key", 404 errors | Use sports-validator.ts mapping |
| No Upcoming Games | "Filtered to 0 upcoming events" | Wait for games or increase time range |
| API Rate Limit | 429 status code | Wait or upgrade API plan |
| Network Timeout | "Failed to fetch" | Check Edge runtime limits |
| Malformed Response | "JSON parse error" | Check API response format |
| Empty Odds Data | "No bookmakers" in events | Check Odds API regions/markets |
| Cache Stale | Old data being served | Clear cache or wait for TTL |

## Testing Different Scenarios

### Test Case 1: Valid Sport with Live Games

```javascript
await fetchDynamicCards({
  sport: 'basketball_nba',
  category: 'betting',
  limit: 3
});
// Expected: 3 cards with live odds data
```

### Test Case 2: Invalid Sport

```javascript
await fetchDynamicCards({
  sport: 'nba', // Wrong code
  category: 'betting',
  limit: 3
});
// Expected: Sport validation corrects to 'basketball_nba'
```

### Test Case 3: No API Key

```javascript
// Remove ODDS_API_KEY from environment
await fetchDynamicCards({
  sport: 'basketball_nba',
  category: 'betting',
  limit: 3
});
// Expected: 3 contextual cards (no live odds)
```

### Test Case 4: Off-Season Sport

```javascript
await fetchDynamicCards({
  sport: 'americanfootball_nfl', // During off-season
  category: 'betting',
  limit: 3
});
// Expected: 0 live odds, 3 contextual cards
```

## Enhanced Logging Benefits

### Before Enhancement

```
[v0] Got dynamic cards: 0
```

**Problem:** No visibility into WHY zero cards were returned

### After Enhancement

```
[DataService] ========================================
[DataService] FETCHING DYNAMIC CARDS
[DataService] Parameters: {"sport":"basketball_nba","category":"betting","limit":3}
[DataService] → Making POST request...
[DataService] ← Response status: 200 OK
[DataService] ✓ JSON parsed successfully
[DataService] ⚠ WARNING: Zero cards returned!
[DataService] Full API response: {"success":true,"cards":[],...}
[API] ⚠ WARNING: Zero cards generated!
[API] Possible causes:
[API] 1. No odds data available (had 0 events)
[API] 2. Sport not recognized: basketball_nba
[API] 3. Category filtering too strict: betting
[API] 4. generateDynamicCards logic issue
```

**Benefit:** Complete transparency into the failure point

## Performance Monitoring

The enhanced logging also helps monitor performance:

```
[DataService] Cache age: 25s
[API] → Step 1: Filtering events by time range... (< 10ms)
[API] → Step 2: Transforming odds events... (< 50ms)
[API] → Step 3: Sorting by value... (< 5ms)
```

## Debugging Checklist

- [ ] Frontend logs show card request being made
- [ ] Data service logs show API call being initiated
- [ ] API route logs show request being received
- [ ] Odds API key is configured (if expecting live data)
- [ ] Odds API returns 200 status
- [ ] Odds data contains events
- [ ] Events pass time range filter (next 48 hours)
- [ ] Events have bookmaker data with markets
- [ ] Transformed odds have bestSpread/bestMoneyline
- [ ] Cards array is populated in generation loop
- [ ] Final card count matches expectation
- [ ] Response is sent back to frontend
- [ ] Frontend receives and parses response

## Next Steps

If issues persist after following this guide:

1. **Capture Full Log Output:** Copy all logs from browser console
2. **Check Integration Status:** Use `GetOrRequestIntegration` to verify setup
3. **Test API Isolation:** Test each API endpoint independently
4. **Review Recent Changes:** Check git history for breaking changes
5. **Consult Documentation:** Review REALTIME_ODDS_INTEGRATION.md

## Maintenance

### Log Cleanup

Once debugging is complete, you can reduce log verbosity:

1. Change LOG_PREFIXES to include log levels
2. Add environment variable for log level (DEV/PROD)
3. Wrap verbose logs in conditional checks

### Monitoring in Production

Consider keeping key logs for production monitoring:

- API request/response counts
- Error rates by type
- Average card generation time
- Cache hit rates

## Related Documentation

- [REALTIME_ODDS_INTEGRATION.md](./REALTIME_ODDS_INTEGRATION.md) - Odds API integration details
- [SPORTS_VALIDATION_SYSTEM.md](./SPORTS_VALIDATION_SYSTEM.md) - Sport code validation
- [SUPABASE_VALIDATION_SYSTEM.md](./SUPABASE_VALIDATION_SYSTEM.md) - Database error handling
- [DYNAMIC_CARDS_DIAGNOSTIC_FIX.md](./DYNAMIC_CARDS_DIAGNOSTIC_FIX.md) - Original diagnostic implementation
