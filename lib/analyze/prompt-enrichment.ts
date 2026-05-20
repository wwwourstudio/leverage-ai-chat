/**
 * Prompt enrichment for the /api/analyze pipeline.
 *
 * Builds the final enrichedPrompt string by injecting live data blocks (odds,
 * Kalshi markets, Statcast leaders, NFL context, etc.) into the base user
 * message. Also sets context.oddsData as a side effect when odds are fetched
 * server-side (downstream card generation reads it).
 *
 * Independent data sources (Statcast leaders, MLB schedule) are kicked off as
 * parallel Promises at function entry so they are ready by the time the odds
 * branch resolves, keeping end-to-end latency close to the slowest single fetch
 * rather than their sum.
 *
 * Timeout budget per service (cold cache):
 *   Odds API          2.5 s  (was 8 s)
 *   Kalshi main       2.5 s  (was 6 s)
 *   Kalshi sports     2.0 s  (was 4 s)
 *   Statcast DB       1.0 s  (was 0.8 s — now parallel)
 *   Statcast Savant   2.0 s  (was 4 s   — now parallel)
 *   MLB schedule      2.0 s  (was 3 s   — now parallel)
 */

import { getOddsApiKey } from '@/lib/config';
import { getMarketIntelligenceSummary } from '@/lib/market-intelligence';
import { NFL_SEASON_YEAR } from '@/lib/constants';
import { cacheGet, cacheSet, bucket } from '@/lib/cache/redis-cache';
import type { AnalyzeContext, SportDetectionResult, EnrichmentResult } from './types';

// ── Formatting helpers ────────────────────────────────────────────────────────

/** Format an American-odds number, returning 'N/A' for invalid values. */
function fmtOdds(p: unknown): string {
  if (typeof p !== 'number' || !Number.isFinite(p) || Math.abs(p) < 100) return 'N/A';
  return `${p > 0 ? '+' : ''}${p}`;
}

/** Format an odds event array (up to 8 events, 2 books each) into a text block. */
function formatOddsEvents(events: any[], sportLabel: string): string {
  const oddsPreview = events
    .slice(0, 8)
    .map((e: any) => {
      const lines: string[] = [`${e.away_team} @ ${e.home_team}`];
      for (const book of (e.bookmakers || []).slice(0, 2)) {
        const h2h    = book.markets?.find((m: any) => m.key === 'h2h');
        const spread = book.markets?.find((m: any) => m.key === 'spreads');
        const total  = book.markets?.find((m: any) => m.key === 'totals');
        if (h2h) {
          const home = h2h.outcomes?.find((o: any) => o.name === e.home_team);
          const away = h2h.outcomes?.find((o: any) => o.name === e.away_team);
          lines.push(`  ML (${book.title}): ${e.away_team} ${fmtOdds(away?.price)} | ${e.home_team} ${fmtOdds(home?.price)}`);
        }
        if (spread) {
          const home = spread.outcomes?.find((o: any) => o.name === e.home_team);
          const away = spread.outcomes?.find((o: any) => o.name === e.away_team);
          lines.push(`  Spread (${book.title}): ${e.away_team} ${(away?.point ?? 0) > 0 ? '+' : ''}${away?.point ?? ''} (${fmtOdds(away?.price)}) | ${e.home_team} ${(home?.point ?? 0) > 0 ? '+' : ''}${home?.point ?? ''} (${fmtOdds(home?.price)})`);
        }
        if (total) {
          const over  = total.outcomes?.find((o: any) => o.name === 'Over');
          const under = total.outcomes?.find((o: any) => o.name === 'Under');
          lines.push(`  Total (${book.title}): O${over?.point ?? ''} (${fmtOdds(over?.price)}) | U${under?.point ?? ''} (${fmtOdds(under?.price)})`);
        }
      }
      return lines.join('\n');
    })
    .join('\n\n');

  return `\n\n--- REAL LIVE ODDS DATA (use ONLY these numbers for odds/lines) ---\nSport: ${sportLabel}\n\n${oddsPreview}\n--- END ODDS DATA ---`;
}

// ── Private parallel-fetch helpers ────────────────────────────────────────────

/**
 * Fetch and cache Statcast leaders. Tries the DB first (1 s timeout), falls
 * back to Baseball Savant (2 s timeout). Returns a formatted text block ready
 * for prompt injection, or null if neither source had enough data.
 *
 * Shape detection handles both DB (snake_case) and Savant (camelCase) records
 * transparently, including cached results from either source.
 */
async function _fetchStatcastBlock(season: number): Promise<{ block: string; injected: boolean } | null> {
  const key = `statcast:leaders:v1:${season}:${bucket(3_600_000)}`;
  try {
    // ── Cache hit ─────────────────────────────────────────────────────────────
    let batters: any[] | undefined;
    let pitchers: any[] | undefined;

    const cached = await cacheGet<{ batters: any[]; pitchers: any[] }>(key).catch(() => null);
    if (cached && (cached.batters?.length ?? 0) >= 3) {
      console.log(`[v0] [ANALYZE] Statcast leaders cache hit (${cached.batters.length} batters)`);
      batters  = cached.batters;
      pitchers = cached.pitchers ?? [];
    }

    // ── DB fetch ──────────────────────────────────────────────────────────────
    if (!batters) {
      const { getTopStatcastLeadersFromDB } = await import('@/lib/services/statcast-ingest');
      const fromDB = await Promise.race([
        getTopStatcastLeadersFromDB(season, 5),
        new Promise<{ batters: never[]; pitchers: never[] }>(
          resolve => setTimeout(() => resolve({ batters: [], pitchers: [] }), 1000)
        ),
      ]);
      if ((fromDB?.batters?.length ?? 0) >= 3) {
        batters  = fromDB.batters;
        pitchers = fromDB.pitchers ?? [];
        void cacheSet(key, fromDB, 3600);
      }
    }

    // ── Baseball Savant fallback ───────────────────────────────────────────────
    if (!batters) {
      const { getStatcastData, queryStatcast } = await import('@/lib/baseball-savant');
      const { players } = await Promise.race([
        getStatcastData(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
      ]);
      if (players.length > 0) {
        batters  = queryStatcast(players, { playerType: 'batter',  limit: 5 }).sort((a, b) => b.barrelRate - a.barrelRate);
        pitchers = queryStatcast(players, { playerType: 'pitcher', limit: 5 }).sort((a, b) => a.xslg - b.xslg);
        if ((batters?.length ?? 0) >= 3) {
          void cacheSet(key, { batters, pitchers }, 3600);
          void import('@/lib/services/statcast-ingest').then(({ persistStatcastLeaders }) =>
            persistStatcastLeaders(players)
          ).catch((e: unknown) => {
            console.warn('[v0] [ANALYZE] statcast DB warm failed:', e instanceof Error ? e.message : e);
          });
        }
      }
    }

    if (!batters || batters.length < 3 || !pitchers || pitchers.length < 3) return null;

    // Format — detect shape by field name (DB = snake_case, Savant = camelCase)
    const fmtB = (p: any) => 'player_name' in p
      ? `  ${p.player_name}: Barrel% ${Number(p.barrel_rate ?? 0).toFixed(1)}, xwOBA ${Number(p.xwoba ?? 0).toFixed(3)}, HardHit% ${Number(p.hard_hit_pct ?? 0).toFixed(1)}, ExitVelo ${Number(p.avg_exit_velocity ?? 0).toFixed(1)} mph`
      : `  ${p.name}: Barrel% ${p.barrelRate.toFixed(1)}, xwOBA ${p.xwoba.toFixed(3)}, HardHit% ${p.hardHitPct.toFixed(1)}, ExitVelo ${p.exitVelocity.toFixed(1)} mph`;
    const fmtP = (p: any) => 'player_name' in p
      ? `  ${p.player_name}: xSLG-allowed ${Number(p.xslg ?? 0).toFixed(3)}, Barrel%-allowed ${Number(p.barrel_rate ?? 0).toFixed(1)}, xwOBA-against ${Number(p.xwoba ?? 0).toFixed(3)}`
      : `  ${p.name}: xSLG-allowed ${p.xslg.toFixed(3)}, Barrel%-allowed ${p.barrelRate.toFixed(1)}, xwOBA-against ${p.xwoba.toFixed(3)}`;

    const block = `\n\n${[
      `--- MLB STATCAST LEADERS (${season} season) ---`,
      'Top Batters by Barrel Rate:',
      ...batters.map(fmtB),
      'Top Pitchers (lowest xSLG allowed):',
      ...pitchers.map(fmtP),
      '--- END STATCAST ---',
    ].join('\n')}`;

    console.log(`[v0] [ANALYZE] Injected Statcast leaders: ${batters.length} batters, ${pitchers.length} pitchers`);
    return { block, injected: true };
  } catch {
    return null;
  }
}

/**
 * Fetch and cache today's MLB schedule. 2 s timeout.
 * Returns the game array, or null on miss/error.
 */
async function _fetchMLBSchedule(): Promise<any[] | null> {
  const key = `mlb:schedule:v1:${new Date().toISOString().slice(0, 10)}:${bucket(300_000)}`;
  try {
    const cached = await cacheGet<any[]>(key).catch(() => null);
    if (cached !== null) {
      console.log(`[v0] [ANALYZE] MLB schedule cache hit (${cached.length} games)`);
      return cached;
    }
    const { fetchTodaysGames } = await import('@/lib/mlb-projections/mlb-stats-api');
    const games = await Promise.race([
      fetchTodaysGames(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000)),
    ]).catch(() => null);
    if (Array.isArray(games) && games.length > 0) {
      void cacheSet(key, games, 300);
    }
    return Array.isArray(games) ? games : null;
  } catch {
    return null;
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Build the enriched prompt by injecting live data context blocks.
 *
 * Side effects on `context`:
 *   - context.oddsData is set when odds are fetched server-side.
 *
 * @param userMessage  The (possibly file-summarised) user message
 * @param context      Mutable context from the client
 * @param detection    Sport/intent detection result from detectSportAndIntents()
 * @param dateStr      Human-readable date string ("Monday, May 15, 2026")
 */
export async function buildEnrichedPrompt(
  userMessage: string,
  context: AnalyzeContext,
  detection: SportDetectionResult,
  dateStr: string,
): Promise<EnrichmentResult> {
  const { isMLBQuery, hasADPIntent } = detection;

  let enrichedPrompt = userMessage;
  let kalshiSportsFallbackMarkets: any[] | null = null;
  let kalshiPromptMarkets: any[] | null = null;
  let serverFetchedOdds = false;
  let statcastInjected = false;
  let noLiveGamesDetected = false;

  const STATCAST_SEASON = new Date().getFullYear() - (new Date().getMonth() + 1 >= 4 ? 0 : 1);

  // ── Pre-fetch MLB data in parallel (concurrent with branch selection) ─────
  // These are fully independent of the odds result; starting them here saves
  // up to 3 s of serial waiting on the Branch 5 hot path.
  const _statcastPromise = (isMLBQuery && !hasADPIntent && !context.isPoliticalMarket)
    ? _fetchStatcastBlock(STATCAST_SEASON)
    : Promise.resolve(null);

  const _schedulePromise = (isMLBQuery && !context.isPoliticalMarket)
    ? _fetchMLBSchedule()
    : Promise.resolve(null);

  // ── Branch 1: Client already has live odds ────────────────────────────────
  if (context.oddsData?.events?.length > 0 && !context.isPoliticalMarket) {
    enrichedPrompt += formatOddsEvents(context.oddsData.events, context.oddsData.sport);

  // ── Branch 2: No live games in client context ─────────────────────────────
  } else if (context.noGamesAvailable) {
    enrichedPrompt += `\n\n[Context: No live ${context.sport?.toUpperCase() || 'sports'} games are currently scheduled (offseason or between games). Provide expert analysis, offseason insights, betting strategy, and relevant market knowledge instead of live odds.]`;

  // ── Branch 3: Non-betting sports question ─────────────────────────────────
  } else if (!context.hasBettingIntent && context.sport) {
    enrichedPrompt += `\n\n[Context: User is asking about ${context.sport.toUpperCase()} — provide expert analysis using your knowledge. No live odds needed for this question.]`;

  // ── Branch 4: Kalshi / prediction market query ────────────────────────────
  } else if (context.isPoliticalMarket || context.selectedCategory === 'kalshi') {
    try {
      const sub = (context.kalshiSubcategory || '').toLowerCase();
      const _kalshiMainKey = `kalshi:main:v1:${sub || 'general'}:${bucket(180_000)}`; // 3-min buckets

      let markets: any[] | null = await cacheGet<any[]>(_kalshiMainKey).catch(() => null);

      if (markets === null) {
        const { fetchElectionMarkets, fetchKalshiMarketsWithRetry, fetchEntertainmentMarkets } = await import('@/lib/kalshi/index');
        const ENTERTAINMENT_SUBS = ['entertainment', 'culture', 'awards', 'oscars', 'grammys',
          'emmys', 'films', 'movies', 'music', 'tv', 'celebrity', 'pop culture', 'arts',
          'film', 'oscar', 'grammy', 'emmy'];
        const fetchMarkets =
          (sub === 'politics' || sub === 'elections' || sub === 'election')
            ? fetchElectionMarkets({ limit: 50 })
          : (sub === 'sports' || sub === 'sport')
            ? fetchKalshiMarketsWithRetry({ search: 'NFL NBA MLB NHL Super Bowl March Madness', limit: 30, maxRetries: 2 })
          : ENTERTAINMENT_SUBS.includes(sub)
            ? fetchEntertainmentMarkets(50)
          : fetchKalshiMarketsWithRetry({ limit: 50, maxRetries: 3 });

        markets = await Promise.race([
          fetchMarkets,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500)), // was 6000
        ]).catch(() => null);

        if (Array.isArray(markets)) {
          void cacheSet(_kalshiMainKey, markets, 180);
        }
      } else {
        console.log(`[KALSHI] Cache hit for ${_kalshiMainKey}`);
      }

      if (markets && (markets as any[]).length > 0) {
        const sorted = (markets as any[]).sort((a: any, b: any) => {
          const score = (m: any) =>
            (m.priceIsReal ? 1_000_000 : 0)
            + ((m.yesBid > 0 || m.yesAsk > 0) ? 200_000 : 0)
            + (m.volume24h ?? 0) * 10
            + (m.volume ?? 0);
          return score(b) - score(a);
        });
        const topMarkets = sorted.slice(0, 6);
        kalshiPromptMarkets = topMarkets;
        const marketSummary = topMarkets.map((m: any, i: number) => {
          const yesCents = Math.min(100, Math.max(0, m.yesPrice ?? m.yesBid ?? m.yes_bid ?? 50));
          const noCents  = Math.min(100, Math.max(0, m.noPrice  ?? m.noAsk  ?? m.no_ask  ?? (100 - yesCents)));
          const spread   = m.spread ?? Math.abs(yesCents - (100 - noCents));
          const vol = m.volume24h ?? m.volume ?? 0;
          const volStr = vol > 1_000_000 ? `${(vol / 1_000_000).toFixed(1)}M` : vol > 1_000 ? `${(vol / 1_000).toFixed(0)}K` : `${vol}`;
          return `${i + 1}. "${m.title}" — YES: ${yesCents}% implied prob, NO: ${noCents}%, Spread: ${spread}¢, Vol: ${volStr}`;
        }).join('\n');
        console.log(`[KALSHI] Injected ${topMarkets.length} prediction markets into AI context`);
        enrichedPrompt += `\n\n--- LIVE KALSHI PREDICTION MARKETS ---\n${marketSummary}\n[YES % = market-implied probability. Edge = difference between your model probability and YES %. Ground analysis in these real prices — do not invent tickers or volumes.]\n--- END KALSHI DATA ---`;
      } else {
        enrichedPrompt += `\n\n[Context: Kalshi prediction market query. No live markets available — provide general prediction market analysis and strategy.]`;
      }
    } catch {
      enrichedPrompt += `\n\n[Context: This is a Kalshi prediction market query. Answer directly with prediction market analysis, probability edge, and trading recommendations. Do NOT ask the user to choose a sports platform or area — the user is already on the Kalshi tab. Analyze the specific market or topic asked about.]`;
    }

  // ── Branch 5: Betting intent with sport — try server-side Odds API fetch ──
  } else if ((context.hasBettingIntent || context.isSportsQuery) && context.sport && !context.isPoliticalMarket && !hasADPIntent) {
    const _oddsKey = getOddsApiKey();
    if (_oddsKey && context.sport !== 'none') {
      try {
        const { fetchLiveOdds, validateSportKey } = await import('@/lib/odds/index');
        const _sportKey = validateSportKey(context.sport).normalizedKey ?? context.sport;

        // 2-minute cache: odds change slowly; avoids hammering the Odds API on every request
        const _oddsCacheKey = `odds:v1:${_sportKey}:${bucket(120_000)}`;
        let _serverEvents: any[] | null = await cacheGet<any[]>(_oddsCacheKey).catch(() => null);

        if (_serverEvents === null) {
          _serverEvents = await Promise.race([
            fetchLiveOdds(_sportKey, { apiKey: _oddsKey, markets: ['h2h', 'spreads', 'totals'], regions: ['us'], oddsFormat: 'american' }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500)), // was 8000
          ]).catch(() => null);
          // Cache the result (including empty arrays — no live games IS a valid cached state)
          if (Array.isArray(_serverEvents)) {
            void cacheSet(_oddsCacheKey, _serverEvents, 120);
          }
        } else {
          console.log(`[v0] [ANALYZE] Odds cache hit for ${_sportKey}`);
        }

        if (Array.isArray(_serverEvents) && _serverEvents.length > 0) {
          enrichedPrompt += formatOddsEvents(_serverEvents, context.sport);
          serverFetchedOdds = true;
          context.oddsData = { events: _serverEvents, sport: _sportKey };
          console.log(`[v0] [ANALYZE] Server-fetched ${_serverEvents.length} ${context.sport} games from Odds API`);

          // Query Supabase for notable line movements in the last 4 hours
          try {
            const { createClient: createSbClient } = await import('@/lib/supabase/server');
            const _sb = await createSbClient();
            const { data: _moves } = await _sb
              .from('line_movement')
              .select('game_id, market_type, bookmaker, old_odds, new_odds, updated_at')
              .eq('sport', context.sport)
              .gte('updated_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
              .order('updated_at', { ascending: false })
              .limit(10);
            if (_moves && _moves.length > 0) {
              const sharpLines = _moves.map((m: any) => {
                const delta = (m.new_odds ?? 0) - (m.old_odds ?? 0);
                const direction = delta < 0 ? 'shortening ▼' : 'lengthening ▲';
                const isSharp  = Math.abs(delta) >= 20;
                return `  ${m.market_type} (${m.bookmaker}): ${m.old_odds > 0 ? '+' : ''}${m.old_odds} → ${m.new_odds > 0 ? '+' : ''}${m.new_odds} (${direction}${isSharp ? ' 🔥 SHARP' : ''})`;
              }).join('\n');
              enrichedPrompt += `\n\n--- RECENT LINE MOVEMENT (last 4h, ${context.sport}) ---\n${sharpLines}\n[Shortening ≥20pts = likely sharp money. Factor into your confidence/recommendation.]\n--- END LINE MOVEMENT ---`;
              console.log(`[v0] [ANALYZE] Injected ${_moves.length} line movement signals`);
            }
          } catch {
            // Non-critical — skip if Supabase is unavailable
          }
        }
      } catch (oddsErr) {
        const oddsStatus = (oddsErr as any)?.status ?? (oddsErr as any)?.statusCode;
        const oddsMsg = oddsErr instanceof Error ? oddsErr.message : String(oddsErr);
        if (oddsStatus && oddsStatus >= 400 && oddsStatus < 500) {
          console.warn('[v0] [ANALYZE] Odds API ' + oddsStatus + ' — ' + oddsMsg + '. Using Kalshi fallback.');
        }
      }
    }

    if (!serverFetchedOdds) {
      // Kalshi sports fallback when Odds API had no data
      const SPORT_TO_KALSHI_KW: Record<string, string> = {
        basketball_nba: 'NBA', basketball_ncaab: 'college basketball',
        americanfootball_nfl: 'NFL', americanfootball_ncaaf: 'college football',
        baseball_mlb: 'MLB', icehockey_nhl: 'NHL',
        soccer_epl: 'Premier League', soccer_mls: 'MLS',
        mma_mixed_martial_arts: 'UFC MMA',
      };
      const sportKw = SPORT_TO_KALSHI_KW[context.sport]
        ?? context.sport.replace(/^[a-z]+_/, '').toUpperCase();
      try {
        const _kalshiSportKey = `kalshi:sport:v1:${sportKw}:${bucket(180_000)}`; // 3-min buckets
        let markets: any[] | null = await cacheGet<any[]>(_kalshiSportKey).catch(() => null);

        if (markets === null) {
          const { fetchKalshiMarketsWithRetry } = await import('@/lib/kalshi/index');
          markets = await Promise.race([
            fetchKalshiMarketsWithRetry({ search: sportKw, limit: 10, maxRetries: 3 }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)), // was 4000
          ]).catch(() => null);
          if (Array.isArray(markets)) {
            void cacheSet(_kalshiSportKey, markets, 180);
          }
        } else {
          console.log(`[KALSHI] Sports fallback cache hit for ${sportKw}`);
        }
        if (markets && (markets as any[]).length > 0) {
          const top = (markets as any[]).slice(0, 6);
          kalshiSportsFallbackMarkets = top;
          const marketLines = top.map((m: any, i: number) => {
            const yesCents = Math.min(100, Math.max(0, m.yesPrice ?? m.yesBid ?? 50));
            const noCents  = Math.min(100, Math.max(0, 100 - yesCents));
            const vol = m.volume24h ?? m.volume ?? 0;
            const volStr = vol > 1_000_000 ? `${(vol / 1_000_000).toFixed(1)}M` : vol > 1_000 ? `${(vol / 1_000).toFixed(0)}K` : `${vol}`;
            return `${i + 1}. "${m.title}" — YES: ${yesCents}% (implied prob ${(yesCents / 100).toFixed(3)}), NO: ${noCents}%, Vol: ${volStr}`;
          }).join('\n');
          console.log(`[KALSHI] Injected ${top.length} ${sportKw} markets as odds fallback`);
          enrichedPrompt += `\n\n--- KALSHI ${sportKw.toUpperCase()} MARKETS (live market-implied probabilities — sportsbook odds unavailable) ---\n${marketLines}\n[YES % = market-implied probability. Use these as your probability baseline. Identify edge where your model probability diverges from market price.]\n--- END KALSHI DATA ---`;
        } else {
          noLiveGamesDetected = true;
          enrichedPrompt += `\n\n[IMPORTANT: No live ${context.sport.toUpperCase()} odds or prediction market data is available right now. You MUST NOT invent or assume specific game matchups, scores, teams, or betting lines that you are not 100% certain about. Do not fabricate schedules. Instead: (1) clearly state that verified live data is currently unavailable, (2) offer general betting strategy or historical context for this sport, and (3) ask the user what they would like to analyze — futures, trends, season-long analysis, or to wait for confirmed schedules. Today: ${dateStr}.]`;
          console.log(`[KALSHI] No ${sportKw} markets found — injecting no-hallucination guard`);
        }
      } catch (err) {
        console.warn(`[KALSHI] Sports market fetch failed for ${context.sport}:`, err instanceof Error ? err.message : String(err));
        noLiveGamesDetected = true;
        enrichedPrompt += `\n\n[IMPORTANT: Live ${context.sport.toUpperCase()} odds data is unavailable right now. Do NOT invent game matchups, scores, or betting lines. Clearly state data is unavailable and offer general betting strategy instead.]`;
      }
    }

  // ── Branch 6: ADP query ───────────────────────────────────────────────────
  } else if (hasADPIntent && context.sport) {
    enrichedPrompt += `\n\n[Context: Fantasy draft/ADP query for ${context.sport.toUpperCase()}. Use the query_adp tool and your NFBC expertise to answer. Focus on draft value, positional scarcity, and roster construction — not sportsbook odds.]`;

  // ── Branch 7: General question ────────────────────────────────────────────
  } else if (!context.hasBettingIntent && !context.sport && !context.isPoliticalMarket) {
    enrichedPrompt += `\n\n[Context: General question — answer with your full expert knowledge about sports betting, fantasy, DFS, or prediction markets as appropriate.]`;
  }

  // ── Statcast enrichment (awaits pre-fetched parallel result) ─────────────
  // By this point the promise has been running concurrently with the odds
  // branch above, so the await here adds little or no extra latency.
  if (isMLBQuery && !hasADPIntent && !context.isPoliticalMarket) {
    const statcastResult = await _statcastPromise;
    if (statcastResult?.injected) {
      enrichedPrompt += statcastResult.block;
      statcastInjected = true;
    }
  }

  // ── Market Intelligence signal injection (non-blocking, 2 s timeout) ──────
  if (context.sport && context.oddsData?.events?.length > 0) {
    try {
      const primaryEvent = context.oddsData.events[0];
      const primaryEventId = primaryEvent?.id;
      if (primaryEventId) {
        const intel = await Promise.race([
          getMarketIntelligenceSummary(primaryEventId, context.sport),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 2000)),
        ]);
        if (intel && intel.severity !== 'none') {
          enrichedPrompt += `\n\n[Market Intelligence Signals]\nAnomaly Score: ${intel.anomalyScore.toFixed(2)} (${intel.severity} severity)\nSurface Probability: ${(intel.surfaceProbability * 100).toFixed(1)}%\nLine Movement: ${intel.movementType} (velocity ${intel.velocityScore.toFixed(0)}/100)\nBenford Trust Score: ${intel.benfordTrust.toFixed(0)}/100\nComposite Signal Strength: ${intel.signalStrength.toFixed(0)}/100\n[Use these signals to contextualize your analysis. High anomaly scores may indicate smart-money movement or cross-market mispricing worth highlighting.]`;
        }
      }
    } catch {
      // Non-blocking — intelligence signals are additive, never block the AI response
    }
  }

  // ── MLB schedule injection (awaits pre-fetched parallel result) ───────────
  if (isMLBQuery && !context.isPoliticalMarket) {
    const todaysGames = await _schedulePromise;
    if (todaysGames && todaysGames.length > 0) {
      const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      const scheduleLines = todaysGames.map((g: any) =>
        `${g.awayTeam ?? g.away ?? 'Away'} @ ${g.homeTeam ?? g.home ?? 'Home'}` +
        ` | Away SP: ${g.probableAwayPitcher?.fullName ?? 'TBD'}` +
        ` | Home SP: ${g.probableHomePitcher?.fullName ?? 'TBD'}`
      );
      enrichedPrompt +=
        `\n\n--- TODAY'S MLB SCHEDULE (${todayLabel}) ---\n` +
        scheduleLines.join('\n') +
        `\n--- END SCHEDULE ---\n` +
        `CRITICAL: Only recommend pitchers who appear in TODAY'S SCHEDULE above. ` +
        `If a pitcher is NOT listed, explicitly state they are not scheduled to pitch today and decline to give a start/sit recommendation for them.\n`;
    } else {
      enrichedPrompt += `\n\n[MLB Schedule: No games found for today or schedule unavailable. Do not make start/sit pitcher recommendations without verified schedule data.]\n`;
    }
  }

  // ── NFL data-provenance context ────────────────────────────────────────────
  const isNFLQuery = (context.sport ?? '').includes('football') || (context.sport ?? '') === 'nfl' || (context.sport ?? '') === '';
  const hasLiveNFLOdds = (context.oddsData?.events?.length ?? 0) > 0;
  if (isNFLQuery && !hasLiveNFLOdds && !context.isPoliticalMarket) {
    const now2 = new Date();
    const month = now2.getMonth() + 1;
    const isOffseason = month >= 3 && month <= 8;
    const isPlayoffs = month === 1 || month === 2;
    const isRegularSeason = month >= 9 || month === 12;
    const phaseLabel = isOffseason
      ? `${NFL_SEASON_YEAR} NFL season is complete (Super Bowl concluded ~Feb ${NFL_SEASON_YEAR + 1}). It is currently the ${NFL_SEASON_YEAR + 1} offseason (free agency, draft prep, rookie minis).`
      : isPlayoffs
      ? `The ${NFL_SEASON_YEAR} NFL regular season is complete; playoffs are in progress.`
      : isRegularSeason
      ? `The ${NFL_SEASON_YEAR} NFL regular season is in progress.`
      : `NFL offseason.`;
    enrichedPrompt += `\n\n[NFL Season Context — ${NFL_SEASON_YEAR}]\n${phaseLabel}\nIMPORTANT: No live NFL stats are available in this session. Any player stats, snap counts, yards, TDs, or performance metrics you provide are sourced from your training knowledge and may be incomplete for the ${NFL_SEASON_YEAR} season. Label all AI-sourced stats as "(${NFL_SEASON_YEAR} season — AI estimate)" and encourage the user to verify at NFL.com, Pro Football Reference, or ESPN for official figures.`;
  }

  // ── Fantasy-specific context ───────────────────────────────────────────────
  if (context.hasFantasyIntent && (!context.hasBettingIntent || context.selectedCategory === 'fantasy' || context.selectedCategory === 'dfs')) {
    const sport = context.sport || '';
    const isNFL = sport.includes('football') || sport === '';
    if (isNFL) {
      enrichedPrompt += `\n\n[Fantasy Context: The ${NFL_SEASON_YEAR} NFL regular season and playoffs are complete. Fantasy advice should address the ${NFL_SEASON_YEAR + 1} offseason: free agency moves, rookie targets, ADP for ${NFL_SEASON_YEAR + 1} redraft leagues, and dynasty/devy strategy. Any stats referenced are ${NFL_SEASON_YEAR} season figures from AI training data — label them as "(${NFL_SEASON_YEAR} — AI estimate)" and encourage verification.]`;
    } else {
      const sportName = sport.replace(/^(americanfootball|basketball|baseball|icehockey|soccer|mma)_?/, '').toUpperCase().replace(/_/g, ' ') || sport.toUpperCase();
      enrichedPrompt += `\n\n[Fantasy Context: The user is asking about ${sportName} fantasy. Use your current knowledge of active rosters, recent performance, injury reports, and this week's matchups to give accurate advice. Today's date: ${dateStr}.]`;
    }
  }

  // ── Odds key missing notice ────────────────────────────────────────────────
  if (context.oddsKeyMissing) {
    enrichedPrompt += `\n\n[System: Live odds are unavailable — ODDS_API_KEY is not configured in the server environment. Inform the user they need to add ODDS_API_KEY to their Vercel environment variables to enable live odds.]`;
  }

  return {
    enrichedPrompt,
    kalshiSportsFallbackMarkets,
    kalshiPromptMarkets,
    serverFetchedOdds,
    noLiveGamesDetected,
    statcastInjected,
  };
}
