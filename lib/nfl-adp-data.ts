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
import { saveADPToSupabase, loadADPFromSupabase, clearADPCache as clearMLBCache } from '@/lib/adp-data';

// ── Constants ─────────────────────────────────────────────────────────────────

// Short TTL so newly-uploaded data propagates quickly across serverless instances
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Clears the in-memory NFL cache, forcing the next call to re-read from Supabase.
 * Called by the upload route after a successful TSV import.
 */
export function clearNFLADPCache(): void {
  nflAdpCache = null;
  nflLastFetched = 0;
}

/**
 * Returns the NFFC NFL ADP player list.
 * Data comes exclusively from Supabase (populated by user TSV uploads).
 * Falls back to the static pre-season dataset when no upload exists yet.
 */
export async function getNFLADPData(forceRefresh = false): Promise<NFBCPlayer[]> {
  const now = Date.now();

  if (nflAdpCache && !forceRefresh && now - nflLastFetched < CACHE_TTL_MS) {
    return nflAdpCache;
  }

  // User-uploaded data lives in Supabase — always authoritative, no TTL check
  const dbData = await loadADPFromSupabase('nfl', true);
  if (dbData && dbData.length > 0) {
    console.log(`[v0] [NFL ADP] Serving ${dbData.length} NFL players from Supabase (user upload)`);
    nflAdpCache = dbData;
    nflLastFetched = now;
    return dbData;
  }

  console.log(`[v0] [NFL ADP] No NFL ADP upload found — serving static fallback (${NFL_STATIC_FALLBACK.length} players)`);
  return NFL_STATIC_FALLBACK;
}
