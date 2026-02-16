/**
 * Active Sports Detector
 * Intelligently determines which sports have games available based on season and day of week
 */

import { SPORT_KEYS } from './constants';

export interface SportAvailability {
  sport: string;
  apiKey: string;
  likelihood: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Get sports most likely to have games today, ordered by probability
 */
export function getSportsWithGames(date: Date = new Date()): SportAvailability[] {
  const month = date.getMonth() + 1; // 1-12
  const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday
  
  const availability: SportAvailability[] = [];
  
  // NHL Season: October-April (Oct=10, Apr=4)
  if (month >= 10 || month <= 4) {
    availability.push({
      sport: 'NHL',
      apiKey: SPORT_KEYS.NHL.API,
      likelihood: 'high',
      reason: 'NHL in-season, games most days'
    });
  }
  
  // NBA Season: October-April (Oct=10, Apr=4)
  if (month >= 10 || month <= 4) {
    // NBA games typically Tue-Sun, rare on Monday
    const likelihood = dayOfWeek === 1 ? 'medium' : 'high';
    availability.push({
      sport: 'NBA',
      apiKey: SPORT_KEYS.NBA.API,
      likelihood,
      reason: dayOfWeek === 1 ? 'NBA in-season, few Monday games' : 'NBA in-season, games most days'
    });
  }
  
  // MLB Season: April-October (Apr=4, Oct=10)
  if (month >= 4 && month <= 10) {
    // MLB games every day during season
    availability.push({
      sport: 'MLB',
      apiKey: SPORT_KEYS.MLB.API,
      likelihood: 'high',
      reason: 'MLB in-season, games daily'
    });
  }
  
  // NFL Season: September-February (Sep=9, Feb=2)
  if ((month >= 9 && month <= 12) || (month >= 1 && month <= 2)) {
    // NFL only Thu, Sun, Mon during regular season
    const isGameDay = dayOfWeek === 0 || dayOfWeek === 1 || dayOfWeek === 4; // Sun, Mon, Thu
    const likelihood = isGameDay ? 'high' : 'low';
    availability.push({
      sport: 'NFL',
      apiKey: SPORT_KEYS.NFL.API,
      likelihood,
      reason: isGameDay ? 'NFL in-season, typical game day' : 'NFL in-season, but no games today'
    });
  }
  
  // NCAA Basketball: November-April (Nov=11, Apr=4)
  if (month >= 11 || month <= 4) {
    // Many games during season, but not every day
    availability.push({
      sport: 'NCAAB',
      apiKey: SPORT_KEYS.NCAAB.API,
      likelihood: 'medium',
      reason: 'College basketball season'
    });
  }
  
  // NCAA Football: September-January (Sep=9, Jan=1)
  if ((month >= 9 && month <= 12) || month === 1) {
    // Primarily Saturday games
    const likelihood = dayOfWeek === 6 ? 'high' : dayOfWeek === 5 ? 'medium' : 'low';
    availability.push({
      sport: 'NCAAF',
      apiKey: SPORT_KEYS.NCAAF.API,
      likelihood,
      reason: dayOfWeek === 6 ? 'College football Saturday' : 'College football season, primarily Saturdays'
    });
  }
  
  // Sort by likelihood: high > medium > low
  const likelihoodOrder = { high: 0, medium: 1, low: 2 };
  availability.sort((a, b) => likelihoodOrder[a.likelihood] - likelihoodOrder[b.likelihood]);
  
  return availability;
}

/**
 * Get the best sport to show odds for right now
 */
export function getBestSportForOdds(date: Date = new Date()): string {
  const available = getSportsWithGames(date);
  
  // Return the sport with highest likelihood of having games
  const best = available.find(s => s.likelihood === 'high');
  if (best) return best.apiKey;
  
  const medium = available.find(s => s.likelihood === 'medium');
  if (medium) return medium.apiKey;
  
  // Fallback to NHL if nothing else (longest season)
  return SPORT_KEYS.NHL.API;
}

/**
 * Check if a sport is in season
 */
export function isSportInSeason(sport: string, date: Date = new Date()): boolean {
  const month = date.getMonth() + 1;
  const sportKey = sport.toLowerCase();
  
  // NHL & NBA: October-April
  if (sportKey.includes('nhl') || sportKey.includes('nba')) {
    return month >= 10 || month <= 4;
  }
  
  // MLB: April-October
  if (sportKey.includes('mlb') || sportKey.includes('baseball')) {
    return month >= 4 && month <= 10;
  }
  
  // NFL: September-February
  if (sportKey.includes('nfl') && !sportKey.includes('ncaa')) {
    return (month >= 9 && month <= 12) || (month >= 1 && month <= 2);
  }
  
  // NCAAF: September-January
  if (sportKey.includes('ncaaf') || sportKey.includes('college') && sportKey.includes('football')) {
    return (month >= 9 && month <= 12) || month === 1;
  }
  
  // NCAAB: November-April
  if (sportKey.includes('ncaab') || sportKey.includes('college') && sportKey.includes('basketball')) {
    return month >= 11 || month <= 4;
  }
  
  // Unknown sport, assume in season
  return true;
}

/**
 * Get user-friendly message for offseason sports
 */
export function getOffseasonMessage(sport: string): string {
  const sportKey = sport.toLowerCase();
  
  if (sportKey.includes('nfl')) {
    return 'NFL season runs September through February (Super Bowl)';
  }
  
  if (sportKey.includes('mlb') || sportKey.includes('baseball')) {
    return 'MLB season runs April through October (World Series)';
  }
  
  if (sportKey.includes('nba')) {
    return 'NBA season runs October through April (Finals in June)';
  }
  
  if (sportKey.includes('nhl')) {
    return 'NHL season runs October through April (Stanley Cup Finals in June)';
  }
  
  if (sportKey.includes('ncaaf')) {
    return 'College football season runs September through January';
  }
  
  if (sportKey.includes('ncaab')) {
    return 'College basketball season runs November through April (March Madness)';
  }
  
  return 'This sport is currently in the offseason';
}
