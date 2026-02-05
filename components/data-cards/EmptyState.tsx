'use client';

import { Info, Search, TrendingUp, DollarSign, Trophy, BarChart3, Cloud } from 'lucide-react';

interface EmptyStateProps {
  message?: string;
  className?: string;
}

const suggestions = [
  { icon: DollarSign, text: 'NFL betting lines and best value bets', category: 'Betting' },
  { icon: Trophy, text: 'NBA DFS lineup construction for tonight', category: 'DFS' },
  { icon: TrendingUp, text: 'Fantasy football waiver wire pickups for Week 10', category: 'Fantasy' },
  { icon: BarChart3, text: 'Kalshi prediction markets for upcoming games', category: 'Kalshi' },
  { icon: Cloud, text: 'Weather impact on Sunday NFL games', category: 'Weather' },
];

export function EmptyState({ 
  message = 'No live data cards available for this query.',
  className = ''
}: EmptyStateProps) {
  return (
    <div className={`ml-11 ${className}`}>
      {/* Main empty state card */}
      <div className="relative bg-gradient-to-br from-gray-900/95 via-gray-850/95 to-gray-900/95 backdrop-blur-xl rounded-2xl p-8 border border-gray-700/50 shadow-xl overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.2),transparent_50%)]" />
        </div>
        
        {/* Content */}
        <div className="relative space-y-6">
          {/* Icon and message */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <Search className="w-8 h-8 text-blue-400" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">
                {message}
              </h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
                {'Try asking about specific sports, markets, or events to get real-time insights and data-driven recommendations.'}
              </p>
            </div>
          </div>
          
          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700/50" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 text-xs font-semibold text-gray-500 bg-gray-900/95 uppercase tracking-wider">
                Example Queries
              </span>
            </div>
          </div>
          
          {/* Suggestion chips */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {suggestions.map((suggestion, index) => {
              const Icon = suggestion.icon;
              return (
                <button
                  key={index}
                  className="group relative flex items-start gap-3 p-4 rounded-xl bg-gray-800/30 hover:bg-gray-800/50 border border-gray-700/40 hover:border-gray-600/60 transition-all duration-300 text-left"
                  onClick={() => {
                    // This would trigger a query with the suggestion text
                    console.log('[v0] Empty state suggestion clicked:', suggestion.text);
                  }}
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-gray-700/40 to-gray-800/40 border border-gray-600/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icon className="w-5 h-5 text-gray-400 group-hover:text-blue-400 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      {suggestion.category}
                    </div>
                    <div className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors leading-snug">
                      {suggestion.text}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          
          {/* Help text */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-blue-300">
                {'Pro Tip'}
              </p>
              <p className="text-sm text-gray-400 leading-relaxed">
                {'Be specific with your queries by mentioning sport names (NFL, NBA, MLB), specific teams, player names, or market types (DFS, betting, fantasy, Kalshi) for the most relevant insights.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
