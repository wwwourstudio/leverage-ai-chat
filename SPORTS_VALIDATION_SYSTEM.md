# Sports Validation System

## Overview

The Sports Validation System provides robust validation and normalization of sport identifiers for the Odds API, preventing 404 errors from unknown sport codes and improving the overall reliability of the application.

## Problem Statement

Previously, the application would send invalid sport codes to the Odds API, resulting in 404 "Unknown sport" errors. This occurred because:

1. **No validation** - Sport codes were passed directly to the API without checking validity
2. **No fallback** - Invalid codes caused complete failures instead of graceful degradation
3. **No suggestions** - Users received cryptic errors without guidance
4. **Hard to maintain** - Valid sport codes were scattered across the codebase

## Solution

### 1. Comprehensive Sports Validator (`/lib/sports-validator.ts`)

A centralized utility that provides:

- **Complete sport catalog** - All 200+ valid Odds API sport keys with metadata
- **Smart mapping** - Converts common abbreviations (nba, nfl, mlb) to API keys
- **Validation** - Checks if sport codes are recognized by the API
- **Fuzzy matching** - Suggests similar sports when invalid codes are provided
- **Graceful fallback** - Defaults to "upcoming" (all sports) for unknown codes

### 2. Key Functions

#### `validateSportKey(sport: string)`

Validates and normalizes a sport key with detailed feedback:

```typescript
const result = validateSportKey('nba');
// Returns:
{
  isValid: true,
  normalizedKey: 'basketball_nba',
  suggestion: 'Mapped "nba" to "basketball_nba"'
}
```

Invalid sport example:

```typescript
const result = validateSportKey('baseball');
// Returns:
{
  isValid: false,
  normalizedKey: 'upcoming',
  error: 'Unknown sport: "baseball"',
  suggestion: 'Did you mean: baseball_mlb, baseball_npb, baseball_kbo?'
}
```

#### `mapSportToApiKey(sport: string)`

Simple mapping function that always returns a valid key:

```typescript
mapSportToApiKey('nba')  // Returns: 'basketball_nba'
mapSportToApiKey('invalid')  // Returns: 'upcoming' (fallback)
```

#### `getSportInfo(sportKey: string)`

Gets display information for a sport:

```typescript
getSportInfo('basketball_nba')
// Returns:
{
  name: 'NBA',
  category: 'Basketball',
  apiKey: 'basketball_nba'
}
```

#### `getPopularSports()`

Returns quick-access list of popular sports for UI:

```typescript
getPopularSports()
// Returns:
[
  { key: 'basketball_nba', name: 'NBA', category: 'Basketball' },
  { key: 'americanfootball_nfl', name: 'NFL', category: 'American Football' },
  // ... more sports
]
```

## Implementation

### API Routes

Both `/api/cards` and `/api/odds` now use the sports validator:

**Before:**
```typescript
const sportKey = SPORTS_MAP[sport?.toLowerCase()] || 'upcoming';
const url = `${baseUrl}/sports/${sportKey}/odds`;
// No validation - could send invalid codes
```

**After:**
```typescript
const sportValidation = validateSportKey(sport);
const normalizedSport = sportValidation.normalizedKey;
const sportInfo = getSportInfo(normalizedSport);

console.log(`Fetching odds for ${sportInfo.name} (${sportInfo.apiKey})`);
const url = `${baseUrl}/sports/${normalizedSport}/odds`;

// Response includes validation details
return { 
  sport: normalizedSport, 
  sportInfo, 
  sportValidation,
  events: data 
};
```

### Error Handling

The system provides detailed logging and user-friendly error messages:

```typescript
// Invalid sport logs
console.log('[API] Invalid sport key: Unknown sport: "basktbl"');
console.log('[API] Did you mean: basketball_nba, basketball_ncaab?');

// Fallback behavior
console.log('[API] Using "upcoming" to show all available events');
```

## Supported Sports

### Major Sports

| Sport | API Key | Common Abbreviation |
|-------|---------|---------------------|
| NBA | `basketball_nba` | nba |
| NFL | `americanfootball_nfl` | nfl |
| MLB | `baseball_mlb` | mlb |
| NHL | `icehockey_nhl` | nhl |
| NCAAB | `basketball_ncaab` | ncaab |
| NCAAF | `americanfootball_ncaaf` | ncaaf |

### Categories

- **American Football** - NFL, NCAAF, CFL, UFL
- **Baseball** - MLB, NPB, KBO, NCAA Baseball
- **Basketball** - NBA, WNBA, NCAAB, Euroleague
- **Ice Hockey** - NHL, AHL, SHL
- **Soccer** - EPL, La Liga, Bundesliga, Serie A, Champions League
- **Combat Sports** - MMA, Boxing
- **And 200+ more leagues worldwide**

## Benefits

### 1. Reliability

- **No more 404 errors** - All sport codes are validated before API calls
- **Graceful degradation** - Invalid codes fall back to "upcoming" instead of crashing
- **Smart mapping** - Common abbreviations automatically converted to API keys

### 2. User Experience

- **Better error messages** - Clear explanations instead of cryptic API errors
- **Helpful suggestions** - "Did you mean..." guidance for typos
- **Informative logging** - Detailed console output for debugging

### 3. Maintainability

- **Centralized validation** - One place to manage all sport codes
- **Easy updates** - Add new sports by editing one file
- **Type safety** - TypeScript types prevent runtime errors

### 4. Observability

- **Validation tracking** - Every response includes validation status
- **Sport metadata** - Responses include human-readable sport names
- **API usage insights** - Track which sports are being requested

## Usage Examples

### API Request Example

```typescript
// Request
POST /api/odds
{
  "sport": "nba",  // User provides abbreviation
  "marketType": "h2h"
}

// Response
{
  "sport": "basketball_nba",  // Normalized
  "sportInfo": {
    "name": "NBA",
    "category": "Basketball",
    "apiKey": "basketball_nba"
  },
  "sportValidation": {
    "isValid": true,
    "normalizedKey": "basketball_nba",
    "suggestion": "Mapped \"nba\" to \"basketball_nba\""
  },
  "events": [...]
}
```

### Invalid Sport Handling

```typescript
// Request
POST /api/odds
{
  "sport": "unknown",
  "marketType": "h2h"
}

// Response
{
  "sport": "upcoming",  // Fallback
  "sportInfo": {
    "name": "All Upcoming Sports",
    "category": "All",
    "apiKey": "upcoming"
  },
  "sportValidation": {
    "isValid": false,
    "normalizedKey": "upcoming",
    "error": "Unknown sport: \"unknown\"",
    "suggestion": "Using \"upcoming\" to show all available events"
  },
  "events": [...]  // Shows all sports
}
```

## Future Enhancements

### 1. Dynamic Sport List Fetching

Currently uses static list. Could fetch available sports from API:

```typescript
async function fetchAvailableSports() {
  const response = await fetch(
    `${ODDS_API_BASE_URL}/sports?apiKey=${key}`
  );
  const sports = await response.json();
  // Cache and use for validation
}
```

### 2. Sport Availability Tracking

Track which sports are currently in season:

```typescript
interface SportAvailability {
  key: string;
  inSeason: boolean;
  nextGame?: Date;
  activeBookmakers: number;
}
```

### 3. Smart Sport Recommendations

Use machine learning to suggest sports based on user history:

```typescript
function getRecommendedSports(userHistory: string[]): string[] {
  // Analyze user's past queries
  // Return similar or correlated sports
}
```

### 4. Multi-Sport Queries

Support queries across multiple sports:

```typescript
POST /api/odds
{
  "sports": ["nba", "nfl", "nhl"],
  "marketType": "h2h"
}
```

## Testing

### Validation Tests

```typescript
// Test valid sports
expect(validateSportKey('nba').isValid).toBe(true);
expect(validateSportKey('basketball_nba').isValid).toBe(true);

// Test invalid sports
expect(validateSportKey('invalid').isValid).toBe(false);
expect(validateSportKey('invalid').normalizedKey).toBe('upcoming');

// Test fallback
expect(validateSportKey('').normalizedKey).toBe('upcoming');
expect(validateSportKey(null).normalizedKey).toBe('upcoming');
```

### API Integration Tests

```bash
# Valid sport
curl -X POST /api/odds -d '{"sport":"nba"}'
# Should return NBA odds

# Invalid sport
curl -X POST /api/odds -d '{"sport":"invalid"}'
# Should return all upcoming events with validation warning

# Empty sport
curl -X POST /api/odds -d '{"sport":""}'
# Should return all upcoming events
```

## Troubleshooting

### Issue: Still getting 404 errors

**Solution:** Check if you're using the latest version of the validator. The sport might not be in season.

```typescript
// Check if sport is valid
const validation = validateSportKey('sport_key');
console.log(validation);  // See detailed validation info
```

### Issue: Sport abbreviation not working

**Solution:** Add it to `SPORTS_MAP` in `/lib/constants.ts`:

```typescript
export const SPORTS_MAP = {
  // ... existing mappings
  'mls': 'soccer_usa_mls',  // Add new mapping
} as const;
```

### Issue: New sport not recognized

**Solution:** Add it to `VALID_SPORTS` in `/lib/sports-validator.ts`:

```typescript
export const VALID_SPORTS = {
  // ... existing sports
  'new_sport_key': { name: 'New Sport', category: 'Category' },
} as const;
```

## References

- [The Odds API Documentation](https://the-odds-api.com/sports-odds-data/sports-apis.html)
- [Complete Sports List](https://the-odds-api.com/sports-odds-data/sports-apis.html)
- API Version: v4 (2026)

## Changelog

### 2026-02-03
- Initial implementation of sports validation system
- Added comprehensive sport catalog with 200+ sports
- Implemented smart mapping and fuzzy matching
- Added graceful fallback for invalid sport codes
- Integrated validation into cards and odds API routes
- Added detailed error messages and suggestions
