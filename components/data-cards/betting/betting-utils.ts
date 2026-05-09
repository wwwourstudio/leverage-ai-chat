// Pure utility functions and shared types for BettingCard and its tab sub-components.
// No React dependency — safe to import from any file in the betting/ tree.

export interface BookEntry {
  name: string;
  homeOdds: string | null;
  awayOdds: string | null;
}

export interface BettingCardData {
  matchup?: string;
  game?: string;
  team?: string;
  finalScore?: string;
  homeOdds?: string;
  awayOdds?: string;
  homeSpread?: string;
  awaySpread?: string;
  overUnder?: string;
  bestLine?: string;
  line?: string;
  over?: string;
  under?: string;
  odds?: string;
  book?: string;
  bookmaker?: string;
  bookmakerCount?: number | string;
  books?: BookEntry[];
  bestHomeOdds?: string;
  bestAwayOdds?: string;
  edge?: string;
  impliedWin?: string;
  impliedProb?: string;
  movement?: string;
  confidence?: number | string;
  marketEfficiency?: string;
  recommendation?: string;
  gameTime?: string;
  player?: string;
  stat?: string;
  lineChange?: string;
  lineMove?: string;
  openLine?: string;
  oldLine?: string;
  newLine?: string;
  direction?: string;
  sharpMoney?: string;
  sharpPct?: number | string;
  timestamp?: string;
  kellyFraction?: string;
  recommendedStake?: string;
  expectedValue?: string;
  description?: string;
  note?: string;
  sport?: string;
  status?: string;
  realData?: boolean;
  atsRecord?: string;
  h2hRecord?: string;
  homeRecord?: string;
  awayRecord?: string;
  injuryAlert?: string;
  weatherNote?: string;
  playerPhotoUrl?: string;
  hitRate?: string | number;
  teamComparison?: any;
  injuries?: any[];
  playerProps?: any[];
  h2hHistory?: any[];
  playersToWatch?: any[];
  category?: string;
  [key: string]: any;
}

export interface BettingCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: BettingCardData;
  status: string;
  onAnalyze?: () => void;
  onAsk?: (query: string) => void;
  isLoading?: boolean;
  error?: string;
  isHero?: boolean;
}

export function formatMarket(key: string): string {
  const m: Record<string, string> = {
    batter_home_runs: 'Home Runs', batter_hits: 'Hits', batter_rbis: 'RBIs',
    batter_total_bases: 'Total Bases', batter_strikeouts: 'Strikeouts',
    batter_runs_scored: 'Runs Scored', batter_stolen_bases: 'Stolen Bases',
    pitcher_strikeouts: 'Ks (Pitcher)', pitcher_hits_allowed: 'Hits Allowed',
    pitcher_earned_runs: 'Earned Runs', pitcher_walks: 'Walks (P)',
    player_points: 'Points', player_rebounds: 'Rebounds', player_assists: 'Assists',
    player_threes: '3-Pointers', player_blocks: 'Blocks', player_steals: 'Steals',
    player_pass_tds: 'Pass TDs', player_pass_yds: 'Pass Yards',
    player_rush_yds: 'Rush Yards', player_receptions: 'Receptions',
    player_reception_yds: 'Rec Yards', player_anytime_td: 'Anytime TD',
  };
  return m[key] ?? key.replace(/^(batter_|pitcher_|player_)/, '').replace(/_/g, ' ');
}

export function sportFromCategory(cat: string): string | null {
  const c = cat.toLowerCase();
  if (c.includes('mlb') || c.includes('baseball')) return 'baseball_mlb';
  if (c.includes('nba') || c.includes('basketball')) return 'basketball_nba';
  if (c.includes('nfl') || c.includes('football')) return 'americanfootball_nfl';
  if (c.includes('nhl') || c.includes('hockey')) return 'icehockey_nhl';
  return null;
}

export function parseTeams(matchup?: string): { away: string; home: string } | null {
  if (!matchup) return null;
  const atIdx = matchup.indexOf(' @ ');
  if (atIdx >= 0) return { away: matchup.slice(0, atIdx).trim(), home: matchup.slice(atIdx + 3).trim() };
  const vsMatch = matchup.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (vsMatch) return { away: vsMatch[1].trim(), home: vsMatch[2].trim() };
  return null;
}

export function abbr(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return name.slice(0, 3).toUpperCase();
  return words[words.length - 1].slice(0, 3).toUpperCase();
}

export function fmtML(val?: string): { display: string; positive: boolean } | null {
  if (!val || val === 'N/A' || val === '—') return null;
  const n = Number(val);
  if (isNaN(n)) return { display: val, positive: false };
  return { display: n > 0 ? `+${n}` : String(n), positive: n > 0 };
}

export function parseOU(raw?: string): { total: string; overJ?: string; underJ?: string } | null {
  if (!raw || raw === 'N/A') return null;
  const full = raw.match(/O\/U\s*([\d.]+)(?::\s*Over\s*([+-]?\d+)\s*\/\s*Under\s*([+-]?\d+))?/i);
  if (full) return { total: full[1], overJ: full[2], underJ: full[3] };
  const num = raw.match(/([\d.]+)/);
  return num ? { total: num[1] } : null;
}

export function parseSpread(raw?: string): { pts: string; juice?: string } | null {
  if (!raw || raw === 'N/A') return null;
  const m = raw.match(/([+-]?[\d.]+)\s*(?:\(([^)]+)\))?/);
  return m ? { pts: m[1], juice: m[2] } : null;
}

export function impliedProb(ml?: string): number | null {
  const n = Number(ml);
  if (!ml || isNaN(n)) return null;
  return n < 0 ? Math.round((-n / (-n + 100)) * 100) : Math.round((100 / (n + 100)) * 100);
}

export function calcVig(homeML?: string, awayML?: string): number | null {
  const h = impliedProb(homeML);
  const a = impliedProb(awayML);
  if (h === null || a === null) return null;
  return Math.round((h + a - 100) * 10) / 10;
}

const SPORT_VAR: Record<string, string> = {
  basketball: '--sport-basketball',
  hockey:     '--sport-hockey',
  baseball:   '--sport-baseball',
  football:   '--sport-football',
  soccer:     '--sport-soccer',
};

export function getSportVar(sport?: string): string {
  if (!sport) return '--sport-default';
  const s = sport.toLowerCase();
  for (const [key, val] of Object.entries(SPORT_VAR)) {
    if (s.includes(key)) return val;
  }
  return '--sport-default';
}

export function sportTheme(sport?: string): {
  headerGrad: string;
  accentColor: string;
  avatarCls: string;
  probBarColor: string;
  sportVar: string;
} {
  const sportVar = getSportVar(sport);
  if (sport?.includes('basketball')) return {
    headerGrad: 'from-orange-600/80 via-amber-700/60 to-orange-900/40',
    accentColor: `text-[color:var(${sportVar})]`,
    avatarCls: `bg-[color:var(${sportVar})]/15 text-[color:var(${sportVar})] border-[color:var(${sportVar})]/30`,
    probBarColor: 'from-orange-500 to-amber-400',
    sportVar,
  };
  if (sport?.includes('hockey')) return {
    headerGrad: 'from-sky-600/80 via-blue-700/60 to-sky-900/40',
    accentColor: `text-[color:var(${sportVar})]`,
    avatarCls: `bg-[color:var(${sportVar})]/15 text-[color:var(${sportVar})] border-[color:var(${sportVar})]/30`,
    probBarColor: 'from-sky-500 to-blue-400',
    sportVar,
  };
  if (sport?.includes('baseball')) return {
    headerGrad: 'from-indigo-600/80 via-violet-700/60 to-indigo-900/40',
    accentColor: `text-[color:var(${sportVar})]`,
    avatarCls: `bg-[color:var(${sportVar})]/15 text-[color:var(${sportVar})] border-[color:var(${sportVar})]/30`,
    probBarColor: 'from-indigo-500 to-violet-400',
    sportVar,
  };
  return {
    headerGrad: 'from-green-600/80 via-emerald-700/60 to-green-900/40',
    accentColor: `text-[color:var(${sportVar})]`,
    avatarCls: `bg-[color:var(${sportVar})]/15 text-[color:var(${sportVar})] border-[color:var(${sportVar})]/30`,
    probBarColor: 'from-green-500 to-emerald-400',
    sportVar,
  };
}
