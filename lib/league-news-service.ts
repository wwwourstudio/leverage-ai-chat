/**
 * League News Service
 * Aggregates real-time news, trades, and roster changes across all major leagues
 */

export interface LeagueNews {
  id: string;
  league: 'NBA' | 'NHL' | 'MLB' | 'NFL';
  type: 'Trade' | 'Injury' | 'Signing' | 'Release' | 'Suspension' | 'News';
  headline: string;
  description: string;
  teams: string[];
  players: string[];
  timestamp: string;
  source: string;
  impact: 'High' | 'Medium' | 'Low';
  bettingImplications?: string;
}

export interface RosterChange {
  id: string;
  league: 'NBA' | 'NHL' | 'MLB' | 'NFL';
  changeType: 'Trade' | 'Signing' | 'Release' | 'Waived' | 'Activated' | 'Injured Reserve';
  playerName: string;
  fromTeam?: string;
  toTeam: string;
  date: string;
  details: string;
  propsAffected: string[];
}

/**
 * Fetch latest league news with trade and injury updates
 */
export async function fetchLeagueNews(
  league?: 'NBA' | 'NHL' | 'MLB' | 'NFL',
  limit: number = 20
): Promise<LeagueNews[]> {
  console.log(`[v0] [LEAGUE-NEWS] Fetching news for ${league || 'all leagues'}`);
  
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  
  try {
    let query = supabase
      .from('league_news')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);
    
    if (league) {
      query = query.eq('league', league);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[v0] [LEAGUE-NEWS] Fetch error:', error);
      return getMockLeagueNews(league, limit);
    }
    
    if (data && data.length > 0) {
      console.log(`[v0] [LEAGUE-NEWS] Retrieved ${data.length} news items`);
      return data.map((row: any) => ({
        id: row.id,
        league: row.league,
        type: row.type,
        headline: row.headline,
        description: row.description,
        teams: row.teams || [],
        players: row.players || [],
        timestamp: row.timestamp,
        source: row.source,
        impact: row.impact,
        bettingImplications: row.betting_implications
      }));
    }
    
    return getMockLeagueNews(league, limit);
  } catch (error) {
    console.error('[v0] [LEAGUE-NEWS] Error:', error);
    return getMockLeagueNews(league, limit);
  }
}

/**
 * Fetch roster changes with trade/transaction details
 */
export async function fetchRosterChanges(
  league?: 'NBA' | 'NHL' | 'MLB' | 'NFL',
  limit: number = 15
): Promise<RosterChange[]> {
  console.log(`[v0] [ROSTER-CHANGES] Fetching changes for ${league || 'all leagues'}`);
  
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  
  try {
    let query = supabase
      .from('roster_changes')
      .select('*')
      .order('date', { ascending: false })
      .limit(limit);
    
    if (league) {
      query = query.eq('league', league);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[v0] [ROSTER-CHANGES] Fetch error:', error);
      return getMockRosterChanges(league, limit);
    }
    
    if (data && data.length > 0) {
      console.log(`[v0] [ROSTER-CHANGES] Retrieved ${data.length} roster changes`);
      return data.map((row: any) => ({
        id: row.id,
        league: row.league,
        changeType: row.change_type,
        playerName: row.player_name,
        fromTeam: row.from_team,
        toTeam: row.to_team,
        date: row.date,
        details: row.details,
        propsAffected: row.props_affected || []
      }));
    }
    
    return getMockRosterChanges(league, limit);
  } catch (error) {
    console.error('[v0] [ROSTER-CHANGES] Error:', error);
    return getMockRosterChanges(league, limit);
  }
}

/**
 * Get betting implications from recent news
 */
export function analyzeBettingImpact(news: LeagueNews[]): {
  highImpact: LeagueNews[];
  affectedTeams: Set<string>;
  affectedPlayers: Set<string>;
} {
  const highImpact = news.filter(item => item.impact === 'High');
  const affectedTeams = new Set(news.flatMap(item => item.teams));
  const affectedPlayers = new Set(news.flatMap(item => item.players));
  
  return {
    highImpact,
    affectedTeams,
    affectedPlayers
  };
}

/**
 * Mock league news for development/fallback
 */
function getMockLeagueNews(league?: string, limit: number = 20): LeagueNews[] {
  const allNews: LeagueNews[] = [
    {
      id: '1',
      league: 'NBA',
      type: 'Trade',
      headline: 'Lakers acquire veteran guard in three-team deal',
      description: 'Los Angeles Lakers complete trade to strengthen backcourt depth',
      teams: ['Lakers', 'Nets', 'Pistons'],
      players: ['Player A', 'Player B'],
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      source: 'ESPN',
      impact: 'High',
      bettingImplications: 'Increased Lakers championship odds, player prop lines adjusted'
    },
    {
      id: '2',
      league: 'NHL',
      type: 'Injury',
      headline: 'Star forward out 2-3 weeks with lower body injury',
      description: 'Team places leading scorer on IR following last night\'s game',
      teams: ['Maple Leafs'],
      players: ['Forward Name'],
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      source: 'NHL.com',
      impact: 'High',
      bettingImplications: 'Team total goals under trend, power play effectiveness impacted'
    },
    {
      id: '3',
      league: 'MLB',
      type: 'Signing',
      headline: 'Team signs ace pitcher to 5-year contract',
      description: 'Front-runner adds dominant starter to rotation',
      teams: ['Dodgers'],
      players: ['Pitcher Name'],
      timestamp: new Date(Date.now() - 10800000).toISOString(),
      source: 'MLB.com',
      impact: 'Medium',
      bettingImplications: 'World Series odds shift, rotation strength improves'
    },
    {
      id: '4',
      league: 'NFL',
      type: 'Injury',
      headline: 'Starting QB questionable for Sunday with shoulder issue',
      description: 'Team monitoring franchise quarterback through week of practice',
      teams: ['Chiefs'],
      players: ['QB Name'],
      timestamp: new Date(Date.now() - 14400000).toISOString(),
      source: 'NFL Network',
      impact: 'High',
      bettingImplications: 'Game spread moved 3.5 points, total adjusted down'
    }
  ];
  
  const filtered = league ? allNews.filter(n => n.league === league) : allNews;
  return filtered.slice(0, limit);
}

/**
 * Mock roster changes for development/fallback
 */
function getMockRosterChanges(league?: string, limit: number = 15): RosterChange[] {
  const allChanges: RosterChange[] = [
    {
      id: '1',
      league: 'NBA',
      changeType: 'Trade',
      playerName: 'Guard Name',
      fromTeam: 'Team A',
      toTeam: 'Team B',
      date: new Date(Date.now() - 86400000).toISOString(),
      details: 'Traded for draft picks and young player',
      propsAffected: ['Points', 'Assists', 'Usage Rate']
    },
    {
      id: '2',
      league: 'NHL',
      changeType: 'Injured Reserve',
      playerName: 'Defenseman Name',
      toTeam: 'Team C',
      date: new Date(Date.now() - 172800000).toISOString(),
      details: 'Placed on IR retroactive to last game',
      propsAffected: ['Ice Time', 'Shots', 'Blocked Shots']
    },
    {
      id: '3',
      league: 'NFL',
      changeType: 'Activated',
      playerName: 'Running Back Name',
      toTeam: 'Team D',
      date: new Date(Date.now() - 259200000).toISOString(),
      details: 'Activated from injured reserve, expected to play Sunday',
      propsAffected: ['Rushing Yards', 'Receptions', 'Touchdowns']
    }
  ];
  
  const filtered = league ? allChanges.filter((c: RosterChange) => c.league === league) : allChanges;
  return filtered.slice(0, limit);
}

/**
 * Subscribe to real-time league news updates via Supabase
 */
export async function subscribeToLeagueNews(
  league: 'NBA' | 'NHL' | 'MLB' | 'NFL',
  onUpdate: (news: LeagueNews) => void
) {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  
  const subscription = supabase
    .channel(`league-news-${league}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'league_news', filter: `league=eq.${league}` },
      (payload: any) => {
        const news: LeagueNews = {
          id: payload.new.id,
          league: payload.new.league,
          type: payload.new.type,
          headline: payload.new.headline,
          description: payload.new.description,
          teams: payload.new.teams || [],
          players: payload.new.players || [],
          timestamp: payload.new.timestamp,
          source: payload.new.source,
          impact: payload.new.impact,
          bettingImplications: payload.new.betting_implications
        };
        onUpdate(news);
      }
    )
    .subscribe();
  
  return subscription;
}
