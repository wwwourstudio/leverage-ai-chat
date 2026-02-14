/**
 * Matchup-Specific Analysis Engine
 * Analyzes team performance against specific opponents
 */

import { createClient } from '@supabase/supabase-js';

interface MatchupHistory {
  team1: string;
  team2: string;
  games: Array<{
    date: string;
    team1Score: number;
    team2Score: number;
    winner: string;
    venue: string;
  }>;
  stats: {
    totalGames: number;
    team1Wins: number;
    team2Wins: number;
    team1AvgPoints: number;
    team2AvgPoints: number;
    lastMeetingDate: string;
  };
}

export async function analyzeMatchup(
  team1: string,
  team2: string,
  sport: string,
  lastNGames: number = 10
): Promise<MatchupHistory> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase not configured');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Query matchup history
  const { data: games, error } = await supabase
    .from('matchup_history')
    .select('*')
    .eq('sport', sport.toLowerCase())
    .or(`and(team1.eq.${team1},team2.eq.${team2}),and(team1.eq.${team2},team2.eq.${team1})`)
    .order('date', { ascending: false })
    .limit(lastNGames);

  if (error) throw error;

  // Calculate statistics
  const team1Wins = games?.filter(g => g.winner === team1).length || 0;
  const team2Wins = games?.filter(g => g.winner === team2).length || 0;

  const team1Points = games?.map(g => 
    g.team1 === team1 ? g.team1_score : g.team2_score
  ) || [];
  const team2Points = games?.map(g => 
    g.team1 === team2 ? g.team1_score : g.team2_score
  ) || [];

  return {
    team1,
    team2,
    games: games?.map(g => ({
      date: g.date,
      team1Score: g.team1_score,
      team2Score: g.team2_score,
      winner: g.winner,
      venue: g.venue
    })) || [],
    stats: {
      totalGames: games?.length || 0,
      team1Wins,
      team2Wins,
      team1AvgPoints: team1Points.length > 0 
        ? Math.round(team1Points.reduce((a, b) => a + b, 0) / team1Points.length * 10) / 10
        : 0,
      team2AvgPoints: team2Points.length > 0
        ? Math.round(team2Points.reduce((a, b) => a + b, 0) / team2Points.length * 10) / 10
        : 0,
      lastMeetingDate: games?.[0]?.date || 'N/A'
    }
  };
}

export async function getVenueImpact(
  team: string,
  venue: string,
  sport: string
): Promise<{
  homeRecord: string;
  awayRecord: string;
  homeAvgPoints: number;
  awayAvgPoints: number;
  venueAdvantage: number;
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase not configured');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: venueData } = await supabase
    .from('venue_splits')
    .select('*')
    .eq('team_name', team)
    .eq('venue', venue)
    .single();

  if (!venueData) {
    return {
      homeRecord: 'N/A',
      awayRecord: 'N/A',
      homeAvgPoints: 0,
      awayAvgPoints: 0,
      venueAdvantage: 0
    };
  }

  return {
    homeRecord: `${venueData.home_wins}-${venueData.home_losses}`,
    awayRecord: `${venueData.away_wins}-${venueData.away_losses}`,
    homeAvgPoints: venueData.home_avg_points,
    awayAvgPoints: venueData.away_avg_points,
    venueAdvantage: venueData.home_avg_points - venueData.away_avg_points
  };
}
