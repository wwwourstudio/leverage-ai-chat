/**
 * MLB Park Factors — 2025 season
 * hr:   home run factor relative to league average (1.0 = neutral)
 * runs: run scoring environment factor
 * k:    strikeout factor (>1.0 = pitchers' park with more Ks)
 *
 * Source: FanGraphs / Baseball Prospectus 2025 multi-year park factors,
 * normalized to 3-year weighted average. Updated pre-season 2025.
 */

export interface ParkFactors {
  hr: number;   // HR factor (1.22 = 22% more HRs than average)
  runs: number; // Run environment factor
  k: number;    // Strikeout factor
}

/** Maps MLB team abbreviation → park factors */
export const PARK_FACTORS_BY_TEAM: Record<string, ParkFactors> = {
  // Extreme hitter parks
  COL: { hr: 1.22, runs: 1.18, k: 0.95 }, // Coors Field
  CIN: { hr: 1.15, runs: 1.12, k: 0.97 }, // Great American Ball Park
  PHI: { hr: 1.12, runs: 1.08, k: 0.98 }, // Citizens Bank Park
  BAL: { hr: 1.11, runs: 1.07, k: 0.99 }, // Oriole Park at Camden Yards
  TEX: { hr: 1.10, runs: 1.06, k: 0.98 }, // Globe Life Field
  NYY: { hr: 1.10, runs: 1.05, k: 1.00 }, // Yankee Stadium
  BOS: { hr: 1.08, runs: 1.04, k: 0.99 }, // Fenway Park
  ARI: { hr: 1.07, runs: 1.05, k: 1.00 }, // Chase Field
  MIL: { hr: 1.06, runs: 1.03, k: 1.00 }, // American Family Field
  HOU: { hr: 1.04, runs: 1.02, k: 1.01 }, // Minute Maid Park
  // Near-neutral parks
  LAD: { hr: 1.03, runs: 1.01, k: 1.01 }, // Dodger Stadium
  ATL: { hr: 1.02, runs: 1.01, k: 1.00 }, // Truist Park
  WSH: { hr: 1.01, runs: 1.00, k: 1.00 }, // Nationals Park
  CHC: { hr: 1.00, runs: 1.00, k: 1.00 }, // Wrigley Field (neutral avg)
  DET: { hr: 0.99, runs: 0.99, k: 1.01 }, // Comerica Park
  STL: { hr: 0.99, runs: 0.98, k: 1.01 }, // Busch Stadium
  KC:  { hr: 0.98, runs: 0.98, k: 1.01 }, // Kauffman Stadium
  CLE: { hr: 0.98, runs: 0.97, k: 1.02 }, // Progressive Field
  TOR: { hr: 0.97, runs: 0.97, k: 1.01 }, // Rogers Centre
  MIN: { hr: 0.97, runs: 0.97, k: 1.01 }, // Target Field
  // Pitcher-friendly parks
  NYM: { hr: 0.96, runs: 0.96, k: 1.02 }, // Citi Field
  TB:  { hr: 0.95, runs: 0.95, k: 1.02 }, // Tropicana Field
  CWS: { hr: 0.95, runs: 0.95, k: 1.02 }, // Guaranteed Rate Field
  PIT: { hr: 0.94, runs: 0.94, k: 1.02 }, // PNC Park
  LAA: { hr: 0.93, runs: 0.93, k: 1.03 }, // Angel Stadium
  SEA: { hr: 0.91, runs: 0.92, k: 1.03 }, // T-Mobile Park
  MIA: { hr: 0.90, runs: 0.91, k: 1.03 }, // loanDepot Park
  SF:  { hr: 0.88, runs: 0.91, k: 1.03 }, // Oracle Park
  OAK: { hr: 0.88, runs: 0.90, k: 1.02 }, // Oakland Coliseum (or Sacramento)
  SD:  { hr: 0.85, runs: 0.92, k: 1.04 }, // Petco Park
};

/** Map full team name variants → team abbreviation */
const TEAM_NAME_TO_ABBR: Record<string, string> = {
  'Colorado Rockies': 'COL', 'Rockies': 'COL',
  'Cincinnati Reds': 'CIN', 'Reds': 'CIN',
  'Philadelphia Phillies': 'PHI', 'Phillies': 'PHI',
  'Baltimore Orioles': 'BAL', 'Orioles': 'BAL',
  'Texas Rangers': 'TEX', 'Rangers': 'TEX',
  'New York Yankees': 'NYY', 'Yankees': 'NYY',
  'Boston Red Sox': 'BOS', 'Red Sox': 'BOS',
  'Arizona Diamondbacks': 'ARI', 'Diamondbacks': 'ARI', 'D-backs': 'ARI',
  'Milwaukee Brewers': 'MIL', 'Brewers': 'MIL',
  'Houston Astros': 'HOU', 'Astros': 'HOU',
  'Los Angeles Dodgers': 'LAD', 'Dodgers': 'LAD',
  'Atlanta Braves': 'ATL', 'Braves': 'ATL',
  'Washington Nationals': 'WSH', 'Nationals': 'WSH',
  'Chicago Cubs': 'CHC', 'Cubs': 'CHC',
  'Detroit Tigers': 'DET', 'Tigers': 'DET',
  'St. Louis Cardinals': 'STL', 'Cardinals': 'STL',
  'Kansas City Royals': 'KC', 'Royals': 'KC',
  'Cleveland Guardians': 'CLE', 'Guardians': 'CLE',
  'Toronto Blue Jays': 'TOR', 'Blue Jays': 'TOR',
  'Minnesota Twins': 'MIN', 'Twins': 'MIN',
  'New York Mets': 'NYM', 'Mets': 'NYM',
  'Tampa Bay Rays': 'TB', 'Rays': 'TB',
  'Chicago White Sox': 'CWS', 'White Sox': 'CWS',
  'Pittsburgh Pirates': 'PIT', 'Pirates': 'PIT',
  'Los Angeles Angels': 'LAA', 'Angels': 'LAA',
  'Seattle Mariners': 'SEA', 'Mariners': 'SEA',
  'Miami Marlins': 'MIA', 'Marlins': 'MIA',
  'San Francisco Giants': 'SF', 'Giants': 'SF',
  'Oakland Athletics': 'OAK', 'Athletics': 'OAK', "A's": 'OAK',
  'San Diego Padres': 'SD', 'Padres': 'SD',
};

const NEUTRAL: ParkFactors = { hr: 1.0, runs: 1.0, k: 1.0 };

/** Get park factors by team abbreviation or full name. Returns neutral (1.0) if unknown. */
export function getParkFactors(teamNameOrAbbr: string): ParkFactors {
  if (!teamNameOrAbbr) return NEUTRAL;
  const abbr = TEAM_NAME_TO_ABBR[teamNameOrAbbr] ?? teamNameOrAbbr.toUpperCase();
  return PARK_FACTORS_BY_TEAM[abbr] ?? NEUTRAL;
}
