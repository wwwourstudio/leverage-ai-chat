/**
 * Supabase Edge Function: ingest-odds
 *
 * Scheduled every 5 minutes via Supabase cron (or called ad-hoc).
 * For each configured sport:
 *   1. Fetch live odds from The Odds API (h2h + spreads + totals)
 *   2. Compare to existing live_odds_cache to detect line movement
 *   3. Upsert updated odds into live_odds_cache
 *   4. Write any detected movements into line_movement
 *
 * Tables written:
 *   api.live_odds_cache   — canonical odds cache (game_id UNIQUE)
 *   api.line_movement     — historical movement log
 *
 * Deploy:
 *   supabase functions deploy ingest-odds
 *
 * Set secrets:
 *   supabase secrets set ODDS_API_KEY=<key>
 */

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Types ──────────────────────────────────────────────────────────────────────

interface OddsOutcome {
  name: string;
  price: number;
  point?: number;
}

interface OddsMarket {
  key: 'h2h' | 'spreads' | 'totals' | string;
  last_update?: string;
  outcomes: OddsOutcome[];
}

interface OddsBookmaker {
  key: string;
  title: string;
  last_update?: string;
  markets: OddsMarket[];
}

interface OddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

interface CachedOddsRow {
  game_id: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
  cached_at: string;
}

interface MovementRecord {
  game_id: string;
  sport: string;
  home_team: string;
  away_team: string;
  bookmaker: string;
  market_type: string;
  old_line: number | null;
  new_line: number | null;
  line_change: number | null;
  old_odds: number | null;
  new_odds: number | null;
}

// ── Configuration ──────────────────────────────────────────────────────────────

const SPORTS = [
  'baseball_mlb',
  'basketball_nba',
  'americanfootball_nfl',
  'icehockey_nhl',
] as const;

const MARKETS = 'h2h,spreads,totals';
const REGIONS = 'us';
const CACHE_TTL_MIN = 5;

// Minimum line change to record as a movement event (filters noise)
const MIN_LINE_CHANGE   = 0.5;  // half-point spread move
const MIN_ODDS_CHANGE   = 3;    // 3 cents on a moneyline

// ── Entry point ────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // Allow ad-hoc POST with optional body: { sports?: string[] }
  let targetSports: readonly string[] = SPORTS;
  if (req.method === 'POST') {
    try {
      const body = await req.json().catch(() => ({}));
      if (Array.isArray(body?.sports) && body.sports.length > 0) {
        targetSports = body.sports as string[];
      }
    } catch { /* ignore parse errors */ }
  }

  const oddsApiKey = Deno.env.get('ODDS_API_KEY');
  if (!oddsApiKey) {
    return jsonResponse({ success: false, error: 'ODDS_API_KEY not configured' }, 500);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { db: { schema: 'api' } },
  );

  const results: Record<string, { upserted: number; movements: number; error?: string }> = {};

  for (const sport of targetSports) {
    try {
      const { upserted, movements } = await ingestSport(supabase, oddsApiKey, sport);
      results[sport] = { upserted, movements };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ingest-odds] ${sport} failed:`, msg);
      results[sport] = { upserted: 0, movements: 0, error: msg };
    }
  }

  const totalUpserted  = Object.values(results).reduce((s, r) => s + r.upserted, 0);
  const totalMovements = Object.values(results).reduce((s, r) => s + r.movements, 0);

  return jsonResponse({ success: true, totalUpserted, totalMovements, sports: results });
});

// ── Per-sport ingest ───────────────────────────────────────────────────────────

async function ingestSport(
  supabase: SupabaseClient,
  apiKey: string,
  sport: string,
): Promise<{ upserted: number; movements: number }> {
  // 1. Fetch from Odds API
  const url = new URL(`https://api.the-odds-api.com/v4/sports/${sport}/odds/`);
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('regions', REGIONS);
  url.searchParams.set('markets', MARKETS);
  url.searchParams.set('oddsFormat', 'american');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Odds API ${res.status} for sport=${sport}: ${await res.text()}`);
  }

  const events: OddsApiEvent[] = await res.json();
  if (!events.length) return { upserted: 0, movements: 0 };

  // 2. Load existing cached odds for movement comparison
  const gameIds = events.map(e => e.id);
  const { data: existing } = await supabase
    .from('live_odds_cache')
    .select('game_id, home_team, away_team, bookmakers, cached_at')
    .in('game_id', gameIds);

  const existingMap = new Map<string, CachedOddsRow>(
    (existing ?? []).map(row => [row.game_id, row as CachedOddsRow]),
  );

  // 3. Detect movements and collect upsert rows
  const movements: MovementRecord[] = [];
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + CACHE_TTL_MIN * 60 * 1000).toISOString();

  const upsertRows = events.map(event => {
    const prior = existingMap.get(event.id);
    if (prior) {
      const detected = detectMovements(event, prior);
      movements.push(...detected);
    }

    return {
      game_id:        event.id,
      sport:          event.sport_title,
      sport_key:      event.sport_key,
      home_team:      event.home_team,
      away_team:      event.away_team,
      commence_time:  event.commence_time,
      bookmakers:     event.bookmakers,
      markets:        extractMarketsSnapshot(event),
      cached_at:      now,
      expires_at:     expiresAt,
    };
  });

  // 4. Upsert odds cache (game_id is UNIQUE)
  const { error: upsertErr } = await supabase
    .from('live_odds_cache')
    .upsert(upsertRows, { onConflict: 'game_id' });

  if (upsertErr) throw new Error(`live_odds_cache upsert: ${upsertErr.message}`);

  // 5. Insert movement records (append-only log)
  if (movements.length > 0) {
    const { error: movErr } = await supabase
      .from('line_movement')
      .insert(movements);

    if (movErr) {
      // Non-fatal: log but don't fail the whole ingest
      console.warn(`[ingest-odds] line_movement insert failed:`, movErr.message);
    }
  }

  return { upserted: upsertRows.length, movements: movements.length };
}

// ── Movement detection ─────────────────────────────────────────────────────────

function detectMovements(
  current: OddsApiEvent,
  prior: CachedOddsRow,
): MovementRecord[] {
  const movements: MovementRecord[] = [];

  for (const book of current.bookmakers) {
    // Find same bookmaker in prior snapshot
    const priorBook = (prior.bookmakers ?? []).find(b => b.key === book.key);
    if (!priorBook) continue;

    for (const market of book.markets) {
      const priorMarket = priorBook.markets?.find(m => m.key === market.key);
      if (!priorMarket) continue;

      if (market.key === 'h2h') {
        // Moneyline: compare odds for home + away
        for (const outcome of market.outcomes) {
          const priorOutcome = priorMarket.outcomes.find(o => o.name === outcome.name);
          if (!priorOutcome) continue;
          const oddsChange = Math.abs(outcome.price - priorOutcome.price);
          if (oddsChange >= MIN_ODDS_CHANGE) {
            movements.push({
              game_id:     current.id,
              sport:       current.sport_key,
              home_team:   current.home_team,
              away_team:   current.away_team,
              bookmaker:   book.key,
              market_type: `h2h_${outcome.name.replace(/\s+/g, '_').toLowerCase()}`,
              old_line:    null,
              new_line:    null,
              line_change: null,
              old_odds:    priorOutcome.price,
              new_odds:    outcome.price,
            });
          }
        }
      } else if (market.key === 'spreads') {
        // Spread: compare point (line) and price separately
        for (const outcome of market.outcomes) {
          const priorOutcome = priorMarket.outcomes.find(o => o.name === outcome.name);
          if (!priorOutcome) continue;
          const lineChange  = Math.abs((outcome.point ?? 0) - (priorOutcome.point ?? 0));
          const oddsChange  = Math.abs(outcome.price - priorOutcome.price);
          if (lineChange >= MIN_LINE_CHANGE || oddsChange >= MIN_ODDS_CHANGE) {
            movements.push({
              game_id:     current.id,
              sport:       current.sport_key,
              home_team:   current.home_team,
              away_team:   current.away_team,
              bookmaker:   book.key,
              market_type: `spread_${outcome.name.replace(/\s+/g, '_').toLowerCase()}`,
              old_line:    priorOutcome.point ?? null,
              new_line:    outcome.point ?? null,
              line_change: lineChange > 0 ? lineChange : null,
              old_odds:    priorOutcome.price,
              new_odds:    outcome.price,
            });
          }
        }
      } else if (market.key === 'totals') {
        // Totals: compare over/under line
        const currentOver = market.outcomes.find(o => o.name === 'Over');
        const priorOver   = priorMarket.outcomes.find(o => o.name === 'Over');
        if (currentOver && priorOver) {
          const lineChange = Math.abs((currentOver.point ?? 0) - (priorOver.point ?? 0));
          const oddsChange = Math.abs(currentOver.price - priorOver.price);
          if (lineChange >= MIN_LINE_CHANGE || oddsChange >= MIN_ODDS_CHANGE) {
            movements.push({
              game_id:     current.id,
              sport:       current.sport_key,
              home_team:   current.home_team,
              away_team:   current.away_team,
              bookmaker:   book.key,
              market_type: 'total',
              old_line:    priorOver.point ?? null,
              new_line:    currentOver.point ?? null,
              line_change: lineChange > 0 ? lineChange : null,
              old_odds:    priorOver.price,
              new_odds:    currentOver.price,
            });
          }
        }
      }
    }
  }

  return movements;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Build a compact {market_type → best_line} snapshot for the markets JSONB column */
function extractMarketsSnapshot(event: OddsApiEvent): Record<string, unknown> {
  const snap: Record<string, unknown> = {};
  for (const book of event.bookmakers.slice(0, 2)) {
    for (const market of book.markets) {
      if (!snap[market.key]) {
        snap[market.key] = market.outcomes.map(o => ({
          name: o.name,
          price: o.price,
          point: o.point,
        }));
      }
    }
  }
  return snap;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
