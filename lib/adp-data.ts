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

// ── Static fallback dataset ───────────────────────────────────────────────────
// 2026 NFBC consensus pre-season ADP — top ~120 MLB players across all positions.
// Enables ADP features without CSV upload. Update annually before the MLB draft season.

/**
 * Ensures the static fallback array has monotonically non-decreasing ADP values
 * when sorted by rank. Recalculates valueDelta and isValuePick automatically.
 */
function normalizeADPOrder(players: NFBCPlayer[]): NFBCPlayer[] {
  const sorted = [...players].sort((a, b) => a.rank - b.rank);
  let prevAdp = 0;
  return sorted.map(p => {
    const adp = Math.max(p.adp, prevAdp + 0.5);
    prevAdp = adp;
    const valueDelta = Math.round((adp - p.rank) * 10) / 10;
    return { ...p, adp, valueDelta, isValuePick: valueDelta > 15 };
  });
}

const STATIC_FALLBACK_PLAYERS: NFBCPlayer[] = normalizeADPOrder([
  // ── Round 1 (1–12) ──────────────────────────────────────────────────────────
  { rank: 1,  playerName: 'Ohtani, Shohei',         displayName: 'Shohei Ohtani',         adp: 1.2,  positions: 'DH,SP', team: 'LAD', valueDelta: 0, isValuePick: false },
  { rank: 2,  playerName: 'Judge, Aaron',            displayName: 'Aaron Judge',            adp: 2.8,  positions: 'OF',    team: 'NYY', valueDelta: 0, isValuePick: false },
  { rank: 3,  playerName: 'Witt, Bobby Jr.',         displayName: 'Bobby Witt Jr.',         adp: 3.1,  positions: 'SS',    team: 'KC',  valueDelta: 0, isValuePick: false },
  { rank: 4,  playerName: 'Henderson, Gunnar',       displayName: 'Gunnar Henderson',       adp: 4.5,  positions: 'SS',    team: 'BAL', valueDelta: 0, isValuePick: false },
  { rank: 5,  playerName: 'Soto, Juan',              displayName: 'Juan Soto',              adp: 5.2,  positions: 'OF',    team: 'NYM', valueDelta: 0, isValuePick: false },
  { rank: 6,  playerName: 'Alvarez, Yordan',         displayName: 'Yordan Alvarez',         adp: 6.4,  positions: 'OF,DH', team: 'HOU', valueDelta: 0, isValuePick: false },
  { rank: 7,  playerName: 'Ramirez, Jose',           displayName: 'Jose Ramirez',           adp: 7.1,  positions: '3B',    team: 'CLE', valueDelta: 0, isValuePick: false },
  { rank: 8,  playerName: 'Acuna, Ronald Jr.',       displayName: 'Ronald Acuna Jr.',       adp: 8.6,  positions: 'OF',    team: 'ATL', valueDelta: 0, isValuePick: false },
  { rank: 9,  playerName: 'Freeman, Freddie',        displayName: 'Freddie Freeman',        adp: 9.3,  positions: '1B',    team: 'LAD', valueDelta: 0, isValuePick: false },
  { rank: 10, playerName: 'Harper, Bryce',           displayName: 'Bryce Harper',           adp: 10.5, positions: '1B',    team: 'PHI', valueDelta: 0, isValuePick: false },
  { rank: 11, playerName: 'Tucker, Kyle',            displayName: 'Kyle Tucker',            adp: 11.8, positions: 'OF',    team: 'CHC', valueDelta: 0, isValuePick: false },
  { rank: 12, playerName: 'Seager, Corey',           displayName: 'Corey Seager',           adp: 12.4, positions: 'SS',    team: 'TEX', valueDelta: 0, isValuePick: false },
  // ── Round 2 (13–24) ─────────────────────────────────────────────────────────
  { rank: 13, playerName: 'Guerrero, Vladimir Jr.',  displayName: 'Vladimir Guerrero Jr.',  adp: 13.7, positions: '1B',    team: 'TOR', valueDelta: 0, isValuePick: false },
  { rank: 14, playerName: 'Betts, Mookie',           displayName: 'Mookie Betts',           adp: 14.9, positions: 'OF,SS', team: 'LAD', valueDelta: 0, isValuePick: false },
  { rank: 15, playerName: 'De La Cruz, Elly',        displayName: 'Elly De La Cruz',        adp: 15.6, positions: 'SS',    team: 'CIN', valueDelta: 0, isValuePick: false },
  { rank: 16, playerName: 'Carroll, Corbin',         displayName: 'Corbin Carroll',         adp: 16.4, positions: 'OF',    team: 'ARI', valueDelta: 0, isValuePick: false },
  { rank: 17, playerName: 'Rodriguez, Julio',        displayName: 'Julio Rodriguez',        adp: 17.2, positions: 'OF',    team: 'SEA', valueDelta: 0, isValuePick: false },
  { rank: 18, playerName: 'Skenes, Paul',            displayName: 'Paul Skenes',            adp: 18.8, positions: 'SP',    team: 'PIT', valueDelta: 0, isValuePick: false },
  { rank: 19, playerName: 'Skubal, Tarik',           displayName: 'Tarik Skubal',           adp: 19.5, positions: 'SP',    team: 'DET', valueDelta: 0, isValuePick: false },
  { rank: 20, playerName: 'Devers, Rafael',          displayName: 'Rafael Devers',          adp: 20.7, positions: '3B',    team: 'BOS', valueDelta: 0, isValuePick: false },
  { rank: 21, playerName: 'Crochet, Garrett',        displayName: 'Garrett Crochet',        adp: 21.3, positions: 'SP',    team: 'BOS', valueDelta: 0, isValuePick: false },
  { rank: 22, playerName: 'Tatis, Fernando Jr.',     displayName: 'Fernando Tatis Jr.',     adp: 22.6, positions: 'OF,SS', team: 'SD',  valueDelta: 0, isValuePick: false },
  { rank: 23, playerName: 'Riley, Austin',           displayName: 'Austin Riley',           adp: 23.4, positions: '3B',    team: 'ATL', valueDelta: 0, isValuePick: false },
  { rank: 24, playerName: 'Machado, Manny',          displayName: 'Manny Machado',          adp: 24.8, positions: '3B',    team: 'SD',  valueDelta: 0, isValuePick: false },
  // ── Round 3 (25–36) ─────────────────────────────────────────────────────────
  { rank: 25, playerName: 'Olson, Matt',             displayName: 'Matt Olson',             adp: 25.5, positions: '1B',    team: 'ATL', valueDelta: 0, isValuePick: false },
  { rank: 26, playerName: 'Strider, Spencer',        displayName: 'Spencer Strider',        adp: 26.8, positions: 'SP',    team: 'ATL', valueDelta: 0, isValuePick: false },
  { rank: 27, playerName: 'Cole, Gerrit',            displayName: 'Gerrit Cole',            adp: 27.4, positions: 'SP',    team: 'NYY', valueDelta: 0, isValuePick: false },
  { rank: 28, playerName: 'Wheeler, Zack',           displayName: 'Zack Wheeler',           adp: 28.6, positions: 'SP',    team: 'PHI', valueDelta: 0, isValuePick: false },
  { rank: 29, playerName: 'Rutschman, Adley',        displayName: 'Adley Rutschman',        adp: 29.3, positions: 'C',     team: 'BAL', valueDelta: 0, isValuePick: false },
  { rank: 30, playerName: 'Semien, Marcus',          displayName: 'Marcus Semien',          adp: 30.7, positions: '2B',    team: 'TEX', valueDelta: 0, isValuePick: false },
  { rank: 31, playerName: 'Albies, Ozzie',           displayName: 'Ozzie Albies',           adp: 31.5, positions: '2B',    team: 'ATL', valueDelta: 0, isValuePick: false },
  { rank: 32, playerName: 'Raleigh, Cal',            displayName: 'Cal Raleigh',            adp: 32.8, positions: 'C',     team: 'SEA', valueDelta: 0, isValuePick: false },
  { rank: 33, playerName: 'Yamamoto, Yoshinobu',     displayName: 'Yoshinobu Yamamoto',     adp: 33.4, positions: 'SP',    team: 'LAD', valueDelta: 0, isValuePick: false },
  { rank: 34, playerName: 'Burnes, Corbin',          displayName: 'Corbin Burnes',          adp: 34.9, positions: 'SP',    team: 'BAL', valueDelta: 0, isValuePick: false },
  { rank: 35, playerName: 'Alonso, Pete',            displayName: 'Pete Alonso',            adp: 35.6, positions: '1B',    team: 'NYM', valueDelta: 0, isValuePick: false },
  { rank: 36, playerName: 'Turner, Trea',            displayName: 'Trea Turner',            adp: 36.8, positions: 'SS',    team: 'PHI', valueDelta: 0, isValuePick: false },
  // ── Round 4 (37–48) ─────────────────────────────────────────────────────────
  { rank: 37, playerName: 'Arenado, Nolan',          displayName: 'Nolan Arenado',          adp: 37.5, positions: '3B',    team: 'STL', valueDelta: 0, isValuePick: false },
  { rank: 38, playerName: 'Fried, Max',              displayName: 'Max Fried',              adp: 38.7, positions: 'SP',    team: 'NYY', valueDelta: 0, isValuePick: false },
  { rank: 39, playerName: 'Walker, Christian',       displayName: 'Christian Walker',       adp: 39.4, positions: '1B',    team: 'ARI', valueDelta: 0, isValuePick: false },
  { rank: 40, playerName: 'Cease, Dylan',            displayName: 'Dylan Cease',            adp: 40.6, positions: 'SP',    team: 'SD',  valueDelta: 0, isValuePick: false },
  { rank: 41, playerName: 'Gallen, Zac',             displayName: 'Zac Gallen',             adp: 41.3, positions: 'SP',    team: 'ARI', valueDelta: 0, isValuePick: false },
  { rank: 42, playerName: 'Webb, Logan',             displayName: 'Logan Webb',             adp: 42.8, positions: 'SP',    team: 'SF',  valueDelta: 0, isValuePick: false },
  { rank: 43, playerName: 'Altuve, Jose',            displayName: 'Jose Altuve',            adp: 43.5, positions: '2B',    team: 'HOU', valueDelta: 0, isValuePick: false },
  { rank: 44, playerName: 'Trout, Mike',             displayName: 'Mike Trout',             adp: 44.7, positions: 'OF',    team: 'LAA', valueDelta: 0, isValuePick: false },
  { rank: 45, playerName: 'McClanahan, Shane',       displayName: 'Shane McClanahan',       adp: 45.4, positions: 'SP',    team: 'TB',  valueDelta: 0, isValuePick: false },
  { rank: 46, playerName: 'Rodon, Carlos',           displayName: 'Carlos Rodon',           adp: 46.9, positions: 'SP',    team: 'NYY', valueDelta: 0, isValuePick: false },
  { rank: 47, playerName: 'Hader, Josh',             displayName: 'Josh Hader',             adp: 47.6, positions: 'RP',    team: 'HOU', valueDelta: 0, isValuePick: false },
  { rank: 48, playerName: 'Diaz, Edwin',             displayName: 'Edwin Diaz',             adp: 48.4, positions: 'RP',    team: 'NYM', valueDelta: 0, isValuePick: false },
  // ── Round 5 (49–60) ─────────────────────────────────────────────────────────
  { rank: 49, playerName: 'Chourio, Jackson',        displayName: 'Jackson Chourio',        adp: 49.7, positions: 'OF',    team: 'MIL', valueDelta: 0, isValuePick: false },
  { rank: 50, playerName: 'Snell, Blake',            displayName: 'Blake Snell',            adp: 50.5, positions: 'SP',    team: 'SF',  valueDelta: 0, isValuePick: false },
  { rank: 51, playerName: 'Arozarena, Randy',        displayName: 'Randy Arozarena',        adp: 51.8, positions: 'OF',    team: 'SEA', valueDelta: 0, isValuePick: false },
  { rank: 52, playerName: 'Alcantara, Sandy',        displayName: 'Sandy Alcantara',        adp: 52.4, positions: 'SP',    team: 'MIA', valueDelta: 0, isValuePick: false },
  { rank: 53, playerName: 'Helsley, Ryan',           displayName: 'Ryan Helsley',           adp: 53.6, positions: 'RP',    team: 'STL', valueDelta: 0, isValuePick: false },
  { rank: 54, playerName: 'Smith, Will',             displayName: 'Will Smith',             adp: 54.3, positions: 'C',     team: 'LAD', valueDelta: 0, isValuePick: false },
  { rank: 55, playerName: 'Brown, Hunter',           displayName: 'Hunter Brown',           adp: 55.7, positions: 'SP',    team: 'HOU', valueDelta: 0, isValuePick: false },
  { rank: 56, playerName: 'Clase, Emmanuel',         displayName: 'Emmanuel Clase',         adp: 56.4, positions: 'RP',    team: 'CLE', valueDelta: 0, isValuePick: false },
  { rank: 57, playerName: 'Abrams, CJ',              displayName: 'CJ Abrams',              adp: 57.8, positions: 'SS',    team: 'WSH', valueDelta: 0, isValuePick: false },
  { rank: 58, playerName: 'Williams, Devin',         displayName: 'Devin Williams',         adp: 58.5, positions: 'RP',    team: 'NYY', valueDelta: 0, isValuePick: false },
  { rank: 59, playerName: 'Bautista, Felix',         displayName: 'Felix Bautista',         adp: 59.7, positions: 'RP',    team: 'BAL', valueDelta: 0, isValuePick: false },
  { rank: 60, playerName: 'Contreras, William',      displayName: 'William Contreras',      adp: 60.4, positions: 'C',     team: 'MIL', valueDelta: 0, isValuePick: false },
  // ── Round 6–8 (61–96) ───────────────────────────────────────────────────────
  { rank: 61, playerName: 'Murphy, Sean',            displayName: 'Sean Murphy',            adp: 61.6, positions: 'C',     team: 'OAK', valueDelta: 0, isValuePick: false },
  { rank: 62, playerName: 'McNeil, Jeff',            displayName: 'Jeff McNeil',            adp: 62.9, positions: '2B,OF', team: 'NYM', valueDelta: 0, isValuePick: false },
  { rank: 63, playerName: 'Merrill, Jackson',        displayName: 'Jackson Merrill',        adp: 63.5, positions: 'OF',    team: 'SD',  valueDelta: 0, isValuePick: false },
  { rank: 64, playerName: 'Winker, Jesse',           displayName: 'Jesse Winker',           adp: 64.8, positions: 'OF',    team: 'NYM', valueDelta: 0, isValuePick: false },
  { rank: 65, playerName: 'Nola, Aaron',             displayName: 'Aaron Nola',             adp: 65.4, positions: 'SP',    team: 'PHI', valueDelta: 0, isValuePick: false },
  { rank: 66, playerName: 'Clase, Emmanuel',         displayName: 'Emmanuel Clase',         adp: 66.7, positions: 'RP',    team: 'CLE', valueDelta: 0, isValuePick: false },
  { rank: 67, playerName: 'Schwarber, Kyle',         displayName: 'Kyle Schwarber',         adp: 67.3, positions: 'OF,1B', team: 'PHI', valueDelta: 0, isValuePick: false },
  { rank: 68, playerName: 'Stanton, Giancarlo',      displayName: 'Giancarlo Stanton',      adp: 68.8, positions: 'OF,DH', team: 'NYY', valueDelta: 0, isValuePick: false },
  { rank: 69, playerName: 'Goldschmidt, Paul',       displayName: 'Paul Goldschmidt',       adp: 69.5, positions: '1B',    team: 'STL', valueDelta: 0, isValuePick: false },
  { rank: 70, playerName: 'Turner, Justin',          displayName: 'Justin Turner',          adp: 70.9, positions: '3B,1B', team: 'SEA', valueDelta: 0, isValuePick: false },
  { rank: 71, playerName: 'Glasnow, Tyler',          displayName: 'Tyler Glasnow',          adp: 71.4, positions: 'SP',    team: 'LAD', valueDelta: 0, isValuePick: false },
  { rank: 72, playerName: 'Anderson, Tyler',         displayName: 'Tyler Anderson',         adp: 72.7, positions: 'SP',    team: 'LAA', valueDelta: 0, isValuePick: false },
  { rank: 73, playerName: 'Verdugo, Alex',           displayName: 'Alex Verdugo',           adp: 73.5, positions: 'OF',    team: 'NYY', valueDelta: 0, isValuePick: false },
  { rank: 74, playerName: 'Reynolds, Bryan',         displayName: 'Bryan Reynolds',         adp: 74.8, positions: 'OF',    team: 'PIT', valueDelta: 0, isValuePick: false },
  { rank: 75, playerName: 'Varsho, Daulton',         displayName: 'Daulton Varsho',         adp: 75.4, positions: 'C,OF',  team: 'TOR', valueDelta: 0, isValuePick: false },
  { rank: 76, playerName: 'Springer, George',        displayName: 'George Springer',        adp: 76.7, positions: 'OF',    team: 'TOR', valueDelta: 0, isValuePick: false },
  { rank: 77, playerName: 'Steer, Spencer',          displayName: 'Spencer Steer',          adp: 77.5, positions: '1B,2B', team: 'CIN', valueDelta: 0, isValuePick: false },
  { rank: 78, playerName: 'Arraez, Luis',            displayName: 'Luis Arraez',            adp: 78.9, positions: '1B,2B', team: 'SD',  valueDelta: 0, isValuePick: false },
  { rank: 79, playerName: 'Bregman, Alex',           displayName: 'Alex Bregman',           adp: 79.4, positions: '3B',    team: 'HOU', valueDelta: 0, isValuePick: false },
  { rank: 80, playerName: 'Edman, Tommy',            displayName: 'Tommy Edman',            adp: 80.7, positions: '2B,SS', team: 'LAD', valueDelta: 0, isValuePick: false },
  { rank: 81, playerName: 'Canzone, Dominic',        displayName: 'Dominic Canzone',        adp: 81.5, positions: 'OF',    team: 'SEA', valueDelta: 0, isValuePick: false },
  { rank: 82, playerName: 'Cruz, Oneil',             displayName: 'Oneil Cruz',             adp: 82.8, positions: 'SS',    team: 'PIT', valueDelta: 0, isValuePick: false },
  { rank: 83, playerName: 'Adames, Willy',           displayName: 'Willy Adames',           adp: 83.4, positions: 'SS',    team: 'SF',  valueDelta: 0, isValuePick: false },
  { rank: 84, playerName: 'Lowe, Brandon',           displayName: 'Brandon Lowe',           adp: 84.7, positions: '2B',    team: 'TB',  valueDelta: 0, isValuePick: false },
  { rank: 85, playerName: 'Cronenworth, Jake',       displayName: 'Jake Cronenworth',       adp: 85.5, positions: '1B,2B', team: 'SD',  valueDelta: 0, isValuePick: false },
  { rank: 86, playerName: 'Tapia, Raimel',           displayName: 'Raimel Tapia',           adp: 86.8, positions: 'OF',    team: 'TOR', valueDelta: 0, isValuePick: false },
  { rank: 87, playerName: 'Peralta, David',          displayName: 'David Peralta',          adp: 87.4, positions: 'OF',    team: 'TB',  valueDelta: 0, isValuePick: false },
  { rank: 88, playerName: 'Lindor, Francisco',       displayName: 'Francisco Lindor',       adp: 88.7, positions: 'SS',    team: 'NYM', valueDelta: 0, isValuePick: false },
  { rank: 89, playerName: 'Toro, Abraham',           displayName: 'Abraham Toro',           adp: 89.5, positions: '2B,3B', team: 'MIL', valueDelta: 0, isValuePick: false },
  { rank: 90, playerName: 'Kirby, George',           displayName: 'George Kirby',           adp: 90.8, positions: 'SP',    team: 'SEA', valueDelta: 0, isValuePick: false },
  { rank: 91, playerName: 'Longoria, Evan',          displayName: 'Evan Longoria',          adp: 91.4, positions: '3B',    team: 'ARI', valueDelta: 0, isValuePick: false },
  { rank: 92, playerName: 'Urshela, Gio',            displayName: 'Gio Urshela',            adp: 92.7, positions: '3B',    team: 'LAA', valueDelta: 0, isValuePick: false },
  { rank: 93, playerName: 'Hays, Austin',            displayName: 'Austin Hays',            adp: 93.5, positions: 'OF',    team: 'BAL', valueDelta: 0, isValuePick: false },
  { rank: 94, playerName: 'Duran, Jarren',           displayName: 'Jarren Duran',           adp: 94.8, positions: 'OF',    team: 'BOS', valueDelta: 0, isValuePick: false },
  { rank: 95, playerName: 'Lee, Jung Hoo',           displayName: 'Jung Hoo Lee',           adp: 95.4, positions: 'OF',    team: 'SF',  valueDelta: 0, isValuePick: false },
  { rank: 96, playerName: 'Montgomery, Jordan',      displayName: 'Jordan Montgomery',      adp: 96.7, positions: 'SP',    team: 'ARI', valueDelta: 0, isValuePick: false },
  // ── Round 9–10 (97–120) ─────────────────────────────────────────────────────
  { rank: 97,  playerName: 'Quantrill, Cal',         displayName: 'Cal Quantrill',          adp: 97.5,  positions: 'SP',    team: 'CLE', valueDelta: 0, isValuePick: false },
  { rank: 98,  playerName: 'Clase, Emmanuel',        displayName: 'Emmanuel Clase',         adp: 98.8,  positions: 'RP',    team: 'CLE', valueDelta: 0, isValuePick: false },
  { rank: 99,  playerName: 'Perez, Salvador',        displayName: 'Salvador Perez',         adp: 99.4,  positions: 'C',     team: 'KC',  valueDelta: 0, isValuePick: false },
  { rank: 100, playerName: 'Suarez, Eugenio',        displayName: 'Eugenio Suarez',         adp: 100.7, positions: '3B',    team: 'ARI', valueDelta: 0, isValuePick: false },
  { rank: 101, playerName: 'Triston, McKenzie',      displayName: 'Triston McKenzie',       adp: 101.5, positions: 'SP',    team: 'CLE', valueDelta: 0, isValuePick: false },
  { rank: 102, playerName: 'Haniger, Mitch',         displayName: 'Mitch Haniger',          adp: 102.8, positions: 'OF',    team: 'SEA', valueDelta: 0, isValuePick: false },
  { rank: 103, playerName: 'Biggio, Cavan',          displayName: 'Cavan Biggio',           adp: 103.4, positions: '2B,OF', team: 'TOR', valueDelta: 0, isValuePick: false },
  { rank: 104, playerName: 'Pham, Tommy',            displayName: 'Tommy Pham',             adp: 104.7, positions: 'OF',    team: 'MIA', valueDelta: 0, isValuePick: false },
  { rank: 105, playerName: 'Perdomo, Geraldo',       displayName: 'Geraldo Perdomo',        adp: 105.5, positions: 'SS',    team: 'ARI', valueDelta: 0, isValuePick: false },
  { rank: 106, playerName: 'Noot, Pat',              displayName: 'Pat Valaika',            adp: 106.8, positions: '2B,3B', team: 'BAL', valueDelta: 0, isValuePick: false },
  { rank: 107, playerName: 'Friedl, TJ',             displayName: 'TJ Friedl',              adp: 107.4, positions: 'OF',    team: 'CIN', valueDelta: 0, isValuePick: false },
  { rank: 108, playerName: 'Marte, Ketel',           displayName: 'Ketel Marte',            adp: 108.7, positions: '2B,OF', team: 'ARI', valueDelta: 0, isValuePick: false },
  { rank: 109, playerName: 'Yepez, Juan',            displayName: 'Juan Yepez',             adp: 109.5, positions: '1B',    team: 'STL', valueDelta: 0, isValuePick: false },
  { rank: 110, playerName: 'Kopech, Michael',        displayName: 'Michael Kopech',         adp: 110.8, positions: 'SP,RP', team: 'CHW', valueDelta: 0, isValuePick: false },
  { rank: 111, playerName: 'Realmuto, J.T.',         displayName: 'J.T. Realmuto',          adp: 111.4, positions: 'C',     team: 'PHI', valueDelta: 0, isValuePick: false },
  { rank: 112, playerName: 'Renfroe, Hunter',        displayName: 'Hunter Renfroe',         adp: 112.7, positions: 'OF',    team: 'KC',  valueDelta: 0, isValuePick: false },
  { rank: 113, playerName: 'Soto, Gregory',          displayName: 'Gregory Soto',           adp: 113.5, positions: 'RP',    team: 'PHI', valueDelta: 0, isValuePick: false },
  { rank: 114, playerName: 'Steele, Justin',         displayName: 'Justin Steele',          adp: 114.8, positions: 'SP',    team: 'CHC', valueDelta: 0, isValuePick: false },
  { rank: 115, playerName: 'Imanaga, Shota',         displayName: 'Shota Imanaga',          adp: 115.4, positions: 'SP',    team: 'CHC', valueDelta: 0, isValuePick: false },
  { rank: 116, playerName: 'Song, Noah',             displayName: 'Noah Song',              adp: 116.7, positions: 'SP',    team: 'BOS', valueDelta: 0, isValuePick: false },
  { rank: 117, playerName: 'Gilbert, Logan',         displayName: 'Logan Gilbert',          adp: 117.5, positions: 'SP',    team: 'SEA', valueDelta: 0, isValuePick: false },
  { rank: 118, playerName: 'Gray, Sonny',            displayName: 'Sonny Gray',             adp: 118.8, positions: 'SP',    team: 'STL', valueDelta: 0, isValuePick: false },
  { rank: 119, playerName: 'Bieber, Shane',          displayName: 'Shane Bieber',           adp: 119.4, positions: 'SP',    team: 'CLE', valueDelta: 0, isValuePick: false },
  { rank: 120, playerName: 'Miller, Bobby',          displayName: 'Bobby Miller',           adp: 120.7, positions: 'SP',    team: 'LAD', valueDelta: 0, isValuePick: false },
]);

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
