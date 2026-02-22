'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PositionBadge } from '../shared/PositionBadge';
import { cn } from '@/lib/utils';
import type { DraftRecommendation } from '@/lib/fantasy/types';

interface PickRecommendationProps {
  bestPick: DraftRecommendation | null;
  leveragePicks: DraftRecommendation[];
  onSelectPlayer: (playerName: string, position: string) => void;
  isSimulating?: boolean;
}

export function PickRecommendation({
  bestPick,
  leveragePicks,
  onSelectPlayer,
  isSimulating,
}: PickRecommendationProps) {
  if (isSimulating) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-sm text-muted-foreground animate-pulse">
            Running {(1000).toLocaleString()} simulations...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!bestPick) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-sm text-muted-foreground">
            Click &ldquo;Simulate&rdquo; to get AI recommendations
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Best Pick */}
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="text-green-400">BEST PICK</span>
            <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-bold text-green-400">
              #{bestPick.rank}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <PositionBadge position={bestPick.position} size="lg" />
            <div className="flex-1">
              <div className="text-lg font-bold text-foreground">{bestPick.playerName}</div>
              <div className="text-xs text-muted-foreground">{bestPick.reasoning}</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-green-400">
                {bestPick.vbd.toFixed(1)}
              </div>
              <div className="text-[10px] text-muted-foreground">VBD</div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-2 rounded-lg bg-background/50 p-2">
            <StatCell
              label="Survival"
              value={`${Math.round(bestPick.survivalProbability * 100)}%`}
              color={bestPick.survivalProbability > 0.7 ? 'green' : bestPick.survivalProbability > 0.3 ? 'yellow' : 'red'}
            />
            <StatCell
              label="Roster Fit"
              value={bestPick.rosterFitScore >= 0.85 ? 'Starter' : bestPick.rosterFitScore >= 0.5 ? 'Good' : 'Bench'}
              color={bestPick.rosterFitScore >= 0.85 ? 'green' : 'yellow'}
            />
            <StatCell
              label="Scarcity"
              value={bestPick.scarcityWeight >= 0.7 ? 'High' : bestPick.scarcityWeight >= 0.4 ? 'Med' : 'Low'}
              color={bestPick.scarcityWeight >= 0.7 ? 'red' : 'yellow'}
            />
            <StatCell
              label="Utility"
              value={bestPick.utility.toFixed(2)}
              color="blue"
            />
          </div>

          <Button
            className="w-full"
            onClick={() => onSelectPlayer(bestPick.playerName, bestPick.position)}
          >
            Draft {bestPick.playerName}
          </Button>
        </CardContent>
      </Card>

      {/* Leverage Picks */}
      {leveragePicks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">LEVERAGE PICKS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {leveragePicks.map((pick, i) => (
              <div
                key={pick.playerName}
                className="flex items-center gap-3 rounded-lg border border-border/50 p-2 transition-colors hover:bg-muted/30 cursor-pointer"
                onClick={() => onSelectPlayer(pick.playerName, pick.position)}
              >
                <span className="w-5 text-center text-xs font-bold text-muted-foreground">
                  {i + 2}
                </span>
                <PositionBadge position={pick.position} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium">{pick.playerName}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {pick.reasoning}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{pick.vbd.toFixed(1)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {Math.round(pick.survivalProbability * 100)}% survive
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: 'green' | 'yellow' | 'red' | 'blue';
}) {
  const colorClasses = {
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
  };

  return (
    <div className="text-center">
      <div className={cn('text-sm font-bold', colorClasses[color])}>
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
