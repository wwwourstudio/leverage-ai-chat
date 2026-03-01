/**
 * Unit Tests for lib/odds/index.ts
 * Covers: validateSportKey (alias resolution, direct keys, invalid inputs),
 *         clearOddsCache (full and targeted cache clearing), and
 *         ODDS_API_SPORTS / ODDS_MARKETS / BETTING_REGIONS constant shapes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateSportKey,
  clearOddsCache,
  ODDS_API_SPORTS,
  ODDS_MARKETS,
  BETTING_REGIONS,
} from '@/lib/odds/index';

// ============================================================================
// validateSportKey
// ============================================================================

describe('validateSportKey', () => {
  describe('valid direct API keys', () => {
    it('accepts basketball_nba', () => {
      const result = validateSportKey('basketball_nba');
      expect(result.isValid).toBe(true);
      expect(result.normalizedKey).toBe('basketball_nba');
    });

    it('accepts americanfootball_nfl', () => {
      const result = validateSportKey('americanfootball_nfl');
      expect(result.isValid).toBe(true);
      expect(result.normalizedKey).toBe('americanfootball_nfl');
    });

    it('accepts baseball_mlb', () => {
      const result = validateSportKey('baseball_mlb');
      expect(result.isValid).toBe(true);
      expect(result.normalizedKey).toBe('baseball_mlb');
    });

    it('accepts icehockey_nhl', () => {
      const result = validateSportKey('icehockey_nhl');
      expect(result.isValid).toBe(true);
    });

    it('accepts soccer_epl', () => {
      const result = validateSportKey('soccer_epl');
      expect(result.isValid).toBe(true);
    });

    it('normalizes uppercase input to lowercase', () => {
      const result = validateSportKey('BASKETBALL_NBA');
      expect(result.isValid).toBe(true);
      expect(result.normalizedKey).toBe('basketball_nba');
    });
  });

  describe('short-form aliases', () => {
    it('resolves "nba" to basketball_nba', () => {
      const result = validateSportKey('nba');
      expect(result.isValid).toBe(true);
      expect(result.normalizedKey).toBe('basketball_nba');
    });

    it('resolves "nfl" to americanfootball_nfl', () => {
      const result = validateSportKey('nfl');
      expect(result.isValid).toBe(true);
      expect(result.normalizedKey).toBe('americanfootball_nfl');
    });

    it('resolves "football" to americanfootball_nfl', () => {
      const result = validateSportKey('football');
      expect(result.isValid).toBe(true);
      expect(result.normalizedKey).toBe('americanfootball_nfl');
    });

    it('resolves "basketball" to basketball_nba', () => {
      const result = validateSportKey('basketball');
      expect(result.isValid).toBe(true);
      expect(result.normalizedKey).toBe('basketball_nba');
    });

    it('resolves "baseball" to baseball_mlb', () => {
      const result = validateSportKey('baseball');
      expect(result.isValid).toBe(true);
      expect(result.normalizedKey).toBe('baseball_mlb');
    });

    it('resolves "mlb" to baseball_mlb', () => {
      const result = validateSportKey('mlb');
      expect(result.isValid).toBe(true);
      expect(result.normalizedKey).toBe('baseball_mlb');
    });

    it('resolves "hockey" to icehockey_nhl', () => {
      const result = validateSportKey('hockey');
      expect(result.isValid).toBe(true);
      expect(result.normalizedKey).toBe('icehockey_nhl');
    });

    it('resolves "nhl" to icehockey_nhl', () => {
      const result = validateSportKey('nhl');
      expect(result.isValid).toBe(true);
      expect(result.normalizedKey).toBe('icehockey_nhl');
    });

    it('aliases are case-insensitive', () => {
      const result = validateSportKey('NBA');
      expect(result.isValid).toBe(true);
      expect(result.normalizedKey).toBe('basketball_nba');
    });
  });

  describe('invalid inputs', () => {
    it('rejects an empty string', () => {
      const result = validateSportKey('');
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/no sport/i);
    });

    it('rejects an unknown sport name', () => {
      const result = validateSportKey('cricket');
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/unknown sport/i);
    });

    it('rejects a random string', () => {
      const result = validateSportKey('not_a_sport_xyz');
      expect(result.isValid).toBe(false);
    });

    it('returns undefined normalizedKey for invalid sports', () => {
      const result = validateSportKey('curling');
      expect(result.isValid).toBe(false);
      expect(result.normalizedKey).toBeUndefined();
    });
  });
});

// ============================================================================
// clearOddsCache — smoke tests (validates it runs without throwing)
// ============================================================================

describe('clearOddsCache', () => {
  it('clears the full cache without throwing', () => {
    expect(() => clearOddsCache()).not.toThrow();
  });

  it('clears cache for a specific sport key without throwing', () => {
    expect(() => clearOddsCache('basketball_nba')).not.toThrow();
  });

  it('handles clearing cache for an unknown sport key', () => {
    expect(() => clearOddsCache('sport_does_not_exist')).not.toThrow();
  });
});

// ============================================================================
// Constants shape validation
// ============================================================================

describe('ODDS_API_SPORTS', () => {
  it('contains expected sport keys', () => {
    expect(ODDS_API_SPORTS.NFL).toBe('americanfootball_nfl');
    expect(ODDS_API_SPORTS.NBA).toBe('basketball_nba');
    expect(ODDS_API_SPORTS.MLB).toBe('baseball_mlb');
    expect(ODDS_API_SPORTS.NHL).toBe('icehockey_nhl');
  });

  it('all values are non-empty strings', () => {
    for (const val of Object.values(ODDS_API_SPORTS)) {
      expect(typeof val).toBe('string');
      expect(val.length).toBeGreaterThan(0);
    }
  });
});

describe('ODDS_MARKETS', () => {
  it('has the expected market keys', () => {
    expect(ODDS_MARKETS.H2H).toBe('h2h');
    expect(ODDS_MARKETS.SPREADS).toBe('spreads');
    expect(ODDS_MARKETS.TOTALS).toBe('totals');
  });
});

describe('BETTING_REGIONS', () => {
  it('includes the US region', () => {
    expect(BETTING_REGIONS.US).toBe('us');
  });
});
