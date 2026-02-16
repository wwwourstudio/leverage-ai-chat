'use client';

import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, AlertCircle, Activity, DollarSign } from 'lucide-react';
import { getSportsWithGames, getOffseasonMessage, isSportInSeason } from '@/lib/active-sports-detector';
import type { SportAvailability } from '@/lib/active-sports-detector';

interface LeagueStatus {
  sport: string;
  apiKey: string;
  inSeason: boolean;
  likelihood: 'high' | 'medium' | 'low';
  gamesAvailable: number;
  message: string;
}

export function MultiLeagueDashboard() {
  const [leagueStatuses, setLeagueStatuses] = useState<LeagueStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeagueData = async () => {
      const available = getSportsWithGames();
      
      const statuses: LeagueStatus[] = [
        { sport: 'NBA', apiKey: 'basketball_nba' },
        { sport: 'NHL', apiKey: 'icehockey_nhl' },
        { sport: 'MLB', apiKey: 'baseball_mlb' },
        { sport: 'NFL', apiKey: 'americanfootball_nfl' }
      ].map(league => {
        const availability = available.find(a => a.apiKey === league.apiKey);
        const inSeason = isSportInSeason(league.apiKey);
        
        return {
          sport: league.sport,
          apiKey: league.apiKey,
          inSeason,
          likelihood: availability?.likelihood || 'low',
          gamesAvailable: 0,
          message: availability?.reason || getOffseasonMessage(league.sport)
        };
      });

      setLeagueStatuses(statuses);
      setLoading(false);
    };

    fetchLeagueData();
  }, []);

  const getLeagueColor = (likelihood: string) => {
    switch (likelihood) {
      case 'high': return 'from-green-600 to-emerald-700';
      case 'medium': return 'from-yellow-600 to-orange-600';
      case 'low': return 'from-gray-600 to-slate-700';
      default: return 'from-gray-600 to-slate-700';
    }
  };

  const getLeagueIcon = (likelihood: string) => {
    switch (likelihood) {
      case 'high': return TrendingUp;
      case 'medium': return Activity;
      case 'low': return AlertCircle;
      default: return Calendar;
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-48 bg-gray-800 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Major Sports Leagues</h2>
          <p className="text-gray-400 text-sm">Real-time status across NBA, NHL, MLB, and NFL</p>
        </div>
        <Calendar className="h-8 w-8 text-gray-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {leagueStatuses.map(league => {
          const Icon = getLeagueIcon(league.likelihood);
          const gradient = getLeagueColor(league.likelihood);

          return (
            <div
              key={league.sport}
              className="relative overflow-hidden rounded-2xl bg-gray-800 border border-gray-700 hover:border-gray-600 transition-all duration-300 hover:scale-105"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-10`} />
              
              <div className="relative p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white">{league.sport}</h3>
                    <p className={`text-sm ${league.inSeason ? 'text-green-400' : 'text-red-400'}`}>
                      {league.inSeason ? 'In Season' : 'Offseason'}
                    </p>
                  </div>
                  <Icon className="h-8 w-8 text-gray-400" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-300 capitalize">
                      {league.likelihood} likelihood today
                    </span>
                  </div>
                  
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {league.message}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-700">
                  <button className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium text-white transition-colors">
                    View {league.sport} Odds
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="h-6 w-6 text-green-500" />
            <h3 className="font-semibold text-white">Live Odds</h3>
          </div>
          <p className="text-sm text-gray-400">
            Real-time odds across all active leagues with arbitrage detection
          </p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <Activity className="h-6 w-6 text-blue-500" />
            <h3 className="font-semibold text-white">Line Movement</h3>
          </div>
          <p className="text-sm text-gray-400">
            Track sharp money and steam moves across all major sports
          </p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <DollarSign className="h-6 w-6 text-purple-500" />
            <h3 className="font-semibold text-white">Player Props</h3>
          </div>
          <p className="text-sm text-gray-400">
            Injury-adjusted prop analysis with hit rate tracking
          </p>
        </div>
      </div>
    </div>
  );
}
