/**
 * MLB Park HR Factors
 *
 * 5-year rolling HR park factors (FanGraphs, 2020–2024 seasons).
 * hrFactor > 1.0 = HR-friendly park; < 1.0 = HR-suppressing.
 *
 * Notes:
 * - Wrigley Field is 0.99 (near-neutral) because lib/weather/index.ts already
 *   captures its strong directional wind variance.
 * - Coors Field is the strongest outlier at 1.40 (altitude + thin air).
 * - Oracle Park is the toughest at 0.88 (cold marine air + deep alleys).
 */

export interface ParkFactor {
  team:      string;   // canonical MLB team name
  stadium:   string;   // stadium name
  hrFactor:  number;   // HR multiplier [0.7, 1.5]
  hitFactor: number;   // overall hit multiplier
}

// ── 30-park table ──────────────────────────────────────────────────────────────
// FanGraphs 5-year park factors, 2020–2024.  Indexed by canonical team name.

const PARK_FACTORS: ParkFactor[] = [
  { team: 'Colorado Rockies',       stadium: 'Coors Field',               hrFactor: 1.40, hitFactor: 1.18 },
  { team: 'New York Yankees',       stadium: 'Yankee Stadium',            hrFactor: 1.18, hitFactor: 1.05 },
  { team: 'Cincinnati Reds',        stadium: 'Great American Ball Park',  hrFactor: 1.12, hitFactor: 1.06 },
  { team: 'Philadelphia Phillies',  stadium: 'Citizens Bank Park',        hrFactor: 1.10, hitFactor: 1.05 },
  { team: 'Texas Rangers',          stadium: 'Globe Life Field',          hrFactor: 1.08, hitFactor: 1.03 },
  { team: 'Houston Astros',         stadium: 'Minute Maid Park',          hrFactor: 1.06, hitFactor: 1.02 },
  { team: 'Arizona Diamondbacks',   stadium: 'Chase Field',               hrFactor: 1.05, hitFactor: 1.03 },
  { team: 'Atlanta Braves',         stadium: 'Truist Park',               hrFactor: 1.04, hitFactor: 1.02 },
  { team: 'Boston Red Sox',         stadium: 'Fenway Park',               hrFactor: 1.03, hitFactor: 1.07 },
  { team: 'Toronto Blue Jays',      stadium: 'Rogers Centre',             hrFactor: 1.03, hitFactor: 1.01 },
  { team: 'Milwaukee Brewers',      stadium: 'American Family Field',     hrFactor: 1.02, hitFactor: 1.01 },
  { team: 'Kansas City Royals',     stadium: 'Kauffman Stadium',          hrFactor: 1.01, hitFactor: 1.01 },
  { team: 'Chicago White Sox',      stadium: 'Guaranteed Rate Field',     hrFactor: 1.01, hitFactor: 1.00 },
  { team: 'Minnesota Twins',        stadium: 'Target Field',              hrFactor: 1.00, hitFactor: 1.00 },
  { team: 'Los Angeles Angels',     stadium: 'Angel Stadium',             hrFactor: 1.00, hitFactor: 1.00 },
  { team: 'Chicago Cubs',           stadium: 'Wrigley Field',             hrFactor: 0.99, hitFactor: 1.01 },
  { team: 'Baltimore Orioles',      stadium: 'Camden Yards',              hrFactor: 0.99, hitFactor: 1.01 },
  { team: 'Cleveland Guardians',    stadium: 'Progressive Field',         hrFactor: 0.98, hitFactor: 0.99 },
  { team: 'Tampa Bay Rays',         stadium: 'Tropicana Field',           hrFactor: 0.97, hitFactor: 0.97 },
  { team: 'Detroit Tigers',         stadium: 'Comerica Park',             hrFactor: 0.96, hitFactor: 0.98 },
  { team: 'Seattle Mariners',       stadium: 'T-Mobile Park',             hrFactor: 0.95, hitFactor: 0.97 },
  { team: 'Miami Marlins',          stadium: 'loanDepot Park',            hrFactor: 0.94, hitFactor: 0.97 },
  { team: 'Washington Nationals',   stadium: 'Nationals Park',            hrFactor: 0.94, hitFactor: 0.99 },
  { team: 'Pittsburgh Pirates',     stadium: 'PNC Park',                  hrFactor: 0.93, hitFactor: 0.98 },
  { team: 'Los Angeles Dodgers',    stadium: 'Dodger Stadium',            hrFactor: 0.93, hitFactor: 0.98 },
  { team: 'St. Louis Cardinals',    stadium: 'Busch Stadium',             hrFactor: 0.92, hitFactor: 0.97 },
  { team: 'Oakland Athletics',      stadium: 'Oakland Coliseum',          hrFactor: 0.92, hitFactor: 0.96 },
  { team: 'New York Mets',          stadium: 'Citi Field',                hrFactor: 0.91, hitFactor: 0.97 },
  { team: 'San Diego Padres',       stadium: 'Petco Park',                hrFactor: 0.89, hitFactor: 0.96 },
  { team: 'San Francisco Giants',   stadium: 'Oracle Park',               hrFactor: 0.88, hitFactor: 0.97 },
];

// Common nickname / abbreviation aliases → canonical team name
const ALIASES: Record<string, string> = {
  'rockies':      'Colorado Rockies',
  'yankees':      'New York Yankees',
  'reds':         'Cincinnati Reds',
  'phillies':     'Philadelphia Phillies',
  'rangers':      'Texas Rangers',
  'astros':       'Houston Astros',
  'dbacks':       'Arizona Diamondbacks',
  'diamondbacks': 'Arizona Diamondbacks',
  'braves':       'Atlanta Braves',
  'red sox':      'Boston Red Sox',
  'blue jays':    'Toronto Blue Jays',
  'brewers':      'Milwaukee Brewers',
  'royals':       'Kansas City Royals',
  'white sox':    'Chicago White Sox',
  'twins':        'Minnesota Twins',
  'angels':       'Los Angeles Angels',
  'cubs':         'Chicago Cubs',
  'orioles':      'Baltimore Orioles',
  'guardians':    'Cleveland Guardians',
  'rays':         'Tampa Bay Rays',
  'tigers':       'Detroit Tigers',
  'mariners':     'Seattle Mariners',
  'marlins':      'Miami Marlins',
  'nationals':    'Washington Nationals',
  'pirates':      'Pittsburgh Pirates',
  'dodgers':      'Los Angeles Dodgers',
  'cardinals':    'St. Louis Cardinals',
  'athletics':    'Oakland Athletics',
  'mets':         'New York Mets',
  'padres':       'San Diego Padres',
  'giants':       'San Francisco Giants',
};

// O(1) index by lowercase canonical name
const INDEX = new Map<string, ParkFactor>(
  PARK_FACTORS.map(f => [f.team.toLowerCase(), f]),
);

const NEUTRAL: ParkFactor = {
  team: 'Unknown', stadium: 'Unknown', hrFactor: 1.0, hitFactor: 1.0,
};

/**
 * Resolve a home team name to its park HR factor.
 *
 * Supports full names ('New York Yankees'), nicknames ('Yankees'),
 * and common abbreviations.  Returns a neutral factor (1.0) when the
 * team is not recognised.
 */
export function getParkFactor(teamName: string): ParkFactor {
  if (!teamName) return NEUTRAL;
  const lower = teamName.toLowerCase().trim();

  // Exact canonical match
  const direct = INDEX.get(lower);
  if (direct) return direct;

  // Alias match
  const aliased = ALIASES[lower];
  if (aliased) return INDEX.get(aliased.toLowerCase()) ?? NEUTRAL;

  // Partial match — any canonical entry whose last word is contained in input
  for (const [key, factor] of INDEX) {
    const lastWord = key.split(' ').at(-1)!;
    if (lower.includes(lastWord) || key.includes(lower)) return factor;
  }

  return NEUTRAL;
}

export { PARK_FACTORS };
