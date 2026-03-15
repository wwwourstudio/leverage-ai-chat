'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Check, ChevronLeft, ChevronRight, Users, Upload, Bot, FileText, X, CheckCircle2, AlertCircle } from 'lucide-react';
import type { FantasySport, DraftType } from '@/lib/fantasy/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types & interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface LeagueFormData {
  name: string;
  sport: FantasySport;
  platform: string;
  leagueSize: number;
  leagueType: string;        // 'ppr' | 'half_ppr' | 'standard' | 'h2h' | 'roto' | 'roto_h2h'
  scoringType: string;
  scoringSettings: Record<string, number>;
  rosterSlots: Record<string, number>;
  draftType: DraftType;
  faabBudget: number;
  teams: { name: string }[];
}

interface LeagueCreatorProps {
  onCreateLeague: (league: LeagueFormData) => void;
  isLoading?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SPORTS = [
  { value: 'nfl' as FantasySport, label: 'Football', icon: '🏈', color: 'from-green-600 to-emerald-700', border: 'border-green-500/40 hover:border-green-400/70', selected: 'border-green-400 bg-green-500/15' },
  { value: 'mlb' as FantasySport, label: 'Baseball', icon: '⚾', color: 'from-blue-600 to-indigo-700', border: 'border-blue-500/40 hover:border-blue-400/70', selected: 'border-blue-400 bg-blue-500/15' },
  { value: 'nba' as FantasySport, label: 'Basketball', icon: '🏀', color: 'from-orange-500 to-red-600', border: 'border-orange-500/40 hover:border-orange-400/70', selected: 'border-orange-400 bg-orange-500/15' },
  { value: 'nhl' as FantasySport, label: 'Hockey', icon: '🏒', color: 'from-sky-600 to-blue-700', border: 'border-sky-500/40 hover:border-sky-400/70', selected: 'border-sky-400 bg-sky-500/15' },
] as const;

const PLATFORMS: Record<string, Array<{ value: string; label: string; accent: string }>> = {
  nfl: [
    { value: 'espn',    label: 'ESPN',    accent: 'border-red-500/40 hover:border-red-400/70 data-[active]:border-red-400 data-[active]:bg-red-500/15' },
    { value: 'yahoo',   label: 'Yahoo',   accent: 'border-purple-500/40 hover:border-purple-400/70 data-[active]:border-purple-400 data-[active]:bg-purple-500/15' },
    { value: 'fantrax', label: 'Fantrax', accent: 'border-blue-500/40 hover:border-blue-400/70 data-[active]:border-blue-400 data-[active]:bg-blue-500/15' },
    { value: 'cbs',     label: 'CBS',     accent: 'border-sky-500/40 hover:border-sky-400/70 data-[active]:border-sky-400 data-[active]:bg-sky-500/15' },
    { value: 'nfl_com', label: 'NFL.com', accent: 'border-indigo-500/40 hover:border-indigo-400/70 data-[active]:border-indigo-400 data-[active]:bg-indigo-500/15' },
  ],
  mlb: [
    { value: 'espn',    label: 'ESPN',    accent: 'border-red-500/40 hover:border-red-400/70 data-[active]:border-red-400 data-[active]:bg-red-500/15' },
    { value: 'yahoo',   label: 'Yahoo',   accent: 'border-purple-500/40 hover:border-purple-400/70 data-[active]:border-purple-400 data-[active]:bg-purple-500/15' },
    { value: 'fantrax', label: 'Fantrax', accent: 'border-blue-500/40 hover:border-blue-400/70 data-[active]:border-blue-400 data-[active]:bg-blue-500/15' },
    { value: 'cbs',     label: 'CBS',     accent: 'border-sky-500/40 hover:border-sky-400/70 data-[active]:border-sky-400 data-[active]:bg-sky-500/15' },
    { value: 'nfbc',    label: 'NFBC',    accent: 'border-emerald-500/40 hover:border-emerald-400/70 data-[active]:border-emerald-400 data-[active]:bg-emerald-500/15' },
  ],
  nba: [
    { value: 'espn',    label: 'ESPN',    accent: 'border-red-500/40 hover:border-red-400/70 data-[active]:border-red-400 data-[active]:bg-red-500/15' },
    { value: 'yahoo',   label: 'Yahoo',   accent: 'border-purple-500/40 hover:border-purple-400/70 data-[active]:border-purple-400 data-[active]:bg-purple-500/15' },
    { value: 'fantrax', label: 'Fantrax', accent: 'border-blue-500/40 hover:border-blue-400/70 data-[active]:border-blue-400 data-[active]:bg-blue-500/15' },
    { value: 'cbs',     label: 'CBS',     accent: 'border-sky-500/40 hover:border-sky-400/70 data-[active]:border-sky-400 data-[active]:bg-sky-500/15' },
  ],
  nhl: [
    { value: 'espn',    label: 'ESPN',    accent: 'border-red-500/40 hover:border-red-400/70 data-[active]:border-red-400 data-[active]:bg-red-500/15' },
    { value: 'yahoo',   label: 'Yahoo',   accent: 'border-purple-500/40 hover:border-purple-400/70 data-[active]:border-purple-400 data-[active]:bg-purple-500/15' },
    { value: 'fantrax', label: 'Fantrax', accent: 'border-blue-500/40 hover:border-blue-400/70 data-[active]:border-blue-400 data-[active]:bg-blue-500/15' },
    { value: 'cbs',     label: 'CBS',     accent: 'border-sky-500/40 hover:border-sky-400/70 data-[active]:border-sky-400 data-[active]:bg-sky-500/15' },
  ],
};

const LEAGUE_TYPES: Record<string, Array<{ value: string; label: string; desc: string; emoji: string }>> = {
  nfl: [
    { value: 'ppr',      label: 'PPR',        desc: '1 point per reception',     emoji: '🎯' },
    { value: 'half_ppr', label: 'Half PPR',   desc: '0.5 pts per reception',     emoji: '⚖️' },
    { value: 'standard', label: 'Standard',   desc: 'No reception points',       emoji: '📋' },
  ],
  mlb: [
    { value: 'h2h',      label: 'Head-to-Head', desc: 'Weekly matchup format',   emoji: '⚔️' },
    { value: 'roto',     label: 'Rotisserie',   desc: 'Season-long standings',   emoji: '📊' },
    { value: 'roto_h2h', label: 'Roto H2H',     desc: 'H2H with roto scoring',  emoji: '🔄' },
  ],
  nba: [
    { value: 'h2h',  label: 'Head-to-Head', desc: 'Weekly matchup format',       emoji: '⚔️' },
    { value: 'roto', label: 'Rotisserie',   desc: 'Season-long standings',       emoji: '📊' },
  ],
  nhl: [
    { value: 'h2h',  label: 'Head-to-Head', desc: 'Weekly matchup format',       emoji: '⚔️' },
    { value: 'roto', label: 'Rotisserie',   desc: 'Season-long standings',       emoji: '📊' },
  ],
};

// Roster slot defaults per sport, and NFBC override for baseball
const DEFAULT_ROSTERS: Record<string, Record<string, number>> = {
  nfl:      { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, 'D/ST': 1, K: 1, BN: 6 },
  mlb:      { C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1, MI: 1, CI: 1, OF: 3, UTIL: 1, SP: 5, RP: 3, BN: 5 },
  mlb_nfbc: { C: 2, '1B': 1, '2B': 1, '3B': 1, SS: 1, MI: 1, CI: 1, OF: 5, UTIL: 1, P: 9, BN: 8 },
  nba:      { PG: 1, SG: 1, SF: 1, PF: 1, C: 1, G: 1, F: 1, UTIL: 2, BN: 4 },
  nhl:      { C: 2, LW: 2, RW: 2, D: 4, G: 2, UTIL: 1, BN: 4 },
};

const SCORING_DEFAULTS: Record<string, Record<string, number>> = {
  nfl_ppr:      { pass_yards_per_point: 25, pass_td: 4, interception: -2, rush_yards_per_point: 10, rush_td: 6, reception: 1, receiving_yards_per_point: 10, receiving_td: 6 },
  nfl_half_ppr: { pass_yards_per_point: 25, pass_td: 4, interception: -2, rush_yards_per_point: 10, rush_td: 6, reception: 0.5, receiving_yards_per_point: 10, receiving_td: 6 },
  nfl_standard: { pass_yards_per_point: 25, pass_td: 4, interception: -2, rush_yards_per_point: 10, rush_td: 6, reception: 0, receiving_yards_per_point: 10, receiving_td: 6 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getDefaultRoster(sport: FantasySport, platform: string): Record<string, number> {
  if (sport === 'mlb' && platform === 'nfbc') return { ...DEFAULT_ROSTERS.mlb_nfbc };
  return { ...(DEFAULT_ROSTERS[sport] ?? DEFAULT_ROSTERS.nfl) };
}

function getTeamSizes(sport: FantasySport, platform: string): number[] {
  if (platform === 'nfbc') return [12, 15];
  return Array.from({ length: 23 }, (_, i) => i + 8); // 8..30
}

function getSportMeta(sport: FantasySport) {
  return SPORTS.find(s => s.value === sport) ?? SPORTS[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Step indicator
// ─────────────────────────────────────────────────────────────────────────────

function StepIndicator({ step, labels }: { step: number; labels: string[] }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {labels.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
        return (
          <div key={n} className="flex items-center gap-1">
            <div className={cn(
              'flex flex-col items-center gap-0.5',
            )}>
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-all duration-200',
                done   ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-400'
                : active ? 'bg-blue-500/20 border-blue-400/80 text-blue-300'
                : 'bg-[oklch(0.14_0.01_280)] border-[oklch(0.22_0.02_280)] text-[oklch(0.45_0.01_280)]',
              )}>
                {done ? <Check className="w-3.5 h-3.5" /> : n}
              </div>
              <span className={cn(
                'text-[9px] font-medium whitespace-nowrap',
                active ? 'text-blue-300' : done ? 'text-emerald-400' : 'text-[oklch(0.35_0.01_280)]',
              )}>{label}</span>
            </div>
            {i < labels.length - 1 && (
              <div className={cn(
                'w-6 h-px mb-3 transition-all duration-200',
                step > n ? 'bg-emerald-500/50' : 'bg-[oklch(0.22_0.02_280)]',
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface NfbcFileSlot {
  key: 'adp' | 'freeAgents' | 'tsx';
  label: string;
  hint: string;
  file: File | null;
  error: string | null;
}

export function LeagueCreator({ onCreateLeague, isLoading }: LeagueCreatorProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [form, setForm] = useState<LeagueFormData>({
    name: '',
    sport: 'nfl',
    platform: 'espn',
    leagueSize: 12,
    leagueType: 'ppr',
    scoringType: 'ppr',
    scoringSettings: { ...SCORING_DEFAULTS.nfl_ppr },
    rosterSlots: { ...DEFAULT_ROSTERS.nfl },
    draftType: 'snake',
    faabBudget: 100,
    teams: Array.from({ length: 12 }, (_, i) => ({ name: `Team ${i + 1}` })),
  });

  const update = (patch: Partial<LeagueFormData>) =>
    setForm(prev => ({ ...prev, ...patch }));

  const sportMeta = getSportMeta(form.sport);

  // ── NFBC file upload state ─────────────────────────────────────────────────
  const [nfbcSlots, setNfbcSlots] = useState<NfbcFileSlot[]>([
    { key: 'adp',        label: 'Draft ADP CSV',            hint: 'Expected columns: Rank, Player, Team, Pos, ADP', file: null, error: null },
    { key: 'freeAgents', label: 'Free Agents Available CSV', hint: 'Expected columns: Player, Team, Pos, Status',    file: null, error: null },
    { key: 'tsx',        label: 'TSX Export CSV',            hint: 'Expected columns: Player, Team, Pos, Stats',     file: null, error: null },
  ]);
  const [nfbcAiAnalysis, setNfbcAiAnalysis] = useState('');
  const [nfbcAiLoading, setNfbcAiLoading] = useState(false);
  const [nfbcDraggingKey, setNfbcDraggingKey] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const hasAnyNfbcFile = nfbcSlots.some(s => s.file !== null);

  const handleNfbcFile = useCallback(async (key: NfbcFileSlot['key'], file: File) => {
    // Validate type and size
    if (!file.name.endsWith('.csv')) {
      setNfbcSlots(prev => prev.map(s => s.key === key ? { ...s, error: 'Only .csv files are accepted' } : s));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setNfbcSlots(prev => prev.map(s => s.key === key ? { ...s, error: 'File too large (max 5 MB)' } : s));
      return;
    }

    setNfbcSlots(prev => prev.map(s => s.key === key ? { ...s, file, error: null } : s));

    // Persist to user files via adp/upload
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sport', 'mlb');
      await fetch('/api/adp/upload', { method: 'POST', body: formData });
    } catch {
      // non-fatal — file is still stored in component state for AI analysis
    }
  }, []);

  const triggerNfbcAiAnalysis = useCallback(async (slots: NfbcFileSlot[]) => {
    const uploadedSlots = slots.filter(s => s.file !== null);
    if (uploadedSlots.length === 0) return;

    setNfbcAiLoading(true);
    setNfbcAiAnalysis('');

    try {
      // Read uploaded CSV content
      const fileTexts = await Promise.all(
        uploadedSlots.map(s => new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve(`### ${s.label}\n${(e.target?.result as string).slice(0, 3000)}`);
          reader.onerror = reject;
          reader.readAsText(s.file!);
        }))
      );

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: `You are analyzing NFBC fantasy baseball data. Based on the uploaded CSV files, provide: 1) Top 20 player rankings, 2) Position scarcity analysis, 3) Draft strategy recommendations, 4) Key sleepers and value picks.\n\n${fileTexts.join('\n\n')}`,
          context: { sport: 'mlb', selectedCategory: 'fantasy', hasFantasyIntent: true },
        }),
      });

      if (!res.ok || !res.body) {
        setNfbcAiAnalysis('Unable to generate analysis. Please try again.');
        return;
      }

      // Parse SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') break;
            try {
              const parsed = JSON.parse(payload);
              const text = parsed.text ?? parsed.content ?? parsed.chunk ?? '';
              if (text) setNfbcAiAnalysis(prev => prev + text);
            } catch {
              // skip unparseable SSE lines
            }
          }
        }
      }
    } catch {
      setNfbcAiAnalysis('Analysis failed. Your files were saved — continue to the next step.');
    } finally {
      setNfbcAiLoading(false);
    }
  }, []);

  // ── Step 1: Sport ──────────────────────────────────────────────────────────
  const StepSport = () => (
    <div className="space-y-3">
      <p className="text-sm text-[oklch(0.55_0.01_280)] mb-4">What sport is your fantasy league?</p>
      <div className="grid grid-cols-2 gap-3">
        {SPORTS.map(s => (
          <button
            key={s.value}
            onClick={() => {
              const defaultPlatform = PLATFORMS[s.value][0].value;
              const defaultType = LEAGUE_TYPES[s.value][0].value;
              const defaultRoster = getDefaultRoster(s.value, defaultPlatform);
              const scoringKey = s.value === 'nfl' ? `nfl_${defaultType}` : '';
              update({
                sport: s.value,
                platform: defaultPlatform,
                leagueType: defaultType,
                scoringType: defaultType,
                rosterSlots: defaultRoster,
                scoringSettings: SCORING_DEFAULTS[scoringKey] ?? {},
              });
            }}
            className={cn(
              'relative rounded-xl border p-4 text-left transition-all duration-200 overflow-hidden group',
              form.sport === s.value ? s.selected : `${s.border} bg-[oklch(0.11_0.01_280)]`,
            )}
          >
            <div className={cn(
              'absolute inset-0 opacity-0 bg-gradient-to-br transition-opacity duration-200',
              s.color,
              form.sport === s.value ? 'opacity-5' : 'group-hover:opacity-5',
            )} />
            <div className="relative">
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className="text-sm font-bold text-[oklch(0.90_0.005_85)]">{s.label}</div>
              {form.sport === s.value && (
                <div className="absolute top-0 right-0">
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
      <Button className="w-full mt-4" onClick={() => setStep(2)}>
        Continue <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );

  // ── Step 2: Platform ───────────────────────────────────────────────────────
  const StepPlatform = () => {
    const platforms = PLATFORMS[form.sport] ?? PLATFORMS.nfl;
    return (
      <div className="space-y-3">
        <p className="text-sm text-[oklch(0.55_0.01_280)] mb-4">
          Which platform is your {sportMeta.label} league on?
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {platforms.map(p => (
            <button
              key={p.value}
              data-active={form.platform === p.value ? '' : undefined}
              onClick={() => {
                const newRoster = getDefaultRoster(form.sport, p.value);
                const sizes = getTeamSizes(form.sport, p.value);
                const newSize = sizes.includes(form.leagueSize) ? form.leagueSize : sizes[sizes.length > 1 ? Math.floor(sizes.length / 2) : 0];
                const newTeams = Array.from({ length: newSize }, (_, i) => ({
                  name: form.teams[i]?.name || `Team ${i + 1}`,
                }));
                const leagueTypeOverride = p.value === 'nfbc' && form.sport === 'mlb'
                  ? { leagueType: 'roto', scoringType: 'roto' }
                  : {};
                update({ platform: p.value, rosterSlots: newRoster, leagueSize: newSize, teams: newTeams, ...leagueTypeOverride });
              }}
              className={cn(
                'rounded-xl border px-4 py-3 text-sm font-semibold transition-all duration-200',
                p.accent,
                form.platform === p.value
                  ? ''
                  : 'bg-[oklch(0.11_0.01_280)] text-[oklch(0.70_0.01_280)]',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <NavButtons onBack={() => setStep(1)} onNext={() => setStep(3)} />
      </div>
    );
  };

  // ── Step 3: Team count slider ───────────────────────────────────────────────
  const StepTeams = () => {
    const sizes = getTeamSizes(form.sport, form.platform);
    const isNfbc = form.platform === 'nfbc';

    return (
      <div className="space-y-4">
        <p className="text-sm text-[oklch(0.55_0.01_280)] mb-4">
          How many teams are in your league?
        </p>

        {isNfbc ? (
          // NFBC: only 2 options
          <div className="grid grid-cols-2 gap-3">
            {sizes.map(sz => (
              <button
                key={sz}
                onClick={() => {
                  const teams = Array.from({ length: sz }, (_, i) => ({ name: form.teams[i]?.name || `Team ${i + 1}` }));
                  update({ leagueSize: sz, teams });
                }}
                className={cn(
                  'rounded-xl border py-5 text-2xl font-black transition-all duration-200',
                  form.leagueSize === sz
                    ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
                    : 'border-[oklch(0.22_0.02_280)] bg-[oklch(0.11_0.01_280)] text-[oklch(0.70_0.01_280)] hover:border-[oklch(0.32_0.02_280)]',
                )}
              >
                {sz}
                <span className="block text-[10px] font-normal text-[oklch(0.45_0.01_280)] mt-0.5">teams</span>
              </button>
            ))}
          </div>
        ) : (
          // Slider 8-30
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="flex flex-col items-center">
                <span className="text-5xl font-black text-[oklch(0.95_0.005_85)] tabular-nums">{form.leagueSize}</span>
                <span className="text-xs text-[oklch(0.45_0.01_280)] mt-1">teams</span>
              </div>
            </div>
            <div className="px-2">
              <input
                type="range"
                min={8}
                max={30}
                step={1}
                value={form.leagueSize}
                onChange={e => {
                  const sz = parseInt(e.target.value);
                  const teams = Array.from({ length: sz }, (_, i) => ({ name: form.teams[i]?.name || `Team ${i + 1}` }));
                  update({ leagueSize: sz, teams });
                }}
                className="w-full accent-blue-400 h-2 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[oklch(0.40_0.01_280)] mt-1 px-0.5">
                <span>8</span>
                <span>16</span>
                <span>24</span>
                <span>30</span>
              </div>
            </div>

            {/* Quick-pick row */}
            <div className="flex gap-2 flex-wrap justify-center">
              {[8, 10, 12, 14, 16, 20].map(sz => (
                <button
                  key={sz}
                  onClick={() => {
                    const teams = Array.from({ length: sz }, (_, i) => ({ name: form.teams[i]?.name || `Team ${i + 1}` }));
                    update({ leagueSize: sz, teams });
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150',
                    form.leagueSize === sz
                      ? 'border-blue-400 bg-blue-500/15 text-blue-300'
                      : 'border-[oklch(0.22_0.02_280)] bg-[oklch(0.11_0.01_280)] text-[oklch(0.55_0.01_280)] hover:border-[oklch(0.30_0.02_280)]',
                  )}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[oklch(0.10_0.01_280)] border border-[oklch(0.18_0.015_280)]">
          <Users className="w-3.5 h-3.5 text-[oklch(0.45_0.01_280)]" />
          <span className="text-[11px] text-[oklch(0.50_0.01_280)]">{form.leagueSize}-team league · {form.platform.toUpperCase()} · {sportMeta.icon} {sportMeta.label}</span>
        </div>

        <NavButtons onBack={() => setStep(2)} onNext={() => setStep(4)} />
      </div>
    );
  };

  // ── Step 4: League type ────────────────────────────────────────────────────
  const StepLeagueType = () => {
    const allTypes = LEAGUE_TYPES[form.sport] ?? LEAGUE_TYPES.nfl;
    // NFBC only supports Rotisserie format
    const types = form.platform === 'nfbc' ? allTypes.filter(t => t.value === 'roto') : allTypes;
    return (
      <div className="space-y-3">
        <p className="text-sm text-[oklch(0.55_0.01_280)] mb-4">
          What scoring format does your league use?
        </p>
        {form.platform === 'nfbc' && (
          <p className="text-xs text-emerald-400/70">
            NFBC leagues use Rotisserie scoring exclusively.
          </p>
        )}
        <div className="space-y-2.5">
          {types.map(t => (
            <button
              key={t.value}
              onClick={() => {
                const scoringKey = form.sport === 'nfl' ? `nfl_${t.value}` : '';
                update({
                  leagueType: t.value,
                  scoringType: t.value,
                  scoringSettings: SCORING_DEFAULTS[scoringKey] ?? {},
                });
              }}
              className={cn(
                'w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200',
                form.leagueType === t.value
                  ? 'border-blue-400 bg-blue-500/10'
                  : 'border-[oklch(0.22_0.02_280)] bg-[oklch(0.11_0.01_280)] hover:border-[oklch(0.30_0.02_280)]',
              )}
            >
              <span className="text-xl">{t.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className={cn('text-sm font-bold', form.leagueType === t.value ? 'text-blue-300' : 'text-[oklch(0.88_0.005_85)]')}>{t.label}</div>
                <div className="text-xs text-[oklch(0.45_0.01_280)]">{t.desc}</div>
              </div>
              {form.leagueType === t.value && (
                <Check className="w-4 h-4 text-blue-400 shrink-0" />
              )}
            </button>
          ))}
        </div>
        <NavButtons onBack={() => setStep(3)} onNext={() => setStep(5)} />
      </div>
    );
  };

  // ── Step 4 (NFBC only): AI file upload ────────────────────────────────────
  const StepNFBCUpload = () => (
    <div className="space-y-4">
      <p className="text-sm font-bold text-emerald-300 mb-1">Set Up Your Fantasy League with AI</p>
      <p className="text-xs text-[oklch(0.50_0.01_280)] mb-3">
        Upload your NFBC CSV exports and our AI will generate draft strategy, rankings, and roster recommendations.
      </p>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* ── Left: File upload slots ── */}
        <div className="flex-1 space-y-3 min-w-0">
          {nfbcSlots.map(slot => (
            <div key={slot.key} className="relative">
              <input
                type="file"
                accept=".csv"
                ref={el => { fileInputRefs.current[slot.key] = el; }}
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) {
                    handleNfbcFile(slot.key, f);
                    setNfbcSlots(prev => {
                      const updated = prev.map(s => s.key === slot.key ? { ...s, file: f, error: null } : s);
                      const wasEmpty = prev.every(s => s.file === null);
                      if (wasEmpty) triggerNfbcAiAnalysis(updated);
                      return updated;
                    });
                  }
                  e.target.value = '';
                }}
              />
              <div
                onDragOver={e => { e.preventDefault(); setNfbcDraggingKey(slot.key); }}
                onDragLeave={() => setNfbcDraggingKey(null)}
                onDrop={e => {
                  e.preventDefault();
                  setNfbcDraggingKey(null);
                  const f = e.dataTransfer.files[0];
                  if (f) {
                    handleNfbcFile(slot.key, f);
                    setNfbcSlots(prev => {
                      const updated = prev.map(s => s.key === slot.key ? { ...s, file: f, error: null } : s);
                      const wasEmpty = prev.every(s => s.file === null);
                      if (wasEmpty) triggerNfbcAiAnalysis(updated);
                      return updated;
                    });
                  }
                }}
                className={cn(
                  'rounded-xl border-2 border-dashed px-4 py-3 transition-all cursor-pointer',
                  nfbcDraggingKey === slot.key
                    ? 'border-emerald-400 bg-emerald-500/10'
                    : slot.file
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-[oklch(0.24_0.02_280)] bg-[oklch(0.11_0.01_280)] hover:border-[oklch(0.32_0.02_280)]',
                )}
                onClick={() => !slot.file && fileInputRefs.current[slot.key]?.click()}
              >
                <div className="flex items-center gap-3">
                  {slot.file ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Upload className="w-4 h-4 text-[oklch(0.45_0.01_280)] shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs font-semibold truncate', slot.file ? 'text-emerald-300' : 'text-[oklch(0.75_0.005_85)]')}>{slot.label}</p>
                    <p className="text-[10px] text-[oklch(0.40_0.01_280)] truncate mt-0.5">
                      {slot.file ? slot.file.name : slot.hint}
                    </p>
                  </div>
                  {slot.file && (
                    <button
                      onClick={e => { e.stopPropagation(); setNfbcSlots(prev => prev.map(s => s.key === slot.key ? { ...s, file: null, error: null } : s)); }}
                      className="p-1 rounded-lg hover:bg-red-500/15 text-[oklch(0.45_0.01_280)] hover:text-red-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {!slot.file && (
                    <button
                      onClick={e => { e.stopPropagation(); fileInputRefs.current[slot.key]?.click(); }}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-[oklch(0.65_0.01_280)] border border-[oklch(0.24_0.02_280)] hover:border-emerald-500/50 hover:text-emerald-400 transition-all"
                    >
                      Select
                    </button>
                  )}
                </div>
                {slot.error && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                    <p className="text-[10px] text-red-400">{slot.error}</p>
                  </div>
                )}
              </div>
            </div>
          ))}

          <p className="text-[10px] text-[oklch(0.35_0.01_280)] px-1">
            CSV files only · Max 5 MB each · Files are saved to your account
          </p>
        </div>

        {/* ── Right: AI panel ── */}
        <div
          className="lg:w-56 rounded-xl border flex flex-col overflow-hidden"
          style={{ background: 'oklch(0.09 0.01 280)', borderColor: 'oklch(0.20 0.02 280)' }}
        >
          <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: 'oklch(0.17 0.015 280)' }}>
            <Bot className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-300">AI Analysis</span>
          </div>
          <div className="flex-1 p-3 overflow-y-auto max-h-52 text-[11px] text-[oklch(0.65_0.005_85)] leading-relaxed">
            {nfbcAiLoading ? (
              <div className="flex items-center gap-2 text-emerald-400">
                <div className="w-3 h-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                <span>Analyzing your data…</span>
              </div>
            ) : nfbcAiAnalysis ? (
              <div className="whitespace-pre-wrap">{nfbcAiAnalysis}</div>
            ) : (
              <div className="flex flex-col items-center justify-center h-28 gap-2 text-center">
                <FileText className="w-7 h-7 text-[oklch(0.28_0.015_280)]" />
                <p className="text-[oklch(0.38_0.01_280)]">Upload a CSV to activate AI analysis</p>
              </div>
            )}
          </div>
          {hasAnyNfbcFile && !nfbcAiLoading && !nfbcAiAnalysis && (
            <div className="px-3 pb-2.5">
              <button
                onClick={() => triggerNfbcAiAnalysis(nfbcSlots)}
                className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition-all"
              >
                Re-run Analysis
              </button>
            </div>
          )}
        </div>
      </div>

      <NavButtons onBack={() => setStep(3)} onNext={() => setStep(5)} />
    </div>
  );

  // ── Step 5: Roster + Name ──────────────────────────────────────────────────
  const StepRoster = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-[oklch(0.55_0.01_280)] mb-1.5 uppercase tracking-wider">League Name</label>
        <Input
          value={form.name}
          onChange={e => update({ name: e.target.value })}
          placeholder="My Fantasy League"
          className="bg-[oklch(0.11_0.01_280)] border-[oklch(0.22_0.02_280)]"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold text-[oklch(0.55_0.01_280)] uppercase tracking-wider">Roster Slots</label>
          <span className="text-[10px] text-[oklch(0.40_0.01_280)]">
            {Object.values(form.rosterSlots).reduce((a: number, b: number) => a + b, 0)} total spots
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 max-h-[240px] overflow-y-auto pr-1">
          {(Object.entries(form.rosterSlots) as [string, number][]).map(([pos, count]) => (
            <div key={pos} className="flex items-center justify-between rounded-lg border border-[oklch(0.18_0.015_280)] bg-[oklch(0.10_0.01_280)] px-2.5 py-1.5">
              <span className="text-xs font-bold text-[oklch(0.75_0.01_280)]">{pos}</span>
              <div className="flex items-center gap-1.5">
                <button
                  className="w-5 h-5 rounded flex items-center justify-center text-[oklch(0.50_0.01_280)] hover:text-white hover:bg-[oklch(0.20_0.01_280)] transition-colors text-sm font-bold"
                  onClick={() => {
                    const slots = { ...form.rosterSlots };
                    slots[pos] = Math.max(0, count - 1);
                    update({ rosterSlots: slots });
                  }}
                >−</button>
                <span className="w-4 text-center text-xs font-black text-[oklch(0.90_0.005_85)]">{count}</span>
                <button
                  className="w-5 h-5 rounded flex items-center justify-center text-[oklch(0.50_0.01_280)] hover:text-white hover:bg-[oklch(0.20_0.01_280)] transition-colors text-sm font-bold"
                  onClick={() => {
                    const slots = { ...form.rosterSlots };
                    slots[pos] = count + 1;
                    update({ rosterSlots: slots });
                  }}
                >+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary chip */}
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        {[
          sportMeta.icon + ' ' + sportMeta.label,
          form.platform.toUpperCase(),
          `${form.leagueSize} teams`,
          LEAGUE_TYPES[form.sport]?.find(t => t.value === form.leagueType)?.label ?? form.leagueType,
        ].map((chip, i) => (
          <span key={i} className="px-2 py-0.5 rounded-full bg-[oklch(0.14_0.015_280)] border border-[oklch(0.22_0.02_280)] text-[oklch(0.55_0.01_280)] font-medium">
            {chip}
          </span>
        ))}
      </div>

      <div className="flex gap-2 mt-2">
        <Button variant="outline" onClick={() => setStep(form.platform === 'nfbc' ? 3 : 4)} className="flex-1">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button
          className="flex-1"
          disabled={!form.name.trim() || isLoading}
          onClick={() => onCreateLeague(form)}
        >
          {isLoading ? 'Creating…' : 'Create League 🚀'}
        </Button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Shared nav buttons
  // ─────────────────────────────────────────────────────────────────────────
  function NavButtons({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
    return (
      <div className="flex gap-2 mt-4">
        <Button variant="outline" onClick={onBack} className="flex-1">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button onClick={onNext} className="flex-1">
          Continue <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  const isNfbc = form.platform === 'nfbc';

  const stepLabels = isNfbc
    ? ['Sport', 'Platform', 'Teams', 'Upload', 'Roster']
    : ['Sport', 'Platform', 'Teams', 'Format', 'Roster'];

  const stepTitles = isNfbc
    ? ['Choose Your Sport', 'Choose Your Platform', 'League Size', 'Set Up Your Fantasy League with AI', 'Roster & Settings']
    : ['Choose Your Sport', 'Choose Your Platform', 'League Size', 'Scoring Format', 'Roster & Settings'];

  return (
    <div className="w-full max-w-lg mx-auto rounded-2xl bg-[oklch(0.10_0.01_280)] border border-[oklch(0.20_0.02_280)] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">{sportMeta.icon}</span>
          <h2 className="text-base font-bold text-[oklch(0.92_0.005_85)]">Create Fantasy League</h2>
        </div>
        <p className="text-xs text-[oklch(0.45_0.01_280)] mb-4">{stepTitles[step - 1]}</p>
        <StepIndicator step={step} labels={stepLabels} />
      </div>

      {/* Body */}
      <div className="px-5 pb-5">
        {step === 1 && <StepSport />}
        {step === 2 && <StepPlatform />}
        {step === 3 && <StepTeams />}
        {step === 4 && (isNfbc ? <StepNFBCUpload /> : <StepLeagueType />)}
        {step === 5 && <StepRoster />}
      </div>
    </div>
  );
}
