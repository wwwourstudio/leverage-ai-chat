/**
 * Sports Validator Utility
 * Validates and manages sport identifiers for the Odds API
 */

import { SPORTS_MAP } from './constants';

// Comprehensive list of valid Odds API sport keys based on official documentation
// Updated: 2026-02-03
export const VALID_SPORTS = {
  // American Football
  'americanfootball_cfl': { name: 'CFL', category: 'American Football' },
  'americanfootball_ncaaf': { name: 'NCAAF', category: 'American Football' },
  'americanfootball_nfl': { name: 'NFL', category: 'American Football' },
  'americanfootball_nfl_preseason': { name: 'NFL Preseason', category: 'American Football' },
  'americanfootball_ufl': { name: 'UFL', category: 'American Football' },
  
  // Baseball
  'baseball_mlb': { name: 'MLB', category: 'Baseball' },
  'baseball_mlb_preseason': { name: 'MLB Preseason', category: 'Baseball' },
  'baseball_ncaa': { name: 'NCAA Baseball', category: 'Baseball' },
  'baseball_npb': { name: 'NPB (Japan)', category: 'Baseball' },
  'baseball_kbo': { name: 'KBO League (Korea)', category: 'Baseball' },
  
  // Basketball
  'basketball_nba': { name: 'NBA', category: 'Basketball' },
  'basketball_nba_preseason': { name: 'NBA Preseason', category: 'Basketball' },
  'basketball_wnba': { name: 'WNBA', category: 'Basketball' },
  'basketball_ncaab': { name: 'NCAAB', category: 'Basketball' },
  'basketball_wncaab': { name: 'WNCAAB', category: 'Basketball' },
  'basketball_euroleague': { name: 'Euroleague', category: 'Basketball' },
  'basketball_nbl': { name: 'NBL (Australia)', category: 'Basketball' },
  
  // Ice Hockey
  'icehockey_nhl': { name: 'NHL', category: 'Ice Hockey' },
  'icehockey_nhl_preseason': { name: 'NHL Preseason', category: 'Ice Hockey' },
  'icehockey_ahl': { name: 'AHL', category: 'Ice Hockey' },
  'icehockey_sweden_hockey_league': { name: 'SHL', category: 'Ice Hockey' },
  
  // Soccer (most popular leagues)
  'soccer_epl': { name: 'English Premier League', category: 'Soccer' },
  'soccer_spain_la_liga': { name: 'La Liga', category: 'Soccer' },
  'soccer_germany_bundesliga': { name: 'Bundesliga', category: 'Soccer' },
  'soccer_italy_serie_a': { name: 'Serie A', category: 'Soccer' },
  'soccer_france_ligue_one': { name: 'Ligue 1', category: 'Soccer' },
  'soccer_usa_mls': { name: 'MLS', category: 'Soccer' },
  'soccer_uefa_champs_league': { name: 'UEFA Champions League', category: 'Soccer' },
  
  // MMA
  'mma_mixed_martial_arts': { name: 'MMA', category: 'Mixed Martial Arts' },
  
  // Boxing
  'boxing_boxing': { name: 'Boxing', category: 'Boxing' },
  
  // Special
  'upcoming': { name: 'All Upcoming Sports', category: 'All' },
} as const;

export type ValidSportKey = keyof typeof VALID_SPORTS;

/**
 * Validates if a sport key is recognized by the Odds API
 */
export function isValidSport(sportKey: string): boolean {
  return sportKey in VALID_SPORTS;
}

/**
 * Maps common sport abbreviations to Odds API sport keys
 * Uses the SPORTS_MAP from constants
 */
export function mapSportToApiKey(sport: string): string {
  if (!sport) return 'upcoming';
  
  const lowercaseSport = sport.toLowerCase();
  
  // Check if it's already a valid API key
  if (isValidSport(lowercaseSport)) {
    return lowercaseSport;
  }
  
  // Try to map from abbreviation
  const mapped = SPORTS_MAP[lowercaseSport as keyof typeof SPORTS_MAP];
  if (mapped && isValidSport(mapped)) {
    return mapped;
  }
  
  // Fallback to 'upcoming' which shows all sports
  console.log(`[SportsValidator] Unknown sport "${sport}", using "upcoming"`);
  return 'upcoming';
}

/**
 * Validates and normalizes a sport key with detailed error information
 */
export function validateSportKey(sport: string): {
  isValid: boolean;
  normalizedKey: string;
  error?: string;
  suggestion?: string;
} {
  if (!sport) {
    return {
      isValid: true,
      normalizedKey: 'upcoming',
      suggestion: 'No sport specified, showing all upcoming events'
    };
  }
  
  const lowercaseSport = sport.toLowerCase();
  
  // Check if already valid
  if (isValidSport(lowercaseSport)) {
    return {
      isValid: true,
      normalizedKey: lowercaseSport,
    };
  }
  
  // Check if it's a known abbreviation
  const mapped = SPORTS_MAP[lowercaseSport as keyof typeof SPORTS_MAP];
  if (mapped && isValidSport(mapped)) {
    return {
      isValid: true,
      normalizedKey: mapped,
      suggestion: `Mapped "${sport}" to "${mapped}"`
    };
  }
  
  // Find similar sport keys for suggestions
  const suggestions = findSimilarSports(lowercaseSport);
  
  return {
    isValid: false,
    normalizedKey: 'upcoming',
    error: `Unknown sport: "${sport}"`,
    suggestion: suggestions.length > 0 
      ? `Did you mean: ${suggestions.slice(0, 3).join(', ')}?`
      : 'Using "upcoming" to show all available events'
  };
}

/**
 * Finds similar sport keys using fuzzy matching
 */
function findSimilarSports(input: string): string[] {
  const allSportKeys = Object.keys(VALID_SPORTS);
  const allAbbreviations = Object.keys(SPORTS_MAP);
  
  // Simple similarity: check if the input is contained in any valid key
  const similar: string[] = [];
  
  for (const key of allSportKeys) {
    if (key.includes(input) || input.includes(key.split('_')[0])) {
      similar.push(key);
    }
  }
  
  for (const abbrev of allAbbreviations) {
    if (abbrev.includes(input)) {
      const mapped = SPORTS_MAP[abbrev as keyof typeof SPORTS_MAP];
      if (!similar.includes(mapped)) {
        similar.push(mapped);
      }
    }
  }
  
  return similar;
}

/**
 * Gets sport information for display
 */
export function getSportInfo(sportKey: string): {
  name: string;
  category: string;
  apiKey: string;
} {
  const normalizedKey = mapSportToApiKey(sportKey);
  const info = VALID_SPORTS[normalizedKey as ValidSportKey];
  
  return {
    name: info?.name || sportKey,
    category: info?.category || 'Unknown',
    apiKey: normalizedKey,
  };
}

/**
 * Gets all supported sports grouped by category
 */
export function getSupportedSports(): Record<string, Array<{ key: string; name: string }>> {
  const grouped: Record<string, Array<{ key: string; name: string }>> = {};
  
  for (const [key, value] of Object.entries(VALID_SPORTS)) {
    if (!grouped[value.category]) {
      grouped[value.category] = [];
    }
    grouped[value.category].push({ key, name: value.name });
  }
  
  return grouped;
}

/**
 * Gets quick access list of popular sports
 */
export function getPopularSports(): Array<{ key: string; name: string; category: string }> {
  const popular: ValidSportKey[] = [
    'basketball_nba',
    'americanfootball_nfl',
    'baseball_mlb',
    'icehockey_nhl',
    'soccer_epl',
    'basketball_ncaab',
    'americanfootball_ncaaf',
    'mma_mixed_martial_arts',
  ];
  
  return popular.map(key => ({
    key,
    name: VALID_SPORTS[key].name,
    category: VALID_SPORTS[key].category,
  }));
}
