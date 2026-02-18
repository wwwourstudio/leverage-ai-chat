# Library Documentation

This directory contains core services, utilities, and configurations for the Leverage AI application.

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
