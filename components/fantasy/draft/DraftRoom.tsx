'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DraftBoard } from './DraftBoard';
import { PlayerQueue } from './PlayerQueue';
import { PickRecommendation } from './PickRecommendation';
import type {
  DraftPick,
  DraftRecommendation,
  DraftSimulationResult,
  PlayerWithVBD,
  TierCliff,
} from '@/lib/fantasy/types';

interface DraftRoomProps {
  draftRoomId: string;
  leagueId: string;
  leagueSize: number;
  totalRounds: number;
  userTeamId: string;
  teamNames: Map<string, string>;
  initialPicks: DraftPick[];
  initialPlayers: PlayerWithVBD[];
}

export function DraftRoom({
  draftRoomId,
  leagueSize,
  totalRounds,
  userTeamId,
  teamNames,
  initialPicks,
  initialPlayers,
}: DraftRoomProps) {
  const [picks, setPicks] = useState<DraftPick[]>(initialPicks);
  const [availablePlayers, setAvailablePlayers] = useState<PlayerWithVBD[]>(initialPlayers);
  const [currentPick, setCurrentPick] = useState(initialPicks.length + 1);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResults, setSimulationResults] = useState<DraftSimulationResult[]>([]);
  const [bestPick, setBestPick] = useState<DraftRecommendation | null>(null);
  const [leveragePicks, setLeveragePicks] = useState<DraftRecommendation[]>([]);
  const [tierCliffs, setTierCliffs] = useState<TierCliff[]>([]);

  const runSimulation = useCallback(async () => {
    setIsSimulating(true);
    try {
      const response = await fetch('/api/fantasy/draft/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftRoomId,
          numSimulations: 1000,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSimulationResults(data.simulation.topResults);
        setBestPick(data.recommendations.bestPick);
        setLeveragePicks(data.recommendations.leveragePicks);
        setTierCliffs(data.tierCliffs);
      }
    } catch (error) {
      console.error('Simulation error:', error);
    } finally {
      setIsSimulating(false);
    }
  }, [draftRoomId]);

  const handleSelectPlayer = useCallback(async (playerName: string, position: string) => {
    try {
      const response = await fetch('/api/fantasy/draft/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftRoomId,
          playerName,
          position,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Add pick to local state
        const newPick: DraftPick = data.pick;
        setPicks((prev: any) => [...prev, newPick]);

        // Remove player from available
        setAvailablePlayers((prev: any) => prev.filter((p: any) => p.playerName !== playerName));

        // Advance pick
        setCurrentPick(data.nextPick || currentPick + 1);

        // Clear simulation results
        setSimulationResults([]);
        setBestPick(null);
        setLeveragePicks([]);
      }
    } catch (error) {
      console.error('Pick error:', error);
    }
  }, [draftRoomId, currentPick]);

  const round = Math.ceil(currentPick / leagueSize);
  const pickInRound = ((currentPick - 1) % leagueSize) + 1;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Draft Room</h2>
          <p className="text-sm text-muted-foreground">
            Round {round}, Pick {pickInRound} (Overall #{currentPick})
          </p>
        </div>
        <Button
          onClick={runSimulation}
          disabled={isSimulating}
          variant="default"
        >
          {isSimulating ? 'Simulating...' : 'Run AI Simulation'}
        </Button>
      </div>

      {/* Tier cliff alerts */}
      {tierCliffs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tierCliffs.slice(0, 3).map((cliff: any, i: any) => (
            <div
              key={i}
              className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-xs text-yellow-400"
            >
              <span className="font-bold">{cliff.position}</span> tier cliff after{' '}
              <span className="font-bold">{cliff.cliffPlayerName}</span>{' '}
              ({cliff.dropPercentage.toFixed(1)}% drop)
            </div>
          ))}
        </div>
      )}

      {/* Main layout: 3-column */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Available Players */}
        <div className="lg:col-span-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Available Players</CardTitle>
            </CardHeader>
            <CardContent>
              <PlayerQueue
                players={availablePlayers}
                simulationResults={simulationResults}
                onSelectPlayer={handleSelectPlayer}
              />
            </CardContent>
          </Card>
        </div>

        {/* Center: Draft Board */}
        <div className="lg:col-span-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Draft Board</CardTitle>
            </CardHeader>
            <CardContent>
              <DraftBoard
                picks={picks}
                leagueSize={leagueSize}
                totalRounds={totalRounds}
                teamNames={teamNames}
                userTeamId={userTeamId}
                currentPick={currentPick}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right: AI Recommendations */}
        <div className="lg:col-span-3">
          <PickRecommendation
            bestPick={bestPick}
            leveragePicks={leveragePicks}
            onSelectPlayer={handleSelectPlayer}
            isSimulating={isSimulating}
          />
        </div>
      </div>
    </div>
  );
}
