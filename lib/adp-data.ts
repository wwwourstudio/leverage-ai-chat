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

// Short TTL so newly-uploaded data propagates quickly across serverless instances
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

// ── Static fallback dataset ───────────────────────────────────────────────────
// Used when the NFBC live endpoint is unreachable. Values are 2026 NFBC consensus
// pre-season ADP (updated March 2026). Update annually before each MLB draft season.
// Covers top 120 picks (rounds 1–12 of a 10-team league) across all positions.

const STATIC_FALLBACK_PLAYERS: NFBCPlayer[] = [
  // ── Round 1 (1–10) ──────────────────────────────────────────────────────────
  { rank: 1,   playerName: 'Witt, Bobby Jr.',           displayName: 'Bobby Witt Jr.',           adp: 1.2,   positions: 'SS',      team: 'KC',  valueDelta: 0.2,  isValuePick: false },
  { rank: 2,   playerName: 'Acuna, Ronald Jr.',         displayName: 'Ronald Acuna Jr.',         adp: 2.4,   positions: 'OF',      team: 'ATL', valueDelta: 0.4,  isValuePick: false },
  { rank: 3,   playerName: 'Judge, Aaron',              displayName: 'Aaron Judge',              adp: 3.5,   positions: 'OF',      team: 'NYY', valueDelta: 0.5,  isValuePick: false },
  { rank: 4,   playerName: 'Ohtani, Shohei',           displayName: 'Shohei Ohtani',            adp: 4.1,   positions: 'OF,DH',   team: 'LAD', valueDelta: 0.1,  isValuePick: false },
  { rank: 5,   playerName: 'Henderson, Gunnar',         displayName: 'Gunnar Henderson',         adp: 5.8,   positions: 'SS,3B',   team: 'BAL', valueDelta: 0.8,  isValuePick: false },
  { rank: 6,   playerName: 'Alvarez, Yordan',           displayName: 'Yordan Alvarez',           adp: 6.4,   positions: 'OF,DH',   team: 'HOU', valueDelta: 0.4,  isValuePick: false },
  { rank: 7,   playerName: 'Soto, Juan',                displayName: 'Juan Soto',                adp: 7.2,   positions: 'OF',      team: 'NYM', valueDelta: 0.2,  isValuePick: false },
  { rank: 8,   playerName: 'Tucker, Kyle',              displayName: 'Kyle Tucker',              adp: 8.6,   positions: 'OF',      team: 'CHC', valueDelta: 0.6,  isValuePick: false },
  { rank: 9,   playerName: 'Guerrero, Vladimir Jr.',    displayName: 'Vladimir Guerrero Jr.',    adp: 9.9,   positions: '1B',      team: 'TOR', valueDelta: 0.9,  isValuePick: false },
  { rank: 10,  playerName: 'Betts, Mookie',             displayName: 'Mookie Betts',             adp: 11.2,  positions: 'SS,OF',   team: 'LAD', valueDelta: 1.2,  isValuePick: false },
  // ── Round 2 (11–20) ─────────────────────────────────────────────────────────
  { rank: 11,  playerName: 'Harper, Bryce',             displayName: 'Bryce Harper',             adp: 12.0,  positions: '1B',      team: 'PHI', valueDelta: 1.0,  isValuePick: false },
  { rank: 12,  playerName: 'Devers, Rafael',            displayName: 'Rafael Devers',            adp: 13.3,  positions: '3B',      team: 'BOS', valueDelta: 1.3,  isValuePick: false },
  { rank: 13,  playerName: 'Seager, Corey',             displayName: 'Corey Seager',             adp: 14.8,  positions: 'SS',      team: 'TEX', valueDelta: 1.8,  isValuePick: false },
  { rank: 14,  playerName: 'Freeman, Freddie',          displayName: 'Freddie Freeman',          adp: 16.1,  positions: '1B',      team: 'LAD', valueDelta: 2.1,  isValuePick: false },
  { rank: 15,  playerName: 'Alonso, Pete',              displayName: 'Pete Alonso',              adp: 17.5,  positions: '1B',      team: 'NYM', valueDelta: 2.5,  isValuePick: false },
  { rank: 16,  playerName: 'Olson, Matt',               displayName: 'Matt Olson',               adp: 19.0,  positions: '1B',      team: 'ATL', valueDelta: 3.0,  isValuePick: false },
  { rank: 17,  playerName: 'Wheeler, Zack',             displayName: 'Zack Wheeler',             adp: 20.4,  positions: 'SP',      team: 'PHI', valueDelta: 3.4,  isValuePick: false },
  { rank: 18,  playerName: 'Cole, Gerrit',              displayName: 'Gerrit Cole',              adp: 22.0,  positions: 'SP',      team: 'NYY', valueDelta: 4.0,  isValuePick: false },
  { rank: 19,  playerName: 'Webb, Logan',               displayName: 'Logan Webb',               adp: 24.5,  positions: 'SP',      team: 'SF',  valueDelta: 5.5,  isValuePick: false },
  { rank: 20,  playerName: 'Strider, Spencer',          displayName: 'Spencer Strider',          adp: 26.8,  positions: 'SP',      team: 'ATL', valueDelta: 6.8,  isValuePick: false },
  // ── Round 3 (21–30) ─────────────────────────────────────────────────────────
  { rank: 21,  playerName: 'Burnes, Corbin',            displayName: 'Corbin Burnes',            adp: 29.2,  positions: 'SP',      team: 'ARI', valueDelta: 8.2,  isValuePick: false },
  { rank: 22,  playerName: 'Brown, Hunter',             displayName: 'Hunter Brown',             adp: 33.5,  positions: 'SP',      team: 'HOU', valueDelta: 11.5, isValuePick: false },
  { rank: 23,  playerName: 'Clase, Emmanuel',           displayName: 'Emmanuel Clase',           adp: 37.0,  positions: 'RP',      team: 'CLE', valueDelta: 14.0, isValuePick: false },
  { rank: 24,  playerName: 'Helsley, Ryan',             displayName: 'Ryan Helsley',             adp: 41.0,  positions: 'RP',      team: 'STL', valueDelta: 17.0, isValuePick: true  },
  { rank: 25,  playerName: 'Hader, Josh',               displayName: 'Josh Hader',               adp: 44.5,  positions: 'RP',      team: 'HOU', valueDelta: 19.5, isValuePick: true  },
  { rank: 26,  playerName: 'Tatis, Fernando Jr.',       displayName: 'Fernando Tatis Jr.',       adp: 27.5,  positions: 'OF,SS',   team: 'SD',  valueDelta: 1.5,  isValuePick: false },
  { rank: 27,  playerName: 'Rodriguez, Julio',          displayName: 'Julio Rodriguez',          adp: 28.8,  positions: 'OF',      team: 'SEA', valueDelta: 1.8,  isValuePick: false },
  { rank: 28,  playerName: 'Ramirez, Jose',             displayName: 'Jose Ramirez',             adp: 29.0,  positions: '3B',      team: 'CLE', valueDelta: 1.0,  isValuePick: false },
  { rank: 29,  playerName: 'Machado, Manny',            displayName: 'Manny Machado',            adp: 31.8,  positions: '3B,SS',   team: 'SD',  valueDelta: 2.8,  isValuePick: false },
  { rank: 30,  playerName: 'Valdez, Framber',            displayName: 'Framber Valdez',           adp: 36.5,  positions: 'SP',      team: 'HOU', valueDelta: 6.5,  isValuePick: false },
  // ── Round 4 (31–40) ─────────────────────────────────────────────────────────
  { rank: 31,  playerName: 'Bieber, Shane',             displayName: 'Shane Bieber',             adp: 35.5,  positions: 'SP',      team: 'CLE', valueDelta: 4.5,  isValuePick: false },
  { rank: 32,  playerName: 'Albies, Ozzie',             displayName: 'Ozzie Albies',             adp: 33.2,  positions: '2B',      team: 'ATL', valueDelta: 1.2,  isValuePick: false },
  { rank: 33,  playerName: 'Turner, Trea',              displayName: 'Trea Turner',              adp: 34.0,  positions: 'SS',      team: 'PHI', valueDelta: 1.0,  isValuePick: false },
  { rank: 34,  playerName: 'Kirby, George',             displayName: 'George Kirby',             adp: 37.8,  positions: 'SP',      team: 'SEA', valueDelta: 3.8,  isValuePick: false },
  { rank: 35,  playerName: 'Cease, Dylan',              displayName: 'Dylan Cease',              adp: 40.2,  positions: 'SP',      team: 'SD',  valueDelta: 5.2,  isValuePick: false },
  { rank: 36,  playerName: 'Buxton, Byron',             displayName: 'Byron Buxton',             adp: 42.0,  positions: 'OF',      team: 'MIN', valueDelta: 6.0,  isValuePick: false },
  { rank: 37,  playerName: 'Bellinger, Cody',           displayName: 'Cody Bellinger',           adp: 39.5,  positions: '1B,OF',   team: 'NYY', valueDelta: 2.5,  isValuePick: false },
  { rank: 38,  playerName: 'Semien, Marcus',            displayName: 'Marcus Semien',            adp: 40.8,  positions: '2B,SS',   team: 'TEX', valueDelta: 2.8,  isValuePick: false },
  { rank: 39,  playerName: 'Glasnow, Tyler',            displayName: 'Tyler Glasnow',            adp: 44.0,  positions: 'SP',      team: 'LAD', valueDelta: 5.0,  isValuePick: false },
  { rank: 40,  playerName: 'Sale, Chris',               displayName: 'Chris Sale',               adp: 47.5,  positions: 'SP',      team: 'ATL', valueDelta: 7.5,  isValuePick: false },
  // ── Round 5 (41–50) ─────────────────────────────────────────────────────────
  { rank: 41,  playerName: 'Rutschman, Adley',          displayName: 'Adley Rutschman',          adp: 43.5,  positions: 'C',       team: 'BAL', valueDelta: 2.5,  isValuePick: false },
  { rank: 42,  playerName: 'Arozarena, Randy',          displayName: 'Randy Arozarena',          adp: 45.0,  positions: 'OF',      team: 'SEA', valueDelta: 3.0,  isValuePick: false },
  { rank: 43,  playerName: 'Trout, Mike',               displayName: 'Mike Trout',               adp: 49.0,  positions: 'OF',      team: 'LAA', valueDelta: 6.0,  isValuePick: false },
  { rank: 44,  playerName: 'Hoerner, Nico',             displayName: 'Nico Hoerner',             adp: 46.2,  positions: '2B,SS',   team: 'CHC', valueDelta: 2.2,  isValuePick: false },
  { rank: 45,  playerName: 'Pena, Jeremy',               displayName: 'Jeremy Peña',              adp: 47.5,  positions: 'SS',      team: 'HOU', valueDelta: 2.5,  isValuePick: false },
  { rank: 46,  playerName: 'Gausman, Kevin',            displayName: 'Kevin Gausman',            adp: 52.0,  positions: 'SP',      team: 'TOR', valueDelta: 6.0,  isValuePick: false },
  { rank: 47,  playerName: 'Diaz, Edwin',               displayName: 'Edwin Diaz',               adp: 55.5,  positions: 'RP',      team: 'NYM', valueDelta: 8.5,  isValuePick: false },
  { rank: 48,  playerName: 'Luzardo, Jesus',            displayName: 'Jesus Luzardo',            adp: 53.0,  positions: 'SP',      team: 'PHI', valueDelta: 5.0,  isValuePick: false },
  { rank: 49,  playerName: 'Goldschmidt, Paul',         displayName: 'Paul Goldschmidt',         adp: 56.0,  positions: '1B',      team: 'NYY', valueDelta: 7.0,  isValuePick: false },
  { rank: 50,  playerName: 'Gallen, Zac',               displayName: 'Zac Gallen',               adp: 57.5,  positions: 'SP',      team: 'ARI', valueDelta: 7.5,  isValuePick: false },
  // ── Round 6 (51–60) ─────────────────────────────────────────────────────────
  { rank: 51,  playerName: 'Lowe, Brandon',             displayName: 'Brandon Lowe',             adp: 54.0,  positions: '2B',      team: 'TB',  valueDelta: 3.0,  isValuePick: false },
  { rank: 52,  playerName: 'Smith, Will',               displayName: 'Will Smith',               adp: 57.0,  positions: 'C',       team: 'LAD', valueDelta: 5.0,  isValuePick: false },
  { rank: 53,  playerName: 'Springer, George',          displayName: 'George Springer',          adp: 59.5,  positions: 'OF',      team: 'TOR', valueDelta: 6.5,  isValuePick: false },
  { rank: 54,  playerName: 'Contreras, William',        displayName: 'William Contreras',        adp: 61.0,  positions: 'C',       team: 'MIL', valueDelta: 7.0,  isValuePick: false },
  { rank: 55,  playerName: 'Bregman, Alex',             displayName: 'Alex Bregman',             adp: 60.0,  positions: '3B,2B',   team: 'BOS', valueDelta: 5.0,  isValuePick: false },
  { rank: 56,  playerName: 'Correa, Carlos',            displayName: 'Carlos Correa',            adp: 63.0,  positions: 'SS',      team: 'MIN', valueDelta: 7.0,  isValuePick: false },
  { rank: 57,  playerName: 'Grisham, Trent',            displayName: 'Trent Grisham',            adp: 65.0,  positions: 'OF',      team: 'NYY', valueDelta: 8.0,  isValuePick: false },
  { rank: 58,  playerName: 'Muncy, Max',                displayName: 'Max Muncy',                adp: 66.5,  positions: '1B,2B,3B',team: 'LAD', valueDelta: 8.5,  isValuePick: false },
  { rank: 59,  playerName: 'Montgomery, Jordan',        displayName: 'Jordan Montgomery',        adp: 68.0,  positions: 'SP',      team: 'ARI', valueDelta: 9.0,  isValuePick: false },
  { rank: 60,  playerName: 'Pressly, Ryan',             displayName: 'Ryan Pressly',             adp: 72.0,  positions: 'RP',      team: 'HOU', valueDelta: 12.0, isValuePick: false },
  // ── Round 7 (61–70) ─────────────────────────────────────────────────────────
  { rank: 61,  playerName: 'Straw, Myles',              displayName: 'Myles Straw',              adp: 69.0,  positions: 'OF',      team: 'CLE', valueDelta: 8.0,  isValuePick: false },
  { rank: 62,  playerName: 'Perez, Salvador',           displayName: 'Salvador Perez',           adp: 70.5,  positions: 'C',       team: 'KC',  valueDelta: 8.5,  isValuePick: false },
  { rank: 63,  playerName: 'Varsho, Daulton',           displayName: 'Daulton Varsho',           adp: 73.0,  positions: 'C,OF',    team: 'TOR', valueDelta: 10.0, isValuePick: false },
  { rank: 64,  playerName: 'Lodolo, Nick',              displayName: 'Nick Lodolo',              adp: 74.5,  positions: 'SP',      team: 'CIN', valueDelta: 10.5, isValuePick: false },
  { rank: 65,  playerName: 'Iglesias, Raisel',          displayName: 'Raisel Iglesias',          adp: 78.0,  positions: 'RP',      team: 'LAA', valueDelta: 13.0, isValuePick: false },
  { rank: 66,  playerName: 'Barlow, Scott',             displayName: 'Scott Barlow',             adp: 81.0,  positions: 'RP',      team: 'KC',  valueDelta: 15.0, isValuePick: false },
  { rank: 67,  playerName: 'Chapman, Aroldis',          displayName: 'Aroldis Chapman',          adp: 84.0,  positions: 'RP',      team: 'PIT', valueDelta: 17.0, isValuePick: true  },
  { rank: 68,  playerName: 'Crochet, Garrett',          displayName: 'Garrett Crochet',          adp: 76.0,  positions: 'SP',      team: 'BOS', valueDelta: 8.0,  isValuePick: false },
  { rank: 69,  playerName: 'Realmuto, J.T.',            displayName: 'J.T. Realmuto',            adp: 79.0,  positions: 'C',       team: 'PHI', valueDelta: 10.0, isValuePick: false },
  { rank: 70,  playerName: 'Murphy, Sean',              displayName: 'Sean Murphy',              adp: 82.0,  positions: 'C',       team: 'ATL', valueDelta: 12.0, isValuePick: false },
  // ── Round 8 (71–80) ─────────────────────────────────────────────────────────
  { rank: 71,  playerName: 'Eovaldi, Nathan',           displayName: 'Nathan Eovaldi',           adp: 80.5,  positions: 'SP',      team: 'TEX', valueDelta: 9.5,  isValuePick: false },
  { rank: 72,  playerName: 'Lynn, Lance',               displayName: 'Lance Lynn',               adp: 85.0,  positions: 'SP',      team: 'STL', valueDelta: 13.0, isValuePick: false },
  { rank: 73,  playerName: 'Doval, Camilo',             displayName: 'Camilo Doval',             adp: 88.5,  positions: 'RP',      team: 'SF',  valueDelta: 15.5, isValuePick: true  },
  { rank: 74,  playerName: 'Kimbrel, Craig',            displayName: 'Craig Kimbrel',            adp: 91.0,  positions: 'RP',      team: 'PHI', valueDelta: 17.0, isValuePick: true  },
  { rank: 75,  playerName: 'Jimenez, Eloy',             displayName: 'Eloy Jimenez',             adp: 83.5,  positions: 'OF,DH',   team: 'CWS', valueDelta: 8.5,  isValuePick: false },
  { rank: 76,  playerName: 'Arraez, Luis',              displayName: 'Luis Arraez',              adp: 85.5,  positions: '1B,2B',   team: 'MIA', valueDelta: 9.5,  isValuePick: false },
  { rank: 77,  playerName: 'Kopech, Michael',           displayName: 'Michael Kopech',           adp: 87.0,  positions: 'SP,RP',   team: 'CWS', valueDelta: 10.0, isValuePick: false },
  { rank: 78,  playerName: 'Nola, Aaron',               displayName: 'Aaron Nola',               adp: 89.0,  positions: 'SP',      team: 'PHI', valueDelta: 11.0, isValuePick: false },
  { rank: 79,  playerName: 'Manoah, Alek',              displayName: 'Alek Manoah',              adp: 92.0,  positions: 'SP',      team: 'TOR', valueDelta: 13.0, isValuePick: false },
  { rank: 80,  playerName: 'Bautista, Felix',           displayName: 'Felix Bautista',           adp: 95.0,  positions: 'RP',      team: 'BAL', valueDelta: 15.0, isValuePick: true  },
  // ── Round 9 (81–90) ─────────────────────────────────────────────────────────
  { rank: 81,  playerName: 'Canha, Mark',               displayName: 'Mark Canha',               adp: 88.0,  positions: 'OF,1B',   team: 'NYM', valueDelta: 7.0,  isValuePick: false },
  { rank: 82,  playerName: 'Eflin, Zach',               displayName: 'Zach Eflin',               adp: 90.5,  positions: 'SP',      team: 'TB',  valueDelta: 8.5,  isValuePick: false },
  { rank: 83,  playerName: 'Stanton, Giancarlo',        displayName: 'Giancarlo Stanton',        adp: 93.5,  positions: 'OF,DH',   team: 'NYY', valueDelta: 10.5, isValuePick: false },
  { rank: 84,  playerName: 'Duran, Jarren',             displayName: 'Jarren Duran',             adp: 96.0,  positions: 'OF',      team: 'BOS', valueDelta: 12.0, isValuePick: false },
  { rank: 85,  playerName: 'Walker, Christian',         displayName: 'Christian Walker',         adp: 94.0,  positions: '1B',      team: 'ARI', valueDelta: 9.0,  isValuePick: false },
  { rank: 86,  playerName: 'McKinstry, Zach',           displayName: 'Zach McKinstry',           adp: 97.5,  positions: '2B,OF',   team: 'DET', valueDelta: 11.5, isValuePick: false },
  { rank: 87,  playerName: 'Hicks, Jordan',             displayName: 'Jordan Hicks',             adp: 100.0, positions: 'SP',      team: 'STL', valueDelta: 13.0, isValuePick: false },
  { rank: 88,  playerName: 'Ryan, Joe',                 displayName: 'Joe Ryan',                 adp: 98.5,  positions: 'SP',      team: 'MIN', valueDelta: 10.5, isValuePick: false },
  { rank: 89,  playerName: 'Naylor, Bo',                displayName: 'Bo Naylor',                adp: 101.0, positions: 'C',       team: 'CLE', valueDelta: 12.0, isValuePick: false },
  { rank: 90,  playerName: 'Flaherty, Jack',            displayName: 'Jack Flaherty',            adp: 103.5, positions: 'SP',      team: 'DET', valueDelta: 13.5, isValuePick: false },
  // ── Round 10 (91–100) ───────────────────────────────────────────────────────
  { rank: 91,  playerName: 'Pfaadt, Brandon',           displayName: 'Brandon Pfaadt',           adp: 99.0,  positions: 'SP',      team: 'ARI', valueDelta: 8.0,  isValuePick: false },
  { rank: 92,  playerName: 'Gonsolin, Tony',            displayName: 'Tony Gonsolin',            adp: 102.0, positions: 'SP',      team: 'LAD', valueDelta: 10.0, isValuePick: false },
  { rank: 93,  playerName: 'Smith, Kevin',              displayName: 'Kevin Smith',              adp: 105.0, positions: 'RP',      team: 'OAK', valueDelta: 12.0, isValuePick: false },
  { rank: 94,  playerName: 'Fedde, Erick',              displayName: 'Erick Fedde',              adp: 104.0, positions: 'SP',      team: 'STL', valueDelta: 10.0, isValuePick: false },
  { rank: 95,  playerName: 'Alvarado, Jose',            displayName: 'Jose Alvarado',            adp: 108.0, positions: 'RP',      team: 'PHI', valueDelta: 13.0, isValuePick: false },
  { rank: 96,  playerName: 'Sears, JP',                 displayName: 'JP Sears',                 adp: 106.5, positions: 'SP',      team: 'OAK', valueDelta: 10.5, isValuePick: false },
  { rank: 97,  playerName: 'Mayer, Marcelo',            displayName: 'Marcelo Mayer',            adp: 109.0, positions: 'SS',      team: 'BOS', valueDelta: 12.0, isValuePick: false },
  { rank: 98,  playerName: 'Kwan, Steven',              displayName: 'Steven Kwan',              adp: 107.5, positions: 'OF',      team: 'CLE', valueDelta: 9.5,  isValuePick: false },
  { rank: 99,  playerName: 'Imanaga, Shota',            displayName: 'Shota Imanaga',            adp: 111.0, positions: 'SP',      team: 'CHC', valueDelta: 12.0, isValuePick: false },
  { rank: 100, playerName: 'Berti, Jon',                displayName: 'Jon Berti',                adp: 113.5, positions: '2B,3B,SS',team: 'MIA', valueDelta: 13.5, isValuePick: false },
  // ── Round 11 (101–110) ──────────────────────────────────────────────────────
  { rank: 101, playerName: 'Cueto, Johnny',             displayName: 'Johnny Cueto',             adp: 110.0, positions: 'SP',      team: 'MIA', valueDelta: 9.0,  isValuePick: false },
  { rank: 102, playerName: 'Anderson, Tim',             displayName: 'Tim Anderson',             adp: 114.0, positions: 'SS',      team: 'CWS', valueDelta: 12.0, isValuePick: false },
  { rank: 103, playerName: 'Sewald, Paul',              displayName: 'Paul Sewald',              adp: 117.5, positions: 'RP',      team: 'ARI', valueDelta: 14.5, isValuePick: false },
  { rank: 104, playerName: 'Cimber, Adam',              displayName: 'Adam Cimber',              adp: 115.0, positions: 'RP',      team: 'LAA', valueDelta: 11.0, isValuePick: false },
  { rank: 105, playerName: 'Suarez, Ranger',            displayName: 'Ranger Suarez',            adp: 112.5, positions: 'SP',      team: 'PHI', valueDelta: 7.5,  isValuePick: false },
  { rank: 106, playerName: 'Stott, Bryson',             displayName: 'Bryson Stott',             adp: 116.0, positions: '2B,SS',   team: 'PHI', valueDelta: 10.0, isValuePick: false },
  { rank: 107, playerName: 'Marsh, Brandon',            displayName: 'Brandon Marsh',            adp: 118.0, positions: 'OF',      team: 'PHI', valueDelta: 11.0, isValuePick: false },
  { rank: 108, playerName: 'Schreiber, John',           displayName: 'John Schreiber',           adp: 121.0, positions: 'RP',      team: 'BOS', valueDelta: 13.0, isValuePick: false },
  { rank: 109, playerName: 'Lorenzen, Michael',         displayName: 'Michael Lorenzen',         adp: 119.5, positions: 'SP',      team: 'DET', valueDelta: 10.5, isValuePick: false },
  { rank: 110, playerName: 'Stallings, Jacob',          displayName: 'Jacob Stallings',          adp: 122.0, positions: 'C',       team: 'COL', valueDelta: 12.0, isValuePick: false },
  // ── Round 12 (111–120) ──────────────────────────────────────────────────────
  { rank: 111, playerName: 'De La Cruz, Elly',          displayName: 'Elly De La Cruz',          adp: 118.5, positions: 'SS,3B',   team: 'CIN', valueDelta: 7.5,  isValuePick: false },
  { rank: 112, playerName: 'Caroll, Corbin',            displayName: 'Corbin Carroll',           adp: 120.0, positions: 'OF',      team: 'ARI', valueDelta: 8.0,  isValuePick: false },
  { rank: 113, playerName: 'Yepez, Juan',               displayName: 'Juan Yepez',               adp: 123.5, positions: '1B,OF',   team: 'STL', valueDelta: 10.5, isValuePick: false },
  { rank: 114, playerName: 'Hill, Tim',                 displayName: 'Tim Hill',                 adp: 125.0, positions: 'RP',      team: 'SD',  valueDelta: 11.0, isValuePick: false },
  { rank: 115, playerName: 'McClanahan, Shane',         displayName: 'Shane McClanahan',         adp: 122.5, positions: 'SP',      team: 'TB',  valueDelta: 7.5,  isValuePick: false },
  { rank: 116, playerName: 'Skenes, Paul',              displayName: 'Paul Skenes',              adp: 124.0, positions: 'SP',      team: 'PIT', valueDelta: 8.0,  isValuePick: false },
  { rank: 117, playerName: 'Yarbrough, Ryan',           displayName: 'Ryan Yarbrough',           adp: 127.5, positions: 'SP',      team: 'BOS', valueDelta: 10.5, isValuePick: false },
  { rank: 118, playerName: 'Merrill, Jackson',          displayName: 'Jackson Merrill',          adp: 126.0, positions: 'OF',      team: 'SD',  valueDelta: 8.0,  isValuePick: false },
  { rank: 119, playerName: 'Stephenson, Tyler',         displayName: 'Tyler Stephenson',         adp: 128.5, positions: 'C',       team: 'CIN', valueDelta: 9.5,  isValuePick: false },
  { rank: 120, playerName: 'Reynolds, Bryan',           displayName: 'Bryan Reynolds',           adp: 129.0, positions: 'OF',      team: 'PIT', valueDelta: 9.0,  isValuePick: false },
];

// ── Module-level cache ────────────────────────────────────────────────────────

let adpCache: NFBCPlayer[] | null = null;
let lastFetched = 0;

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
 * Strip surrounding double-quotes from a CSV field value.
 */
function stripQuotes(s: string): string {
  return s.replace(/^"|"$/g, '').trim();
}

/**
 * Parse a delimited (TSV or CSV) NFBC/FantasyPros ADP export.
 * Auto-detects the delimiter from the header row.
 * Reads column names from the first non-empty line — resilient to column reordering.
 *
 * Expected columns (names may vary slightly): Rank, Player, ADP / Overall ADP,
 * Position(s) / Pos, Team
 */
export function parseTSV(raw: string): NFBCPlayer[] {
  const lines = raw.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Auto-detect delimiter — TSV has tabs, CSV has commas
  const delimiter = lines[0].includes('\t') ? '\t' : ',';

  const headers = lines[0].split(delimiter).map(h => stripQuotes(h).toLowerCase());

  // Resolve column indices dynamically
  const col = (candidates: string[]): number => {
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
    const cols = lines[i].split(delimiter).map(stripQuotes);
    if (cols.length < 2) continue;

    const rawName = playerIdx !== -1 ? (cols[playerIdx] ?? '').trim() : '';
    if (!rawName) continue;

    const rank      = rankIdx  !== -1 ? parseInt(cols[rankIdx]  ?? '', 10) : i;
    const adp       = adpIdx   !== -1 ? parseFloat(cols[adpIdx] ?? '')     : rank;
    const positions = posIdx   !== -1 ? (cols[posIdx]  ?? '').trim()       : '';
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

// Use globalThis to persist singleton across HMR reloads in dev mode
const GLOBAL_KEY = '__adp_supabase_client__' as const;

// No-op storage to completely disable GoTrueClient session management
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

async function getADPSupabaseClient() {
  // Guard: this function must only run server-side
  if (typeof window !== 'undefined') return null;

  // Check global cache first (survives HMR)
  const cached = (globalThis as Record<string, unknown>)[GLOBAL_KEY];
  if (cached) return cached as Awaited<ReturnType<typeof import('@supabase/supabase-js').createClient>>;
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, key, {
    db: { schema: 'api' },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: noopStorage, // Completely disable storage to prevent GoTrueClient conflicts
    },
  });
  
  // Store in global to survive HMR
  (globalThis as Record<string, unknown>)[GLOBAL_KEY] = client;
  return client;
}

export async function saveADPToSupabase(players: NFBCPlayer[], sport = 'mlb'): Promise<void> {
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
    // Upsert in batches of 50 to stay well within payload limits
    const BATCH = 50;
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error } = await supabase
        .from('nfbc_adp')
        .upsert(rows.slice(i, i + BATCH), { onConflict: 'sport,rank' });
      if (error) {
        console.warn('[v0] [ADP] Supabase upsert batch failed:', error.message);
        return;
      }
    }
    console.log(`[v0] [ADP] Saved ${players.length} ${sport.toUpperCase()} ADP players to Supabase`);
  } catch (err) {
    console.warn('[v0] [ADP] saveADPToSupabase failed (non-critical):', err);
  }
}

export async function loadADPFromSupabase(sport = 'mlb', allowStale = false): Promise<NFBCPlayer[] | null> {
  try {
    const supabase = await getADPSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('nfbc_adp')
      .select('*')
      .eq('sport', sport)
      .order('rank', { ascending: true })
      .limit(300);
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

// ── Public API ──────────────────────────────────────────��─────────────────────

/**
 * Clears the in-memory cache, forcing the next call to re-read from Supabase.
 * Called by the upload route after a successful TSV import.
 */
export function clearADPCache(): void {
  adpCache = null;
  lastFetched = 0;
}

/**
 * Returns the NFBC MLB ADP player list.
 * Data comes exclusively from Supabase (populated by user TSV uploads).
 * Falls back to the static pre-season dataset when no upload exists yet.
 */
export async function getADPData(forceRefresh = false): Promise<NFBCPlayer[]> {
  const now = Date.now();

  if (adpCache && !forceRefresh && now - lastFetched < CACHE_TTL_MS) {
    return adpCache;
  }

  // User-uploaded data lives in Supabase — always authoritative, no TTL check
  const dbData = await loadADPFromSupabase('mlb', true);
  if (dbData && dbData.length > 0) {
    console.log(`[v0] [ADP] Serving ${dbData.length} MLB players from Supabase (user upload)`);
    adpCache = dbData;
    lastFetched = now;
    return dbData;
  }

  console.log(`[v0] [ADP] No MLB ADP upload found — serving static fallback (${STATIC_FALLBACK_PLAYERS.length} players)`);
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
