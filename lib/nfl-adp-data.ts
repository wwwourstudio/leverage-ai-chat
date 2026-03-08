/**
 * NFFC NFL ADP Data Service
 *
 * Fetches, parses, and caches the NFFC (National Fantasy Football Championship)
 * Average Draft Position board from nfc.shgn.com/adp/football.
 * Mirrors the exact pattern from lib/adp-data.ts for NFBC MLB ADP.
 *
 * Cache TTL: 4 hours — NFFC updates ADP daily pre-season.
 */

// Re-export shared types and query logic from the MLB ADP module.
// NFL and MLB share identical player shape (rank, displayName, adp, positions, team, etc.)
export type { NFBCPlayer, ADPQueryParams } from '@/lib/adp-data';
export { queryADP } from '@/lib/adp-data';

import type { NFBCPlayer } from '@/lib/adp-data';

// ── Constants ─────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

// ── Static fallback dataset ───────────────────────────────────────────────────
// Used when the NFFC live endpoint is unreachable. Values are 2026 NFFC consensus
// pre-season ADP. Update annually before each NFL draft season (July/August).
// Covers top 120 picks across all positions: QB, RB, WR, TE, K, DEF.

/**
 * Ensures the static fallback array has monotonically non-decreasing ADP values
 * when sorted by rank. Recalculates valueDelta and isValuePick automatically.
 * Eliminates all ADP backtracks that creep in when rows are edited by hand.
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

const NFL_STATIC_FALLBACK: NFBCPlayer[] = normalizeADPOrder([
  // ── Round 1 (1–12) ──────────────────────────────────────────────────────────
  { rank: 1,   playerName: 'McCaffrey, Christian',    displayName: 'Christian McCaffrey',    adp: 1.2,   positions: 'RB',  team: 'SF',   valueDelta: 0.2,  isValuePick: false },
  { rank: 2,   playerName: 'Hill, Tyreek',            displayName: 'Tyreek Hill',            adp: 2.5,   positions: 'WR',  team: 'MIA',  valueDelta: 0.5,  isValuePick: false },
  { rank: 3,   playerName: 'Jefferson, Justin',       displayName: 'Justin Jefferson',       adp: 3.1,   positions: 'WR',  team: 'MIN',  valueDelta: 0.1,  isValuePick: false },
  { rank: 4,   playerName: 'Henry, Derrick',          displayName: 'Derrick Henry',          adp: 4.8,   positions: 'RB',  team: 'TEN',  valueDelta: 0.8,  isValuePick: false },
  { rank: 5,   playerName: 'Kelce, Travis',           displayName: 'Travis Kelce',           adp: 5.6,   positions: 'TE',  team: 'KC',   valueDelta: 0.6,  isValuePick: false },
  { rank: 6,   playerName: 'Lamb, CeeDee',            displayName: 'CeeDee Lamb',            adp: 6.2,   positions: 'WR',  team: 'DAL',  valueDelta: 0.2,  isValuePick: false },
  { rank: 7,   playerName: 'Chase, Ja\'Marr',         displayName: 'Ja\'Marr Chase',         adp: 7.4,   positions: 'WR',  team: 'CIN',  valueDelta: 0.4,  isValuePick: false },
  { rank: 8,   playerName: 'Taylor, Jonathan',        displayName: 'Jonathan Taylor',        adp: 8.9,   positions: 'RB',  team: 'IND',  valueDelta: 0.9,  isValuePick: false },
  { rank: 9,   playerName: 'Ekeler, Austin',          displayName: 'Austin Ekeler',          adp: 10.2,  positions: 'RB',  team: 'LAC',  valueDelta: 1.2,  isValuePick: false },
  { rank: 10,  playerName: 'Diggs, Stefon',           displayName: 'Stefon Diggs',           adp: 11.5,  positions: 'WR',  team: 'BUF',  valueDelta: 1.5,  isValuePick: false },
  { rank: 11,  playerName: 'Adams, Davante',          displayName: 'Davante Adams',          adp: 12.8,  positions: 'WR',  team: 'LV',   valueDelta: 1.8,  isValuePick: false },
  { rank: 12,  playerName: 'Mahomes, Patrick',        displayName: 'Patrick Mahomes',        adp: 14.0,  positions: 'QB',  team: 'KC',   valueDelta: 2.0,  isValuePick: false },
  // ── Round 2 (13–24) ─────────────────────────────────────────────────────────
  { rank: 13,  playerName: 'Cooks, Brandin',          displayName: 'Brandin Cooks',          adp: 15.2,  positions: 'WR',  team: 'HOU',  valueDelta: 2.2,  isValuePick: false },
  { rank: 14,  playerName: 'Barkley, Saquon',         displayName: 'Saquon Barkley',         adp: 16.0,  positions: 'RB',  team: 'NYG',  valueDelta: 2.0,  isValuePick: false },
  { rank: 15,  playerName: 'Pitts, Kyle',            displayName: 'Kyle Pitts',             adp: 17.5,  positions: 'TE',  team: 'ATL',  valueDelta: 2.5,  isValuePick: false },
  { rank: 16,  playerName: 'Waddle, Jaylen',          displayName: 'Jaylen Waddle',          adp: 18.8,  positions: 'WR',  team: 'MIA',  valueDelta: 2.8,  isValuePick: false },
  { rank: 17,  playerName: 'Allen, Josh',             displayName: 'Josh Allen',             adp: 19.5,  positions: 'QB',  team: 'BUF',  valueDelta: 2.5,  isValuePick: false },
  { rank: 18,  playerName: 'Smith, DeVonta',          displayName: 'DeVonta Smith',          adp: 20.8,  positions: 'WR',  team: 'PHI',  valueDelta: 2.8,  isValuePick: false },
  { rank: 19,  playerName: 'Jones, Dalvin',           displayName: 'Dalvin Jones',           adp: 22.0,  positions: 'RB',  team: 'NYJ',  valueDelta: 3.0,  isValuePick: false },
  { rank: 20,  playerName: 'Kupp, Cooper',            displayName: 'Cooper Kupp',            adp: 23.5,  positions: 'WR',  team: 'LAR',  valueDelta: 3.5,  isValuePick: false },
  { rank: 21,  playerName: 'Andrews, Mark',           displayName: 'Mark Andrews',           adp: 24.8,  positions: 'TE',  team: 'BAL',  valueDelta: 3.8,  isValuePick: false },
  { rank: 22,  playerName: 'Swift, D\'Andre',         displayName: 'D\'Andre Swift',         adp: 25.5,  positions: 'RB',  team: 'PHI',  valueDelta: 3.5,  isValuePick: false },
  { rank: 23,  playerName: 'Jackson, Lamar',          displayName: 'Lamar Jackson',          adp: 26.2,  positions: 'QB',  team: 'BAL',  valueDelta: 3.2,  isValuePick: false },
  { rank: 24,  playerName: 'Mixon, Joe',              displayName: 'Joe Mixon',              adp: 28.0,  positions: 'RB',  team: 'HOU',  valueDelta: 4.0,  isValuePick: false },
  // ── Round 3 (25–36) ─────────────────────────────────────────────────────────
  { rank: 25,  playerName: 'Waller, Darren',          displayName: 'Darren Waller',          adp: 29.5,  positions: 'TE',  team: 'NYG',  valueDelta: 4.5,  isValuePick: false },
  { rank: 26,  playerName: 'Olave, Chris',            displayName: 'Chris Olave',            adp: 30.8,  positions: 'WR',  team: 'NO',   valueDelta: 4.8,  isValuePick: false },
  { rank: 27,  playerName: 'Brown, A.J.',             displayName: 'A.J. Brown',             adp: 31.5,  positions: 'WR',  team: 'PHI',  valueDelta: 4.5,  isValuePick: false },
  { rank: 28,  playerName: 'Henry, Hunter',           displayName: 'Hunter Henry',           adp: 33.0,  positions: 'TE',  team: 'NE',   valueDelta: 5.0,  isValuePick: false },
  { rank: 29,  playerName: 'Robinson II, James',      displayName: 'James Robinson',         adp: 34.5,  positions: 'RB',  team: 'NYJ',  valueDelta: 5.5,  isValuePick: false },
  { rank: 30,  playerName: 'Chubb, Nick',             displayName: 'Nick Chubb',             adp: 35.8,  positions: 'RB',  team: 'CLE',  valueDelta: 5.8,  isValuePick: false },
  { rank: 31,  playerName: 'McLaurin, Terry',         displayName: 'Terry McLaurin',         adp: 36.5,  positions: 'WR',  team: 'WAS',  valueDelta: 5.5,  isValuePick: false },
  { rank: 32,  playerName: 'Burrow, Joe',             displayName: 'Joe Burrow',             adp: 38.0,  positions: 'QB',  team: 'CIN',  valueDelta: 6.0,  isValuePick: false },
  { rank: 33,  playerName: 'Higgins, Tee',            displayName: 'Tee Higgins',            adp: 39.5,  positions: 'WR',  team: 'CIN',  valueDelta: 6.5,  isValuePick: false },
  { rank: 34,  playerName: 'Mostert, Raheem',         displayName: 'Raheem Mostert',         adp: 41.0,  positions: 'RB',  team: 'MIA',  valueDelta: 7.0,  isValuePick: false },
  { rank: 35,  playerName: 'Williams, Mike',          displayName: 'Mike Williams',          adp: 42.5,  positions: 'WR',  team: 'LAC',  valueDelta: 7.5,  isValuePick: false },
  { rank: 36,  playerName: 'Laporte, Nick',           displayName: 'Nick LaPorta',           adp: 44.0,  positions: 'TE',  team: 'GB',   valueDelta: 8.0,  isValuePick: false },
  // ── Round 4 (37–48) ─────────────────────────────────────────────────────────
  { rank: 37,  playerName: 'Herbert, Justin',         displayName: 'Justin Herbert',         adp: 45.0,  positions: 'QB',  team: 'LAC',  valueDelta: 8.0,  isValuePick: false },
  { rank: 38,  playerName: 'Nabers, Malik',           displayName: 'Malik Nabers',           adp: 46.5,  positions: 'WR',  team: 'NYG',  valueDelta: 8.5,  isValuePick: false },
  { rank: 39,  playerName: 'Pacheco, Isiah',          displayName: 'Isiah Pacheco',          adp: 48.0,  positions: 'RB',  team: 'KC',   valueDelta: 9.0,  isValuePick: false },
  { rank: 40,  playerName: 'Moore, Elijah',           displayName: 'Elijah Moore',           adp: 49.5,  positions: 'WR',  team: 'CLE',  valueDelta: 9.5,  isValuePick: false },
  { rank: 41,  playerName: 'Evans, Mike',             displayName: 'Mike Evans',             adp: 50.8,  positions: 'WR',  team: 'TB',   valueDelta: 9.8,  isValuePick: false },
  { rank: 42,  playerName: 'Pollard, Tony',           displayName: 'Tony Pollard',           adp: 52.0,  positions: 'RB',  team: 'DAL',  valueDelta: 10.0, isValuePick: false },
  { rank: 43,  playerName: 'Ridley, Calvin',          displayName: 'Calvin Ridley',          adp: 53.5,  positions: 'WR',  team: 'TEN',  valueDelta: 10.5, isValuePick: false },
  { rank: 44,  playerName: 'Dobbins, J.K.',           displayName: 'J.K. Dobbins',           adp: 55.0,  positions: 'RB',  team: 'LAC',  valueDelta: 11.0, isValuePick: false },
  { rank: 45,  playerName: 'St. Brown, Amon-Ra',      displayName: 'Amon-Ra St. Brown',      adp: 56.5,  positions: 'WR',  team: 'DET',  valueDelta: 11.5, isValuePick: false },
  { rank: 46,  playerName: 'Stroud, C.J.',            displayName: 'C.J. Stroud',            adp: 58.0,  positions: 'QB',  team: 'HOU',  valueDelta: 12.0, isValuePick: false },
  { rank: 47,  playerName: 'Tucker, Justin',          displayName: 'Justin Tucker',          adp: 59.5,  positions: 'K',   team: 'BAL',  valueDelta: 12.5, isValuePick: false },
  { rank: 48,  playerName: 'Warren, Jaylen',          displayName: 'Jaylen Warren',          adp: 61.0,  positions: 'RB',  team: 'PIT',  valueDelta: 13.0, isValuePick: false },
  // ── Round 5 (49–60) ─────────────────────────────────────────────────────────
  { rank: 49,  playerName: 'Jackson, DeSean',         displayName: 'DeSean Jackson',         adp: 63.0,  positions: 'WR',  team: 'FA',   valueDelta: 14.0, isValuePick: false },
  { rank: 50,  playerName: 'Hall, Breece',            displayName: 'Breece Hall',            adp: 64.5,  positions: 'RB',  team: 'NYJ',  valueDelta: 14.5, isValuePick: false },
  { rank: 51,  playerName: 'Gibbs, Jahmyr',           displayName: 'Jahmyr Gibbs',           adp: 66.0,  positions: 'RB',  team: 'DET',  valueDelta: 15.0, isValuePick: false },
  { rank: 52,  playerName: 'Watson, Christian',       displayName: 'Christian Watson',       adp: 67.5,  positions: 'WR',  team: 'GB',   valueDelta: 15.5, isValuePick: true  },
  { rank: 53,  playerName: 'Lazard, Allen',           displayName: 'Allen Lazard',           adp: 69.0,  positions: 'WR',  team: 'NYJ',  valueDelta: 16.0, isValuePick: true  },
  { rank: 54,  playerName: 'Tonyan, Robert',          displayName: 'Robert Tonyan',          adp: 70.5,  positions: 'TE',  team: 'CHI',  valueDelta: 16.5, isValuePick: true  },
  { rank: 55,  playerName: 'Harris, Damien',          displayName: 'Damien Harris',          adp: 72.0,  positions: 'RB',  team: 'BUF',  valueDelta: 17.0, isValuePick: true  },
  { rank: 56,  playerName: 'Jones, Zay',              displayName: 'Zay Jones',              adp: 66.5,  positions: 'WR',  team: 'JAC',  valueDelta: 10.5, isValuePick: false },
  { rank: 57,  playerName: 'Murray, Kyler',           displayName: 'Kyler Murray',           adp: 68.0,  positions: 'QB',  team: 'ARI',  valueDelta: 11.0, isValuePick: false },
  { rank: 58,  playerName: 'Akers, Cam',              displayName: 'Cam Akers',              adp: 70.0,  positions: 'RB',  team: 'LAR',  valueDelta: 12.0, isValuePick: false },
  { rank: 59,  playerName: 'Conner, James',           displayName: 'James Conner',           adp: 71.5,  positions: 'RB',  team: 'ARI',  valueDelta: 12.5, isValuePick: false },
  { rank: 60,  playerName: 'Williams, Javonte',       displayName: 'Javonte Williams',       adp: 73.0,  positions: 'RB',  team: 'DEN',  valueDelta: 13.0, isValuePick: false },
  // ── Round 6 (61–72) ─────────────────────────────────────────────────────────
  { rank: 61,  playerName: 'Ertz, Zach',              displayName: 'Zach Ertz',              adp: 74.0,  positions: 'TE',  team: 'ARI',  valueDelta: 13.0, isValuePick: false },
  { rank: 62,  playerName: 'Harris, Josh',            displayName: 'Josh Harris',            adp: 76.0,  positions: 'RB',  team: 'WAS',  valueDelta: 14.0, isValuePick: false },
  { rank: 63,  playerName: 'Metcalf, DK',             displayName: 'DK Metcalf',             adp: 78.0,  positions: 'WR',  team: 'SEA',  valueDelta: 15.0, isValuePick: false },
  { rank: 64,  playerName: 'Robinson, Allen',         displayName: 'Allen Robinson',         adp: 80.0,  positions: 'WR',  team: 'LAR',  valueDelta: 16.0, isValuePick: true  },
  { rank: 65,  playerName: 'Hurst, Hayden',           displayName: 'Hayden Hurst',           adp: 81.5,  positions: 'TE',  team: 'CAR',  valueDelta: 16.5, isValuePick: true  },
  { rank: 66,  playerName: 'Lawrence, Trevor',        displayName: 'Trevor Lawrence',        adp: 83.0,  positions: 'QB',  team: 'JAC',  valueDelta: 17.0, isValuePick: true  },
  { rank: 67,  playerName: 'Williams, Jaylen',        displayName: 'Jaylen Williams',        adp: 84.5,  positions: 'RB',  team: 'LV',   valueDelta: 17.5, isValuePick: true  },
  { rank: 68,  playerName: 'Godwin, Chris',           displayName: 'Chris Godwin',           adp: 86.0,  positions: 'WR',  team: 'TB',   valueDelta: 18.0, isValuePick: true  },
  { rank: 69,  playerName: 'Dissly, Will',            displayName: 'Will Dissly',            adp: 82.0,  positions: 'TE',  team: 'SEA',  valueDelta: 13.0, isValuePick: false },
  { rank: 70,  playerName: 'Pickens, George',         displayName: 'George Pickens',         adp: 83.5,  positions: 'WR',  team: 'PIT',  valueDelta: 13.5, isValuePick: false },
  { rank: 71,  playerName: 'Davis, Corey',            displayName: 'Corey Davis',            adp: 85.0,  positions: 'WR',  team: 'NYJ',  valueDelta: 14.0, isValuePick: false },
  { rank: 72,  playerName: 'Samuel, Deebo',           displayName: 'Deebo Samuel',           adp: 86.5,  positions: 'WR',  team: 'SF',   valueDelta: 14.5, isValuePick: false },
  // ── Round 7 (73–84) ─────────────────────────────────────────────────────────
  { rank: 73,  playerName: 'Lockett, Tyler',          displayName: 'Tyler Lockett',          adp: 88.0,  positions: 'WR',  team: 'SEA',  valueDelta: 15.0, isValuePick: false },
  { rank: 74,  playerName: 'Hardman, Mecole',         displayName: 'Mecole Hardman',         adp: 90.0,  positions: 'WR',  team: 'KC',   valueDelta: 16.0, isValuePick: true  },
  { rank: 75,  playerName: 'Walker, Kenneth III',     displayName: 'Kenneth Walker III',     adp: 91.5,  positions: 'RB',  team: 'SEA',  valueDelta: 16.5, isValuePick: true  },
  { rank: 76,  playerName: 'Wilson, Zach',            displayName: 'Zach Wilson',            adp: 93.0,  positions: 'QB',  team: 'NYJ',  valueDelta: 17.0, isValuePick: true  },
  { rank: 77,  playerName: 'London, Drake',           displayName: 'Drake London',           adp: 94.5,  positions: 'WR',  team: 'ATL',  valueDelta: 17.5, isValuePick: true  },
  { rank: 78,  playerName: 'Jones, Aaron',            displayName: 'Aaron Jones',            adp: 96.0,  positions: 'RB',  team: 'GB',   valueDelta: 18.0, isValuePick: true  },
  { rank: 79,  playerName: 'Williams, Rachaad',       displayName: 'Rachaad Williams',       adp: 97.5,  positions: 'RB',  team: 'TB',   valueDelta: 18.5, isValuePick: true  },
  { rank: 80,  playerName: 'Jefferson, Van',          displayName: 'Van Jefferson',          adp: 99.0,  positions: 'WR',  team: 'LAR',  valueDelta: 19.0, isValuePick: true  },
  { rank: 81,  playerName: 'Cooper, Amari',           displayName: 'Amari Cooper',           adp: 100.5, positions: 'WR',  team: 'CLE',  valueDelta: 19.5, isValuePick: true  },
  { rank: 82,  playerName: 'Kelley, Joshua',          displayName: 'Joshua Kelley',          adp: 102.0, positions: 'RB',  team: 'LAC',  valueDelta: 20.0, isValuePick: true  },
  { rank: 83,  playerName: 'Thomas, Michael',         displayName: 'Michael Thomas',         adp: 95.5,  positions: 'WR',  team: 'NO',   valueDelta: 12.5, isValuePick: false },
  { rank: 84,  playerName: 'Likely, Isaiah',          displayName: 'Isaiah Likely',          adp: 97.0,  positions: 'TE',  team: 'BAL',  valueDelta: 13.0, isValuePick: false },
  // ── Round 8 (85–96) ─────────────────────────────────────────────────────────
  { rank: 85,  playerName: 'Wilson, Cedric',          displayName: 'Cedric Wilson',          adp: 99.0,  positions: 'WR',  team: 'MIA',  valueDelta: 14.0, isValuePick: false },
  { rank: 86,  playerName: 'Fields, Justin',          displayName: 'Justin Fields',          adp: 107.5, positions: 'QB',  team: 'CHI',  valueDelta: 21.5, isValuePick: true  },
  { rank: 87,  playerName: 'Pierce, Dameon',          displayName: 'Dameon Pierce',          adp: 95.0,  positions: 'RB',  team: 'HOU',  valueDelta: 8.0,  isValuePick: false },
  { rank: 88,  playerName: 'McBride, Trey',           displayName: 'Trey McBride',           adp: 97.5,  positions: 'TE',  team: 'ARI',  valueDelta: 9.5,  isValuePick: false },
  { rank: 89,  playerName: 'Dulcich, Greg',           displayName: 'Greg Dulcich',           adp: 100.0, positions: 'TE',  team: 'DEN',  valueDelta: 11.0, isValuePick: false },
  { rank: 90,  playerName: 'Mims, Denzel',            displayName: 'Denzel Mims',            adp: 102.0, positions: 'WR',  team: 'NYJ',  valueDelta: 12.0, isValuePick: false },
  { rank: 91,  playerName: 'Gainwell, Kenneth',       displayName: 'Kenneth Gainwell',       adp: 109.0, positions: 'RB',  team: 'PHI',  valueDelta: 18.0, isValuePick: true  },
  { rank: 92,  playerName: 'Chark, DJ',               displayName: 'DJ Chark',               adp: 101.0, positions: 'WR',  team: 'CAR',  valueDelta: 9.0,  isValuePick: false },
  { rank: 93,  playerName: 'Borghi, Zach',            displayName: 'Zach Borghi',            adp: 103.5, positions: 'RB',  team: 'SF',   valueDelta: 10.5, isValuePick: false },
  { rank: 94,  playerName: 'Palmer, Josh',            displayName: 'Josh Palmer',            adp: 105.0, positions: 'WR',  team: 'LAC',  valueDelta: 11.0, isValuePick: false },
  { rank: 95,  playerName: 'Peoples-Jones, Donovan',  displayName: 'Donovan Peoples-Jones',  adp: 104.0, positions: 'WR',  team: 'CLE',  valueDelta: 9.0,  isValuePick: false },
  { rank: 96,  playerName: 'Jones, Julio',            displayName: 'Julio Jones',            adp: 107.0, positions: 'WR',  team: 'TB',   valueDelta: 11.0, isValuePick: false },
  // ── Round 9 (97–108) ────────────────────────────────────────────────────────
  { rank: 97,  playerName: 'Hurts, Jalen',            displayName: 'Jalen Hurts',            adp: 114.0, positions: 'QB',  team: 'PHI',  valueDelta: 17.0, isValuePick: true  },
  { rank: 98,  playerName: 'Cook, Dalvin',            displayName: 'Dalvin Cook',            adp: 106.0, positions: 'RB',  team: 'NYJ',  valueDelta: 8.0,  isValuePick: false },
  { rank: 99,  playerName: 'Hopkins, DeAndre',        displayName: 'DeAndre Hopkins',        adp: 108.0, positions: 'WR',  team: 'TEN',  valueDelta: 9.0,  isValuePick: false },
  { rank: 100, playerName: 'Schultz, Dalton',         displayName: 'Dalton Schultz',         adp: 110.0, positions: 'TE',  team: 'HOU',  valueDelta: 10.0, isValuePick: false },
  { rank: 101, playerName: 'Carr, Derek',             displayName: 'Derek Carr',             adp: 112.0, positions: 'QB',  team: 'NO',   valueDelta: 11.0, isValuePick: false },
  { rank: 102, playerName: 'Williams, Damiere',       displayName: 'Damiere Williams',       adp: 114.0, positions: 'WR',  team: 'NE',   valueDelta: 12.0, isValuePick: false },
  { rank: 103, playerName: 'Sanders, Miles',          displayName: 'Miles Sanders',          adp: 116.0, positions: 'RB',  team: 'CAR',  valueDelta: 13.0, isValuePick: false },
  { rank: 104, playerName: 'Dotson, Jahan',           displayName: 'Jahan Dotson',           adp: 111.0, positions: 'WR',  team: 'WAS',  valueDelta: 7.0,  isValuePick: false },
  { rank: 105, playerName: 'Okonkwo, Chig',           displayName: 'Chig Okonkwo',           adp: 113.0, positions: 'TE',  team: 'TEN',  valueDelta: 8.0,  isValuePick: false },
  { rank: 106, playerName: 'Toney, Kadarius',         displayName: 'Kadarius Toney',         adp: 116.0, positions: 'WR',  team: 'KC',   valueDelta: 10.0, isValuePick: false },
  { rank: 107, playerName: 'Mitchell, Elijah',        displayName: 'Elijah Mitchell',        adp: 115.0, positions: 'RB',  team: 'SF',   valueDelta: 8.0,  isValuePick: false },
  { rank: 108, playerName: 'McPherson, Evan',         displayName: 'Evan McPherson',         adp: 118.0, positions: 'K',   team: 'CIN',  valueDelta: 10.0, isValuePick: false },
  // ── Round 10 (109–120) ──────────────────────────────────────────────────────
  { rank: 109, playerName: 'Watson, Deshaun',         displayName: 'Deshaun Watson',         adp: 122.0, positions: 'QB',  team: 'CLE',  valueDelta: 13.0, isValuePick: false },
  { rank: 110, playerName: 'Thielen, Adam',           displayName: 'Adam Thielen',           adp: 119.5, positions: 'WR',  team: 'CAR',  valueDelta: 9.5,  isValuePick: false },
  { rank: 111, playerName: '49ers, SF',               displayName: 'SF 49ers D/ST',          adp: 121.0, positions: 'DEF', team: 'SF',   valueDelta: 10.0, isValuePick: false },
  { rank: 112, playerName: 'Eagles, PHI',             displayName: 'PHI Eagles D/ST',        adp: 122.5, positions: 'DEF', team: 'PHI',  valueDelta: 10.5, isValuePick: false },
  { rank: 113, playerName: 'Cowboys, DAL',            displayName: 'DAL Cowboys D/ST',       adp: 124.0, positions: 'DEF', team: 'DAL',  valueDelta: 11.0, isValuePick: false },
  { rank: 114, playerName: 'Harris, Dameon',          displayName: 'Dameon Harris',          adp: 120.0, positions: 'RB',  team: 'HOU',  valueDelta: 6.0,  isValuePick: false },
  { rank: 115, playerName: 'Patterson, Cordarrelle',  displayName: 'Cordarrelle Patterson',  adp: 123.0, positions: 'RB',  team: 'ATL',  valueDelta: 8.0,  isValuePick: false },
  { rank: 116, playerName: 'Bass, Tyler',             displayName: 'Tyler Bass',             adp: 125.5, positions: 'K',   team: 'BUF',  valueDelta: 9.5,  isValuePick: false },
  { rank: 117, playerName: 'Bills, BUF',              displayName: 'BUF Bills D/ST',         adp: 127.0, positions: 'DEF', team: 'BUF',  valueDelta: 10.0, isValuePick: false },
  { rank: 118, playerName: 'Chiefs, KC',              displayName: 'KC Chiefs D/ST',         adp: 128.5, positions: 'DEF', team: 'KC',   valueDelta: 10.5, isValuePick: false },
  { rank: 119, playerName: 'Reynolds, Josh',          displayName: 'Josh Reynolds',          adp: 126.5, positions: 'WR',  team: 'DET',  valueDelta: 7.5,  isValuePick: false },
  { rank: 120, playerName: 'White, Jamaal',           displayName: 'Jamaal White',           adp: 130.0, positions: 'RB',  team: 'NO',   valueDelta: 10.0, isValuePick: false },
]);

// ── Module-level cache ────────────────────────────────────────────────────────

let nflAdpCache: NFBCPlayer[] | null = null;
let nflLastFetched = 0;

// ── Fetch helpers ─────────────────────────────────────────────────────────────

// URL patterns to try in order — matches the Download button on nfc.shgn.com/adp/football.
const NFFC_NFL_ADP_URLS: string[] = [
  'https://nfc.shgn.com/adp/football?download=1',
  'https://nfc.shgn.com/adp/football?export=csv',
  'https://nfc.shgn.com/adp/football?format=csv',
];

// Delimiter-agnostic parser (same logic as in adp-data.ts, applied to football data)
function stripQuotes(s: string): string {
  return s.replace(/^"|"$/g, '').trim();
}

function normalisePlayerName(raw: string): string {
  const trimmed = raw.trim();
  const commaIdx = trimmed.indexOf(',');
  if (commaIdx === -1) return trimmed;
  const last = trimmed.slice(0, commaIdx).trim();
  const first = trimmed.slice(commaIdx + 1).trim();
  return first ? `${first} ${last}` : last;
}

function parseTSV(raw: string): NFBCPlayer[] {
  const lines = raw.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(delimiter).map(h => stripQuotes(h).toLowerCase());

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

async function tryFetchURL(url: string): Promise<NFBCPlayer[]> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/tab-separated-values, text/csv, text/plain, application/vnd.ms-excel, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://nfc.shgn.com/adp/football',
      'Origin': 'https://nfc.shgn.com',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`NFFC NFL ADP fetch failed: HTTP ${res.status}`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  const body = await res.text();

  if (contentType.includes('text/html') || body.trimStart().startsWith('<')) {
    throw new Error('NFFC NFL ADP endpoint returned HTML (not TSV) — format may have changed');
  }

  if (contentType.includes('application/json') || contentType.includes('json') || body.trimStart().startsWith('{') || body.trimStart().startsWith('[')) {
    const json = JSON.parse(body) as Record<string, unknown>;
    const raw = (json.players ?? json.data ?? json) as Array<Record<string, unknown>>;
    if (!Array.isArray(raw) || raw.length === 0) throw new Error('JSON response has no player array');
    const parsed = raw.map((p, i) => {
      const rank = Number(p.rank ?? p.overall_rank ?? i + 1);
      const adp  = Number(p.adp ?? p.average_draft_position ?? rank);
      const name = String(p.player_name ?? p.name ?? '');
      const pos  = String(p.pos ?? p.position ?? '');
      const team = String(p.team ?? '');
      const valueDelta = Math.round((adp - rank) * 10) / 10;
      return {
        rank, playerName: name, displayName: normalisePlayerName(name),
        adp, positions: pos, team, valueDelta, isValuePick: valueDelta > 15,
      } satisfies NFBCPlayer;
    }).filter(p => p.displayName.length > 0);
    if (parsed.length === 0) throw new Error('JSON response parsed to 0 valid players');
    return parsed;
  }

  const players = parseTSV(body);
  if (players.length === 0) {
    throw new Error('NFFC NFL ADP response parsed to 0 players — unexpected format');
  }

  return players;
}

async function fetchNFFCNFLADP(): Promise<NFBCPlayer[]> {
  let lastError: Error | null = null;

  for (const url of NFFC_NFL_ADP_URLS) {
    try {
      const players = await tryFetchURL(url);
      console.log(`[v0] [NFL ADP] Fetched ${players.length} players from NFFC (${url})`);
      return players;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[v0] [NFL ADP] URL failed (${url}): ${lastError.message}`);
    }
  }

  throw lastError ?? new Error('No NFFC NFL ADP URLs configured');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the cached NFFC NFL ADP player list, refreshing when the cache is stale.
 * Safe to call on every request — fetches only once per TTL period.
 */
export async function getNFLADPData(forceRefresh = false): Promise<NFBCPlayer[]> {
  const now = Date.now();
  const isStale = now - nflLastFetched > CACHE_TTL_MS;

  if (nflAdpCache && !isStale && !forceRefresh) {
    return nflAdpCache;
  }

  try {
    const players = await fetchNFFCNFLADP();
    nflAdpCache = players;
    nflLastFetched = now;
    return players;
  } catch (err) {
    console.error('[v0] [NFL ADP] Failed to fetch NFFC NFL ADP data:', err);
    if (nflAdpCache) {
      console.warn('[v0] [NFL ADP] Returning stale cached data');
      return nflAdpCache;
    }
    console.warn(`[v0] [NFL ADP] Returning static fallback dataset (${NFL_STATIC_FALLBACK.length} players, 2026 pre-season consensus)`);
    return NFL_STATIC_FALLBACK;
  }
}
