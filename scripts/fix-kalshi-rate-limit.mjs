/**
 * Directly rewrites the fetchElectionMarkets and fetchWeatherMarkets functions
 * in lib/kalshi/index.ts to use a single API call each (instead of 3+),
 * eliminating the 429 rate-limit errors.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = resolve(__dirname, '../lib/kalshi/index.ts');

let src = readFileSync(filePath, 'utf8');

// ─── 1. Replace fetchElectionMarkets body ────────────────────────────────────
const OLD_ELECTION = `  // Reduced to 3 broad searches (was 7) — each goes through the global throttle queue
  // (400ms minimum gap), so 7 searches was generating ~3 req/s and reliably hitting 429s.
  // These 3 terms cover all meaningful election content on Kalshi.
  const searchStrategies: Array<Parameters<typeof fetchKalshiMarkets>[0]> = [
    { search: 'election' },
    { search: 'senate' },
    { search: 'congress' },
  ];

  const seen = new Set<string>();
  const electionMarkets: KalshiMarket[] = [];
  // No manual delay needed — fetchKalshiPage routes through throttledRequest automatically.

  for (let si = 0; si < searchStrategies.length; si++) {
    if (electionMarkets.length >= limit) break;

    const strategy = searchStrategies[si];
    const markets = await fetchKalshiMarkets({ ...strategy, limit: 50 });

    for (const market of markets) {
      if (seen.has(market.ticker)) continue;
      seen.add(market.ticker);
      if (isElectionMarket(market)) {
        electionMarkets.push(market);
      }
    }
  }

  // Fallback: if no matches after all strategies, fetch a broad set and filter.
  // This handles the case where the Kalshi API returns unrelated markets for all searches.
  if (electionMarkets.length === 0) {
    console.log('[KALSHI] No election markets from targeted searches — falling back to broad fetch');
    try {
      const broad = await fetchKalshiMarketsWithRetry({ limit: 200, maxRetries: 2 });
      for (const market of broad) {
        if (!seen.has(market.ticker) && isElectionMarket(market)) {
          electionMarkets.push(market);
        }
      }
    } catch {
      // Non-critical fallback
    }
  }`;

const NEW_ELECTION = `  // ONE search per call. Previously 3 searches x 3 retries each = up to 9 requests -> 429.
  // "congress" is broad enough to surface all political markets on Kalshi.
  const seen = new Set<string>();
  const electionMarkets: KalshiMarket[] = [];

  const primaryMarkets = await fetchKalshiMarkets({
    search: 'congress',
    limit: Math.max(limit * 3, 50),
    cacheTtlMs: 300_000,
  });

  for (const market of primaryMarkets) {
    if (seen.has(market.ticker)) continue;
    seen.add(market.ticker);
    if (isElectionMarket(market)) {
      electionMarkets.push(market);
    }
  }

  // One follow-up ONLY when the primary search returned zero political results
  if (electionMarkets.length === 0) {
    console.log('[KALSHI] No results from "congress" search — trying "election"');
    try {
      const fallback = await fetchKalshiMarkets({ search: 'election', limit: 50, cacheTtlMs: 300_000 });
      for (const market of fallback) {
        if (!seen.has(market.ticker) && isElectionMarket(market)) {
          electionMarkets.push(market);
        }
      }
    } catch {
      // Non-critical
    }
  }`;

if (!src.includes(OLD_ELECTION)) {
  console.error('ERROR: Could not find fetchElectionMarkets target block. File may have already been patched or differs from expected.');
  process.exit(1);
}
src = src.replace(OLD_ELECTION, NEW_ELECTION);
console.log('✓ Patched fetchElectionMarkets (3 searches → 1)');

// ─── 2. Replace fetchWeatherMarkets body ─────────────────────────────────────
const OLD_WEATHER = `  // Trimmed to 3 broad terms to avoid Kalshi rate limits (previously 9 terms → 429 errors).
  const weatherSearches = ['weather', 'temperature', 'climate'];
  const WEATHER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  const seen = new Set<string>();
  const all: KalshiMarket[] = [];

  console.log('[KALSHI] Fetching weather markets...');

  const results = await Promise.allSettled(
    weatherSearches.map(search =>
      fetchKalshiMarkets({ search, limit: 50, useCache: true, cacheTtlMs: WEATHER_CACHE_TTL_MS })
    )
  );
  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const market of result.value) {
        if (!seen.has(market.ticker)) {
          seen.add(market.ticker);
          all.push(market);
        }
      }
    }
  }`;

const NEW_WEATHER = `  // Two searches, run sequentially. Previously Promise.allSettled with 3 concurrent requests
  // fired all 3 simultaneously and defeated the global throttle queue -> 429 errors.
  const weatherSearches = ['weather', 'temperature'];
  const WEATHER_CACHE_TTL_MS = 5 * 60 * 1000;

  const seen = new Set<string>();
  const all: KalshiMarket[] = [];

  console.log('[KALSHI] Fetching weather markets...');

  for (const search of weatherSearches) {
    if (all.length >= limit) break;
    try {
      const markets = await fetchKalshiMarkets({ search, limit: 50, useCache: true, cacheTtlMs: WEATHER_CACHE_TTL_MS });
      for (const market of markets) {
        if (!seen.has(market.ticker)) {
          seen.add(market.ticker);
          all.push(market);
        }
      }
    } catch {
      // Non-critical
    }
  }`;

if (!src.includes(OLD_WEATHER)) {
  console.error('ERROR: Could not find fetchWeatherMarkets target block. File may have already been patched or differs from expected.');
  process.exit(1);
}
src = src.replace(OLD_WEATHER, NEW_WEATHER);
console.log('✓ Patched fetchWeatherMarkets (Promise.allSettled -> sequential)');

writeFileSync(filePath, src, 'utf8');
console.log('✓ Wrote patched file to', filePath);
