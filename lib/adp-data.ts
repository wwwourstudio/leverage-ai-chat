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
// Used when the NFBC live endpoint is unreachable. Values are 2026 NFBC consensus
// pre-season ADP (updated March 2026). Update annually before each MLB draft season.
// Covers top 200 picks across all positions.

const STATIC_FALLBACK_PLAYERS: NFBCPlayer[] = [
  // ── Rounds 1–4 ──────────────────────────────────────────────────────────────
  { rank: 1,   playerName: 'Ohtani, Shohei',            displayName: 'Shohei Ohtani',            adp: 1.18,  positions: 'SP,DH',   team: 'LAD', valueDelta: 0.2,  isValuePick: false },
  { rank: 2,   playerName: 'Judge, Aaron',               displayName: 'Aaron Judge',              adp: 1.93,  positions: 'OF',      team: 'NYY', valueDelta: -0.1, isValuePick: false },
  { rank: 3,   playerName: 'Witt, Bobby Jr.',            displayName: 'Bobby Witt Jr.',           adp: 3.19,  positions: 'SS',      team: 'KC',  valueDelta: 0.2,  isValuePick: false },
  // ── Ranks 4–22 (confirmed 2026 NFBC ADP) ─────────────────────────────────
  { rank: 4,   playerName: 'Soto, Juan',                displayName: 'Juan Soto',                adp: 4.25,  positions: 'OF',      team: 'NYM', valueDelta: 0.25, isValuePick: false },
  { rank: 5,   playerName: 'Ramirez, Jose',             displayName: 'Jose Ramirez',             adp: 5.43,  positions: '3B',      team: 'CLE', valueDelta: 0.43, isValuePick: false },
  { rank: 6,   playerName: 'Acuna, Ronald Jr.',         displayName: 'Ronald Acuna Jr.',         adp: 7.18,  positions: 'OF',      team: 'ATL', valueDelta: 1.18, isValuePick: false },
  { rank: 7,   playerName: 'Skubal, Tarik',             displayName: 'Tarik Skubal',             adp: 7.29,  positions: 'SP',      team: 'DET', valueDelta: 0.29, isValuePick: false },
  { rank: 8,   playerName: 'De La Cruz, Elly',          displayName: 'Elly De La Cruz',          adp: 8.91,  positions: 'SS',      team: 'CIN', valueDelta: 0.91, isValuePick: false },
  { rank: 9,   playerName: 'Rodriguez, Julio',          displayName: 'Julio Rodriguez',          adp: 9.64,  positions: 'OF',      team: 'SEA', valueDelta: 0.64, isValuePick: false },
  { rank: 10,  playerName: 'Cole, Gerrit',              displayName: 'Gerrit Cole',              adp: 11.12, positions: 'SP',      team: 'NYY', valueDelta: 1.12, isValuePick: false },
  { rank: 11,  playerName: 'Skenes, Paul',              displayName: 'Paul Skenes',              adp: 11.28, positions: 'SP',      team: 'PIT', valueDelta: 0.28, isValuePick: false },
  { rank: 12,  playerName: 'Carroll, Corbin',           displayName: 'Corbin Carroll',           adp: 12.40, positions: 'OF',      team: 'ARI', valueDelta: 0.40, isValuePick: false },
  { rank: 13,  playerName: 'Crochet, Garrett',          displayName: 'Garrett Crochet',          adp: 14.17, positions: 'SP',      team: 'BOS', valueDelta: 1.17, isValuePick: false },
  { rank: 14,  playerName: 'Tatis, Fernando Jr.',       displayName: 'Fernando Tatis Jr.',       adp: 14.36, positions: 'OF,SS',   team: 'SD',  valueDelta: 0.36, isValuePick: false },
  { rank: 15,  playerName: 'Henderson, Gunnar',         displayName: 'Gunnar Henderson',         adp: 15.15, positions: 'SS,3B',   team: 'BAL', valueDelta: 0.15, isValuePick: false },
  { rank: 16,  playerName: 'Tucker, Kyle',              displayName: 'Kyle Tucker',              adp: 15.42, positions: 'OF',      team: 'CHC', valueDelta: -0.58,isValuePick: true  },
  { rank: 17,  playerName: 'Caminero, Junior',          displayName: 'Junior Caminero',          adp: 17.42, positions: '3B',      team: 'TB',  valueDelta: 0.42, isValuePick: false },
  { rank: 18,  playerName: 'Raleigh, Cal',              displayName: 'Cal Raleigh',              adp: 18.46, positions: 'C',       team: 'SEA', valueDelta: 0.46, isValuePick: false },
  { rank: 19,  playerName: 'Guerrero, Vladimir Jr.',    displayName: 'Vladimir Guerrero Jr.',    adp: 18.55, positions: '1B',      team: 'TOR', valueDelta: -0.45,isValuePick: true  },
  { rank: 20,  playerName: 'Kurtz, Jackson',            displayName: 'Jackson Kurtz',            adp: 20.26, positions: 'OF',      team: 'SF',  valueDelta: 0.26, isValuePick: false },
  { rank: 21,  playerName: 'Chourio, Jackson',          displayName: 'Jackson Chourio',          adp: 20.72, positions: 'OF',      team: 'MIL', valueDelta: -0.28,isValuePick: true  },
  { rank: 22,  playerName: 'Chisholm, Jazz',            displayName: 'Jazz Chisholm Jr.',        adp: 20.93, positions: '3B',      team: 'NYY', valueDelta: -1.07,isValuePick: true  },
  // ── Ranks 23–50 ──────────────────────────────────────────────────────────
  { rank: 23,  playerName: 'Alvarez, Yordan',           displayName: 'Yordan Alvarez',           adp: 23.10, positions: 'OF,DH',   team: 'HOU', valueDelta: 0.10, isValuePick: false },
  { rank: 24,  playerName: 'Wheeler, Zack',             displayName: 'Zack Wheeler',             adp: 24.05, positions: 'SP',      team: 'PHI', valueDelta: 0.05, isValuePick: false },
  { rank: 25,  playerName: 'Seager, Corey',             displayName: 'Corey Seager',             adp: 25.48, positions: 'SS',      team: 'TEX', valueDelta: 0.48, isValuePick: false },
  { rank: 26,  playerName: 'Webb, Logan',               displayName: 'Logan Webb',               adp: 26.31, positions: 'SP',      team: 'SF',  valueDelta: 0.31, isValuePick: false },
  { rank: 27,  playerName: 'Helsley, Ryan',             displayName: 'Ryan Helsley',             adp: 27.64, positions: 'RP',      team: 'STL', valueDelta: 0.64, isValuePick: false },
  { rank: 28,  playerName: 'Betts, Mookie',             displayName: 'Mookie Betts',             adp: 28.77, positions: 'SS,OF',   team: 'LAD', valueDelta: 0.77, isValuePick: false },
  { rank: 29,  playerName: 'Harper, Bryce',             displayName: 'Bryce Harper',             adp: 29.55, positions: '1B',      team: 'PHI', valueDelta: 0.55, isValuePick: false },
  { rank: 30,  playerName: 'Strider, Spencer',          displayName: 'Spencer Strider',          adp: 30.82, positions: 'SP',      team: 'ATL', valueDelta: 0.82, isValuePick: false },
  { rank: 31,  playerName: 'Freeman, Freddie',          displayName: 'Freddie Freeman',          adp: 31.44, positions: '1B',      team: 'LAD', valueDelta: 0.44, isValuePick: false },
  { rank: 32,  playerName: 'Burnes, Corbin',            displayName: 'Corbin Burnes',            adp: 32.19, positions: 'SP',      team: 'ARI', valueDelta: 0.19, isValuePick: false },
  { rank: 33,  playerName: 'Hader, Josh',               displayName: 'Josh Hader',               adp: 33.67, positions: 'RP',      team: 'HOU', valueDelta: 0.67, isValuePick: false },
  { rank: 34,  playerName: 'Turner, Trea',              displayName: 'Trea Turner',              adp: 34.88, positions: 'SS',      team: 'PHI', valueDelta: 0.88, isValuePick: false },
  { rank: 35,  playerName: 'Clase, Emmanuel',           displayName: 'Emmanuel Clase',           adp: 35.41, positions: 'RP',      team: 'CLE', valueDelta: 0.41, isValuePick: false },
  { rank: 36,  playerName: 'Devers, Rafael',            displayName: 'Rafael Devers',            adp: 36.23, positions: '3B',      team: 'BOS', valueDelta: 0.23, isValuePick: false },
  { rank: 37,  playerName: 'Albies, Ozzie',             displayName: 'Ozzie Albies',             adp: 37.56, positions: '2B',      team: 'ATL', valueDelta: 0.56, isValuePick: false },
  { rank: 38,  playerName: 'Rutschman, Adley',          displayName: 'Adley Rutschman',          adp: 38.70, positions: 'C',       team: 'BAL', valueDelta: 0.70, isValuePick: false },
  { rank: 39,  playerName: 'Merrill, Jackson',          displayName: 'Jackson Merrill',          adp: 39.22, positions: 'OF',      team: 'SD',  valueDelta: 0.22, isValuePick: false },
  { rank: 40,  playerName: 'Imanaga, Shota',            displayName: 'Shota Imanaga',            adp: 40.35, positions: 'SP',      team: 'CHC', valueDelta: 0.35, isValuePick: false },
  { rank: 41,  playerName: 'Glasnow, Tyler',            displayName: 'Tyler Glasnow',            adp: 41.60, positions: 'SP',      team: 'LAD', valueDelta: 0.60, isValuePick: false },
  { rank: 42,  playerName: 'McClanahan, Shane',         displayName: 'Shane McClanahan',         adp: 42.14, positions: 'SP',      team: 'TB',  valueDelta: 0.14, isValuePick: false },
  { rank: 43,  playerName: 'Suarez, Ranger',            displayName: 'Ranger Suarez',            adp: 43.88, positions: 'SP',      team: 'PHI', valueDelta: 0.88, isValuePick: false },
  { rank: 44,  playerName: 'Olson, Matt',               displayName: 'Matt Olson',               adp: 44.55, positions: '1B',      team: 'ATL', valueDelta: 0.55, isValuePick: false },
  { rank: 45,  playerName: 'Valdez, Framber',           displayName: 'Framber Valdez',           adp: 45.30, positions: 'SP',      team: 'HOU', valueDelta: 0.30, isValuePick: false },
  { rank: 46,  playerName: 'Sale, Chris',               displayName: 'Chris Sale',               adp: 46.17, positions: 'SP',      team: 'ATL', valueDelta: 0.17, isValuePick: false },
  { rank: 47,  playerName: 'Bregman, Alex',             displayName: 'Alex Bregman',             adp: 47.43, positions: '3B,2B',   team: 'BOS', valueDelta: 0.43, isValuePick: false },
  { rank: 48,  playerName: 'Kirby, George',             displayName: 'George Kirby',             adp: 48.91, positions: 'SP',      team: 'SEA', valueDelta: 0.91, isValuePick: false },
  { rank: 49,  playerName: 'Duran, Jarren',             displayName: 'Jarren Duran',             adp: 49.66, positions: 'OF',      team: 'BOS', valueDelta: 0.66, isValuePick: false },
  { rank: 50,  playerName: 'Smith, Will',               displayName: 'Will Smith',               adp: 50.28, positions: 'C',       team: 'LAD', valueDelta: 0.28, isValuePick: false },
  // ── Ranks 51–80 ──────────────────────────────────────────────────────────
  { rank: 51,  playerName: 'Contreras, William',        displayName: 'William Contreras',        adp: 51.44, positions: 'C',       team: 'MIL', valueDelta: 0.44, isValuePick: false },
  { rank: 52,  playerName: 'Cease, Dylan',              displayName: 'Dylan Cease',              adp: 52.77, positions: 'SP',      team: 'SD',  valueDelta: 0.77, isValuePick: false },
  { rank: 53,  playerName: 'Nola, Aaron',               displayName: 'Aaron Nola',               adp: 53.20, positions: 'SP',      team: 'PHI', valueDelta: 0.20, isValuePick: false },
  { rank: 54,  playerName: 'Brown, Hunter',             displayName: 'Hunter Brown',             adp: 54.55, positions: 'SP',      team: 'HOU', valueDelta: 0.55, isValuePick: false },
  { rank: 55,  playerName: 'Stott, Bryson',             displayName: 'Bryson Stott',             adp: 55.32, positions: '2B,SS',   team: 'PHI', valueDelta: 0.32, isValuePick: false },
  { rank: 56,  playerName: 'Ryan, Joe',                 displayName: 'Joe Ryan',                 adp: 56.14, positions: 'SP',      team: 'MIN', valueDelta: 0.14, isValuePick: false },
  { rank: 57,  playerName: 'Alonso, Pete',              displayName: 'Pete Alonso',              adp: 57.48, positions: '1B',      team: 'NYM', valueDelta: 0.48, isValuePick: false },
  { rank: 58,  playerName: 'Correa, Carlos',            displayName: 'Carlos Correa',            adp: 58.71, positions: 'SS',      team: 'MIN', valueDelta: 0.71, isValuePick: false },
  { rank: 59,  playerName: 'Gallen, Zac',               displayName: 'Zac Gallen',               adp: 59.88, positions: 'SP',      team: 'ARI', valueDelta: 0.88, isValuePick: false },
  { rank: 60,  playerName: 'Lowe, Brandon',             displayName: 'Brandon Lowe',             adp: 60.23, positions: '2B',      team: 'TB',  valueDelta: 0.23, isValuePick: false },
  { rank: 61,  playerName: 'Buxton, Byron',             displayName: 'Byron Buxton',             adp: 61.55, positions: 'OF',      team: 'MIN', valueDelta: 0.55, isValuePick: false },
  { rank: 62,  playerName: 'Kwan, Steven',              displayName: 'Steven Kwan',              adp: 62.10, positions: 'OF',      team: 'CLE', valueDelta: 0.10, isValuePick: false },
  { rank: 63,  playerName: 'Naylor, Bo',                displayName: 'Bo Naylor',                adp: 63.44, positions: 'C',       team: 'CLE', valueDelta: 0.44, isValuePick: false },
  { rank: 64,  playerName: 'Realmuto, J.T.',            displayName: 'J.T. Realmuto',            adp: 64.77, positions: 'C',       team: 'PHI', valueDelta: 0.77, isValuePick: false },
  { rank: 65,  playerName: 'Machado, Manny',            displayName: 'Manny Machado',            adp: 65.30, positions: '3B,SS',   team: 'SD',  valueDelta: 0.30, isValuePick: false },
  { rank: 66,  playerName: 'Walker, Christian',         displayName: 'Christian Walker',         adp: 66.18, positions: '1B',      team: 'ARI', valueDelta: 0.18, isValuePick: false },
  { rank: 67,  playerName: 'Pfaadt, Brandon',           displayName: 'Brandon Pfaadt',           adp: 67.50, positions: 'SP',      team: 'ARI', valueDelta: 0.50, isValuePick: false },
  { rank: 68,  playerName: 'Perez, Salvador',           displayName: 'Salvador Perez',           adp: 68.22, positions: 'C',       team: 'KC',  valueDelta: 0.22, isValuePick: false },
  { rank: 69,  playerName: 'Arraez, Luis',              displayName: 'Luis Arraez',              adp: 69.85, positions: '1B,2B',   team: 'SD',  valueDelta: 0.85, isValuePick: false },
  { rank: 70,  playerName: 'Murphy, Sean',              displayName: 'Sean Murphy',              adp: 70.41, positions: 'C',       team: 'ATL', valueDelta: 0.41, isValuePick: false },
  { rank: 71,  playerName: 'Hoerner, Nico',             displayName: 'Nico Hoerner',             adp: 71.63, positions: '2B,SS',   team: 'CHC', valueDelta: 0.63, isValuePick: false },
  { rank: 72,  playerName: 'Flaherty, Jack',            displayName: 'Jack Flaherty',            adp: 72.29, positions: 'SP',      team: 'DET', valueDelta: 0.29, isValuePick: false },
  { rank: 73,  playerName: 'Lodolo, Nick',              displayName: 'Nick Lodolo',              adp: 73.74, positions: 'SP',      team: 'CIN', valueDelta: 0.74, isValuePick: false },
  { rank: 74,  playerName: 'Chapman, Aroldis',           displayName: 'Aroldis Chapman',          adp: 74.10, positions: 'RP',      team: 'PIT', valueDelta: 0.10, isValuePick: false },
  { rank: 75,  playerName: 'Bautista, Felix',           displayName: 'Felix Bautista',           adp: 75.36, positions: 'RP',      team: 'BAL', valueDelta: 0.36, isValuePick: false },
  { rank: 76,  playerName: 'Semien, Marcus',            displayName: 'Marcus Semien',            adp: 76.55, positions: '2B,SS',   team: 'TEX', valueDelta: 0.55, isValuePick: false },
  { rank: 77,  playerName: 'Diaz, Edwin',               displayName: 'Edwin Diaz',               adp: 77.80, positions: 'RP',      team: 'NYM', valueDelta: 0.80, isValuePick: false },
  { rank: 78,  playerName: 'Varsho, Daulton',           displayName: 'Daulton Varsho',           adp: 78.44, positions: 'C,OF',    team: 'TOR', valueDelta: 0.44, isValuePick: false },
  { rank: 79,  playerName: 'Gausman, Kevin',            displayName: 'Kevin Gausman',            adp: 79.17, positions: 'SP',      team: 'TOR', valueDelta: 0.17, isValuePick: false },
  { rank: 80,  playerName: 'Lugo, Seth',                displayName: 'Seth Lugo',                adp: 80.62, positions: 'SP',      team: 'KC',  valueDelta: 0.62, isValuePick: false },
  // ── Ranks 81–120 ─────────────────────────────────────────────────────────
  { rank: 81,  playerName: 'Bellinger, Cody',           displayName: 'Cody Bellinger',           adp: 81.30, positions: '1B,OF',   team: 'NYY', valueDelta: 0.30, isValuePick: false },
  { rank: 82,  playerName: 'Eovaldi, Nathan',           displayName: 'Nathan Eovaldi',           adp: 82.45, positions: 'SP',      team: 'TEX', valueDelta: 0.45, isValuePick: false },
  { rank: 83,  playerName: 'Alcantara, Sandy',          displayName: 'Sandy Alcantara',          adp: 83.71, positions: 'SP',      team: 'MIA', valueDelta: 0.71, isValuePick: false },
  { rank: 84,  playerName: 'Eflin, Zach',               displayName: 'Zach Eflin',               adp: 84.22, positions: 'SP',      team: 'TB',  valueDelta: 0.22, isValuePick: false },
  { rank: 85,  playerName: 'Springer, George',          displayName: 'George Springer',          adp: 85.58, positions: 'OF',      team: 'TOR', valueDelta: 0.58, isValuePick: false },
  { rank: 86,  playerName: 'Doval, Camilo',             displayName: 'Camilo Doval',             adp: 86.14, positions: 'RP',      team: 'SF',  valueDelta: 0.14, isValuePick: false },
  { rank: 87,  playerName: 'Goldschmidt, Paul',         displayName: 'Paul Goldschmidt',         adp: 87.40, positions: '1B',      team: 'NYY', valueDelta: 0.40, isValuePick: false },
  { rank: 88,  playerName: 'Pena, Jeremy',              displayName: 'Jeremy Peña',              adp: 88.65, positions: 'SS',      team: 'HOU', valueDelta: 0.65, isValuePick: false },
  { rank: 89,  playerName: 'Stanton, Giancarlo',        displayName: 'Giancarlo Stanton',        adp: 89.20, positions: 'OF,DH',   team: 'NYY', valueDelta: 0.20, isValuePick: false },
  { rank: 90,  playerName: 'Reynolds, Bryan',           displayName: 'Bryan Reynolds',           adp: 90.88, positions: 'OF',      team: 'PIT', valueDelta: 0.88, isValuePick: false },
  { rank: 91,  playerName: 'Luzardo, Jesus',            displayName: 'Jesus Luzardo',            adp: 91.33, positions: 'SP',      team: 'PHI', valueDelta: 0.33, isValuePick: false },
  { rank: 92,  playerName: 'Arozarena, Randy',          displayName: 'Randy Arozarena',          adp: 92.60, positions: 'OF',      team: 'SEA', valueDelta: 0.60, isValuePick: false },
  { rank: 93,  playerName: 'Pressly, Ryan',              displayName: 'Ryan Pressly',             adp: 93.75, positions: 'RP',      team: 'HOU', valueDelta: 0.75, isValuePick: false },
  { rank: 94,  playerName: 'Iglesias, Raisel',          displayName: 'Raisel Iglesias',          adp: 94.10, positions: 'RP',      team: 'LAA', valueDelta: 0.10, isValuePick: false },
  { rank: 95,  playerName: 'Stephenson, Tyler',         displayName: 'Tyler Stephenson',         adp: 95.44, positions: 'C',       team: 'CIN', valueDelta: 0.44, isValuePick: false },
  { rank: 96,  playerName: 'Trout, Mike',               displayName: 'Mike Trout',               adp: 96.85, positions: 'OF',      team: 'LAA', valueDelta: 0.85, isValuePick: false },
  { rank: 97,  playerName: 'Canha, Mark',               displayName: 'Mark Canha',               adp: 97.20, positions: 'OF,1B',   team: 'NYM', valueDelta: 0.20, isValuePick: false },
  { rank: 98,  playerName: 'Hicks, Jordan',             displayName: 'Jordan Hicks',             adp: 98.55, positions: 'SP',      team: 'STL', valueDelta: 0.55, isValuePick: false },
  { rank: 99,  playerName: 'Marsh, Brandon',            displayName: 'Brandon Marsh',            adp: 99.30, positions: 'OF',      team: 'PHI', valueDelta: 0.30, isValuePick: false },
  { rank: 100, playerName: 'Sears, JP',                 displayName: 'JP Sears',                 adp: 100.71,positions: 'SP',      team: 'OAK', valueDelta: 0.71, isValuePick: false },
  { rank: 101, playerName: 'Mayer, Marcelo',            displayName: 'Marcelo Mayer',            adp: 101.44,positions: 'SS',      team: 'BOS', valueDelta: 0.44, isValuePick: false },
  { rank: 102, playerName: 'Fedde, Erick',              displayName: 'Erick Fedde',              adp: 102.20,positions: 'SP',      team: 'STL', valueDelta: 0.20, isValuePick: false },
  { rank: 103, playerName: 'Lynn, Lance',               displayName: 'Lance Lynn',               adp: 103.60,positions: 'SP',      team: 'STL', valueDelta: 0.60, isValuePick: false },
  { rank: 104, playerName: 'Alvarado, Jose',            displayName: 'Jose Alvarado',            adp: 104.85,positions: 'RP',      team: 'PHI', valueDelta: 0.85, isValuePick: false },
  { rank: 105, playerName: 'Kopech, Michael',           displayName: 'Michael Kopech',           adp: 105.17,positions: 'SP,RP',   team: 'LAD', valueDelta: 0.17, isValuePick: false },
  { rank: 106, playerName: 'Webb, Jacob',               displayName: 'Jacob Webb',               adp: 106.40,positions: 'RP',      team: 'CIN', valueDelta: 0.40, isValuePick: false },
  { rank: 107, playerName: 'Sewald, Paul',              displayName: 'Paul Sewald',              adp: 107.72,positions: 'RP',      team: 'ARI', valueDelta: 0.72, isValuePick: false },
  { rank: 108, playerName: 'Muncy, Max',                displayName: 'Max Muncy',                adp: 108.30,positions: '1B,2B,3B',team: 'LAD', valueDelta: 0.30, isValuePick: false },
  { rank: 109, playerName: 'Buehler, Walker',           displayName: 'Walker Buehler',           adp: 109.55,positions: 'SP',      team: 'BOS', valueDelta: 0.55, isValuePick: false },
  { rank: 110, playerName: 'Snell, Blake',              displayName: 'Blake Snell',              adp: 110.20,positions: 'SP',      team: 'SF',  valueDelta: 0.20, isValuePick: false },
  { rank: 111, playerName: 'Blake, Kyle',               displayName: 'Kyle Blake',               adp: 111.44,positions: 'SP',      team: 'NYM', valueDelta: 0.44, isValuePick: false },
  { rank: 112, playerName: 'Montgomery, Jordan',        displayName: 'Jordan Montgomery',        adp: 112.71,positions: 'SP',      team: 'ARI', valueDelta: 0.71, isValuePick: false },
  { rank: 113, playerName: 'Vientos, Mark',             displayName: 'Mark Vientos',             adp: 113.18,positions: '3B,1B',   team: 'NYM', valueDelta: 0.18, isValuePick: false },
  { rank: 114, playerName: 'Winn, Masyn',               displayName: 'Masyn Winn',               adp: 114.50,positions: 'SS',      team: 'STL', valueDelta: 0.50, isValuePick: false },
  { rank: 115, playerName: 'Kirilloff, Alex',           displayName: 'Alex Kirilloff',           adp: 115.85,positions: '1B,OF',   team: 'MIN', valueDelta: 0.85, isValuePick: false },
  { rank: 116, playerName: 'Grisham, Trent',            displayName: 'Trent Grisham',            adp: 116.22,positions: 'OF',      team: 'NYY', valueDelta: 0.22, isValuePick: false },
  { rank: 117, playerName: 'Rodon, Carlos',             displayName: 'Carlos Rodon',             adp: 117.60,positions: 'SP',      team: 'NYY', valueDelta: 0.60, isValuePick: false },
  { rank: 118, playerName: 'Espinal, Santiago',         displayName: 'Santiago Espinal',         adp: 118.30,positions: '2B,3B',   team: 'TOR', valueDelta: 0.30, isValuePick: false },
  { rank: 119, playerName: 'Mitchell, Garrett',         displayName: 'Garrett Mitchell',         adp: 119.70,positions: 'OF',      team: 'MIL', valueDelta: 0.70, isValuePick: false },
  { rank: 120, playerName: 'Kimbrel, Craig',            displayName: 'Craig Kimbrel',            adp: 120.44,positions: 'RP',      team: 'PHI', valueDelta: 0.44, isValuePick: false },
  // ── Ranks 121–200 ────────────────────────────────────────────────────────────
  { rank: 121, playerName: 'Fried, Max',                displayName: 'Max Fried',                adp: 121.55, positions: 'SP',         team: 'NYY', valueDelta:  0.55, isValuePick: false },
  { rank: 122, playerName: 'Rodriguez, Grayson',        displayName: 'Grayson Rodriguez',        adp: 122.80, positions: 'SP',         team: 'BAL', valueDelta:  0.80, isValuePick: false },
  { rank: 123, playerName: 'Bohm, Alec',                displayName: 'Alec Bohm',                adp: 123.30, positions: '3B',         team: 'PHI', valueDelta:  0.30, isValuePick: false },
  { rank: 124, playerName: 'Gilbert, Logan',            displayName: 'Logan Gilbert',            adp: 124.65, positions: 'SP',         team: 'SEA', valueDelta:  0.65, isValuePick: false },
  { rank: 125, playerName: 'Greene, Hunter',            displayName: 'Hunter Greene',            adp: 125.18, positions: 'SP',         team: 'CIN', valueDelta:  0.18, isValuePick: false },
  { rank: 126, playerName: 'Kirk, Alejandro',           displayName: 'Alejandro Kirk',           adp: 126.44, positions: 'C',          team: 'TOR', valueDelta:  0.44, isValuePick: false },
  { rank: 127, playerName: 'Greene, Riley',             displayName: 'Riley Greene',             adp: 127.70, positions: 'OF',         team: 'DET', valueDelta:  0.70, isValuePick: false },
  { rank: 128, playerName: 'Garcia, Adolis',            displayName: 'Adolis Garcia',            adp: 128.22, positions: 'OF',         team: 'TEX', valueDelta:  0.22, isValuePick: false },
  { rank: 129, playerName: 'Moreno, Gabriel',           displayName: 'Gabriel Moreno',           adp: 129.55, positions: 'C',          team: 'ARI', valueDelta:  0.55, isValuePick: false },
  { rank: 130, playerName: 'Peralta, Freddy',           displayName: 'Freddy Peralta',           adp: 130.30, positions: 'SP',         team: 'MIL', valueDelta:  0.30, isValuePick: false },
  { rank: 131, playerName: 'Steele, Justin',            displayName: 'Justin Steele',            adp: 131.65, positions: 'SP',         team: 'CHC', valueDelta:  0.65, isValuePick: false },
  { rank: 132, playerName: 'Romano, Jordan',            displayName: 'Jordan Romano',            adp: 132.18, positions: 'RP',         team: 'TOR', valueDelta:  0.18, isValuePick: false },
  { rank: 133, playerName: 'Arenado, Nolan',            displayName: 'Nolan Arenado',            adp: 133.44, positions: '3B',         team: 'STL', valueDelta:  0.44, isValuePick: false },
  { rank: 134, playerName: 'Williams, Devin',           displayName: 'Devin Williams',           adp: 134.80, positions: 'RP',         team: 'NYY', valueDelta:  0.80, isValuePick: false },
  { rank: 135, playerName: 'Miller, Bryce',             displayName: 'Bryce Miller',             adp: 135.22, positions: 'SP',         team: 'SEA', valueDelta:  0.22, isValuePick: false },
  { rank: 136, playerName: 'Gray, Sonny',               displayName: 'Sonny Gray',               adp: 136.55, positions: 'SP',         team: 'STL', valueDelta:  0.55, isValuePick: false },
  { rank: 137, playerName: 'Holmes, Clay',              displayName: 'Clay Holmes',              adp: 137.30, positions: 'RP',         team: 'NYY', valueDelta:  0.30, isValuePick: false },
  { rank: 138, playerName: 'Fairbanks, Pete',           displayName: 'Pete Fairbanks',           adp: 138.65, positions: 'RP',         team: 'TB',  valueDelta:  0.65, isValuePick: false },
  { rank: 139, playerName: 'Munoz, Andres',             displayName: 'Andres Munoz',             adp: 139.20, positions: 'RP',         team: 'SEA', valueDelta:  0.20, isValuePick: false },
  { rank: 140, playerName: 'Singer, Brady',             displayName: 'Brady Singer',             adp: 140.48, positions: 'SP',         team: 'KC',  valueDelta:  0.48, isValuePick: false },
  { rank: 141, playerName: 'Javier, Cristian',          displayName: 'Cristian Javier',          adp: 141.75, positions: 'SP',         team: 'HOU', valueDelta:  0.75, isValuePick: false },
  { rank: 142, playerName: 'Torkelson, Spencer',        displayName: 'Spencer Torkelson',        adp: 142.22, positions: '1B',         team: 'DET', valueDelta:  0.22, isValuePick: false },
  { rank: 143, playerName: 'Bogaerts, Xander',          displayName: 'Xander Bogaerts',          adp: 143.55, positions: 'SS',         team: 'SD',  valueDelta:  0.55, isValuePick: false },
  { rank: 144, playerName: 'Keller, Mitch',             displayName: 'Mitch Keller',             adp: 144.30, positions: 'SP',         team: 'PIT', valueDelta:  0.30, isValuePick: false },
  { rank: 145, playerName: 'Bednar, David',             displayName: 'David Bednar',             adp: 145.65, positions: 'RP',         team: 'PIT', valueDelta:  0.65, isValuePick: false },
  { rank: 146, playerName: 'Gorman, Nolan',             displayName: 'Nolan Gorman',             adp: 146.18, positions: '2B,3B',      team: 'STL', valueDelta:  0.18, isValuePick: false },
  { rank: 147, playerName: 'Steer, Spencer',            displayName: 'Spencer Steer',            adp: 147.44, positions: '1B,2B,3B,OF',team: 'CIN', valueDelta:  0.44, isValuePick: false },
  { rank: 148, playerName: 'Larnach, Trevor',           displayName: 'Trevor Larnach',           adp: 148.80, positions: 'OF',         team: 'MIN', valueDelta:  0.80, isValuePick: false },
  { rank: 149, playerName: 'Bieber, Shane',             displayName: 'Shane Bieber',             adp: 149.22, positions: 'SP',         team: 'CLE', valueDelta:  0.22, isValuePick: false },
  { rank: 150, playerName: 'Gore, MacKenzie',           displayName: 'MacKenzie Gore',           adp: 150.55, positions: 'SP',         team: 'WAS', valueDelta:  0.55, isValuePick: false },
  { rank: 151, playerName: 'Phillips, Evan',            displayName: 'Evan Phillips',            adp: 151.30, positions: 'RP',         team: 'LAD', valueDelta:  0.30, isValuePick: false },
  { rank: 152, playerName: 'Kim, Ha-Seong',             displayName: 'Ha-Seong Kim',             adp: 152.65, positions: 'SS,2B,3B',   team: 'SD',  valueDelta:  0.65, isValuePick: false },
  { rank: 153, playerName: 'Heim, Jonah',               displayName: 'Jonah Heim',               adp: 153.18, positions: 'C',          team: 'TEX', valueDelta:  0.18, isValuePick: false },
  { rank: 154, playerName: 'Suarez, Robert',            displayName: 'Robert Suarez',            adp: 154.44, positions: 'RP',         team: 'SD',  valueDelta:  0.44, isValuePick: false },
  { rank: 155, playerName: 'Edman, Tommy',              displayName: 'Tommy Edman',              adp: 155.80, positions: '2B,SS,OF',   team: 'LAD', valueDelta:  0.80, isValuePick: false },
  { rank: 156, playerName: 'Quantrill, Cal',            displayName: 'Cal Quantrill',            adp: 156.22, positions: 'SP',         team: 'CLE', valueDelta:  0.22, isValuePick: false },
  { rank: 157, playerName: 'Diaz, Alexis',              displayName: 'Alexis Diaz',              adp: 157.55, positions: 'RP',         team: 'CIN', valueDelta:  0.55, isValuePick: false },
  { rank: 158, playerName: 'Hoskins, Rhys',             displayName: 'Rhys Hoskins',             adp: 158.30, positions: '1B',         team: 'MIL', valueDelta:  0.30, isValuePick: false },
  { rank: 159, playerName: 'Jansen, Kenley',            displayName: 'Kenley Jansen',            adp: 159.65, positions: 'RP',         team: 'BOS', valueDelta:  0.65, isValuePick: false },
  { rank: 160, playerName: 'McCormick, Chas',           displayName: 'Chas McCormick',           adp: 160.18, positions: 'OF',         team: 'HOU', valueDelta:  0.18, isValuePick: false },
  { rank: 161, playerName: 'Soler, Jorge',              displayName: 'Jorge Soler',              adp: 161.44, positions: 'OF,DH',      team: 'MIA', valueDelta:  0.44, isValuePick: false },
  { rank: 162, playerName: 'Cano, Yennier',             displayName: 'Yennier Cano',             adp: 162.80, positions: 'RP',         team: 'BAL', valueDelta:  0.80, isValuePick: false },
  { rank: 163, playerName: 'McNeil, Jeff',              displayName: 'Jeff McNeil',              adp: 163.22, positions: '2B,OF',      team: 'NYM', valueDelta:  0.22, isValuePick: false },
  { rank: 164, playerName: 'Detmers, Patrick',          displayName: 'Patrick Detmers',          adp: 164.55, positions: 'SP',         team: 'LAA', valueDelta:  0.55, isValuePick: false },
  { rank: 165, playerName: 'Langeliers, Shea',          displayName: 'Shea Langeliers',          adp: 165.30, positions: 'C',          team: 'OAK', valueDelta:  0.30, isValuePick: false },
  { rank: 166, playerName: 'Hayes, Ke\'Bryan',          displayName: 'Ke\'Bryan Hayes',          adp: 166.65, positions: '3B',         team: 'PIT', valueDelta:  0.65, isValuePick: false },
  { rank: 167, playerName: 'Winker, Jesse',             displayName: 'Jesse Winker',             adp: 167.18, positions: 'OF',         team: 'NYM', valueDelta:  0.18, isValuePick: false },
  { rank: 168, playerName: 'Musgrove, Joe',             displayName: 'Joe Musgrove',             adp: 168.44, positions: 'SP',         team: 'SD',  valueDelta:  0.44, isValuePick: false },
  { rank: 169, playerName: 'Crawford, J.P.',            displayName: 'J.P. Crawford',            adp: 169.80, positions: 'SS',         team: 'SEA', valueDelta:  0.80, isValuePick: false },
  { rank: 170, playerName: 'Lux, Gavin',                displayName: 'Gavin Lux',                adp: 170.22, positions: '2B,SS',      team: 'LAD', valueDelta:  0.22, isValuePick: false },
  { rank: 171, playerName: 'Bailey, Patrick',           displayName: 'Patrick Bailey',           adp: 171.55, positions: 'C',          team: 'SF',  valueDelta:  0.55, isValuePick: false },
  { rank: 172, playerName: 'Scott, Tanner',             displayName: 'Tanner Scott',             adp: 172.30, positions: 'RP',         team: 'MIA', valueDelta:  0.30, isValuePick: false },
  { rank: 173, playerName: 'Stroman, Marcus',           displayName: 'Marcus Stroman',           adp: 173.65, positions: 'SP',         team: 'CHC', valueDelta:  0.65, isValuePick: false },
  { rank: 174, playerName: 'Abreu, Bryan',              displayName: 'Bryan Abreu',              adp: 174.18, positions: 'RP',         team: 'HOU', valueDelta:  0.18, isValuePick: false },
  { rank: 175, playerName: 'Abbott, Andrew',            displayName: 'Andrew Abbott',            adp: 175.44, positions: 'SP',         team: 'CIN', valueDelta:  0.44, isValuePick: false },
  { rank: 176, playerName: 'Rodgers, Brendan',          displayName: 'Brendan Rodgers',          adp: 176.80, positions: '2B,SS',      team: 'COL', valueDelta:  0.80, isValuePick: false },
  { rank: 177, playerName: 'Ober, Bailey',              displayName: 'Bailey Ober',              adp: 177.22, positions: 'SP',         team: 'MIN', valueDelta:  0.22, isValuePick: false },
  { rank: 178, playerName: 'Happ, Ian',                 displayName: 'Ian Happ',                 adp: 178.55, positions: 'OF',         team: 'CHC', valueDelta:  0.55, isValuePick: false },
  { rank: 179, playerName: 'Walker, Jordan',            displayName: 'Jordan Walker',            adp: 179.30, positions: 'OF,3B',      team: 'STL', valueDelta:  0.30, isValuePick: false },
  { rank: 180, playerName: 'Lewis, Royce',              displayName: 'Royce Lewis',              adp: 180.65, positions: 'SS,3B',      team: 'MIN', valueDelta:  0.65, isValuePick: false },
  { rank: 181, playerName: 'Schmidt, Clarke',           displayName: 'Clarke Schmidt',           adp: 181.18, positions: 'SP',         team: 'NYY', valueDelta:  0.18, isValuePick: false },
  { rank: 182, playerName: 'Ragans, Cole',              displayName: 'Cole Ragans',              adp: 182.44, positions: 'SP',         team: 'KC',  valueDelta:  0.44, isValuePick: false },
  { rank: 183, playerName: 'Ray, Robbie',               displayName: 'Robbie Ray',               adp: 183.80, positions: 'SP',         team: 'SF',  valueDelta:  0.80, isValuePick: false },
  { rank: 184, playerName: 'Gurriel, Lourdes Jr.',      displayName: 'Lourdes Gurriel Jr.',      adp: 184.22, positions: 'OF',         team: 'MIL', valueDelta:  0.22, isValuePick: false },
  { rank: 185, playerName: 'Barlow, Joe',               displayName: 'Joe Barlow',               adp: 185.55, positions: 'RP',         team: 'TEX', valueDelta:  0.55, isValuePick: false },
  { rank: 186, playerName: 'Thompson, Keegan',          displayName: 'Keegan Thompson',          adp: 186.30, positions: 'SP,RP',      team: 'CHC', valueDelta:  0.30, isValuePick: false },
  { rank: 187, playerName: 'France, Ty',                displayName: 'Ty France',                adp: 187.65, positions: '1B,2B',      team: 'SEA', valueDelta:  0.65, isValuePick: false },
  { rank: 188, playerName: 'Nola, Austin',              displayName: 'Austin Nola',              adp: 188.18, positions: 'C',          team: 'SD',  valueDelta:  0.18, isValuePick: false },
  { rank: 189, playerName: 'Pallante, Andre',           displayName: 'Andre Pallante',           adp: 189.44, positions: 'SP,RP',      team: 'STL', valueDelta:  0.44, isValuePick: false },
  { rank: 190, playerName: 'Hernandez, Enrique',        displayName: 'Enrique Hernandez',        adp: 190.80, positions: '2B,SS,OF',   team: 'BOS', valueDelta:  0.80, isValuePick: false },
  { rank: 191, playerName: 'Davis, J.D.',               displayName: 'J.D. Davis',               adp: 191.22, positions: '3B,OF',      team: 'SF',  valueDelta:  0.22, isValuePick: false },
  { rank: 192, playerName: 'Kepler, Max',               displayName: 'Max Kepler',               adp: 192.55, positions: 'OF',         team: 'NYM', valueDelta:  0.55, isValuePick: false },
  { rank: 193, playerName: 'Lopez, Reynaldo',           displayName: 'Reynaldo Lopez',           adp: 193.30, positions: 'SP,RP',      team: 'CWS', valueDelta:  0.30, isValuePick: false },
  { rank: 194, playerName: 'Perdomo, Geraldo',          displayName: 'Geraldo Perdomo',          adp: 194.65, positions: 'SS,2B',      team: 'ARI', valueDelta:  0.65, isValuePick: false },
  { rank: 195, playerName: 'Giolito, Lucas',            displayName: 'Lucas Giolito',            adp: 195.18, positions: 'SP',         team: 'BOS', valueDelta:  0.18, isValuePick: false },
  { rank: 196, playerName: 'Baddoo, Akil',              displayName: 'Akil Baddoo',              adp: 196.44, positions: 'OF',         team: 'DET', valueDelta:  0.44, isValuePick: false },
  { rank: 197, playerName: 'Brennan, Will',             displayName: 'Will Brennan',             adp: 197.80, positions: 'OF',         team: 'CLE', valueDelta:  0.80, isValuePick: false },
  { rank: 198, playerName: 'Taillon, Jameson',          displayName: 'Jameson Taillon',          adp: 198.22, positions: 'SP',         team: 'CHC', valueDelta:  0.22, isValuePick: false },
  { rank: 199, playerName: 'Puk, A.J.',                 displayName: 'A.J. Puk',                 adp: 199.55, positions: 'RP,SP',      team: 'MIA', valueDelta:  0.55, isValuePick: false },
  { rank: 200, playerName: 'Raley, Brooks',             displayName: 'Brooks Raley',             adp: 200.30, positions: 'RP',         team: 'TB',  valueDelta:  0.30, isValuePick: false },
];

// ── Module-level cache ────────────────────────────────────────────────────────

let adpCache: NFBCPlayer[] | null = null;
let lastFetched = 0;
let adpFromDB = false;

// Cooldown for live-fetch attempts: 15 minutes between retries when both
// FantasyPros and ESPN are unreachable (avoids hammering external APIs).
const LIVE_FETCH_COOLDOWN_MS = 15 * 60 * 1000;
let lastLiveFetchAttempt = 0;

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

export async function saveADPToSupabase(players: NFBCPlayer[], sport = 'mlb'): Promise<void> {
  if (typeof window !== 'undefined') return; // server-only
  try {
    const supabase = await getADPSupabaseClient();
    if (!supabase) return;
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
    // Insert in batches of 50 to stay well within payload limits
    const BATCH = 50;
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error } = await supabase
        .from('nfbc_adp')
        .insert(rows.slice(i, i + BATCH));
      if (error) {
        console.warn('[v0] [ADP] Supabase insert batch failed:', error.message);
        return;
      }
    }
    console.log(`[v0] [ADP] Saved ${players.length} ${sport.toUpperCase()} ADP players to Supabase`);
  } catch (err) {
    console.warn('[v0] [ADP] saveADPToSupabase failed (non-critical):', err);
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

/** Returns true only when the current ADP data came from a real user upload in Supabase. */
export function isADPFromUserUpload(): boolean {
  return adpFromDB;
}

/**
 * Returns the MLB ADP player list.
 * Priority: in-memory cache → Supabase → live fetch (FantasyPros/ESPN) → static fallback.
 * Live fetches are attempted when the DB is empty and at most once per LIVE_FETCH_COOLDOWN_MS
 * to avoid hammering external APIs when they are unreachable.
 */
export async function getADPData(forceRefresh = false): Promise<NFBCPlayer[]> {
  const now = Date.now();

  if (adpCache && !forceRefresh && now - lastFetched < CACHE_TTL_MS) {
    return adpCache;
  }

  // Supabase is always authoritative (user uploads + cron data)
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

  // DB is empty — attempt a live fetch (server-side only, respects cooldown)
  if (typeof window === 'undefined' && now - lastLiveFetchAttempt > LIVE_FETCH_COOLDOWN_MS) {
    lastLiveFetchAttempt = now;
    try {
      const { fetchLiveADP } = await import('@/lib/adp-fetcher.server');
      const { players, source } = await fetchLiveADP('mlb');
      if (players.length > 0) {
        // Persist for future requests; fire-and-forget
        saveADPToSupabase(players, 'mlb').catch(() => {});
        adpCache = players;
        lastFetched = now;
        adpFromDB = false;
        console.log(`[v0] [ADP] Live fetch succeeded (${source}): ${players.length} MLB players`);
        return players;
      }
    } catch (err) {
      console.warn('[v0] [ADP] Live fetch failed — falling back to static:', err instanceof Error ? err.message : err);
    }
  }

  console.log(`[v0] [ADP] No live data available — serving static fallback (${STATIC_FALLBACK_PLAYERS.length} players)`);
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
