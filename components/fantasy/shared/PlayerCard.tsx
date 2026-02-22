'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { PositionBadge } from './PositionBadge';
import type { PlayerWithVBD } from '@/lib/fantasy/types';

interface PlayerCardProps {
  player: PlayerWithVBD;
  survivalProbability?: number;
  isRecommended?: boolean;
  onClick?: () => void;
  className?: string;
}

export function PlayerCard({
  player,
  survivalProbability,
  isRecommended,
  onClick,
  className,
}: PlayerCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:border-primary/50 hover:shadow-md',
        isRecommended && 'border-green-500/50 bg-green-500/5',
        className
      )}
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-3 p-3">
        <PositionBadge position={player.position} />

        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-foreground">
            {player.playerName}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>#{player.overallRank} Overall</span>
            <span className="text-muted-foreground/50">|</span>
            <span>#{player.positionRank} {player.position}</span>
            {player.adp > 0 && (
              <>
                <span className="text-muted-foreground/50">|</span>
                <span>ADP {player.adp.toFixed(1)}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="text-sm font-bold text-foreground">
            {player.vbd.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">VBD</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {player.projectedPoints.toFixed(1)} pts
          </div>
        </div>

        {typeof survivalProbability === 'number' && (
          <div className={cn(
            'flex flex-col items-center rounded-md px-2 py-1 text-center',
            survivalProbability > 0.7
              ? 'bg-green-500/10 text-green-400'
              : survivalProbability > 0.3
                ? 'bg-yellow-500/10 text-yellow-400'
                : 'bg-red-500/10 text-red-400'
          )}>
            <div className="text-sm font-bold">
              {Math.round(survivalProbability * 100)}%
            </div>
            <div className="text-[10px]">survive</div>
          </div>
        )}

        {player.tier && (
          <div className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            T{player.tier}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
