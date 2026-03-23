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
  // Source: public/adp - ADP.csv — NFBC 2026 consensus ADP (top 120, 1255 drafts)
  { rank: 1,   playerName: 'Ohtani, Shohei',           displayName: 'Shohei Ohtani',           adp: 1.19,   positions: 'UT,P',   team: 'LAD', valueDelta: 0, isValuePick: false },
  { rank: 2,   playerName: 'Judge, Aaron',              displayName: 'Aaron Judge',              adp: 1.93,   positions: 'OF',     team: 'NYY', valueDelta: 0, isValuePick: false },
  { rank: 3,   playerName: 'Witt Jr., Bobby',           displayName: 'Bobby Witt Jr.',           adp: 3.19,   positions: 'SS',     team: 'KC',  valueDelta: 0, isValuePick: false },
  { rank: 4,   playerName: 'Soto, Juan',                displayName: 'Juan Soto',                adp: 4.26,   positions: 'OF',     team: 'NYM', valueDelta: 0, isValuePick: false },
  { rank: 5,   playerName: 'Ramirez, Jose',             displayName: 'Jose Ramirez',             adp: 5.47,   positions: '3B',     team: 'CLE', valueDelta: 0, isValuePick: false },
  { rank: 6,   playerName: 'Acuna Jr., Ronald',         displayName: 'Ronald Acuna Jr.',         adp: 7.07,   positions: 'OF',     team: 'ATL', valueDelta: 0, isValuePick: false },
  { rank: 7,   playerName: 'Skubal, Tarik',             displayName: 'Tarik Skubal',             adp: 7.32,   positions: 'P',      team: 'DET', valueDelta: 0, isValuePick: false },
  { rank: 8,   playerName: 'De La Cruz, Elly',          displayName: 'Elly De La Cruz',          adp: 8.89,   positions: 'SS',     team: 'CIN', valueDelta: 0, isValuePick: false },
  { rank: 9,   playerName: 'Rodriguez, Julio',          displayName: 'Julio Rodriguez',          adp: 9.62,   positions: 'OF',     team: 'SEA', valueDelta: 0, isValuePick: false },
  { rank: 10,  playerName: 'Skenes, Paul',              displayName: 'Paul Skenes',              adp: 11.15,  positions: 'P',      team: 'PIT', valueDelta: 0, isValuePick: false },
  { rank: 11,  playerName: 'Carroll, Corbin',           displayName: 'Corbin Carroll',           adp: 11.41,  positions: 'OF',     team: 'ARZ', valueDelta: 0, isValuePick: false },
  { rank: 12,  playerName: 'Crochet, Garrett',          displayName: 'Garrett Crochet',          adp: 12.5,   positions: 'P',      team: 'BOS', valueDelta: 0, isValuePick: false },
  { rank: 13,  playerName: 'Tatis Jr., Fernando',       displayName: 'Fernando Tatis Jr.',       adp: 14.14,  positions: 'OF',     team: 'SD',  valueDelta: 0, isValuePick: false },
  { rank: 14,  playerName: 'Henderson, Gunnar',         displayName: 'Gunnar Henderson',         adp: 14.27,  positions: 'SS',     team: 'BAL', valueDelta: 0, isValuePick: false },
  { rank: 15,  playerName: 'Tucker, Kyle',              displayName: 'Kyle Tucker',              adp: 15.01,  positions: 'OF',     team: 'LAD', valueDelta: 0, isValuePick: false },
  { rank: 16,  playerName: 'Caminero, Junior',          displayName: 'Junior Caminero',          adp: 15.44,  positions: '3B',     team: 'TB',  valueDelta: 0, isValuePick: false },
  { rank: 17,  playerName: 'Raleigh, Cal',              displayName: 'Cal Raleigh',              adp: 17.42,  positions: 'C',      team: 'SEA', valueDelta: 0, isValuePick: false },
  { rank: 18,  playerName: 'Guerrero Jr., Vladimir',    displayName: 'Vladimir Guerrero Jr.',    adp: 18.44,  positions: '1B',     team: 'TOR', valueDelta: 0, isValuePick: false },
  { rank: 19,  playerName: 'Kurtz, Nick',               displayName: 'Nick Kurtz',               adp: 18.6,   positions: '1B',     team: 'ATH', valueDelta: 0, isValuePick: false },
  { rank: 20,  playerName: 'Chourio, Jackson',          displayName: 'Jackson Chourio',          adp: 20.25,  positions: 'OF',     team: 'MLW', valueDelta: 0, isValuePick: false },
  { rank: 21,  playerName: 'Chisholm Jr., Jazz',        displayName: 'Jazz Chisholm Jr.',        adp: 20.66,  positions: '2B,3B',  team: 'NYY', valueDelta: 0, isValuePick: false },
  { rank: 22,  playerName: 'Lindor, Francisco',         displayName: 'Francisco Lindor',         adp: 21.18,  positions: 'SS',     team: 'NYM', valueDelta: 0, isValuePick: false },
  { rank: 23,  playerName: 'Schwarber, Kyle',           displayName: 'Kyle Schwarber',           adp: 24.33,  positions: 'UT',     team: 'PHI', valueDelta: 0, isValuePick: false },
  { rank: 24,  playerName: 'Alonso, Pete',              displayName: 'Pete Alonso',              adp: 25.91,  positions: '1B',     team: 'BAL', valueDelta: 0, isValuePick: false },
  { rank: 25,  playerName: 'Turner, Trea',              displayName: 'Trea Turner',              adp: 26.75,  positions: 'SS',     team: 'PHI', valueDelta: 0, isValuePick: false },
  { rank: 26,  playerName: 'Yamamoto, Yoshinobu',       displayName: 'Yoshinobu Yamamoto',       adp: 27.16,  positions: 'P',      team: 'LAD', valueDelta: 0, isValuePick: false },
  { rank: 27,  playerName: 'Sanchez, Cristopher',       displayName: 'Cristopher Sanchez',       adp: 30.78,  positions: 'P',      team: 'PHI', valueDelta: 0, isValuePick: false },
  { rank: 28,  playerName: 'Neto, Zach',                displayName: 'Zach Neto',                adp: 30.96,  positions: 'SS',     team: 'LAA', valueDelta: 0, isValuePick: false },
  { rank: 29,  playerName: 'Crow-Armstrong, Pete',      displayName: 'Pete Crow-Armstrong',      adp: 31.64,  positions: 'OF',     team: 'CHC', valueDelta: 0, isValuePick: false },
  { rank: 30,  playerName: 'Wood, James',               displayName: 'James Wood',               adp: 33.2,   positions: 'OF',     team: 'WAS', valueDelta: 0, isValuePick: false },
  { rank: 31,  playerName: 'Marte, Ketel',              displayName: 'Ketel Marte',              adp: 33.51,  positions: '2B',     team: 'ARZ', valueDelta: 0, isValuePick: false },
  { rank: 32,  playerName: 'Machado, Manny',            displayName: 'Manny Machado',            adp: 36.78,  positions: '3B',     team: 'SD',  valueDelta: 0, isValuePick: false },
  { rank: 33,  playerName: 'Alvarez, Yordan',           displayName: 'Yordan Alvarez',           adp: 37.25,  positions: 'UT',     team: 'HOU', valueDelta: 0, isValuePick: false },
  { rank: 34,  playerName: 'Miller, Mason',             displayName: 'Mason Miller',             adp: 37.75,  positions: 'P',      team: 'SD',  valueDelta: 0, isValuePick: false },
  { rank: 35,  playerName: 'Diaz, Edwin',               displayName: 'Edwin Diaz',               adp: 38.33,  positions: 'P',      team: 'LAD', valueDelta: 0, isValuePick: false },
  { rank: 36,  playerName: 'Brown, Hunter',             displayName: 'Hunter Brown',             adp: 39.0,   positions: 'P',      team: 'HOU', valueDelta: 0, isValuePick: false },
  { rank: 37,  playerName: 'Gilbert, Logan',            displayName: 'Logan Gilbert',            adp: 39.65,  positions: 'P',      team: 'SEA', valueDelta: 0, isValuePick: false },
  { rank: 38,  playerName: 'Woo, Bryan',                displayName: 'Bryan Woo',                adp: 41.76,  positions: 'P',      team: 'SEA', valueDelta: 0, isValuePick: false },
  { rank: 39,  playerName: 'Sale, Chris',               displayName: 'Chris Sale',               adp: 43.03,  positions: 'P',      team: 'ATL', valueDelta: 0, isValuePick: false },
  { rank: 40,  playerName: 'Langford, Wyatt',           displayName: 'Wyatt Langford',           adp: 45.33,  positions: 'OF',     team: 'TEX', valueDelta: 0, isValuePick: false },
  { rank: 41,  playerName: 'Munoz, Andres',             displayName: 'Andres Munoz',             adp: 45.52,  positions: 'P',      team: 'SEA', valueDelta: 0, isValuePick: false },
  { rank: 42,  playerName: 'Harper, Bryce',             displayName: 'Bryce Harper',             adp: 47.17,  positions: '1B',     team: 'PHI', valueDelta: 0, isValuePick: false },
  { rank: 43,  playerName: 'Rooker, Brent',             displayName: 'Brent Rooker',             adp: 47.6,   positions: 'OF',     team: 'ATH', valueDelta: 0, isValuePick: false },
  { rank: 44,  playerName: 'Olson, Matt',               displayName: 'Matt Olson',               adp: 47.93,  positions: '1B',     team: 'ATL', valueDelta: 0, isValuePick: false },
  { rank: 45,  playerName: 'Duran, Jhoan',              displayName: 'Jhoan Duran',              adp: 48.2,   positions: 'P',      team: 'PHI', valueDelta: 0, isValuePick: false },
  { rank: 46,  playerName: 'Smith, Cade',               displayName: 'Cade Smith',               adp: 48.2,   positions: 'P',      team: 'CLE', valueDelta: 0, isValuePick: false },
  { rank: 47,  playerName: 'Rice, Ben',                 displayName: 'Ben Rice',                 adp: 52.28,  positions: 'C,1B',   team: 'NYY', valueDelta: 0, isValuePick: false },
  { rank: 48,  playerName: 'Contreras, William',        displayName: 'William Contreras',        adp: 52.7,   positions: 'C',      team: 'MLW', valueDelta: 0, isValuePick: false },
  { rank: 49,  playerName: 'Langeliers, Shea',          displayName: 'Shea Langeliers',          adp: 53.73,  positions: 'C',      team: 'ATH', valueDelta: 0, isValuePick: false },
  { rank: 50,  playerName: 'deGrom, Jacob',             displayName: 'Jacob deGrom',             adp: 53.89,  positions: 'P',      team: 'TEX', valueDelta: 0, isValuePick: false },
  { rank: 51,  playerName: 'Betts, Mookie',             displayName: 'Mookie Betts',             adp: 54.57,  positions: 'SS',     team: 'LAD', valueDelta: 0, isValuePick: false },
  { rank: 52,  playerName: 'Turang, Brice',             displayName: 'Brice Turang',             adp: 54.67,  positions: '2B',     team: 'MLW', valueDelta: 0, isValuePick: false },
  { rank: 53,  playerName: 'Devers, Rafael',            displayName: 'Rafael Devers',            adp: 55.02,  positions: '1B',     team: 'SF',  valueDelta: 0, isValuePick: false },
  { rank: 54,  playerName: 'Anthony, Roman',            displayName: 'Roman Anthony',            adp: 55.17,  positions: 'OF',     team: 'BOS', valueDelta: 0, isValuePick: false },
  { rank: 55,  playerName: 'Fried, Max',                displayName: 'Max Fried',                adp: 56.0,   positions: 'P',      team: 'NYY', valueDelta: 0, isValuePick: false },
  { rank: 56,  playerName: 'Ragans, Cole',              displayName: 'Cole Ragans',              adp: 56.04,  positions: 'P',      team: 'KC',  valueDelta: 0, isValuePick: false },
  { rank: 57,  playerName: 'Abrams, CJ',                displayName: 'CJ Abrams',                adp: 59.6,   positions: 'SS',     team: 'WAS', valueDelta: 0, isValuePick: false },
  { rank: 58,  playerName: 'Webb, Logan',               displayName: 'Logan Webb',               adp: 59.88,  positions: 'P',      team: 'SF',  valueDelta: 0, isValuePick: false },
  { rank: 59,  playerName: 'Peralta, Freddy',           displayName: 'Freddy Peralta',           adp: 63.94,  positions: 'P',      team: 'NYM', valueDelta: 0, isValuePick: false },
  { rank: 60,  playerName: 'Naylor, Josh',              displayName: 'Josh Naylor',              adp: 64.01,  positions: '1B',     team: 'SEA', valueDelta: 0, isValuePick: false },
  { rank: 61,  playerName: 'Freeman, Freddie',          displayName: 'Freddie Freeman',          adp: 64.37,  positions: '1B',     team: 'LAD', valueDelta: 0, isValuePick: false },
  { rank: 62,  playerName: 'Goodman, Hunter',           displayName: 'Hunter Goodman',           adp: 65.36,  positions: 'C',      team: 'COL', valueDelta: 0, isValuePick: false },
  { rank: 63,  playerName: 'Riley, Austin',             displayName: 'Austin Riley',             adp: 66.6,   positions: '3B',     team: 'ATL', valueDelta: 0, isValuePick: false },
  { rank: 64,  playerName: 'Bednar, David',             displayName: 'David Bednar',             adp: 67.22,  positions: 'P',      team: 'NYY', valueDelta: 0, isValuePick: false },
  { rank: 65,  playerName: 'Chapman, Aroldis',          displayName: 'Aroldis Chapman',          adp: 68.48,  positions: 'P',      team: 'BOS', valueDelta: 0, isValuePick: false },
  { rank: 66,  playerName: 'Merrill, Jackson',          displayName: 'Jackson Merrill',          adp: 68.69,  positions: 'OF',     team: 'SD',  valueDelta: 0, isValuePick: false },
  { rank: 67,  playerName: 'Duran, Jarren',             displayName: 'Jarren Duran',             adp: 70.71,  positions: 'OF',     team: 'BOS', valueDelta: 0, isValuePick: false },
  { rank: 68,  playerName: 'Kirby, George',             displayName: 'George Kirby',             adp: 71.79,  positions: 'P',      team: 'SEA', valueDelta: 0, isValuePick: false },
  { rank: 69,  playerName: 'Garcia, Maikel',            displayName: 'Maikel Garcia',            adp: 71.99,  positions: '3B',     team: 'KC',  valueDelta: 0, isValuePick: false },
  { rank: 70,  playerName: 'Williams, Devin',           displayName: 'Devin Williams',           adp: 73.4,   positions: 'P',      team: 'NYM', valueDelta: 0, isValuePick: false },
  { rank: 71,  playerName: 'Greene, Riley',             displayName: 'Riley Greene',             adp: 73.45,  positions: 'OF',     team: 'DET', valueDelta: 0, isValuePick: false },
  { rank: 72,  playerName: 'Buxton, Byron',             displayName: 'Byron Buxton',             adp: 73.86,  positions: 'OF',     team: 'MIN', valueDelta: 0, isValuePick: false },
  { rank: 73,  playerName: 'Ryan, Joe',                 displayName: 'Joe Ryan',                 adp: 76.53,  positions: 'P',      team: 'MIN', valueDelta: 0, isValuePick: false },
  { rank: 74,  playerName: 'Perdomo, Geraldo',          displayName: 'Geraldo Perdomo',          adp: 76.67,  positions: 'SS',     team: 'ARZ', valueDelta: 0, isValuePick: false },
  { rank: 75,  playerName: 'Bellinger, Cody',           displayName: 'Cody Bellinger',           adp: 77.74,  positions: 'OF',     team: 'NYY', valueDelta: 0, isValuePick: false },
  { rank: 76,  playerName: 'Ramirez, Agustin',          displayName: 'Agustin Ramirez',          adp: 79.6,   positions: 'C',      team: 'MIA', valueDelta: 0, isValuePick: false },
  { rank: 77,  playerName: 'Pasquantino, Vinnie',       displayName: 'Vinnie Pasquantino',       adp: 79.61,  positions: '1B',     team: 'KC',  valueDelta: 0, isValuePick: false },
  { rank: 78,  playerName: 'Cease, Dylan',              displayName: 'Dylan Cease',              adp: 80.29,  positions: 'P',      team: 'TOR', valueDelta: 0, isValuePick: false },
  { rank: 79,  playerName: 'Luzardo, Jesus',            displayName: 'Jesus Luzardo',            adp: 81.58,  positions: 'P',      team: 'PHI', valueDelta: 0, isValuePick: false },
  { rank: 80,  playerName: 'Bradish, Kyle',             displayName: 'Kyle Bradish',             adp: 82.43,  positions: 'P',      team: 'BAL', valueDelta: 0, isValuePick: false },
  { rank: 81,  playerName: 'Baldwin, Drake',            displayName: 'Drake Baldwin',            adp: 83.47,  positions: 'C',      team: 'ATL', valueDelta: 0, isValuePick: false },
  { rank: 82,  playerName: 'Soderstrom, Tyler',         displayName: 'Tyler Soderstrom',         adp: 85.57,  positions: 'OF,1B',  team: 'ATH', valueDelta: 0, isValuePick: false },
  { rank: 83,  playerName: 'Arozarena, Randy',          displayName: 'Randy Arozarena',          adp: 88.89,  positions: 'OF',     team: 'SEA', valueDelta: 0, isValuePick: false },
  { rank: 84,  playerName: 'Perez, Salvador',           displayName: 'Salvador Perez',           adp: 91.02,  positions: 'C,1B',   team: 'KC',  valueDelta: 0, isValuePick: false },
  { rank: 85,  playerName: 'Valdez, Framber',           displayName: 'Framber Valdez',           adp: 91.76,  positions: 'P',      team: 'DET', valueDelta: 0, isValuePick: false },
  { rank: 86,  playerName: 'Suzuki, Seiya',             displayName: 'Seiya Suzuki',             adp: 92.95,  positions: 'OF',     team: 'CHC', valueDelta: 0, isValuePick: false },
  { rank: 87,  playerName: 'Perez, Eury',               displayName: 'Eury Perez',               adp: 93.01,  positions: 'P',      team: 'MIA', valueDelta: 0, isValuePick: false },
  { rank: 88,  playerName: 'Springer, George',          displayName: 'George Springer',          adp: 95.37,  positions: 'OF',     team: 'TOR', valueDelta: 0, isValuePick: false },
  { rank: 89,  playerName: 'Hader, Josh',               displayName: 'Josh Hader',               adp: 95.75,  positions: 'P',      team: 'HOU', valueDelta: 0, isValuePick: false },
  { rank: 90,  playerName: 'Bichette, Bo',              displayName: 'Bo Bichette',              adp: 95.91,  positions: 'SS',     team: 'NYM', valueDelta: 0, isValuePick: false },
  { rank: 91,  playerName: 'Cruz, Oneil',               displayName: 'Oneil Cruz',               adp: 96.28,  positions: 'OF',     team: 'PIT', valueDelta: 0, isValuePick: false },
  { rank: 92,  playerName: 'Seager, Corey',             displayName: 'Corey Seager',             adp: 96.3,   positions: 'SS',     team: 'TEX', valueDelta: 0, isValuePick: false },
  { rank: 93,  playerName: 'Smith, Will',               displayName: 'Will Smith',               adp: 97.12,  positions: 'C',      team: 'LAD', valueDelta: 0, isValuePick: false },
  { rank: 94,  playerName: 'Pivetta, Nick',             displayName: 'Nick Pivetta',             adp: 97.75,  positions: 'P',      team: 'SD',  valueDelta: 0, isValuePick: false },
  { rank: 95,  playerName: 'Pena, Jeremy',              displayName: 'Jeremy Pena',              adp: 98.41,  positions: 'SS',     team: 'HOU', valueDelta: 0, isValuePick: false },
  { rank: 96,  playerName: 'Harris II, Michael',        displayName: 'Michael Harris II',        adp: 98.95,  positions: 'OF',     team: 'ATL', valueDelta: 0, isValuePick: false },
  { rank: 97,  playerName: 'Hoerner, Nico',             displayName: 'Nico Hoerner',             adp: 100.41, positions: '2B',     team: 'CHC', valueDelta: 0, isValuePick: false },
  { rank: 98,  playerName: 'McLean, Nolan',             displayName: 'Nolan McLean',             adp: 100.57, positions: 'P',      team: 'NYM', valueDelta: 0, isValuePick: false },
  { rank: 99,  playerName: 'Suarez, Eugenio',           displayName: 'Eugenio Suarez',           adp: 102.1,  positions: '3B',     team: 'CIN', valueDelta: 0, isValuePick: false },
  { rank: 100, playerName: 'Greene, Hunter',            displayName: 'Hunter Greene',            adp: 104.29, positions: 'P',      team: 'CIN', valueDelta: 0, isValuePick: false },
  { rank: 101, playerName: 'Story, Trevor',             displayName: 'Trevor Story',             adp: 105.15, positions: 'SS',     team: 'BOS', valueDelta: 0, isValuePick: false },
  { rank: 102, playerName: 'Iglesias, Raisel',          displayName: 'Raisel Iglesias',          adp: 105.22, positions: 'P',      team: 'ATL', valueDelta: 0, isValuePick: false },
  { rank: 103, playerName: 'Busch, Michael',            displayName: 'Michael Busch',            adp: 105.89, positions: '1B',     team: 'CHC', valueDelta: 0, isValuePick: false },
  { rank: 104, playerName: 'Helsley, Ryan',             displayName: 'Ryan Helsley',             adp: 106.0,  positions: 'P',      team: 'BAL', valueDelta: 0, isValuePick: false },
  { rank: 105, playerName: 'Estevez, Carlos',           displayName: 'Carlos Estevez',           adp: 106.5,  positions: 'P',      team: 'KC',  valueDelta: 0, isValuePick: false },
  { rank: 106, playerName: 'Diaz, Yainer',              displayName: 'Yainer Diaz',              adp: 110.16, positions: 'C',      team: 'HOU', valueDelta: 0, isValuePick: false },
  { rank: 107, playerName: 'Strider, Spencer',          displayName: 'Spencer Strider',          adp: 110.83, positions: 'P',      team: 'ATL', valueDelta: 0, isValuePick: false },
  { rank: 108, playerName: 'Altuve, Jose',              displayName: 'Jose Altuve',              adp: 111.01, positions: 'OF,2B',  team: 'HOU', valueDelta: 0, isValuePick: false },
  { rank: 109, playerName: 'Bregman, Alex',             displayName: 'Alex Bregman',             adp: 112.95, positions: '3B',     team: 'CHC', valueDelta: 0, isValuePick: false },
  { rank: 110, playerName: 'Snell, Blake',              displayName: 'Blake Snell',              adp: 117.97, positions: 'P',      team: 'LAD', valueDelta: 0, isValuePick: false },
  { rank: 111, playerName: 'Robert Jr., Luis',          displayName: 'Luis Robert Jr.',          adp: 117.97, positions: 'OF',     team: 'NYM', valueDelta: 0, isValuePick: false },
  { rank: 112, playerName: 'Gausman, Kevin',            displayName: 'Kevin Gausman',            adp: 120.31, positions: 'P',      team: 'TOR', valueDelta: 0, isValuePick: false },
  { rank: 113, playerName: 'Burns, Chase',              displayName: 'Chase Burns',              adp: 120.44, positions: 'P',      team: 'CIN', valueDelta: 0, isValuePick: false },
  { rank: 114, playerName: 'Yelich, Christian',         displayName: 'Christian Yelich',         adp: 122.1,  positions: 'UT',     team: 'MLW', valueDelta: 0, isValuePick: false },
  { rank: 115, playerName: 'Adell, Jo',                 displayName: 'Jo Adell',                 adp: 123.01, positions: 'OF',     team: 'LAA', valueDelta: 0, isValuePick: false },
  { rank: 116, playerName: 'Adames, Willy',             displayName: 'Willy Adames',             adp: 123.59, positions: 'SS',     team: 'SF',  valueDelta: 0, isValuePick: false },
  { rank: 117, playerName: 'Hoffman, Jeff',             displayName: 'Jeff Hoffman',             adp: 124.45, positions: 'P',      team: 'TOR', valueDelta: 0, isValuePick: false },
  { rank: 118, playerName: 'Hernandez, Teoscar',        displayName: 'Teoscar Hernandez',        adp: 126.22, positions: 'OF',     team: 'LAD', valueDelta: 0, isValuePick: false },
  { rank: 119, playerName: 'Stowers, Kyle',             displayName: 'Kyle Stowers',             adp: 126.81, positions: 'OF',     team: 'MIA', valueDelta: 0, isValuePick: false },
  { rank: 120, playerName: 'Glasnow, Tyler',            displayName: 'Tyler Glasnow',            adp: 127.05, positions: 'P',      team: 'LAD', valueDelta: 0, isValuePick: false },
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
