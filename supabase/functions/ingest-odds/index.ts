/**
 * Supabase Edge Function: ingest-odds
 *
 * Fetches live odds from The Odds API and persists them atomically via a
 * single Postgres RPC (process_odds_batch).  One DB round-trip per sport —
 * no per-game loops, no partial-update windows, no connection-limit issues.
 *
 * The RPC handles both the live_odds_cache upsert AND line_movement inserts
 * inside one transaction.  If Postgres rejects, nothing is written.
 *
 * Scheduled: every 5 minutes via Supabase cron or Vercel cron
 * Deploy:     supabase functions deploy ingest-odds
 * Secrets:    supabase secrets set ODDS_API_KEY=<key>
 */

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Configuration ──────────────────────────────────────────────────────────────

const DEFAULT_SPORTS = [
  'baseball_mlb',
  'basketball_nba',
  'americanfootball_nfl',
  'icehockey_nhl',
] as const;

const MARKETS = 'h2h,spreads,totals';
const REGIONS = 'us';

// Retry config: two attempts with 1s backoff (handles transient Odds API 429s)
const MAX_RETRIES  = 2;
const RETRY_DELAY  = 1000;

// ── Entry point ────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const oddsApiKey = Deno.env.get('ODDS_API_KEY');
  if (!oddsApiKey) {
    return json({ success: false, error: 'ODDS_API_KEY not configured' }, 500);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { db: { schema: 'api' } },
  );

  // Allow POST body to override the sport list: { "sports": ["baseball_mlb"] }
  let sports: string[] = [...DEFAULT_SPORTS];
  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    if (Array.isArray(body?.sports) && body.sports.length) {
      sports = body.sports;
    }
  }

  const summary: Record<string, { upserted: number; movements: number; error?: string }> = {};

  for (const sport of sports) {
    try {
      summary[sport] = await ingestSport(supabase, oddsApiKey, sport);
    } catch (err) {
      summary[sport] = {
        upserted:  0,
        movements: 0,
        error: err instanceof Error ? err.message : String(err),
      };
      console.error(`[ingest-odds] ${sport} failed:`, summary[sport].error);
    }
  }

  const totalUpserted  = Object.values(summary).reduce((s, r) => s + r.upserted,  0);
  const totalMovements = Object.values(summary).reduce((s, r) => s + r.movements, 0);

  return json({ success: true, totalUpserted, totalMovements, sports: summary });
});

// ── Per-sport pipeline ─────────────────────────────────────────────────────────

async function ingestSport(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  sport: string,
): Promise<{ upserted: number; movements: number }> {

  // 1. Fetch from Odds API (with retry)
  const events = await fetchWithRetry(apiKey, sport);
  if (!events.length) return { upserted: 0, movements: 0 };

  // 2. Single RPC call — Postgres handles upsert + movement detection atomically
  const { data, error } = await supabase.rpc('process_odds_batch', {
    p_payload: events,
  });

  if (error) throw new Error(`process_odds_batch RPC: ${error.message}`);

  return {
    upserted:  (data as any)?.upserted  ?? events.length,
    movements: (data as any)?.movements ?? 0,
  };
}

// ── Odds API fetch with exponential-backoff retry ──────────────────────────────

async function fetchWithRetry(apiKey: string, sport: string): Promise<any[]> {
  const url = new URL(`https://api.the-odds-api.com/v4/sports/${sport}/odds/`);
  url.searchParams.set('apiKey',     apiKey);
  url.searchParams.set('regions',    REGIONS);
  url.searchParams.set('markets',    MARKETS);
  url.searchParams.set('oddsFormat', 'american');

  let lastErr: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await delay(RETRY_DELAY * attempt);
    }
    try {
      const res = await fetch(url.toString());

      // 422 = sport not in season — not an error worth retrying
      if (res.status === 422) {
        console.info(`[ingest-odds] ${sport} not in season (422) — skipping`);
        return [];
      }

      // 429 = rate limit — only retry these
      if (res.status === 429 && attempt < MAX_RETRIES) {
        console.warn(`[ingest-odds] ${sport} rate-limited — retrying (${attempt + 1}/${MAX_RETRIES})`);
        lastErr = new Error(`429 rate limit`);
        continue;
      }

      if (!res.ok) {
        throw new Error(`Odds API ${res.status} for ${sport}: ${await res.text()}`);
      }

      return await res.json();
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) continue;
    }
  }

  throw lastErr ?? new Error('fetch failed after retries');
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
