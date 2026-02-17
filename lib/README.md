# Library Documentation

This directory contains core services, utilities, and configurations for the Leverage AI application.

## 🎯 Recent Refactoring (2026-02-17)

The `/lib` folder has been comprehensively refactored to eliminate code duplication and improve maintainability:

### Consolidated Modules

#### `/lib/data/` - Unified Data Layer
**Replaced**: `data-service.ts`, `supabase-data-service.ts`
- All API data fetching with caching
- Database queries (Supabase)
- Data transformation utilities
- Single import: `import { fetchDynamicCards, fetchUserInsights, fetchOddsFromDB } from '@/lib/data'`

#### `/lib/odds/` - Unified Odds Service
**Replaced**: `odds-api-client.ts`, `enhanced-odds-client.ts`, `unified-odds-fetcher.ts`
- The Odds API integration
- Real-time odds fetching with cache
- Sport validation & normalization
- Arbitrage opportunity detection
- Single import: `import { fetchLiveOdds, validateSportKey, findArbitrageOpportunities } from '@/lib/odds'`

#### `/lib/weather/` - Unified Weather Service
**Replaced**: `weather-service.ts`, `weather-analytics.ts`
- Open-Meteo API integration
- Stadium-specific weather lookups
- Weather impact analysis
- Single import: `import { getWeatherForGame, analyzeWeatherImpact } from '@/lib/weather'`

#### `/lib/utils/` - Unified Utilities
**Replaced**: `auth-utils.ts`, `debug-utils.ts`, `process-utils.ts`
- Styling utilities (`cn()`)
- Authentication helpers
- Debug logging & performance tracking
- Process/runtime information
- Single import: `import { cn, getServerUser, debugLog, PerformanceTimer } from '@/lib/utils'`

#### `/lib/arbitrage/` - Arbitrage Detection
**Replaced**: `arbitrage.ts`, `arbitrage-detector.ts`, `arbitrage/detectArbitrage.ts`
- Consolidated arbitrage detection logic
- Market efficiency analysis
- Opportunity ranking
- Single import: `import { detectArbitrage, calculateProfitMargin } from '@/lib/arbitrage'`

#### `/lib/kelly/` - Kelly Criterion
**Replaced**: `kelly.ts`, `kelly/calculateKelly.ts`
- Bet sizing calculations
- Portfolio allocation
- Risk management
- Single import: `import { calculateKelly, calculateOptimalBankroll } from '@/lib/kelly'`

#### `/lib/kalshi/` - Kalshi Integration
**Replaced**: `kalshi-api-client.ts`, `kalshi-client.ts`
- Kalshi prediction market API
- Market data fetching
- Contract analysis
- Single import: `import { fetchKalshiMarkets, analyzeContract } from '@/lib/kalshi'`

### Configuration Consolidation

#### `/lib/config.ts` - Unified Configuration
**Replaced**: `dynamic-config.ts` (merged into `config.ts`)
- Environment variable management
- Service status checking
- Configuration validation
- Both static and dynamic config in one file

### Migration Guide

**Old Import → New Import**
```typescript
// Data fetching
import { fetchDynamicCards } from '@/lib/data-service';
// NOW: import { fetchDynamicCards } from '@/lib/data';

// Odds fetching
import { fetchLiveOdds } from '@/lib/odds-api-client';
// NOW: import { fetchLiveOdds } from '@/lib/odds';

// Weather
import { getWeatherForGame } from '@/lib/weather-service';
// NOW: import { getWeatherForGame } from '@/lib/weather';

// Utilities
import { debugLog } from '@/lib/debug-utils';
// NOW: import { debugLog } from '@/lib/utils';
```

**Backward Compatibility**: `/lib/utils.ts` re-exports from `/lib/utils/index.ts` to maintain compatibility during migration.

---

## Services

### `player-projections.ts`
Fetches real-time player projection data from The Odds API.

**Key Functions:**
- `fetchPlayerProjections(playerName, sport)` - Fetches player prop data
- `formatProjectionSummary(response)` - Formats projections into readable text
- `extractPlayerName(query)` - Extracts player name from query string
- `isPlayerProjectionQuery(query)` - Detects if query is about player props

**Usage:**
```typescript
import { fetchPlayerProjections } from '@/lib/player-projections';

const projections = await fetchPlayerProjections('Mike Trout', 'baseball_mlb');
if (projections.success) {
  console.log(projections.projections); // Array of PlayerProjection
}
```

### `constants.ts`
Central configuration for API endpoints, system prompts, and default values.

**Key Exports:**
- `SYSTEM_PROMPT` - AI system prompt with anti-hallucination rules
- `API_ENDPOINTS` - Internal API endpoints
- `EXTERNAL_APIS` - External API configurations
- `DEFAULT_TRUST_METRICS` - Default trust metric values
- `LOG_PREFIXES` - Logging prefixes for debugging

### `config.ts`
Environment configuration and validation.

**Key Functions:**
- `getOddsApiKey()` - Gets Odds API key from env
- `isOddsApiConfigured()` - Checks if Odds API is configured
- `getSupabaseConfig()` - Gets Supabase configuration

### `error-handler.ts`
Centralized error handling and classification.

**Key Functions:**
- `classifyError(error)` - Classifies error types
- `getUserErrorMessage(error)` - Returns user-friendly error messages
- `formatErrorForLog(error)` - Formats errors for logging

## Best Practices

### Error Handling
Always wrap API calls in try-catch blocks and use the error handler:

```typescript
try {
  const result = await someApiCall();
} catch (error) {
  const classified = classifyError(error);
  const userMessage = getUserErrorMessage(classified);
  console.error(formatErrorForLog(error));
}
```

### Logging
Use consistent logging prefixes for easy debugging:

```typescript
import { LOG_PREFIXES } from '@/lib/constants';

console.log(`${LOG_PREFIXES.API} Fetching data...`);
console.log(`${LOG_PREFIXES.DATABASE} Query executed`);
```

### Type Safety
Always import and use defined TypeScript interfaces:

```typescript
import type { PlayerProjection, PlayerProjectionsResponse } from '@/lib/player-projections';
```

## Performance Considerations

1. **API Calls**: Player projection fetches are cached for 5 minutes
2. **Error Fallbacks**: All external API calls have fallback mechanisms
3. **Validation**: Input validation happens before expensive operations
4. **Logging**: Debug logs use conditional execution to avoid performance impact

## Security

- All API keys are validated before use
- Environment variables are accessed via centralized config functions
- User input is sanitized before being sent to external APIs
- SQL injection protection via parameterized queries

## Testing

Run tests with:
```bash
bun test
```

Key test files:
- `lib/__tests__/config.test.ts`
- `app/api/__tests__/analyze.test.ts`
