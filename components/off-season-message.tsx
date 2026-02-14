'use client';

import { Calendar, Info } from 'lucide-react';

interface OffSeasonMessageProps {
  sport: string;
  sportName?: string;
  compact?: boolean;
}

export function OffSeasonMessage({ sport, sportName, compact = false }: OffSeasonMessageProps) {
  const displayName = sportName || sport.toUpperCase();
  
  const seasonInfo: Record<string, { season: string; nextStart: string }> = {
    nfl: { season: 'September - February', nextStart: 'September 2026' },
    nba: { season: 'October - June', nextStart: 'October 2026' },
    mlb: { season: 'April - October', nextStart: 'April 2026' },
    nhl: { season: 'October - June', nextStart: 'Active Season' },
    ncaaf: { season: 'September - January', nextStart: 'September 2026' },
    ncaab: { season: 'November - April', nextStart: 'November 2026' },
  };
  
  const info = seasonInfo[sport.toLowerCase()] || { season: 'Varies', nextStart: 'Check official schedule' };
  
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
        <Calendar className="h-4 w-4" />
        <span>{displayName} off-season - No live games available</span>
      </div>
    );
  }
  
  return (
    <div className="border border-border rounded-xl p-6 bg-card">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <Calendar className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-2">{displayName} Off-Season</h3>
          <p className="text-muted-foreground mb-4">
            No live games currently available. {displayName} is in its off-season.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Info className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Regular Season:</span>
              <span className="font-medium">{info.season}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Next Start:</span>
              <span className="font-medium">{info.nextStart}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Try NHL for live games, or check back during the {displayName} season for betting analysis and odds.
          </p>
        </div>
      </div>
    </div>
  );
}
