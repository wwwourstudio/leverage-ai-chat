/**
 * NFBC ADP Data Service
 *
 * Fetches, parses, and caches the NFBC (National Fantasy Baseball Championship)
 * Average Draft Position board. Data is held in a module-level cache so it
 * survives warm serverless invocations (cold-start cost ≈ 1 network round-trip).
 *
 * Cache TTL: 4 hours — NFBC updates ADP daily, so this is a good balance.
 */

// Supabase persistence helpers — dynamic import keeps @supabase/supabase-js out of client bundle
import { getADPSupabaseClient } from '@/lib/supabase/adp-client.server';


// ── Types ─────────────────────────────────────────────────────────────────────

export interface NFBCPlayer {
  /** 1-based overall rank on the board */
  rank: number;
  /** Last, First format as returned by NFBC (e.g. "Judge, Aaron") */
  playerName: string;
  /** Normalised "First Last" form for display and search (e.g. "Aaron Judge") */
  displayName: string;
  /** Numeric ADP (average pick position across drafts) */
  adp: number;
  /** Primary + eligible positions, comma-separated (e.g. "OF", "SP,RP") */
  positions: string;
  /** MLB team abbreviation */
  team: string;
  /**
   * ADP minus rank: positive = being drafted LATER than ranked (value/sleeper),
   * negative = being drafted EARLIER than ranked (reach).
   */
  valueDelta: number;
  /** True when valueDelta > 15 — player available at a meaningful discount to rank */
  isValuePick: boolean;
  /** Auction dollar value if available from NFBC auction board (otherwise undefined) */
  auctionValue?: number;
}

export interface ADPQueryParams {
  /** Partial player name — case-insensitive, matches anywhere in display name */
  player?: string;
  /**
   * Position filter: SP | RP | 1B | 2B | 3B | SS | OF | DH | C
   * Matches when the position string *contains* the supplied value
   * (e.g. "SP" matches "SP" and "SP,RP")
   */
  position?: string;
  /** Minimum overall rank (inclusive) */
  rankMin?: number;
  /** Maximum overall rank (inclusive) */
  rankMax?: number;
  /** Max results to return (default 10, hard cap 25) */
  limit?: number;
  /** MLB team abbreviation filter — case-insensitive exact match (e.g. "NYY", "LAD") */
  team?: string;
  /** When true, return only players where ADP > rank by 15+ (value/sleeper picks) */
  valueOnly?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Short TTL so newly-uploaded data propagates quickly across serverless instances
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

// ADP data comes from user-uploaded CSV (public/adp/ADP.csv) or Supabase.
// No built-in static fallback — upload a CSV at /adp/upload to enable ADP features.
const STATIC_FALLBACK_PLAYERS: NFBCPlayer[] = []

// ── Module-level cache ────────────────────────────────────────────────────────

let adpCache: NFBCPlayer[] | null = null;
let lastFetched = 0;
let adpFromDB = false;


// ── Delimiter-agnostic parser ─────────────────────────────────────────────────

/**
 * Converts "Last, First" → "First Last".
 * Handles names with suffixes like "Witt, Bobby Jr." → "Bobby Jr. Witt"
 */
function normalisePlayerName(raw: string): string {
  const trimmed = raw.trim();
  const commaIdx = trimmed.indexOf(',');
  if (commaIdx === -1) return trimmed;
  const last = trimmed.slice(0, commaIdx).trim();
  const first = trimmed.slice(commaIdx + 1).trim();
  return first ? `${first} ${last}` : last;
}

/**
 * Strip surrounding double-quotes from a TSV field value.
 */
function stripQuotes(s: string): string {
  return s.replace(/^"|"$/g, '').trim();
}

/**
 * Quote-aware CSV row tokenizer.
 * Correctly handles fields like `"Ohtani, Shohei"` and `"UT,P"` without splitting on
 * the commas inside the quotes — the standard NFBC export uses this format.
 */
function parseCsvRow(line: string): string[] {
  return line.match(/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g)
    ?.map(c => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim())
    ?? line.split(',').map(c => c.trim());
}

/**
 * Parse a delimited (TSV or CSV) NFBC/FantasyPros ADP export.
 * Auto-detects the delimiter from the header row.
 * Reads column names from the first non-empty line — resilient to column reordering.
 *
 * Expected columns (names may vary slightly): Rank, Player, ADP / Overall ADP,
 * Position(s) / Pos, Team
 *
 * For CSV format, uses a quote-aware tokenizer so player names like "Ohtani, Shohei"
 * and multi-position strings like "UT,P" are kept as single fields.
 */
export function parseTSV(raw: string): NFBCPlayer[] {
  const lines = raw.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Auto-detect delimiter — TSV has tabs, CSV has commas
  const delimiter = lines[0].includes('\t') ? '\t' : ',';

  // For TSV, simple split is safe (player names never contain tabs).
  // For CSV, use the quote-aware tokenizer so "Last, First" stays as one field.
  const splitRow = delimiter === '\t'
    ? (line: string) => line.split('\t').map(stripQuotes)
    : parseCsvRow;

  const headers = splitRow(lines[0]).map(h => h.toLowerCase());

  // Resolve column indices dynamically.
  // Strategy: exact match first, then "ends with" (so "overall adp" matches "adp" but
  // "player id" does NOT match "player"), then full substring fallback.
  const col = (candidates: string[]): number => {
    for (const c of candidates) {
      const exact = headers.findIndex(h => h === c);
      if (exact !== -1) return exact;
    }
    for (const c of candidates) {
      const endsWith = headers.findIndex(h => h.endsWith(` ${c}`));
      if (endsWith !== -1) return endsWith;
    }
    for (const c of candidates) {
      const idx = headers.findIndex(h => h.includes(c));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const rankIdx    = col(['rank']);
  const playerIdx  = col(['player', 'name']);
  const adpIdx     = col(['overall adp', 'adp', 'overall', 'avg']);
  const posIdx     = col(['position(s)', 'positions', 'pos']);
  const teamIdx    = col(['team']);
  const auctionIdx = col(['auction value', 'auction', 'value', 'salary', 'cost', '$']);

  const players: NFBCPlayer[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitRow(lines[i]);
    if (cols.length < 2) continue;

    const rawName = playerIdx !== -1 ? (cols[playerIdx] ?? '').trim() : '';
    // Skip rows with missing names or purely-numeric values (NFBC player ID columns
    // sometimes appear in the Player column when the wrong TSV format is uploaded)
    if (!rawName || /^\d+$/.test(rawName)) continue;

    const rank      = rankIdx  !== -1 ? parseInt(cols[rankIdx]  ?? '', 10) : i;
    const adp       = adpIdx   !== -1 ? parseFloat(cols[adpIdx] ?? '')     : rank;
    // Normalise SHGN position abbreviations to NFBC/standard fantasy format:
    //   "P"  → "SP"  (SHGN uses "P" for pitchers, fantasy tools expect "SP")
    //   remove spaces after commas so "UT, P" → "UT,P"
    const rawPos    = posIdx   !== -1 ? (cols[posIdx]  ?? '').trim()       : '';
    const positions = rawPos
      .split(',')
      .map(p => { const s = p.trim(); return s === 'P' ? 'SP' : s; })
      .join(',');
    const team      = teamIdx  !== -1 ? (cols[teamIdx] ?? '').trim()       : '';

    const safeRank  = isNaN(rank) ? i : rank;
    const safeAdp   = isNaN(adp)  ? safeRank : adp;
    const valueDelta = Math.round((safeAdp - safeRank) * 10) / 10;

    const rawAuction   = auctionIdx !== -1 ? parseFloat(cols[auctionIdx] ?? '') : NaN;
    const auctionValue = !isNaN(rawAuction) && rawAuction > 0 ? rawAuction : undefined;

    players.push({
      rank:         safeRank,
      playerName:   rawName,
      displayName:  normalisePlayerName(rawName),
      adp:          safeAdp,
      positions,
      team,
      valueDelta,
      isValuePick:  valueDelta > 15,
      auctionValue,
    });
  }

  return players;
}

// ── Supabase ADP persistence ──────────────────────────────────────────────────
// Saves fetched ADP to Supabase so the AI can read it directly from the DB.
// Uses the service role key (bypasses RLS) so no user session is needed.
// Falls back silently — persistence failures never break the ADP tool.

/**
 * Saves players to Supabase nfbc_adp table.
 * Returns the number of rows saved (0 means nothing was written).
 * Throws when called from the upload route so errors surface to the user.
 * Silent-fails (returns 0) when called from background paths (cron, scraper).
 */
export async function saveADPToSupabase(
  players: NFBCPlayer[],
  sport = 'mlb',
  throwOnError = false,
): Promise<number> {
  if (typeof window !== 'undefined') return 0; // server-only
  try {
    const supabase = await getADPSupabaseClient();
    if (!supabase) {
      const msg = '[v0] [ADP] No Supabase client — check SUPABASE_SERVICE_ROLE_KEY env var';
      if (throwOnError) throw new Error(msg);
      console.warn(msg);
      return 0;
    }
    const now = new Date().toISOString();
    const rows = players.map(p => ({
      rank: p.rank,
      player_name: p.playerName,
      display_name: p.displayName,
      adp: p.adp,
      positions: p.positions,
      team: p.team,
      value_delta: p.valueDelta,
      is_value_pick: p.isValuePick,
      auction_value: p.auctionValue ?? null,
      sport,
      fetched_at: now,
    }));
    // Delete all existing rows for this sport before inserting new data.
    // Without this, a smaller upload leaves stale rows behind (e.g. old bad data
    // at ranks 121-300 persists after uploading only 120 fresh players).
    const { error: deleteError } = await supabase
      .from('nfbc_adp')
      .delete()
      .eq('sport', sport);
    if (deleteError) {
      console.warn('[v0] [ADP] Supabase delete failed (non-critical):', deleteError.message);
    }
    // Insert in batches of 100 to stay well within payload limits
    const BATCH = 100;
    let saved = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error } = await supabase
        .from('nfbc_adp')
        .insert(rows.slice(i, i + BATCH));
      if (error) {
        const msg = `[v0] [ADP] Supabase insert batch failed: ${error.message}`;
        if (throwOnError) throw new Error(msg);
        console.warn(msg);
        break;
      }
      saved += rows.slice(i, i + BATCH).length;
    }
    console.log(`[v0] [ADP] Saved ${saved} ${sport.toUpperCase()} ADP players to Supabase`);
    return saved;
  } catch (err) {
    if (throwOnError) throw err;
    console.warn('[v0] [ADP] saveADPToSupabase failed (non-critical):', err);
    return 0;
  }
}

async function purgeADPFromSupabase(sport = 'mlb'): Promise<void> {
  if (typeof window !== 'undefined') return;
  try {
    const supabase = await getADPSupabaseClient();
    if (!supabase) return;
    await supabase.from('nfbc_adp').delete().eq('sport', sport);
    console.log(`[v0] [ADP] Purged malformed ${sport.toUpperCase()} ADP rows from Supabase`);
  } catch (err) {
    console.warn('[v0] [ADP] purgeADPFromSupabase failed (non-critical):', err);
  }
}

export async function loadADPFromSupabase(sport = 'mlb', allowStale = false): Promise<NFBCPlayer[] | null> {
  if (typeof window !== 'undefined') return null; // server-only
  try {
    const supabase = await getADPSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('nfbc_adp')
      .select('*')
      .eq('sport', sport)
      .order('rank', { ascending: true })
      .limit(300);
    console.log(`[v0] [ADP] Supabase query result: rows=${data?.length ?? 0} error=${error ? error.message : 'none'}`);
    if (error || !data || data.length === 0) return null;
    // Check freshness unless allowStale — compare against cache TTL (4 hours)
    if (!allowStale) {
      const latestFetch = data[0]?.fetched_at ? new Date(data[0].fetched_at).getTime() : 0;
      if (Date.now() - latestFetch > CACHE_TTL_MS) return null;
    }
    return data.map((r: any) => ({
      rank: r.rank as number,
      playerName: r.player_name as string,
      displayName: r.display_name as string,
      adp: r.adp as number,
      positions: r.positions as string,
      team: r.team as string,
      valueDelta: r.value_delta as number,
      isValuePick: r.is_value_pick as boolean,
      auctionValue: r.auction_value != null ? (r.auction_value as number) : undefined,
    }));
  } catch (err) {
    console.warn('[v0] [ADP] loadADPFromSupabase failed (non-critical):', err);
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Clears the in-memory cache, forcing the next call to re-read from Supabase.
 * Called by the upload route after a successful TSV import.
 */
export function clearADPCache(): void {
  adpCache = null;
  lastFetched = 0;
  adpFromDB = false;
}

/**
 * Reads and parses a local ADP CSV from the project's public/ directory.
 * Delegates to adp-csv-loader.server.ts to keep Node.js built-ins (fs, path)
 * out of the client bundle.
 */
async function loadADPFromCSV(): Promise<NFBCPlayer[] | null> {
  if (typeof window !== 'undefined') return null;
  try {
    const { loadADPFromCSV: loadFromServer } = await import('@/lib/adp-csv-loader.server');
    return loadFromServer(parseTSV);
  } catch {
    return null;
  }
}

/** Returns true only when the current ADP data came from a real user upload in Supabase. */
export function isADPFromUserUpload(): boolean {
  return adpFromDB;
}

/**
 * Returns the MLB ADP player list.
 * Priority: in-memory cache → Supabase → local CSV → live fetch → static fallback.
 * The local CSV at public/adp/ADP.csv (or public/adp - ADP.csv) is checked before
 * attempting any external network requests, so the app works fully offline.
 */
export async function getADPData(forceRefresh = false): Promise<NFBCPlayer[]> {
  const now = Date.now();

  if (adpCache && !forceRefresh && now - lastFetched < CACHE_TTL_MS) {
    return adpCache;
  }

  // 1. Supabase — authoritative (user uploads + previously seeded CSV data)
  const dbData = await loadADPFromSupabase('mlb', true);
  if (dbData && dbData.length > 0) {
    // Validate quality: purge if majority of display names are numeric IDs (bad upload)
    const numericCount = dbData.filter(p => /^\d+$/.test((p.displayName ?? '').trim())).length;
    if (numericCount > dbData.length * 0.3) {
      console.warn(`[v0] [ADP] Supabase data has ${numericCount}/${dbData.length} numeric display names — purging malformed upload`);
      purgeADPFromSupabase('mlb').catch(() => {});
      adpCache = STATIC_FALLBACK_PLAYERS;
      lastFetched = now;
      adpFromDB = false;
      return STATIC_FALLBACK_PLAYERS;
    }
    console.log(`[v0] [ADP] Serving ${dbData.length} MLB players from Supabase`);
    adpCache = dbData;
    lastFetched = now;
    adpFromDB = true;
    return dbData;
  }

  // 2. Local CSV file — checked before any network calls so the app works without
  //    external API access. Seeds Supabase on first load for faster subsequent reads.
  const csvData = await loadADPFromCSV();
  if (csvData && csvData.length > 0) {
    adpCache = csvData;
    lastFetched = now;
    adpFromDB = false;
    saveADPToSupabase(csvData, 'mlb').catch(() => {}); // seed DB for future cold starts
    return csvData;
  }

  // 3. No data available
  console.warn('[v0] [ADP] No CSV or DB data — ADP features disabled. Upload a CSV at /adp/upload to enable.');
  adpFromDB = false;
  return STATIC_FALLBACK_PLAYERS;
}

/**
 * Filter and search the ADP dataset.
 * All parameters are optional — called with no params returns the top-`limit` players.
 */
export function queryADP(players: NFBCPlayer[], params: ADPQueryParams): NFBCPlayer[] {
  const { player, position, rankMin, rankMax, team, valueOnly } = params;
  const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  let results = players;

  if (player) {
    const needle = player.trim().toLowerCase();
    results = results.filter(p => {
      const dn = p.displayName.toLowerCase();
      const pn = p.playerName.toLowerCase();
      // Match anywhere in either form: "Judge", "Aaron Judge", "Judge, Aaron"
      return dn.includes(needle) || pn.includes(needle);
    });
  }

  if (position) {
    const pos = position.trim().toUpperCase();
    results = results.filter(p => p.positions.toUpperCase().split(',').map(s => s.trim()).includes(pos));
  }

  if (team) {
    const t = team.trim().toUpperCase();
    results = results.filter(p => p.team.toUpperCase() === t);
  }

  if (rankMin != null) results = results.filter(p => p.rank >= rankMin);
  if (rankMax != null) results = results.filter(p => p.rank <= rankMax);

  if (valueOnly) results = results.filter(p => p.isValuePick);

  return results.slice(0, limit);
}
