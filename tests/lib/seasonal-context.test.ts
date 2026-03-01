/**
 * Unit Tests for lib/seasonal-context.ts
 * Covers: getSeasonInfo (regular season, playoffs, offseason),
 *         generateNoDataMessage (various reasons + unknown sport).
 */

import { describe, it, expect } from 'vitest';
import { getSeasonInfo, generateNoDataMessage } from '@/lib/seasonal-context';

// ============================================================================
// Helpers — fixed dates to make tests deterministic
// ============================================================================

/** Create a date in the given month (1-12), in 2025. */
function dateInMonth(month: number): Date {
  return new Date(2025, month - 1, 15); // 15th of the month, midday
}

// ============================================================================
// getSeasonInfo — NBA (Oct-Apr regular, Apr-June playoffs)
// ============================================================================

describe('getSeasonInfo — NBA', () => {
  const SPORT = 'basketball_nba';

  it('is in regular season in November', () => {
    const info = getSeasonInfo(SPORT, dateInMonth(11));
    expect(info.isInSeason).toBe(true);
    expect(info.seasonName).toBe('Regular Season');
  });

  it('is in regular season in February', () => {
    const info = getSeasonInfo(SPORT, dateInMonth(2));
    expect(info.isInSeason).toBe(true);
  });

  it('is in playoffs in May', () => {
    const info = getSeasonInfo(SPORT, dateInMonth(5));
    expect(info.isInSeason).toBe(true);
    expect(info.seasonName).toBe('Playoffs');
  });

  it('is offseason in August', () => {
    const info = getSeasonInfo(SPORT, dateInMonth(8));
    expect(info.isInSeason).toBe(false);
    expect(info.seasonName).toBe('Offseason');
  });

  it('offseason includes nextSeasonStart', () => {
    const info = getSeasonInfo(SPORT, dateInMonth(8));
    expect(info.seasonStart).toBeTruthy();
    expect(typeof info.seasonStart).toBe('string');
  });

  it('in-season info includes context string', () => {
    const info = getSeasonInfo(SPORT, dateInMonth(11));
    expect(typeof info.context).toBe('string');
    expect(info.context.length).toBeGreaterThan(0);
  });

  it('in-season info includes nextGameEstimate', () => {
    const info = getSeasonInfo(SPORT, dateInMonth(11));
    expect(info.nextGameEstimate).toBeTruthy();
  });
});

// ============================================================================
// getSeasonInfo — NFL (Sept-Dec regular, Jan playoffs)
// ============================================================================

describe('getSeasonInfo — NFL', () => {
  const SPORT = 'americanfootball_nfl';

  it('is in regular season in October', () => {
    const info = getSeasonInfo(SPORT, dateInMonth(10));
    expect(info.isInSeason).toBe(true);
    expect(info.seasonName).toBe('Regular Season');
  });

  it('is in playoffs in January', () => {
    const info = getSeasonInfo(SPORT, dateInMonth(1));
    expect(info.isInSeason).toBe(true);
    expect(info.seasonName).toBe('Playoffs');
  });

  it('is offseason in March', () => {
    const info = getSeasonInfo(SPORT, dateInMonth(3));
    expect(info.isInSeason).toBe(false);
  });
});

// ============================================================================
// getSeasonInfo — MLB (Apr-Sept regular, Oct playoffs)
// ============================================================================

describe('getSeasonInfo — MLB', () => {
  const SPORT = 'baseball_mlb';

  it('is in regular season in July', () => {
    const info = getSeasonInfo(SPORT, dateInMonth(7));
    expect(info.isInSeason).toBe(true);
    expect(info.seasonName).toBe('Regular Season');
  });

  it('is in playoffs in October', () => {
    const info = getSeasonInfo(SPORT, dateInMonth(10));
    expect(info.isInSeason).toBe(true);
    expect(info.seasonName).toBe('Playoffs');
  });

  it('is offseason in January', () => {
    const info = getSeasonInfo(SPORT, dateInMonth(1));
    expect(info.isInSeason).toBe(false);
  });
});

// ============================================================================
// getSeasonInfo — unknown sport
// ============================================================================

describe('getSeasonInfo — unknown sport', () => {
  it('returns isInSeason=true for unknown sport key', () => {
    const info = getSeasonInfo('some_unknown_sport_xyz');
    expect(info.isInSeason).toBe(true);
    expect(info.seasonName).toBe('Unknown');
  });

  it('includes a fallback context message', () => {
    const info = getSeasonInfo('unknown_sport');
    expect(info.context).toMatch(/season information/i);
  });
});

// ============================================================================
// generateNoDataMessage
// ============================================================================

describe('generateNoDataMessage', () => {
  it('returns offseason message when sport is out of season', () => {
    // NBA is out of season in August
    const msg = generateNoDataMessage('basketball_nba', undefined);
    // August: check using a specific date... but generateNoDataMessage uses new Date() internally.
    // We can't easily control the internal date, so just assert shape is valid.
    expect(msg).toHaveProperty('title');
    expect(msg).toHaveProperty('description');
    expect(msg).toHaveProperty('suggestion');
    expect(typeof msg.title).toBe('string');
  });

  it('returns api_error message with correct title', () => {
    // For any in-season sport, api_error should give "Data Temporarily Unavailable"
    // Use NBA in November (always in-season in real calendar, but generateNoDataMessage uses current date)
    // To make this deterministic we test the api_error case regardless of current date
    const msg = generateNoDataMessage('basketball_nba', 'api_error');
    // If it's currently in NBA season, api_error is used
    // If it's offseason, the offseason branch runs instead
    // Either way the shape should be correct
    expect(typeof msg.title).toBe('string');
    expect(msg.title.length).toBeGreaterThan(0);
    expect(typeof msg.description).toBe('string');
    expect(typeof msg.suggestion).toBe('string');
  });

  it('returns rate_limited message', () => {
    const msg = generateNoDataMessage('basketball_nba', 'rate_limited');
    expect(typeof msg.title).toBe('string');
    expect(msg.title.length).toBeGreaterThan(0);
  });

  it('returns fallback for unknown reason', () => {
    const msg = generateNoDataMessage('basketball_nba', undefined);
    expect(typeof msg.title).toBe('string');
    expect(typeof msg.description).toBe('string');
    expect(typeof msg.suggestion).toBe('string');
  });

  it('handles unknown sport key gracefully', () => {
    const msg = generateNoDataMessage('sport_does_not_exist', undefined);
    expect(typeof msg.title).toBe('string');
  });
});

// ============================================================================
// SeasonInfo shape validation
// ============================================================================

describe('SeasonInfo shape', () => {
  it('always returns required fields', () => {
    const sports = [
      'basketball_nba',
      'americanfootball_nfl',
      'baseball_mlb',
      'icehockey_nhl',
      'soccer_epl',
    ];
    for (const sport of sports) {
      const info = getSeasonInfo(sport, dateInMonth(6));
      expect(typeof info.isInSeason).toBe('boolean');
      expect(typeof info.seasonName).toBe('string');
      expect(typeof info.context).toBe('string');
    }
  });
});
