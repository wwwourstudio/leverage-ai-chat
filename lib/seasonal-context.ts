/**
 * Seasonal Context Utility
 * Provides context-aware messaging for sports based on their seasons
 */

export interface SeasonInfo {
  isInSeason: boolean;
  seasonName: string;
  seasonStart?: string;
  seasonEnd?: string;
  nextGameEstimate?: string;
  context: string;
}

export interface SportSeasonConfig {
  name: string;
  regularSeasonMonths: number[]; // Months when sport is in regular season (1-12)
  playoffMonths?: number[]; // Months with playoff games
  offseasonMessage: string;
  inSeasonMessage: string;
  typicalGameDays?: string[]; // ['Monday', 'Thursday', 'Sunday']
  typicalGameTime?: string; // '7:00 PM ET'
}

// Sport season configurations
const SPORT_SEASONS: Record<string, SportSeasonConfig> = {
  'americanfootball_nfl': {
    name: 'NFL',
    regularSeasonMonths: [9, 10, 11, 12], // Sept-Dec
    playoffMonths: [1], // January
    offseasonMessage: 'NFL season runs September through early February',
    inSeasonMessage: 'Games typically scheduled 24-48 hours in advance',
    typicalGameDays: ['Thursday', 'Sunday', 'Monday'],
    typicalGameTime: '1:00 PM, 4:25 PM, or 8:20 PM ET',
  },
  'americanfootball_ncaaf': {
    name: 'NCAA Football',
    regularSeasonMonths: [8, 9, 10, 11], // Aug-Nov
    playoffMonths: [12, 1], // Dec-Jan
    offseasonMessage: 'College football season runs late August through early January',
    inSeasonMessage: 'Games primarily on Saturdays',
    typicalGameDays: ['Thursday', 'Friday', 'Saturday'],
    typicalGameTime: '12:00 PM to 8:00 PM ET',
  },
  'basketball_nba': {
    name: 'NBA',
    regularSeasonMonths: [10, 11, 12, 1, 2, 3, 4], // Oct-Apr
    playoffMonths: [4, 5, 6], // Apr-June
    offseasonMessage: 'NBA season runs October through June',
    inSeasonMessage: 'Games typically scheduled 7 days a week',
    typicalGameDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    typicalGameTime: '7:00 PM to 10:30 PM ET',
  },
  'basketball_ncaab': {
    name: 'NCAA Basketball',
    regularSeasonMonths: [11, 12, 1, 2, 3], // Nov-Mar
    playoffMonths: [3], // March
    offseasonMessage: 'College basketball season runs November through early April',
    inSeasonMessage: 'Games daily, with most on weeknights',
    typicalGameDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    typicalGameTime: '6:00 PM to 9:00 PM ET',
  },
  'baseball_mlb': {
    name: 'MLB',
    regularSeasonMonths: [3, 4, 5, 6, 7, 8, 9], // Mar-Sept (season opens late March)
    playoffMonths: [10], // October
    offseasonMessage: 'MLB season runs late March/early April through October',
    inSeasonMessage: 'Games daily from March through September',
    typicalGameDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    typicalGameTime: '1:00 PM to 10:00 PM ET',
  },
  'icehockey_nhl': {
    name: 'NHL',
    regularSeasonMonths: [10, 11, 12, 1, 2, 3, 4], // Oct-Apr
    playoffMonths: [4, 5, 6], // Apr-June
    offseasonMessage: 'NHL season runs October through June',
    inSeasonMessage: 'Games typically scheduled 7 days a week',
    typicalGameDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    typicalGameTime: '7:00 PM to 10:00 PM ET',
  },
  'soccer_epl': {
    name: 'Premier League',
    regularSeasonMonths: [8, 9, 10, 11, 12, 1, 2, 3, 4, 5], // Aug-May
    playoffMonths: [],
    offseasonMessage: 'Premier League season runs August through May',
    inSeasonMessage: 'Matches primarily on weekends',
    typicalGameDays: ['Saturday', 'Sunday'],
    typicalGameTime: '10:00 AM to 12:00 PM ET',
  },
  'soccer_usa_mls': {
    name: 'MLS',
    regularSeasonMonths: [2, 3, 4, 5, 6, 7, 8, 9, 10], // Feb-Oct
    playoffMonths: [10, 11, 12], // Oct-Dec
    offseasonMessage: 'MLS season runs late February through December',
    inSeasonMessage: 'Matches primarily on weekends',
    typicalGameDays: ['Saturday', 'Sunday', 'Wednesday'],
    typicalGameTime: '3:00 PM to 10:30 PM ET',
  },
};

/**
 * Get seasonal information for a sport
 */
export function getSeasonInfo(sportKey: string, currentDate: Date = new Date()): SeasonInfo {
  const config = SPORT_SEASONS[sportKey];
  
  if (!config) {
    return {
      isInSeason: true,
      seasonName: 'Unknown',
      context: 'Season information not available. Games typically appear 24-48 hours before start time.',
    };
  }
  
  const month = currentDate.getMonth() + 1; // 1-12
  const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
  
  const isRegularSeason = config.regularSeasonMonths.includes(month);
  const isPlayoffs = config.playoffMonths?.includes(month) || false;
  const isInSeason = isRegularSeason || isPlayoffs;
  
  if (!isInSeason) {
    // Offseason
    const nextSeasonStart = getNextSeasonStart(config, currentDate);
    
    return {
      isInSeason: false,
      seasonName: 'Offseason',
      seasonStart: nextSeasonStart,
      context: config.offseasonMessage,
    };
  }
  
  // In season
  const seasonName = isPlayoffs ? 'Playoffs' : 'Regular Season';
  const isTypicalGameDay = config.typicalGameDays?.includes(dayOfWeek) || false;
  
  let context = config.inSeasonMessage;
  
  if (!isTypicalGameDay && config.typicalGameDays) {
    context = `${config.name} games typically on ${config.typicalGameDays.slice(0, -1).join(', ')} and ${config.typicalGameDays.slice(-1)[0]}. ${context}`;
  }
  
  if (config.typicalGameTime) {
    context += `. Typical game times: ${config.typicalGameTime}`;
  }
  
  return {
    isInSeason: true,
    seasonName,
    context,
    nextGameEstimate: getNextGameEstimate(config, currentDate),
  };
}

/**
 * Get estimated next season start
 */
function getNextSeasonStart(config: SportSeasonConfig, currentDate: Date): string {
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  
  const firstSeasonMonth = config.regularSeasonMonths[0];
  
  // If the first season month is later this year
  if (firstSeasonMonth > currentMonth) {
    return `${getMonthName(firstSeasonMonth)} ${currentYear}`;
  }
  
  // Otherwise, it's next year
  return `${getMonthName(firstSeasonMonth)} ${currentYear + 1}`;
}

/**
 * Get next game estimate
 */
function getNextGameEstimate(config: SportSeasonConfig, currentDate: Date): string {
  const dayOfWeek = currentDate.getDay(); // 0-6 (Sunday-Saturday)
  
  if (!config.typicalGameDays || config.typicalGameDays.length === 0) {
    return 'Check back 24-48 hours before game time';
  }
  
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const typicalGameDayIndices = config.typicalGameDays.map(day => daysOfWeek.indexOf(day));
  
  // Find next game day
  let daysUntilNextGame = 7;
  for (const gameDay of typicalGameDayIndices) {
    let daysAway = (gameDay - dayOfWeek + 7) % 7;
    if (daysAway === 0) daysAway = 7; // If today is a game day, look to next week
    if (daysAway < daysUntilNextGame) {
      daysUntilNextGame = daysAway;
    }
  }
  
  if (daysUntilNextGame <= 1) {
    return 'Games likely scheduled for tomorrow or later today';
  } else if (daysUntilNextGame <= 3) {
    return `Next games typically in ${daysUntilNextGame} days`;
  }
  
  return 'Check back 24-48 hours before game time';
}

/**
 * Get month name from number (1-12)
 */
function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || 'Unknown';
}

/**
 * Generate user-friendly message when no data is available
 */
export function generateNoDataMessage(sportKey: string, reason?: string): {
  title: string;
  description: string;
  suggestion: string;
} {
  const seasonInfo = getSeasonInfo(sportKey);
  
  if (!seasonInfo.isInSeason) {
    return {
      title: `${SPORT_SEASONS[sportKey]?.name || 'Sport'} Offseason`,
      description: seasonInfo.context,
      suggestion: `Next season starts: ${seasonInfo.seasonStart}`,
    };
  }
  
  if (reason === 'api_error') {
    return {
      title: 'Data Temporarily Unavailable',
      description: 'Unable to fetch live odds data at this time',
      suggestion: 'Try again in a few minutes or check sportsbook websites directly',
    };
  }
  
  if (reason === 'rate_limited') {
    return {
      title: 'API Rate Limit Reached',
      description: 'Too many requests in a short period',
      suggestion: 'Wait 1-2 minutes before requesting more data',
    };
  }
  
  return {
    title: 'No Games Currently Scheduled',
    description: seasonInfo.context,
    suggestion: seasonInfo.nextGameEstimate || 'Check back later today',
  };
}
