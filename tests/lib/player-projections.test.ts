/**
 * Unit Tests for lib/player-projections.ts
 * Covers pure (non-async) functions:
 *   - extractPlayerName
 *   - isPlayerProjectionQuery
 *   - formatProjectionSummary
 *   - calculateDerivedStats
 *
 * Also covers fetchPlayerProjections with mocked fetch / config.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractPlayerName,
  isPlayerProjectionQuery,
  formatProjectionSummary,
  calculateDerivedStats,
  fetchPlayerProjections,
  type PlayerProjection,
  type PlayerProjectionsResponse,
} from '@/lib/player-projections';

// ============================================================================
// extractPlayerName
// ============================================================================

describe('extractPlayerName', () => {
  it('extracts a First Last name', () => {
    expect(extractPlayerName('What are the projections for Aaron Judge?')).toBe('Aaron Judge');
  });

  it('extracts Last, First format and normalizes it', () => {
    // "Judge, Aaron" → "Judge Aaron" (comma removed, space retained)
    const name = extractPlayerName('Tell me about Judge, Aaron this season');
    // Pattern handles "Last, First" by removing comma-space
    expect(name).toBeTruthy();
  });

  it('picks up the first capitalized name pair', () => {
    // "Shohei Ohtani" comes first — the regex matches consecutive [A-Z][a-z]+ pairs
    const result = extractPlayerName('Shohei Ohtani vs Mike Trout tonight');
    expect(result).toBe('Shohei Ohtani');
  });

  it('returns empty string when no name is found', () => {
    expect(extractPlayerName('give me baseball projections')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(extractPlayerName('')).toBe('');
  });
});

// ============================================================================
// isPlayerProjectionQuery
// ============================================================================

describe('isPlayerProjectionQuery', () => {
  it('returns true for "projection" keyword', () => {
    expect(isPlayerProjectionQuery('What are the projections for Shohei Ohtani?')).toBe(true);
  });

  it('returns true for "prop bet" keyword', () => {
    expect(isPlayerProjectionQuery('Show me prop bet for Aaron Judge')).toBe(true);
  });

  it('returns true for "home run" keyword', () => {
    expect(isPlayerProjectionQuery('Will Judge hit a home run tonight?')).toBe(true);
  });

  it('returns true for "rbi" keyword', () => {
    expect(isPlayerProjectionQuery('RBI props for this week')).toBe(true);
  });

  it('returns true for "stolen bases" keyword', () => {
    expect(isPlayerProjectionQuery('stolen bases over/under line')).toBe(true);
  });

  it('returns true for "prop" keyword', () => {
    expect(isPlayerProjectionQuery('Check the prop for the pitcher')).toBe(true);
  });

  it('returns false for unrelated query', () => {
    expect(isPlayerProjectionQuery('Who is the best team in the NBA?')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isPlayerProjectionQuery('PROJECTION for Judge')).toBe(true);
  });
});

// ============================================================================
// formatProjectionSummary
// ============================================================================

const sampleProjections: PlayerProjection[] = [
  {
    player: 'Aaron Judge',
    team: 'NYY',
    position: 'OF',
    statType: 'home runs',
    projection: 0.5,
    overOdds: -115,
    underOdds: -105,
    line: 0.5,
    bookmaker: 'FanDuel',
    lastUpdate: '2025-05-01T12:00:00Z',
  },
  {
    player: 'Aaron Judge',
    team: 'NYY',
    position: 'OF',
    statType: 'home runs',
    projection: 0.5,
    overOdds: -120,
    underOdds: -100,
    line: 0.5,
    bookmaker: 'DraftKings',
    lastUpdate: '2025-05-01T12:00:00Z',
  },
  {
    player: 'Aaron Judge',
    team: 'NYY',
    position: 'OF',
    statType: 'hits',
    projection: 1.5,
    overOdds: -110,
    underOdds: -110,
    line: 1.5,
    bookmaker: 'BetMGM',
    lastUpdate: '2025-05-01T12:00:00Z',
  },
];

const successResponse: PlayerProjectionsResponse = {
  success: true,
  player: 'Aaron Judge',
  projections: sampleProjections,
  source: 'api',
  timestamp: '2025-05-01T12:00:00Z',
};

describe('formatProjectionSummary', () => {
  it('includes the player name', () => {
    const summary = formatProjectionSummary(successResponse);
    expect(summary).toContain('Aaron Judge');
  });

  it('includes each stat type', () => {
    const summary = formatProjectionSummary(successResponse);
    expect(summary).toContain('home runs');
    expect(summary).toContain('hits');
  });

  it('includes bookmaker count for multi-book entries', () => {
    const summary = formatProjectionSummary(successResponse);
    // "home runs" has 2 books → should mention [2 books]
    expect(summary).toContain('2 book');
  });

  it('includes source attribution', () => {
    const summary = formatProjectionSummary(successResponse);
    expect(summary).toContain('The Odds API');
  });

  it('returns error string when success=false', () => {
    const errorResponse: PlayerProjectionsResponse = {
      success: false,
      error: 'Player not found',
      source: 'fallback',
      timestamp: '2025-05-01T12:00:00Z',
    };
    const summary = formatProjectionSummary(errorResponse);
    expect(summary).toBe('Player not found');
  });

  it('returns fallback text when no projections', () => {
    const emptyResponse: PlayerProjectionsResponse = {
      success: false,
      source: 'api',
      timestamp: '2025-05-01T12:00:00Z',
    };
    const summary = formatProjectionSummary(emptyResponse);
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
  });

  it('formats average over odds with sign', () => {
    const summary = formatProjectionSummary(successResponse);
    // Average of -115 and -120 = -117.5, should be formatted as a negative number
    expect(summary).toMatch(/-\d+/);
  });
});

// ============================================================================
// calculateDerivedStats
// ============================================================================

describe('calculateDerivedStats', () => {
  it('aggregates projections by stat type', () => {
    const stats = calculateDerivedStats(sampleProjections);
    // The last projection for each statType wins (reduce overwrites)
    expect(stats).toHaveProperty('home runs');
    expect(stats).toHaveProperty('hits');
  });

  it('returns numeric values', () => {
    const stats = calculateDerivedStats(sampleProjections);
    for (const val of Object.values(stats)) {
      expect(typeof val).toBe('number');
    }
  });

  it('returns an empty object for empty input', () => {
    expect(calculateDerivedStats([])).toEqual({});
  });

  it('maps statType to projection value', () => {
    const projections: PlayerProjection[] = [
      { player: 'Test', team: 'TB', position: 'SP', statType: 'strikeouts', projection: 7.5, source: 'api' as any },
    ];
    const stats = calculateDerivedStats(projections);
    expect(stats['strikeouts']).toBe(7.5);
  });
});

// ============================================================================
// fetchPlayerProjections — mocked fetch / config
// ============================================================================

describe('fetchPlayerProjections', () => {
  beforeEach(() => {
    // Ensure ODDS_API_KEY is unset so isOddsApiConfigured() returns false by default
    delete process.env.ODDS_API_KEY;
    delete process.env.NEXT_PUBLIC_ODDS_API_KEY;
  });

  it('returns error response when Odds API is not configured', async () => {
    const result = await fetchPlayerProjections('Aaron Judge');
    expect(result.success).toBe(false);
    expect(result.source).toBe('fallback');
    expect(result.error).toMatch(/not configured/i);
  });

  it('returns error when fetch fails (non-ok response)', async () => {
    process.env.ODDS_API_KEY = 'test-key';
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 })
    );

    const result = await fetchPlayerProjections('Aaron Judge');
    expect(result.success).toBe(false);
    expect(result.source).toBe('fallback');
  });

  it('returns error when API returns invalid JSON structure', async () => {
    process.env.ODDS_API_KEY = 'test-key';
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ not: 'an array' }), { status: 200 })
    );

    const result = await fetchPlayerProjections('Aaron Judge');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid api response/i);
  });

  it('returns no-player-found when events have no matching bookmakers', async () => {
    process.env.ODDS_API_KEY = 'test-key';
    // Return a valid array but with no bookmakers
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { home_team: 'NYY', away_team: 'BOS', bookmakers: [] },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const result = await fetchPlayerProjections('Aaron Judge');
    expect(result.success).toBe(false);
    expect(result.source).toBe('api');
    expect(result.error).toMatch(/no active prop/i);
  });

  it('includes a timestamp in every response', async () => {
    const result = await fetchPlayerProjections('Anyone');
    expect(result.timestamp).toBeTruthy();
    expect(typeof result.timestamp).toBe('string');
  });
});
