'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlayerCard } from '../shared/PlayerCard';
import { cn } from '@/lib/utils';
import type { PlayerWithVBD, DraftSimulationResult } from '@/lib/fantasy/types';

interface PlayerQueueProps {
  players: PlayerWithVBD[];
  simulationResults?: DraftSimulationResult[];
  onSelectPlayer: (playerName: string, position: string) => void;
  className?: string;
}

const POSITION_FILTERS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

export function PlayerQueue({
  players,
  simulationResults,
  onSelectPlayer,
  className,
}: PlayerQueueProps) {
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'vbd' | 'adp' | 'position' | 'survival'>('vbd');

  const simMap = useMemo(
    () => new Map((simulationResults || []).map(r => [r.playerName, r])),
    [simulationResults]
  );

  const filtered = useMemo(() => {
    let result = players;

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => p.playerName.toLowerCase().includes(q));
    }

    // Position filter
    if (positionFilter !== 'ALL') {
      result = result.filter(p => p.position === positionFilter);
    }

    // Sort
    switch (sortBy) {
      case 'vbd':
        result = [...result].sort((a, b) => b.vbd - a.vbd);
        break;
      case 'adp':
        result = [...result].sort((a, b) => a.adp - b.adp);
        break;
      case 'position':
        result = [...result].sort((a, b) => a.positionRank - b.positionRank);
        break;
      case 'survival':
        result = [...result].sort((a, b) => {
          const simA = simMap.get(a.playerName);
          const simB = simMap.get(b.playerName);
          return (simA?.survivalProbability ?? 1) - (simB?.survivalProbability ?? 1);
        });
        break;
    }

    return result;
  }, [players, search, positionFilter, sortBy, simMap]);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Search */}
      <Input
        placeholder="Search players..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="h-8 text-sm"
      />

      {/* Position filters */}
      <div className="flex flex-wrap gap-1">
        {POSITION_FILTERS.map(pos => (
          <Button
            key={pos}
            variant={positionFilter === pos ? 'default' : 'outline'}
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => setPositionFilter(pos)}
          >
            {pos}
          </Button>
        ))}
      </div>

      {/* Sort controls */}
      <div className="flex gap-1 text-[10px]">
        <span className="text-muted-foreground py-1">Sort:</span>
        {(['vbd', 'adp', 'position', 'survival'] as const).map(s => (
          <Button
            key={s}
            variant={sortBy === s ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => setSortBy(s)}
          >
            {s.toUpperCase()}
          </Button>
        ))}
      </div>

      {/* Player count */}
      <div className="text-[10px] text-muted-foreground">
        {filtered.length} players available
      </div>

      {/* Player list */}
      <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: '60vh' }}>
        {filtered.slice(0, 50).map(player => (
          <PlayerCard
            key={player.playerName}
            player={player}
            survivalProbability={simMap.get(player.playerName)?.survivalProbability}
            onClick={() => onSelectPlayer(player.playerName, player.position)}
          />
        ))}
        {filtered.length > 50 && (
          <div className="py-2 text-center text-xs text-muted-foreground">
            + {filtered.length - 50} more players
          </div>
        )}
      </div>
    </div>
  );
}
