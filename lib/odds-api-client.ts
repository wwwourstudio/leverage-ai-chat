/// <reference types="node" />

/**
 * The Odds API Client - Comprehensive Multi-Sport Implementation
 * Supports all sports categories and historical data endpoints
 */

import { ENV_KEYS, LOG_PREFIXES, EXTERNAL_APIS } from '@/lib/constants';

// All supported sports from The Odds API
export const ODDS_API_SPORTS = {
  // American Football
  NFL: 'americanfootball_nfl',
  NCAAF: 'americanfootball_ncaaf',
  
  // Basketball  
  NBA: 'basketball_nba',
  NCAAB: 'basketball_ncaab',
  EUROLEAGUE: 'basketball_euroleague',
  NBL: 'basketball_nbl',
  
  // Baseball
  MLB: 'baseball_mlb',
  
  // Hockey
  NHL: 'icehockey_nhl',
  
  // Soccer
  EPL: 'soccer_epl',
  LA_LIGA: 'soccer_spain_la_liga',
  BUNDESLIGA: 'soccer_germany_bundesliga',
  SERIE_A: 'soccer_italy_serie_a',
  LIGUE_1: 'soccer_france_ligue_one',
  UEFA_CHAMPIONS: 'soccer_uefa_champs_league',
  UEFA_EUROPA: 'soccer_uefa_europa_league',
  MLS: 'soccer_usa_mls',
  
  // Tennis
  ATP: 'tennis_atp',
  WTA: 'tennis_wta',
  
  // MMA
  UFC: 'mma_mixed_martial_arts',
  
  // Golf
  PGA: 'golf_pga_championship',
  
  // Boxing
  BOXING: 'boxing_boxing'
} as const;

export type OddsSport = typeof ODDS_API_SPORTS[keyof typeof ODDS_API_SPORTS];

// Sport metadata
export interface SportInfo {
  key: string;
  name: string;
  category: string;
  active: boolean;
  hasOutrights: boolean;
}

// Sport information lookup
export const SPORT_INFO: Record<string, SportInfo> = {
  [ODDS_API_SPORTS.NFL]: { key: ODDS_API_SPORTS.NFL, name: 'NFL', category: 'American Football', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.NCAAF]: { key: ODDS_API_SPORTS.NCAAF, name: 'NCAA Football', category: 'American Football', active: true, hasOutrights: false },
  [ODDS_API_SPORTS.NBA]: { key: ODDS_API_SPORTS.NBA, name: 'NBA', category: 'Basketball', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.NCAAB]: { key: ODDS_API_SPORTS.NCAAB, name: 'NCAA Basketball', category: 'Basketball', active: true, hasOutrights: false },
  [ODDS_API_SPORTS.EUROLEAGUE]: { key: ODDS_API_SPORTS.EUROLEAGUE, name: 'Euroleague', category: 'Basketball', active: true, hasOutrights: false },
  [ODDS_API_SPORTS.NBL]: { key: ODDS_API_SPORTS.NBL, name: 'NBL', category: 'Basketball', active: true, hasOutrights: false },
  [ODDS_API_SPORTS.MLB]: { key: ODDS_API_SPORTS.MLB, name: 'MLB', category: 'Baseball', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.NHL]: { key: ODDS_API_SPORTS.NHL, name: 'NHL', category: 'Hockey', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.EPL]: { key: ODDS_API_SPORTS.EPL, name: 'Premier League', category: 'Soccer', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.LA_LIGA]: { key: ODDS_API_SPORTS.LA_LIGA, name: 'La Liga', category: 'Soccer', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.BUNDESLIGA]: { key: ODDS_API_SPORTS.BUNDESLIGA, name: 'Bundesliga', category: 'Soccer', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.SERIE_A]: { key: ODDS_API_SPORTS.SERIE_A, name: 'Serie A', category: 'Soccer', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.LIGUE_1]: { key: ODDS_API_SPORTS.LIGUE_1, name: 'Ligue 1', category: 'Soccer', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.UEFA_CHAMPIONS]: { key: ODDS_API_SPORTS.UEFA_CHAMPIONS, name: 'Champions League', category: 'Soccer', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.UEFA_EUROPA]: { key: ODDS_API_SPORTS.UEFA_EUROPA, name: 'Europa League', category: 'Soccer', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.MLS]: { key: ODDS_API_SPORTS.MLS, name: 'MLS', category: 'Soccer', active: true, hasOutrights: false },
  [ODDS_API_SPORTS.ATP]: { key: ODDS_API_SPORTS.ATP, name: 'ATP', category: 'Tennis', active: true, hasOutrights: false },
  [ODDS_API_SPORTS.WTA]: { key: ODDS_API_SPORTS.WTA, name: 'WTA', category: 'Tennis', active: true, hasOutrights: false },
  [ODDS_API_SPORTS.UFC]: { key: ODDS_API_SPORTS.UFC, name: 'UFC/MMA', category: 'MMA', active: true, hasOutrights: false },
  [ODDS_API_SPORTS.PGA]: { key: ODDS_API_SPORTS.PGA, name: 'PGA', category: 'Golf', active: true, hasOutrights: true },
  [ODDS_API_SPORTS.BOXING]: { key: ODDS_API_SPORTS.BOXING, name: 'Boxing', category: 'Boxing', active: true, hasOutrights: false },
};

// Market types
export const ODDS_MARKETS = {
  H2H: 'h2h', // Head to head (moneyline)
  SPREADS: 'spreads',
  TOTALS: 'totals',
  OUTRIGHTS: 'outrights', // Championship/tournament winners
  PLAYER_PROPS: 'player_props'
} as const;

// Betting regions
export const BETTING_REGIONS = {
  US: 'us',
  UK: 'uk',
  EU: 'eu',
  AU: 'au'
} as const;

// Odds formats
export const ODDS_FORMATS = {
  AMERICAN: 'american',
  DECIMAL: 'decimal',
  FRACTIONAL: 'fractional'
} as const;

/**
 * Validate and normalize sport key
 */
export function validateSportKey(sport: string): { 
  isValid: boolean; 
  normalizedKey?: string; 
  error?: string;
  suggestion?: string;
} {
  if (!sport) {
    return { isValid: false, error: 'No sport specified' };
  }

  const lowerSport = sport.toLowerCase();
  
  // Direct match
  if (Object.values(ODDS_API_SPORTS).includes(lowerSport as OddsSport)) {
    return { isValid: true, normalizedKey: lowerSport };
  }

  // Fuzzy matching
  const sportAliases: Record<string, OddsSport> = {
    'football': ODDS_API_SPORTS.NFL,
    'nfl': ODDS_API_SPORTS.NFL,
    'ncaa_football': ODDS_API_SPORTS.NCAAF,
    'college_football': ODDS_API_SPORTS.NCAAF,
    'basketball': ODDS_API_SPORTS.NBA,
    'nba': ODDS_API_SPORTS.NBA,
    'ncaa_basketball': ODDS_API_SPORTS.NCAAB,
    'college_basketball': ODDS_API_SPORTS.NCAAB,
    'baseball': ODDS_API_SPORTS.MLB,
    'mlb': ODDS_API_SPORTS.MLB,
    'hockey': ODDS_API_SPORTS.NHL,
    'nhl': ODDS_API_SPORTS.NHL,
    'soccer': ODDS_API_SPORTS.EPL,
    'premier_league': ODDS_API_SPORTS.EPL,
    'epl': ODDS_API_SPORTS.EPL,
    'la_liga': ODDS_API_SPORTS.LA_LIGA,
    'bundesliga': ODDS_API_SPORTS.BUNDESLIGA,
    'serie_a': ODDS_API_SPORTS.SERIE_A,
    'ligue_1': ODDS_API_SPORTS.LIGUE_1,
    'champions_league': ODDS_API_SPORTS.UEFA_CHAMPIONS,
    'europa_league': ODDS_API_SPORTS.UEFA_EUROPA,
    'mls': ODDS_API_SPORTS.MLS,
    'tennis': ODDS_API_SPORTS.ATP,
    'atp': ODDS_API_SPORTS.ATP,
    'wta': ODDS_API_SPORTS.WTA,
    'mma': ODDS_API_SPORTS.UFC,
    'ufc': ODDS_API_SPORTS.UFC,
    'golf': ODDS_API_SPORTS.PGA,
    'pga': ODDS_API_SPORTS.PGA,
    'boxing': ODDS_API_SPORTS.BOXING
  };

  const normalizedKey = sportAliases[lowerSport];
  if (normalizedKey) {
    return { isValid: true, normalizedKey };
  }

  // Not found
  return {
    isValid: false,
    error: `Unknown sport: ${sport}`,
    suggestion: 'Try: nfl, nba, mlb, nhl, soccer, tennis, mma, golf, or boxing'
  };
}

/**
 * Get sport information
 */
export function getSportInfo(sportKey: string): SportInfo {
  const sportInfo: SportInfo = SPORT_INFO[sportKey] || {
    key: sportKey,
    name: sportKey.toUpperCase(),
    category: 'Unknown',
    active: false,
    hasOutrights: false
  };
  return sportInfo;
}

/**
 * Fetch live odds for a sport
 */
export async function fetchLiveOdds(
  sportKey: string,
  options: {
    markets?: string[];
    regions?: string[];
    oddsFormat?: string;
    apiKey: string;
  }
): Promise<any> {
  const {
    markets = [ODDS_MARKETS.H2H, ODDS_MARKETS.SPREADS, ODDS_MARKETS.TOTALS],
    regions = [BETTING_REGIONS.US],
    oddsFormat = ODDS_FORMATS.AMERICAN,
    apiKey
  } = options;

  const baseUrl = EXTERNAL_APIS.ODDS_API.BASE_URL;
  const marketsParam = markets.join(',');
  const regionsParam = regions.join(',');

  const url = `${baseUrl}/sports/${sportKey}/odds?apiKey=${apiKey}&regions=${regionsParam}&markets=${marketsParam}&oddsFormat=${oddsFormat}`;
  
  console.log(`${LOG_PREFIXES.API} Fetching live odds:`, { sportKey, markets, regions });

  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Odds API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Fetch historical odds (requires historical data endpoint)
 */
export async function fetchHistoricalOdds(
  sportKey: string,
  date: string, // ISO format: YYYY-MM-DD
  options: {
    markets?: string[];
    regions?: string[];
    oddsFormat?: string;
    apiKey: string;
  }
): Promise<any> {
  const {
    markets = [ODDS_MARKETS.H2H, ODDS_MARKETS.SPREADS, ODDS_MARKETS.TOTALS],
    regions = [BETTING_REGIONS.US],
    oddsFormat = ODDS_FORMATS.AMERICAN,
    apiKey
  } = options;

  const baseUrl = EXTERNAL_APIS.ODDS_API.BASE_URL;
  const marketsParam = markets.join(',');
  const regionsParam = regions.join(',');

  const url = `${baseUrl}/sports/${sportKey}/odds-history?apiKey=${apiKey}&regions=${regionsParam}&markets=${marketsParam}&oddsFormat=${oddsFormat}&date=${date}`;
  
  console.log(`${LOG_PREFIXES.API} Fetching historical odds:`, { sportKey, date, markets, regions });

  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Odds API historical error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Fetch available sports
 */
export async function fetchAvailableSports(apiKey: string): Promise<any> {
  const baseUrl = EXTERNAL_APIS.ODDS_API.BASE_URL;
  const url = `${baseUrl}/sports?apiKey=${apiKey}`;
  
  console.log(`${LOG_PREFIXES.API} Fetching available sports`);

  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Odds API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Fetch outrights/futures (championship winners, etc.)
 */
export async function fetchOutrights(
  sportKey: string,
  options: {
    regions?: string[];
    oddsFormat?: string;
    apiKey: string;
  }
): Promise<any> {
  const {
    regions = [BETTING_REGIONS.US],
    oddsFormat = ODDS_FORMATS.AMERICAN,
    apiKey
  } = options;

  const sportInfo = getSportInfo(sportKey);
  
  if (!sportInfo.hasOutrights) {
    console.log(`${LOG_PREFIXES.API} Sport ${sportKey} does not support outrights`);
    return [];
  }

  const baseUrl = EXTERNAL_APIS.ODDS_API.BASE_URL;
  const regionsParam = regions.join(',');

  const url = `${baseUrl}/sports/${sportKey}/outrights?apiKey=${apiKey}&regions=${regionsParam}&oddsFormat=${oddsFormat}`;
  
  console.log(`${LOG_PREFIXES.API} Fetching outrights:`, { sportKey, regions });

  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Odds API outrights error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Get all active sports
 */
export function getActiveSports(): SportInfo[] {
  return Object.values(SPORT_INFO).filter(sport => sport.active);
}

/**
 * Get sports by category
 */
export function getSportsByCategory(category: string): SportInfo[] {
  return Object.values(SPORT_INFO).filter(
    sport => sport.active && sport.category.toLowerCase() === category.toLowerCase()
  );
}
