/**
 * lib/analyze/tools.ts
 * Tool factory and declarative selection registry for the analyze endpoint.
 *
 * ARCHITECTURE
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  createTools(context, rawQueryLower)                                │
 * │    → builds one Tool instance per capability (closes over context)  │
 * │                                                                     │
 * │  selectTools(toolSet, detection, ...)                               │
 * │    → consults TOOL_SLOTS registry                                   │
 * │    → picks the last active slot (last-wins = original semantics)    │
 * │    → returns { tools, stopWhen, maxSteps? } spread for streamText   │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * xAI COMPATIBILITY
 *   Every slot uses stopWhen: stepCountIs(2) — xAI rejects messages[6+]
 *   that carry cache_control on empty text blocks (Anthropic limitation
 *   surfaced through the xAI gateway). Two steps (1 tool call + 1 synthesis)
 *   is the maximum safe count. deepThink raises this to maxSteps: 3.
 */
import { tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { getADPData, queryADP } from '@/lib/adp-data';
import { getNFLADPData } from '@/lib/nfl-adp-data';
import { getStatcastData, queryStatcast } from '@/lib/baseball-savant';
import { getOddsApiKey } from '@/lib/config';
import { NFBC_DRAFT_YEAR } from '@/lib/constants';
import type { AnalyzeContext, SportDetectionResult } from './types';

// =============================================================================
// Tool factory — one instance per request (execute() closes over context)
// =============================================================================

export function createTools(context: AnalyzeContext, rawQueryLower: string) {

  // ── Fantasy draft / ADP ───────────────────────────────────────────────────
  const adpTool = tool({
    description:
      'Query NFBC MLB or NFFC NFL Average Draft Position (ADP) data. ' +
      'Use for any question about player draft rankings, average draft position (ADP), ' +
      'positional scarcity in fantasy drafts, or where a specific player is being drafted. ' +
      'Works for both baseball (NFBC) and football (NFFC).',
    inputSchema: z.object({
      player:    z.string().optional().describe('Partial player name — case-insensitive (e.g. "Judge", "Ohtani", "Trout")'),
      position:  z.string().optional().describe('Position filter: SP | RP | 1B | 2B | 3B | SS | OF | DH | C'),
      rankMin:   z.number().optional().describe('Minimum overall NFBC rank (inclusive)'),
      rankMax:   z.number().optional().describe('Maximum overall NFBC rank (inclusive)'),
      limit:     z.number().optional().describe('Number of players to return (default 10, max 25)'),
      team:      z.string().optional().describe('MLB team abbreviation — e.g. "NYY", "LAD", "BOS", "CHC"'),
      valueOnly: z.boolean().optional().describe('Return only value picks: players drafted 15+ spots later than their rank (sleepers)'),
    }),
    execute: async ({ player, position, rankMin, rankMax, limit, team, valueOnly }) => {
      console.log('[API/analyze] ADP tool called:', { player, position, rankMin, rankMax, limit, team, valueOnly });
      const isNFL =
        context?.sport?.includes('football') || context?.sport === 'nfl' ||
        rawQueryLower.includes('football') || rawQueryLower.includes('nfl') || rawQueryLower.includes('nffc');
      const data   = isNFL ? await getNFLADPData() : await getADPData();
      const source = isNFL ? `NFFC ${NFBC_DRAFT_YEAR} NFL ADP` : `NFBC ${NFBC_DRAFT_YEAR} ADP`;
      if (data.length === 0) {
        return {
          players: [], total_players_in_dataset: 0, source, is_static_fallback: true,
          error: 'ADP data is temporarily unavailable. Please try again shortly or consult nfc.shgn.com.',
        };
      }
      const results = queryADP(data, { player, position, rankMin, rankMax, limit, team, valueOnly });
      return {
        players: results,
        total_players_in_dataset: data.length,
        source,
        is_static_fallback: data.length <= 150,
      };
    },
  });

  // ── Baseball Savant Statcast metrics ──────────────────────────────────────
  const statcastTool = tool({
    description:
      'Query REAL Baseball Savant Statcast metrics (barrel rate, exit velocity, ' +
      'xwOBA, hard-hit %, sweet-spot %, xBA, xSLG) PLUS pitch-level recent 30-day ' +
      'aggregates from the Leverage AI Statcast database. ' +
      'Use for any MLB player question about Statcast performance or HR probability. ' +
      'Always call this tool FIRST — never invent Statcast numbers. ' +
      'db_recent_30d contains the most recent pitch-level data and should be prioritized ' +
      'over season averages when discussing recent form or hot/cold streaks.',
    inputSchema: z.object({
      player:     z.string().optional().describe('Partial player name — case-insensitive (e.g. "Judge", "Ohtani")'),
      playerType: z.enum(['batter', 'pitcher']).optional().describe('Restrict to batters or pitchers only'),
      limit:      z.number().optional().describe('Number of players to return (default 10, max 25)'),
    }),
    execute: async ({ player, playerType, limit }) => {
      console.log('[API/analyze] Statcast tool called:', { player, playerType, limit });
      const { players: allPlayers, isLiveData, season } = await getStatcastData();
      const results = allPlayers.length > 0 ? queryStatcast(allPlayers, { player, playerType, limit }) : [];
      let dbAggregate = null;
      if (player) {
        try {
          const { getPlayerAggregate } = await import('@/lib/statcastQuery');
          dbAggregate = await getPlayerAggregate(player, playerType ?? 'batter', 30);
        } catch {
          // non-fatal — DB may be empty if scraper hasn't run yet
        }
      }
      return {
        players: results,
        total_in_dataset: allPlayers.length,
        source: isLiveData ? `Baseball Savant ${season} (real data)` : `Baseball Savant ${season} (cached fallback)`,
        ...(dbAggregate && {
          db_recent_30d: {
            source:          'Leverage AI Statcast DB (Baseball Savant pitch-level)',
            playerName:      dbAggregate.playerName,
            samplePitches:   dbAggregate.samplePitches,
            sampleBIP:       dbAggregate.sampleBIP,
            avgExitVelo:     dbAggregate.avgExitVelo,
            barrelRate:      dbAggregate.barrelRate,
            hardHitRate:     dbAggregate.hardHitRate,
            sweetSpotRate:   dbAggregate.sweetSpotRate,
            avgLaunchAngle:  dbAggregate.avgLaunchAngle,
            avgReleaseSpeed: dbAggregate.avgReleaseSpeed,
            avgSpinRate:     dbAggregate.avgSpinRate,
            dateRange:       dbAggregate.dateRange,
          },
        }),
        ...(results.length === 0 && !dbAggregate && {
          error: 'Statcast data temporarily unavailable. Use model knowledge for analysis.',
        }),
      };
    },
  });

  // ── LeverageMetrics MLB projection engine ─────────────────────────────────
  const mlbProjectionTool = tool({
    description:
      'Run the LeverageMetrics MLB projection engine (Monte Carlo N=1,000, HR Super Model, ' +
      'K Model, Breakout Score, 9 DFS matchup variables). ' +
      'Use for ANY MLB question about DFS lineups, fantasy advice (waiver/streaming/ROS), ' +
      'HR prop betting edges, or player projections. ' +
      'Always call this tool FIRST — NEVER invent salaries, projections, or odds. ' +
      'Call this tool ONCE per query. When `player` is set, outputFor is ignored — ' +
      'single-player analysis covers all use cases (projections, betting edge, and fantasy).',
    inputSchema: z.object({
      playerType: z.enum(['hitter', 'pitcher', 'all']).optional()
        .describe('Filter by player type: hitter, pitcher, or all (default: all)'),
      player:     z.string().optional().describe('Specific player name — partial match (e.g. "Judge", "Cole")'),
      limit:      z.number().optional().describe('Max cards to return (1–15, default 9)'),
      date:       z.string().optional().describe('Date in YYYY-MM-DD format (default: today)'),
      outputFor:  z.enum(['projections', 'dfs', 'fantasy', 'betting']).optional()
        .describe('Output format: projections (MLBProjectionCard), dfs (DFSCard), fantasy (FantasyCard), betting (hr_prop_card edge cards)'),
    }),
    execute: async ({ playerType, player, limit, date, outputFor }) => {
      console.log('[API/analyze] MLB projection tool called:', { playerType, player, limit, date, outputFor });
      try {
        const resolvedOutputFor = outputFor ?? 'projections';
        let cards: unknown[];
        if (player) {
          const { projectSinglePlayer } = await import('@/lib/mlb-projections/projection-pipeline');
          const type = playerType === 'all' || !playerType ? 'hitter' : playerType;
          const card = await projectSinglePlayer(player, type);
          cards = card ? [card] : [];
        } else switch (resolvedOutputFor) {
          case 'dfs': {
            const { buildDFSSlateMulti } = await import('@/lib/mlb-projections/slate-builder');
            const multi = await buildDFSSlateMulti({ limit: limit ?? 9, date });
            return {
              success: true,
              cards: multi.slateForCard,
              count: multi.slateForCard.length,
              date: date ?? new Date().toISOString().slice(0, 10),
              source: 'LeverageMetrics MLB Projection Engine',
              outputFor: resolvedOutputFor,
              slateMetadata: multi.metadata,
            };
          }
          case 'fantasy': {
            const { buildFantasyCards } = await import('@/lib/mlb-projections/fantasy-adapter');
            const raw = await buildFantasyCards({ limit: limit ?? 9, date });
            cards = raw.map((c: any) => ({ ...c, ...c.data, type: c.type }));
            break;
          }
          case 'betting': {
            const { buildBettingEdgeCards } = await import('@/lib/mlb-projections/betting-edges');
            cards = await buildBettingEdgeCards({ limit: limit ?? 9, date });
            break;
          }
          default: {
            const { runProjectionPipeline } = await import('@/lib/mlb-projections/projection-pipeline');
            cards = await runProjectionPipeline({ playerType: playerType ?? 'all', limit: limit ?? 9, date });
            break;
          }
        }
        return {
          success: true, cards, count: cards.length,
          date: date ?? new Date().toISOString().slice(0, 10),
          source: 'LeverageMetrics MLB Projection Engine',
          outputFor: resolvedOutputFor,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[API/analyze] MLB projection tool error:', msg);
        return { success: false, error: msg, cards: [], count: 0, source: 'LeverageMetrics MLB Projection Engine' };
      }
    },
  });

  // ── LeverageMetrics HR probability model ──────────────────────────────────
  const predictHRTool = tool({
    description:
      "Predict the probability that a specific MLB batter hits a home run in today's game, " +
      'using the v3 LeverageMetrics HR engine (lineup slot, platoon split scores ±1, ' +
      'pitcher pitch mix vulnerability, park factor, weather, and live market edge). ' +
      "Use for ANY question asking about a player's HR probability, chance, or odds tonight. " +
      'Returns probability (0–1), American odds equivalent, edge vs market, and component breakdown.',
    inputSchema: z.object({
      player: z.string().describe('Full or partial player name, e.g. "Aaron Judge", "Judge", "Ohtani"'),
      date:   z.string().optional().describe('Game date YYYY-MM-DD — defaults to today'),
    }),
    execute: async ({ player, date }) => {
      console.log('[API/analyze] predictHR tool called:', { player, date });
      try {
        const { predictHRForPlayer } = await import('@/lib/engine/hr-prediction-bridge');
        const result = await predictHRForPlayer({ playerName: player, date });
        return { success: true, type: 'hr_prediction_card', player, ...result };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[API/analyze] predictHR tool error:', msg);
        return { success: false, error: msg, player, type: 'hr_prediction_card' };
      }
    },
  });

  // ── Kalshi: browse prediction markets ────────────────────────────────────
  const kalshiGetMarketsTool = tool({
    description:
      'Fetch live Kalshi prediction market data. Use when user asks to "show Kalshi markets", ' +
      '"list election markets", "what are the top Kalshi markets", or any question about ' +
      'prediction market availability, categories, or current YES/NO prices across markets.',
    inputSchema: z.object({
      category: z.enum(['election', 'sports', 'weather', 'finance', 'trending', 'all'])
        .optional().describe('Market category (default: all)'),
      search:   z.string().optional().describe('Free-text search in market titles'),
      limit:    z.number().optional().describe('Number of markets to return (default: 10, max: 50)'),
    }),
    execute: async ({ category = 'all', search, limit = 10 }) => {
      console.log('[API/analyze] kalshi_get_markets tool called:', { category, search, limit });
      try {
        const qs = new URLSearchParams({ category, limit: String(Math.min(limit, 50)) });
        if (search) qs.set('search', search);
        const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
        const res = await fetch(`${baseUrl}/api/kalshi/markets?${qs}`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
        if (!res?.ok) {
          const { fetchKalshiMarkets, fetchTopMarketsByVolume } = await import('@/lib/kalshi/index');
          const markets = category === 'trending'
            ? await fetchTopMarketsByVolume(limit)
            : await fetchKalshiMarkets({ search, limit });
          return { success: true, markets: markets.slice(0, limit), count: markets.length };
        }
        return res.json();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[API/analyze] kalshi_get_markets error:', msg);
        return { success: false, error: msg, markets: [] };
      }
    },
  });

  // ── Kalshi: price a specific market ticker ────────────────────────────────
  const kalshiGetPriceTool = tool({
    description:
      'Get the current YES/NO price for a specific Kalshi market by ticker. ' +
      "Use when user asks \"current price on [ticker]\", \"what's [ticker] trading at\", " +
      '"what\'s the edge on [ticker]", or "should I buy yes/no on [market]". ' +
      'Provide modelProb to get an edge calculation vs the market price.',
    inputSchema: z.object({
      ticker:    z.string().describe('Kalshi market ticker (e.g. KXBT-25DEC25-T45000, FED-25DEC-ABOVE)'),
      modelProb: z.number().optional().describe('Your model probability [0,1] for edge calculation'),
    }),
    execute: async ({ ticker, modelProb }) => {
      console.log('[API/analyze] kalshi_get_price tool called:', { ticker, modelProb });
      try {
        const { getMarketByTicker } = await import('@/lib/kalshi/index');
        const { KalshiClient }      = await import('@/lib/kalshi/kalshiClient');
        const market = await getMarketByTicker(ticker.toUpperCase());
        if (!market) return { success: false, error: `Market "${ticker}" not found`, market: null };
        const edge = (modelProb != null && modelProb >= 0 && modelProb <= 1)
          ? KalshiClient.computeEdge(modelProb, market.yesBid, market.yesAsk)
          : null;
        return {
          success: true, market, edge,
          kalshiUrl: `https://kalshi.com/markets/${market.eventTicker || ticker}/${ticker.toUpperCase()}`,
        };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err), market: null };
      }
    },
  });

  // ── Live odds: sportsbook h2h / spreads / totals ──────────────────────────
  const getLiveOddsTool = tool({
    description:
      "Fetch current sportsbook odds for a sport. Use when the user asks about a game, " +
      "spread, moneyline, or total and live odds aren't already provided in the context.",
    inputSchema: z.object({
      sport: z.string().describe('Sport key: basketball_nba | americanfootball_nfl | baseball_mlb | icehockey_nhl'),
    }),
    execute: async ({ sport }) => {
      console.log('[API/analyze] get_live_odds tool called:', { sport });
      try {
        const oddsKey = getOddsApiKey();
        if (!oddsKey) return { error: 'Odds API key not configured' };
        const { fetchLiveOdds, validateSportKey } = await import('@/lib/odds/index');
        const { normalizedKey: _sportKey = sport } = validateSportKey(sport);
        return fetchLiveOdds(_sportKey, { apiKey: oddsKey, markets: ['h2h', 'spreads', 'totals'], regions: ['us'], oddsFormat: 'american' });
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    },
  });

  // ── Line movement / sharp money steam moves ───────────────────────────────
  const getOddsMoversTool = tool({
    description:
      'Fetch the biggest game-level line movements (spreads, totals, h2h) in the last 24 hours. ' +
      'Use when the user asks about line movement, steam moves, sharp money, or biggest movers.',
    inputSchema: z.object({
      hours: z.number().optional().describe('Look-back window in hours (default 24)'),
    }),
    execute: async ({ hours = 24 }) => {
      console.log('[API/analyze] get_odds_movers tool called:', { hours });
      try {
        const origin = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
        const res = await fetch(`${origin}/api/odds/movers?hours=${hours}`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
        if (!res.ok) return { movers: [] };
        return res.json();
      } catch (err) {
        return { movers: [], error: err instanceof Error ? err.message : String(err) };
      }
    },
  });

  // ── Latest player prop lines ──────────────────────────────────────────────
  const getPropsLatestTool = tool({
    description:
      'Fetch the latest player prop lines (over/under lines and prices). ' +
      'Use when the user asks about best props, prop picks, or player prop betting.',
    inputSchema: z.object({
      sport:  z.string().optional().describe('Sport key, e.g. basketball_nba'),
      market: z.string().optional().describe('Market key, e.g. batter_home_runs, player_points'),
    }),
    execute: async ({ sport, market }) => {
      console.log('[API/analyze] get_props_latest tool called:', { sport, market });
      try {
        const origin = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
        const params = new URLSearchParams();
        if (sport)  params.set('sport', sport);
        if (market) params.set('market', market);
        const res = await fetch(`${origin}/api/props/latest?${params}`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
        if (!res.ok) return { props: [] };
        return res.json();
      } catch (err) {
        return { props: [], error: err instanceof Error ? err.message : String(err) };
      }
    },
  });

  return {
    adpTool,
    statcastTool,
    mlbProjectionTool,
    predictHRTool,
    kalshiGetMarketsTool,
    kalshiGetPriceTool,
    getLiveOddsTool,
    getOddsMoversTool,
    getPropsLatestTool,
  };
}

// =============================================================================
// Declarative tool-selection registry
// =============================================================================

/**
 * One entry in the tool registry: a named group of tools that is conditionally
 * activated based on the detection flags for the current request.
 */
interface ToolSlot {
  /** Debugging label — shows up in dev-mode logs when multiple slots match. */
  name:   string;
  /** Whether this slot should be active for the current request. */
  active: boolean;
  /** Tools to expose to the model, keyed by the name the model sees. */
  tools:  Record<string, unknown>;
}

/**
 * Build the ordered list of tool slots for this request.
 *
 * PRIORITY: slots are listed low → high priority. When multiple slots are
 * active, the LAST one wins — identical to the original spread-override
 * semantics. In practice only one slot fires per request; the ordering only
 * matters when two intents appear in the same query (e.g. "line movement for
 * Judge tonight" triggers both HR and line-movement intents; line movement
 * comes later so it wins).
 *
 * Priority ladder (lowest → highest):
 *   adp
 *   → hr-prediction   (overrides adp if both fire)
 *   → kalshi          (exclusive: skipped when hr or adp is active)
 *   → mlb-projections (exclusive: skipped when hr or kalshi is active)
 *   → statcast        (exclusive: skipped when hr, kalshi, or projections active)
 *   → line-movement   (cross-cutting: can override any MLB-specific slot)
 *   → props           (cross-cutting: overrides specific tools, yields to line-movement)
 *   → live-odds       (fallback: only when no specific intent matched)
 */
function buildToolSlots(
  toolSet: ReturnType<typeof createTools>,
  detection: SportDetectionResult,
  serverFetchedOdds: boolean,
  hasBettingIntent: boolean | undefined,
): ToolSlot[] {
  const {
    hasADPIntent,
    hasHRPredictionIntent,
    hasKalshiToolIntent,
    hasMLBProjectionIntent,
    isMLBStatcastMode,
    hasLineMovementIntent,
    hasPropsToolIntent,
  } = detection;

  // Pre-compute the "any specific tool matched" guard used by the live-odds fallback.
  const hasAnySpecificIntent =
    hasADPIntent || hasHRPredictionIntent || hasKalshiToolIntent ||
    hasMLBProjectionIntent || isMLBStatcastMode ||
    hasLineMovementIntent || hasPropsToolIntent;

  return [
    // ── Fantasy draft / ADP rankings ────────────────────────────────────────
    // Enabled: user asks about draft position, ADP, positional scarcity.
    {
      name:   'adp',
      active: hasADPIntent,
      tools:  { query_adp: toolSet.adpTool },
    },

    // ── HR probability tonight ───────────────────────────────────────────────
    // Enabled: user asks for a specific player's HR odds or probability.
    // Overrides 'adp' if both fire (HR intent is more specific).
    {
      name:   'hr-prediction',
      active: hasHRPredictionIntent,
      tools:  { predict_hr: toolSet.predictHRTool },
    },

    // ── Kalshi prediction markets ────────────────────────────────────────────
    // Enabled: user asks about Kalshi / prediction-market prices or listings.
    // Skipped when 'adp' or 'hr-prediction' is active — those are more specific
    // and the Kalshi tools would add noise without adding value.
    {
      name:   'kalshi',
      active: hasKalshiToolIntent && !hasHRPredictionIntent && !hasADPIntent,
      tools:  {
        kalshi_get_markets: toolSet.kalshiGetMarketsTool,
        kalshi_get_price:   toolSet.kalshiGetPriceTool,
      },
    },

    // ── MLB projection engine ────────────────────────────────────────────────
    // Enabled: user asks about MLB DFS, fantasy projections, or betting edges.
    // Skipped when 'hr-prediction' or 'kalshi' are already active (they are
    // more targeted and the projection tool call would be redundant).
    {
      name:   'mlb-projections',
      active: hasMLBProjectionIntent && !hasHRPredictionIntent && !hasKalshiToolIntent,
      tools:  { query_mlb_projections: toolSet.mlbProjectionTool },
    },

    // ── Baseball Savant Statcast metrics ─────────────────────────────────────
    // Enabled: user asks about Statcast numbers (barrel rate, exit velo, etc.).
    // Skipped when any of the three higher-specificity MLB tools are active —
    // Statcast alone can't answer HR probability, Kalshi, or projection queries.
    {
      name:   'statcast',
      active: isMLBStatcastMode
        && !hasHRPredictionIntent
        && !hasKalshiToolIntent
        && !hasMLBProjectionIntent,
      tools:  { query_statcast: toolSet.statcastTool },
    },

    // ── Sportsbook line movement / sharp money ───────────────────────────────
    // Enabled: user asks about line movement, steam moves, or sharp action.
    // Cross-cutting: not exclusive with the MLB-specific slots above, so it
    // can override them when a query straddles both intents (e.g. "line moves
    // for Judge tonight" triggers Statcast + line-movement; line-movement wins).
    {
      name:   'line-movement',
      active: hasLineMovementIntent,
      tools:  { get_odds_movers: toolSet.getOddsMoversTool },
    },

    // ── Latest player prop lines ─────────────────────────────────────────────
    // Enabled: user asks about prop picks or prop lines.
    // Yields to 'line-movement' when both intents fire (line-movement is more
    // actionable for the same query and comes later in the priority ladder).
    {
      name:   'props',
      active: hasPropsToolIntent && !hasLineMovementIntent,
      tools:  { get_props_latest: toolSet.getPropsLatestTool },
    },

    // ── Live sportsbook odds (fallback) ──────────────────────────────────────
    // Enabled: user has a betting intent but odds were NOT already server-fetched
    // and no specific tool (ADP, HR, Kalshi, projections, Statcast, line movers,
    // props) is handling the request. The most general fallback.
    {
      name:   'live-odds',
      active: !!hasBettingIntent && !serverFetchedOdds && !hasAnySpecificIntent,
      tools:  { get_live_odds: toolSet.getLiveOddsTool },
    },
  ];
}

// =============================================================================
// Public selector — called by the analyze route
// =============================================================================

/**
 * Return the `streamText` spread ({ tools, stopWhen, maxSteps? }) for the
 * active detection context.
 *
 * @param toolSet         - All tool instances for this request (from createTools)
 * @param detection       - Sport/intent flags from detectSportAndIntents
 * @param serverFetchedOdds - True when odds were already fetched server-side
 * @param hasBettingIntent  - From request context
 * @param deepThink         - If true, raise maxSteps to 3 for deeper analysis
 */
export function selectTools(
  toolSet: ReturnType<typeof createTools>,
  detection: SportDetectionResult,
  serverFetchedOdds: boolean,
  hasBettingIntent: boolean | undefined,
  deepThink: boolean,
): Record<string, unknown> {
  const slots   = buildToolSlots(toolSet, detection, serverFetchedOdds, hasBettingIntent);
  const active  = slots.filter(s => s.active);

  // Last active slot wins — preserves the original spread-override semantics.
  const winner  = active[active.length - 1];

  // Dev-only: surface when multiple slots compete so the priority ladder can be tuned.
  if (process.env.NODE_ENV !== 'production' && active.length > 1) {
    console.debug(
      '[tools] Multiple active slots:',
      active.map(s => s.name).join(' → '),
      `| winner: ${winner?.name}`,
    );
  }

  return {
    ...(winner && { tools: winner.tools, stopWhen: stepCountIs(2) }),
    ...(deepThink && { maxSteps: 3 }),
  };
}
