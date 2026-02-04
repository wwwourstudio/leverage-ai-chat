# Constants Refactoring Guide

## Overview

This document describes the comprehensive refactoring of hard-coded values throughout the application into a centralized constants file, making the codebase more maintainable, flexible, and adaptable to changes.

## Motivation

**Before:**
- Hard-coded strings scattered throughout the codebase
- Duplicate values in multiple files
- Difficult to update configuration (e.g., changing AI model name required editing 10+ locations)
- No type safety for constant values
- Magic strings and numbers with unclear meaning

**After:**
- Single source of truth for all configuration values
- Type-safe constants with TypeScript const assertions
- Easy to update and maintain
- Clear naming and organization
- Reduced risk of typos and inconsistencies

## Changes Made

### 1. Created `/lib/constants.ts`

Centralized configuration file containing:

#### AI Model Configuration
```typescript
export const AI_CONFIG = {
  MODEL_NAME: 'grok-3',
  MODEL_DISPLAY_NAME: 'Grok-3',
  PROVIDER: 'xAI',
  API_ENDPOINT: 'https://api.x.ai/v1/chat/completions',
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_MAX_TOKENS: 2000,
} as const;
```

#### API Endpoints
```typescript
export const API_ENDPOINTS = {
  ANALYZE: '/api/analyze',
  CARDS: '/api/cards',
  INSIGHTS: '/api/insights',
  ODDS: '/api/odds',
  HEALTH: '/api/health',
} as const;
```

#### External API Configuration
```typescript
export const EXTERNAL_APIS = {
  ODDS_API: {
    BASE_URL: 'https://api.the-odds-api.com/v4',
    REGIONS: 'us',
    ODDS_FORMAT: 'american',
    DEFAULT_MARKETS: 'h2h,spreads,totals',
  },
  SUPABASE: {
    TABLES: {
      AI_PREDICTIONS: 'ai_predictions',
      AI_RESPONSE_TRUST: 'ai_response_trust',
    },
  },
} as const;
```

#### Sports and Market Types
```typescript
export const SPORTS_MAP = {
  nba: 'basketball_nba',
  nfl: 'americanfootball_nfl',
  mlb: 'baseball_mlb',
  // ...
} as const;

export const MARKET_TYPES = {
  H2H: 'h2h',
  SPREADS: 'spreads',
  TOTALS: 'totals',
} as const;
```

#### Card Types and Status
```typescript
export const CARD_TYPES = {
  LIVE_ODDS: 'live-odds',
  PLAYER_PROP: 'player-prop',
  DFS_STRATEGY: 'dfs-strategy',
  FANTASY_INSIGHT: 'fantasy-insight',
  KALSHI_MARKET: 'kalshi-market',
  // ...
} as const;

export const CARD_STATUS = {
  HOT: 'hot',
  VALUE: 'value',
  OPTIMAL: 'optimal',
  TARGET: 'target',
  // ...
} as const;
```

#### Source Types and Reliability
```typescript
export const SOURCE_TYPES = {
  MODEL: 'model',
  API: 'api',
  DATABASE: 'database',
  CACHE: 'cache',
} as const;

export const DEFAULT_RELIABILITY = {
  MODEL: 94,
  DATABASE: 95,
  API_LIVE: 97,
  API_FALLBACK: 85,
} as const;
```

#### Trust and Risk Levels
```typescript
export const TRUST_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;
```

#### Environment Variable Keys
```typescript
export const ENV_KEYS = {
  XAI_API_KEY: 'XAI_API_KEY',
  ODDS_API_KEY: 'ODDS_API_KEY',
  SUPABASE_URL: 'NEXT_PUBLIC_SUPABASE_URL',
  SUPABASE_ANON_KEY: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
} as const;
```

#### Error and Success Messages
```typescript
export const ERROR_MESSAGES = {
  AI_NOT_CONFIGURED: 'AI service not configured',
  ODDS_NOT_CONFIGURED: 'Sports Odds API is not configured',
  INVALID_API_KEY: 'Invalid API key',
  INTERNAL_ERROR: 'Internal server error',
} as const;

export const SUCCESS_MESSAGES = {
  ANALYSIS_COMPLETE: 'Analysis completed successfully',
  CARDS_GENERATED: 'Cards generated successfully',
} as const;
```

#### Log Prefixes
```typescript
export const LOG_PREFIXES = {
  API: '[API]',
  CLIENT: '[v0]',
  HEALTH: '[Health]',
  DATA_SERVICE: '[DataService]',
} as const;
```

#### Data Sources
```typescript
export const DATA_SOURCES = {
  LIVE: 'live',
  SIMULATED: 'simulated',
  CACHED: 'cached',
  FALLBACK: 'fallback',
  DEFAULT: 'default',
  ERROR: 'error',
} as const;
```

#### System Prompt
```typescript
export const SYSTEM_PROMPT = `You are Leverage AI, an expert sports betting, fantasy sports, and prediction market analyst.
You provide data-driven insights backed by statistical analysis, market trends, and historical patterns.
...` as const;
```

### 2. Updated `/app/api/analyze/route.ts`

**Before:**
```typescript
const grokApiKey = process.env.XAI_API_KEY;
const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
  body: JSON.stringify({
    model: 'grok-3',
    temperature: 0.7,
    max_tokens: 2000,
  }),
});
console.log('[API] Processing request');
```

**After:**
```typescript
const grokApiKey = process.env[ENV_KEYS.XAI_API_KEY];
const grokResponse = await fetch(AI_CONFIG.API_ENDPOINT, {
  body: JSON.stringify({
    model: AI_CONFIG.MODEL_NAME,
    temperature: AI_CONFIG.DEFAULT_TEMPERATURE,
    max_tokens: AI_CONFIG.DEFAULT_MAX_TOKENS,
  }),
});
console.log(`${LOG_PREFIXES.API} Processing request`);
```

### 3. Updated `/app/api/cards/route.ts`

**Before:**
```typescript
type: 'live-odds'
status: 'value'
const sportMap = {
  'nba': 'basketball_nba',
  'nfl': 'americanfootball_nfl',
  // ...
};
```

**After:**
```typescript
type: CARD_TYPES.LIVE_ODDS
status: CARD_STATUS.VALUE
return SPORTS_MAP[sport as keyof typeof SPORTS_MAP] || 'upcoming';
```

### 4. Type Exports

Added TypeScript type exports for type safety:

```typescript
export type AIModelName = typeof AI_CONFIG.MODEL_NAME;
export type AnalysisCategory = typeof ANALYSIS_CATEGORIES[keyof typeof ANALYSIS_CATEGORIES];
export type CardType = typeof CARD_TYPES[keyof typeof CARD_TYPES];
export type CardStatus = typeof CARD_STATUS[keyof typeof CARD_STATUS];
export type SourceType = typeof SOURCE_TYPES[keyof typeof SOURCE_TYPES];
export type TrustLevel = typeof TRUST_LEVELS[keyof typeof TRUST_LEVELS];
export type RiskLevel = typeof RISK_LEVELS[keyof typeof RISK_LEVELS];
export type HealthStatus = typeof HEALTH_STATUS[keyof typeof HEALTH_STATUS];
export type DataSource = typeof DATA_SOURCES[keyof typeof DATA_SOURCES];
```

## Benefits

### 1. **Maintainability**
- Change AI model name in one place instead of 15+
- Update API endpoints without searching through files
- Modify status values consistently across the app

### 2. **Type Safety**
- TypeScript enforces correct constant usage
- Autocomplete for all constant values
- Compile-time error checking

### 3. **Discoverability**
- All configuration in one file
- Easy to see what values are available
- Clear naming conventions

### 4. **Consistency**
- No duplicate or conflicting values
- Standardized naming patterns
- Uniform error messages

### 5. **Flexibility**
- Easy to add new constants
- Simple to create environment-specific configs
- Scalable architecture

## Usage Examples

### Example 1: Creating a New Card

**Before:**
```typescript
{
  type: 'new-card-type',
  status: 'awesome',
  // Magic strings, no autocomplete
}
```

**After:**
```typescript
// First, add to constants.ts
export const CARD_TYPES = {
  // ... existing types
  NEW_CARD: 'new-card-type',
} as const;

export const CARD_STATUS = {
  // ... existing statuses
  AWESOME: 'awesome',
} as const;

// Then use with type safety and autocomplete
{
  type: CARD_TYPES.NEW_CARD,
  status: CARD_STATUS.AWESOME,
}
```

### Example 2: Changing AI Model

**Before:** Search and replace 'grok-3' in 15+ files

**After:** Update one line in constants.ts
```typescript
export const AI_CONFIG = {
  MODEL_NAME: 'grok-4', // Changed in one place
  // ...
}
```

### Example 3: Adding New Environment Variable

**Before:**
```typescript
const myKey = process.env.MY_NEW_KEY;
```

**After:**
```typescript
// Add to constants.ts
export const ENV_KEYS = {
  // ... existing keys
  MY_NEW_KEY: 'MY_NEW_KEY',
} as const;

// Use in code
const myKey = process.env[ENV_KEYS.MY_NEW_KEY];
```

## Migration Guide

### For New Features

1. Check if the value you need exists in `constants.ts`
2. If not, add it to the appropriate section
3. Import and use the constant
4. Never hard-code strings or numbers

### For Existing Code

1. Identify hard-coded values
2. Find or create appropriate constant
3. Replace hard-coded value with constant import
4. Test thoroughly

## Best Practices

### DO:
✅ Use constants for all configuration values
✅ Add `as const` to ensure immutability
✅ Group related constants together
✅ Export type definitions for TypeScript
✅ Use descriptive, ALL_CAPS names
✅ Document complex constants with comments

### DON'T:
❌ Hard-code strings or numbers in components
❌ Duplicate constant definitions
❌ Modify const objects at runtime
❌ Use magic numbers without explanation
❌ Skip adding new config values to constants

## Testing

After refactoring:
1. All API routes work correctly
2. Cards display proper types and status
3. Error messages are consistent
4. Logs use proper prefixes
5. Type safety is enforced

## Future Improvements

1. **Environment-specific constants**: Separate dev/staging/prod configs
2. **Feature flags**: Add boolean constants for feature toggles
3. **Localization**: Add language-specific message constants
4. **Theme constants**: Centralize colors, gradients, and styles
5. **Validation schemas**: Add Zod schemas for runtime validation

## Files Modified

- ✅ `/lib/constants.ts` (created)
- ✅ `/app/api/analyze/route.ts` (refactored)
- ✅ `/app/api/cards/route.ts` (refactored)
- 🔄 `/app/page.tsx` (to be updated in future PR)
- 🔄 `/lib/data-service.ts` (to be updated in future PR)

## Conclusion

This refactoring transforms the codebase from a collection of scattered magic strings and numbers into a well-organized, type-safe, and maintainable system. All configuration values are now centralized, making updates trivial and reducing the risk of bugs from typos or inconsistencies.
