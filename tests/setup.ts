/**
 * Test setup - loads environment variables and checks network connectivity
 * for live API integration tests.
 *
 * The ODDS_API_KEY must be set either via a .env.test file in the project
 * root or as an environment variable before running the tests.
 */

import { config } from 'dotenv';
import path from 'path';

// Load .env.test if present (not committed to git)
config({ path: path.resolve(__dirname, '..', '.env.test') });

if (!process.env.ODDS_API_KEY) {
  console.warn(
    '\n⚠  ODDS_API_KEY is not set. Live API tests will be skipped.\n' +
    '   Create a .env.test file with ODDS_API_KEY=your_key or export it.\n'
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
