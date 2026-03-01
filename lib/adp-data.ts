/**
 * NFBC ADP Data Service
 *
 * Fetches, parses, and caches the NFBC (National Fantasy Baseball Championship)
 * Average Draft Position board. Data is held in a module-level cache so it
 * survives warm serverless invocations (cold-start cost ≈ 1 network round-trip).
 *
 * Cache TTL: 4 hours — NFBC updates ADP daily, so this is a good balance.
 */

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

const NFBC_ADP_URL = 'https://nfc.shgn.com/adp/baseball?board';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

// ── Module-level cache ────────────────────────────────────────────────────────

let adpCache: NFBCPlayer[] | null = null;
let lastFetched = 0;

// ── TSV Parser ────────────────────────────────────────────────────────────────

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
 * Parse a tab-separated NFBC ADP export.
 * Reads column names from the first non-empty line — resilient to column reordering.
 *
 * Expected columns (names may vary slightly): Rank, Player, ADP / Overall ADP,
 * Position(s) / Pos, Team
 */
function parseTSV(tsv: string): NFBCPlayer[] {
  const lines = tsv.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());

  // Resolve column indices dynamically
  const col = (candidates: string[]): number => {
    for (const c of candidates) {
      const idx = headers.findIndex(h => h.includes(c));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const rankIdx        = col(['rank']);
  const playerIdx      = col(['player', 'name']);
  const adpIdx         = col(['overall adp', 'adp', 'overall']);
  const posIdx         = col(['position(s)', 'positions', 'pos']);
  const teamIdx        = col(['team']);
  const auctionIdx     = col(['auction value', 'auction', 'value', 'salary', 'cost', '$']);

  const players: NFBCPlayer[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    if (cols.length < 2) continue;

    const rawName   = playerIdx !== -1 ? (cols[playerIdx] ?? '').trim() : '';
    if (!rawName) continue;

    const rank      = rankIdx  !== -1 ? parseInt(cols[rankIdx]  ?? '', 10) : i;
    const adp       = adpIdx   !== -1 ? parseFloat(cols[adpIdx] ?? '')     : rank;
    const positions = posIdx   !== -1 ? (cols[posIdx]  ?? '').trim()       : '';
    const team      = teamIdx  !== -1 ? (cols[teamIdx] ?? '').trim()       : '';

    const safeRank  = isNaN(rank) ? i : rank;
    const safeAdp   = isNaN(adp)  ? safeRank : adp;
    const valueDelta = Math.round((safeAdp - safeRank) * 10) / 10;

    const rawAuction  = auctionIdx !== -1 ? parseFloat(cols[auctionIdx] ?? '') : NaN;
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

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchNFBCADP(): Promise<NFBCPlayer[]> {
  const res = await fetch(NFBC_ADP_URL, {
    headers: {
      'User-Agent': 'LeverageAI-App/1.0 (fantasy-baseball-adp-lookup)',
      'Accept': 'text/tab-separated-values, text/plain, */*',
    },
    // Give the external site 8 seconds before we give up
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`NFBC ADP fetch failed: HTTP ${res.status}`);
  }

  const tsv = await res.text();
  const players = parseTSV(tsv);

  if (players.length === 0) {
    throw new Error('NFBC ADP response parsed to 0 players — unexpected format');
  }

  console.log(`[v0] [ADP] Fetched ${players.length} players from NFBC`);
  return players;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the cached NFBC ADP player list, refreshing when the cache is stale.
 * Safe to call on every request — fetches only once per TTL period.
 */
export async function getADPData(forceRefresh = false): Promise<NFBCPlayer[]> {
  const now = Date.now();
  const isStale = now - lastFetched > CACHE_TTL_MS;

  if (adpCache && !isStale && !forceRefresh) {
    return adpCache;
  }

  try {
    const players = await fetchNFBCADP();
    adpCache = players;
    lastFetched = now;
    return players;
  } catch (err) {
    console.error('[v0] [ADP] Failed to fetch NFBC ADP data:', err);
    // Return stale cache if available — better than nothing
    if (adpCache) {
      console.warn('[v0] [ADP] Returning stale cached data');
      return adpCache;
    }
    return [];
  }
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
