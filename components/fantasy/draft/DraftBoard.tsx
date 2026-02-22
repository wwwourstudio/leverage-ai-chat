'use client';

import { cn } from '@/lib/utils';
import { PositionBadge } from '../shared/PositionBadge';
import type { DraftPick } from '@/lib/fantasy/types';

interface DraftBoardProps {
  picks: DraftPick[];
  leagueSize: number;
  totalRounds: number;
  teamNames: Map<string, string>;
  userTeamId: string;
  currentPick: number;
}

export function DraftBoard({
  picks,
  leagueSize,
  totalRounds,
  teamNames,
  userTeamId,
  currentPick,
}: DraftBoardProps) {
  // Build grid: rows = rounds, columns = teams
  const grid: (DraftPick | null)[][] = [];
  const teamIds = [...teamNames.keys()];

  for (let round = 1; round <= totalRounds; round++) {
    const row: (DraftPick | null)[] = [];
    for (let col = 0; col < leagueSize; col++) {
      // Snake draft: even rounds are reversed
      const teamIndex = round % 2 === 1 ? col : leagueSize - 1 - col;
      const pickNum = (round - 1) * leagueSize + col + 1;
      const pick = picks.find(p => p.pickNumber === pickNum) || null;
      row.push(pick);
    }
    grid.push(row);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-background px-2 py-1 text-left text-muted-foreground">
              Rd
            </th>
            {teamIds.map(teamId => (
              <th
                key={teamId}
                className={cn(
                  'min-w-[100px] border-b border-border/30 px-2 py-1 text-center',
                  teamId === userTeamId && 'bg-primary/10 text-primary'
                )}
              >
                <span className="truncate">{teamNames.get(teamId) || 'Team'}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row, roundIndex) => (
            <tr key={roundIndex}>
              <td className="sticky left-0 z-10 bg-background px-2 py-1 font-bold text-muted-foreground">
                {roundIndex + 1}
              </td>
              {row.map((pick, colIndex) => {
                const round = roundIndex + 1;
                const teamIndex = round % 2 === 1 ? colIndex : leagueSize - 1 - colIndex;
                const teamId = teamIds[teamIndex];
                const pickNum = roundIndex * leagueSize + colIndex + 1;
                const isCurrent = pickNum === currentPick;
                const isUserTeam = teamId === userTeamId;

                return (
                  <td
                    key={colIndex}
                    className={cn(
                      'border border-border/20 px-1 py-1 text-center transition-colors',
                      isUserTeam && 'bg-primary/5',
                      isCurrent && 'bg-yellow-500/20 ring-1 ring-yellow-500/50',
                      !pick && !isCurrent && 'bg-muted/10'
                    )}
                  >
                    {pick ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <PositionBadge position={pick.position} size="sm" />
                        <span className="truncate text-[10px] font-medium leading-tight">
                          {pick.playerName.split(' ').pop()}
                        </span>
                      </div>
                    ) : isCurrent ? (
                      <span className="text-[10px] font-bold text-yellow-400">ON CLOCK</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/30">{pickNum}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
