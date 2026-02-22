'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { DEFAULT_ROSTER_SLOTS_NFL, DEFAULT_SCORING_NFL_PPR } from '@/lib/constants';
import type { FantasySport, ScoringFormat, DraftType } from '@/lib/fantasy/types';

interface LeagueCreatorProps {
  onCreateLeague: (league: LeagueFormData) => void;
  isLoading?: boolean;
}

export interface LeagueFormData {
  name: string;
  sport: FantasySport;
  leagueSize: number;
  scoringType: ScoringFormat;
  scoringSettings: Record<string, number>;
  rosterSlots: Record<string, number>;
  draftType: DraftType;
  faabBudget: number;
  teams: { name: string }[];
}

const SPORTS: { value: FantasySport; label: string }[] = [
  { value: 'nfl', label: 'NFL' },
  { value: 'nba', label: 'NBA' },
  { value: 'mlb', label: 'MLB' },
  { value: 'nhl', label: 'NHL' },
];

const SCORING_TYPES: { value: ScoringFormat; label: string }[] = [
  { value: 'ppr', label: 'PPR' },
  { value: 'half_ppr', label: 'Half PPR' },
  { value: 'standard', label: 'Standard' },
];

const DRAFT_TYPES: { value: DraftType; label: string }[] = [
  { value: 'snake', label: 'Snake' },
  { value: 'auction', label: 'Auction' },
  { value: 'linear', label: 'Linear' },
];

export function LeagueCreator({ onCreateLeague, isLoading }: LeagueCreatorProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<LeagueFormData>({
    name: '',
    sport: 'nfl',
    leagueSize: 12,
    scoringType: 'ppr',
    scoringSettings: { ...DEFAULT_SCORING_NFL_PPR },
    rosterSlots: { ...DEFAULT_ROSTER_SLOTS_NFL },
    draftType: 'snake',
    faabBudget: 100,
    teams: Array.from({ length: 12 }, (_, i) => ({ name: `Team ${i + 1}` })),
  });

  const updateForm = (updates: Partial<LeagueFormData>) => {
    setForm(prev => ({ ...prev, ...updates }));
  };

  const handleLeagueSizeChange = (size: number) => {
    const teams = Array.from({ length: size }, (_, i) => ({
      name: form.teams[i]?.name || `Team ${i + 1}`,
    }));
    updateForm({ leagueSize: size, teams });
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create Fantasy League</CardTitle>
        <CardDescription>Step {step} of 3</CardDescription>
      </CardHeader>
      <CardContent>
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">League Name</label>
              <Input
                value={form.name}
                onChange={e => updateForm({ name: e.target.value })}
                placeholder="My Fantasy League"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Sport</label>
              <div className="flex gap-2">
                {SPORTS.map(sport => (
                  <Button
                    key={sport.value}
                    variant={form.sport === sport.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateForm({ sport: sport.value })}
                  >
                    {sport.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">League Size</label>
              <div className="flex gap-2">
                {[8, 10, 12, 14, 16].map(size => (
                  <Button
                    key={size}
                    variant={form.leagueSize === size ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleLeagueSizeChange(size)}
                  >
                    {size}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Scoring</label>
              <div className="flex gap-2">
                {SCORING_TYPES.map(st => (
                  <Button
                    key={st.value}
                    variant={form.scoringType === st.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateForm({ scoringType: st.value })}
                  >
                    {st.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Draft Type</label>
              <div className="flex gap-2">
                {DRAFT_TYPES.map(dt => (
                  <Button
                    key={dt.value}
                    variant={form.draftType === dt.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateForm({ draftType: dt.value })}
                  >
                    {dt.label}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              className="w-full mt-4"
              disabled={!form.name}
              onClick={() => setStep(2)}
            >
              Next: Team Setup
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Name the teams in your league. Team 1 is your team.
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto">
              {form.teams.map((team, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={cn(
                    'w-6 text-center text-xs font-bold',
                    i === 0 ? 'text-primary' : 'text-muted-foreground'
                  )}>
                    {i + 1}
                  </span>
                  <Input
                    value={team.name}
                    onChange={e => {
                      const teams = [...form.teams];
                      teams[i] = { name: e.target.value };
                      updateForm({ teams });
                    }}
                    className="h-8 text-sm"
                    placeholder={`Team ${i + 1}`}
                  />
                  {i === 0 && (
                    <span className="text-[10px] text-primary font-bold whitespace-nowrap">YOU</span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1">
                Next: Roster Slots
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure roster slots for your league.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(form.rosterSlots).map(([pos, count]) => (
                <div key={pos} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
                  <span className="text-sm font-medium">{pos}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        const slots = { ...form.rosterSlots };
                        slots[pos] = Math.max(0, count - 1);
                        updateForm({ rosterSlots: slots });
                      }}
                    >
                      -
                    </Button>
                    <span className="w-4 text-center text-sm font-bold">{count}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        const slots = { ...form.rosterSlots };
                        slots[pos] = count + 1;
                        updateForm({ rosterSlots: slots });
                      }}
                    >
                      +
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">FAAB Budget</label>
              <Input
                type="number"
                value={form.faabBudget}
                onChange={e => updateForm({ faabBudget: parseInt(e.target.value) || 100 })}
                className="h-8 w-32"
              />
            </div>

            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => onCreateLeague(form)}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? 'Creating...' : 'Create League'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
