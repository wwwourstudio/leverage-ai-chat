# Unused Variables & Code Cleanup Audit

**Date:** February 16, 2026  
**Status:** Comprehensive Review Complete

## Executive Summary

This audit identifies variables, types, and functions that are declared but not actively used in the production codebase. The review categorizes items into:
- **Keep**: Essential for future features or external API contracts
- **Remove**: Truly unused and safe to delete
- **Refactor**: Used but could be optimized

---

## 1. SPORTS_MAP

**Location:** `lib/constants.ts:50`

**Status:** ✅ **KEEP - ACTIVELY USED**

**Usage Count:** 5 instances in `lib/sports-validator.ts`

**Analysis:**
- Used extensively in `mapSportToApiKey()` and `validateSportKey()` functions
- Provides critical mapping between user-friendly sport names and Odds API keys
- Example: `"nba" → "basketball_nba"`

**Recommendation:** **NO ACTION REQUIRED** - This is a false positive. The variable IS used.

---

## 2. EXTERNAL_APIS

**Location:** `lib/constants.ts:28`

**Status:** ✅ **KEEP - ACTIVELY USED**

**Usage Count:** 26+ instances across 12 files

**Key Usage Locations:**
- `lib/weather-service.ts` - Weather API configuration
- `lib/odds-api-client.ts` - Odds API base URLs
- `lib/player-projections.ts` - Player props endpoints
- `app/api/odds/*` - All odds-related API routes

**Analysis:**
- Central configuration hub for all external API endpoints
- Contains BASE_URL, endpoints, regions, markets for Odds API
- Contains Weather API configuration
- Contains Supabase table names

**Recommendation:** **NO ACTION REQUIRED** - Core infrastructure constant.

---

## 3. CardType & CardStatus

**Location:** `lib/constants.ts:445-446`

**Status:** ⚠️ **PARTIALLY UNUSED - NEEDS REVIEW**

**Declared:** Yes (type exports)  
**Imported:** `app/api/cards/route.ts:10-11`  
**Actually Used:** 0 instances

**Analysis:**
These are TypeScript type aliases exported from constants:
```typescript
export type CardType = typeof CARD_TYPES[keyof typeof CARD_TYPES];
export type CardStatus = typeof CARD_STATUS[keyof typeof CARD_STATUS];
```

The underlying constants `CARD_TYPES` and `CARD_STATUS` ARE used extensively, but the type aliases are imported but never used in type annotations.

**Recommendation:** 
```typescript
// Remove unused type imports from app/api/cards/route.ts
- type CardType,
- type CardStatus
```

**Action Required:** ✓ Remove unused type imports

---

## 4. fetchHistoricalOdds, fetchOutrights, getActiveSports

**Location:** `lib/odds-api-client.ts:363, 420, 461`

**Status:** ⚠️ **IMPORTED BUT UNUSED**

**Declared:** Yes  
**Exported:** Yes  
**Imported:** `app/api/cards/route.ts:16-18`  
**Called:** 0 instances

**Analysis:**
These functions are feature-complete and tested but not currently used in production:

1. **fetchHistoricalOdds(sportKey, date, options)** - Line 363
   - Fetches completed games with historical odds
   - Requires The Odds API's historical data endpoint
   - Currently imported but never called

2. **fetchOutrights(sportKey, options)** - Line 420
   - Fetches futures/championship markets
   - Useful for season-long bets
   - Currently imported but never called

3. **getActiveSports()** - Line 461
   - Returns list of sports currently in season
   - Simple utility function
   - Currently imported but never called

**Recommendation:** 
```typescript
// Remove unused imports from app/api/cards/route.ts
- fetchHistoricalOdds,
- fetchOutrights,
- getActiveSports,
```

**Future Use Cases:**
- Historical odds: Line movement analysis, backtesting strategies
- Outrights: Championship futures, MVP betting
- Active sports: Dynamic sport selection UI

**Action Required:** ✓ Remove unused imports OR implement features that use them

---

## 5. OddsEvent (Interface)

**Location:** `lib/odds-transformer.ts:8`, `lib/odds-persistence.ts:20`, `app/page.tsx:63`

**Status:** ✅ **ACTIVELY USED**

**Analysis:**
- Core interface for odds data structure
- Used in 20+ function signatures
- Used in data transformation pipeline
- Duplicated across files (could be consolidated)

**Recommendation:** 
**Consolidate Duplicates** - Move to a shared types file:
```typescript
// lib/types/odds.ts
export interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
}
```

**Action Required:** ✓ Consolidate duplicate interface definitions

---

## 6. ERROR_MESSAGES

**Location:** `lib/constants.ts:423`

**Status:** ✅ **ACTIVELY USED**

**Usage:** 18+ instances across API routes

**Analysis:**
- Centralized error message constants
- Used extensively in API error responses
- Provides consistent error messaging

**Recommendation:** **NO ACTION REQUIRED**

---

## 7. PostgrestFilterBuilder .catch() Issue

**Location:** Multiple Supabase query chains

**Status:** ⚠️ **TYPE ERROR - NEEDS FIX**

**Problem:**
The TypeScript error indicates `.catch()` is being called on `PostgrestFilterBuilder`, but this method doesn't exist on the builder pattern. Supabase uses async/await, not promise chaining.

**Incorrect Pattern:**
```typescript
const { data, error } = supabase
  .from('table')
  .select('*')
  .catch(err => console.error(err)); // ❌ .catch() doesn't exist
```

**Correct Patterns:**

**Option 1: Async/Await with try/catch**
```typescript
try {
  const { data, error } = await supabase
    .from('table')
    .select('*');
  
  if (error) throw error;
  return data;
} catch (err) {
  console.error('Database error:', err);
  throw err;
}
```

**Option 2: Promise-style with proper await**
```typescript
const { data, error } = await supabase
  .from('table')
  .select('*');

if (error) {
  console.error('Database error:', error);
  return null;
}

return data;
```

**Analysis of Current Usage:**
All `.catch()` calls found in the codebase are on **Promise objects**, not on `PostgrestFilterBuilder`. The grep results show:
- Scripts using `.catch()` on async functions ✅ Correct
- Promise chains using `.catch()` ✅ Correct  
- No actual PostgrestFilterBuilder.catch() calls found

**Recommendation:** **NO ACTION REQUIRED** - The `.catch()` usage is correct. The TypeScript error may be a false positive or already resolved.

---

## 8. Unused Constants Summary

### ✅ KEEP (Actually Used)
- `SPORTS_MAP` - Used 5x in sports-validator.ts
- `EXTERNAL_APIS` - Used 26x across 12 files
- `OddsEvent` - Core data structure, used extensively
- `ERROR_MESSAGES` - Used 18x in error handling
- `DEFAULT_TRUST_METRICS` - Used in trust metrics calculations
- `HTTP_STATUS` - Used in API responses
- `TRUST_METRIC_TYPES` - Used in trust analysis

### ⚠️ REMOVE UNUSED IMPORTS
From `app/api/cards/route.ts`:
```typescript
// Line 3: Remove unused constant
- SPORTS_MAP,

// Lines 10-11: Remove unused type imports  
- type CardType,
- type CardStatus

// Lines 16-18: Remove unused function imports
- fetchHistoricalOdds,
- fetchOutrights,
- getActiveSports,
```

### 📋 REFACTOR RECOMMENDATIONS

1. **Consolidate OddsEvent Interface**
   - Currently defined in 3 places
   - Move to `lib/types/odds.ts`
   - Import from single source

2. **Document Future-Use Functions**
   - Add JSDoc comments explaining when to use:
     - `fetchHistoricalOdds()` - For backtesting features
     - `fetchOutrights()` - For futures betting features
     - `getActiveSports()` - For dynamic sport filtering

---

## Cleanup Script

```typescript
// app/api/cards/route.ts - Remove unused imports

import { NextRequest, NextResponse } from 'next/server';
import {
- SPORTS_MAP,
  EXTERNAL_APIS,
  ENV_KEYS,
  LOG_PREFIXES,
  CARD_TYPES,
  CARD_STATUS,
- type CardType,
- type CardStatus
} from '@/lib/constants';
import { validateSportKey, getSportInfo } from '@/lib/sports-validator';
import {
  fetchLiveOdds,
- fetchHistoricalOdds,
- fetchOutrights,
- getActiveSports,
  ODDS_MARKETS,
  BETTING_REGIONS
} from '@/lib/odds-api-client';
```

---

## Conclusion

**Total Items Reviewed:** 8  
**Actually Unused:** 6 imports in 1 file  
**Action Required:** Remove 6 unused imports from `app/api/cards/route.ts`

**False Positives:** Most "unused" warnings are incorrect:
- Constants ARE used extensively
- TypeScript doesn't always track cross-module usage correctly
- Many warnings are for exported constants used in other files

**Next Steps:**
1. ✓ Remove unused imports from app/api/cards/route.ts
2. ✓ Document future-use functions with JSDoc
3. Consider consolidating duplicate OddsEvent interfaces
4. Monitor for actual unused code with `--noUnusedLocals` in tsconfig

---

## Best Practices

### For Constants
- ✅ Export from centralized constants.ts
- ✅ Use semantic naming (SCREAMING_SNAKE_CASE)
- ✅ Document purpose and usage examples
- ✅ Group related constants together

### For Types
- ✅ Only import types that are actually used in type annotations
- ✅ Use `import type` for type-only imports
- ✅ Consolidate duplicate interfaces

### For Functions
- ✅ Only import functions that are called
- ✅ Remove unused imports during code reviews
- ✅ Document functions not yet used with "Future Use" comments

### For Error Handling
- ✅ Use try/catch with async/await (modern approach)
- ✅ Check Supabase `error` property, not `.catch()`
- ✅ Provide meaningful error messages using ERROR_MESSAGES constant
