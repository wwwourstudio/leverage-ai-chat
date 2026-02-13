/**
 * Sport Key Validator Utility
 * Validates and normalizes sport keys for consistency across the codebase
 * 
 * Purpose:
 * - Ensure all sport references use correct format (API format for external calls)
 * - Convert between short form (nba) and API format (basketball_nba)
 * - Provide helpful error messages for invalid sport keys
 * 
 * Usage:
 * ```typescript
 * import { validateSportKey, normalizeSportKey } from '@/lib/sport-key-validator';
 * 
 * // Validate and get detailed info
 * const result = validateSportKey('nba');
 * if (result.isValid) {
 *   console.log('API format:', result.apiFormat);
 * }
 * 
 * // Quick normalization
 * const apiKey = normalizeSportKey('nfl'); // Returns 'americanfootball_nfl'
 * ```
 */

import { SPORT_KEYS, sportToApi, apiToSport } from './constants';

export interface SportValidationResult {
  isValid: boolean;
  input: string;
  shortForm?: string;
  apiFormat?: string;
  displayName?: string;
  category?: string;
  error?: string;
  suggestion?: string;
}

/**
 * Validates a sport key and returns detailed information
 * Accepts both short form ('nba') and API format ('basketball_nba')
 */
export function validateSportKey(sportKey: string): SportValidationResult {
  if (!sportKey) {
    return {
      isValid: false,
      input: '',
      error: 'Sport key is required',
      suggestion: 'Provide a valid sport key like "nba" or "basketball_nba"'
    };
  }

  const input = sportKey.toLowerCase().trim();
  
  // Try to convert to API format
  const apiFormat = sportToApi(input);
  
  // Check if we have a valid mapping
  const isKnownShortForm = Object.values(SPORT_KEYS).some(
    sport => sport.SHORT === input || sport.API === input
  );
  
  if (!isKnownShortForm && apiFormat === input) {
    // Not found in our mappings and sportToApi returned input unchanged
    return {
      isValid: false,
      input,
      error: `Unknown sport key: "${sportKey}"`,
      suggestion: `Valid options: ${Object.values(SPORT_KEYS).map(s => s.SHORT).join(', ')}`
    };
  }

  // Get the short form
  const shortForm = apiToSport(apiFormat);
  
  // Find the sport details
  const sportDetails = Object.values(SPORT_KEYS).find(
    sport => sport.SHORT === shortForm || sport.API === apiFormat
  );

  return {
    isValid: true,
    input,
    shortForm,
    apiFormat,
    displayName: sportDetails?.NAME,
    category: sportDetails?.CATEGORY
  };
}

/**
 * Quick normalization to API format
 * Returns the input unchanged if not recognized
 */
export function normalizeSportKey(sportKey: string): string {
  if (!sportKey) return '';
  return sportToApi(sportKey.toLowerCase().trim());
}

/**
 * Checks if a sport key is valid (either short or API format)
 */
export function isValidSportKey(sportKey: string): boolean {
  if (!sportKey) return false;
  const result = validateSportKey(sportKey);
  return result.isValid;
}

/**
 * Gets a list of all valid sport keys in both formats
 */
export function getAllSportKeys(): Array<{
  short: string;
  api: string;
  name: string;
  category: string;
}> {
  return Object.values(SPORT_KEYS).map(sport => ({
    short: sport.SHORT,
    api: sport.API,
    name: sport.NAME,
    category: sport.CATEGORY
  }));
}

/**
 * Finds the closest matching sport key using fuzzy matching
 */
export function findSimilarSportKey(input: string): string[] {
  if (!input) return [];
  
  const lowerInput = input.toLowerCase();
  const allKeys = getAllSportKeys();
  const matches: string[] = [];
  
  for (const sport of allKeys) {
    // Check if input matches part of short form, API format, or name
    if (
      sport.short.includes(lowerInput) ||
      sport.api.includes(lowerInput) ||
      sport.name.toLowerCase().includes(lowerInput)
    ) {
      matches.push(sport.short);
    }
  }
  
  return matches;
}

/**
 * Validates multiple sport keys at once
 */
export function validateSportKeys(sportKeys: string[]): {
  valid: string[];
  invalid: Array<{ key: string; error: string }>;
  normalized: string[];
} {
  const valid: string[] = [];
  const invalid: Array<{ key: string; error: string }> = [];
  const normalized: string[] = [];
  
  for (const key of sportKeys) {
    const result = validateSportKey(key);
    if (result.isValid && result.apiFormat) {
      valid.push(key);
      normalized.push(result.apiFormat);
    } else {
      invalid.push({ 
        key, 
        error: result.error || 'Unknown error' 
      });
    }
  }
  
  return { valid, invalid, normalized };
}
