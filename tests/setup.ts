/**
 * Test setup - checks network connectivity for live API integration tests.
 *
 * Environment variables are injected by vitest.config.ts which loads:
 *   .env.test  (test-specific overrides)
 *   .env.local (developer local secrets — put ODDS_API_KEY here)
 *   .env       (shared defaults)
 *
 * No action needed: if ODDS_API_KEY is in any of those files, tests run.
 * If it's absent, live API tests skip gracefully.
 */

if (!process.env.ODDS_API_KEY) {
  console.warn(
    '\n⚠  ODDS_API_KEY is not set. Live API tests will be skipped.\n' +
    '   Add ODDS_API_KEY=your_key to .env.local (or .env.test) to enable them.\n'
  );
}

/**
 * Preflight network check — determines whether the Odds API is reachable.
 * Sets ODDS_API_REACHABLE=1 if the sports endpoint returns 200.
 * Tests should use `canReachAPI()` to decide whether to run.
 */
let _apiReachable: boolean | null = null;

export async function canReachAPI(): Promise<boolean> {
  if (_apiReachable !== null) return _apiReachable;

  const key = process.env.ODDS_API_KEY;
  if (!key) {
    _apiReachable = false;
    return false;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports?apiKey=${key}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    _apiReachable = res.ok;
  } catch {
    _apiReachable = false;
  }

  if (!_apiReachable) {
    console.warn(
      '\n⚠  Cannot reach api.the-odds-api.com. Live API tests will be skipped.\n'
    );
  }

  return _apiReachable;
}
