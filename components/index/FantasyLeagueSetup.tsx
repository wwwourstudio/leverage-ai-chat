'use client';

import { Trophy } from 'lucide-react';
import { useToast } from '@/components/toast-provider';

export interface FantasyLeague {
  sport: string;
  platform: string;
  teams: number;
  leagueType: string;
  teamName: string;
  leagueName: string;
  type?: string;
  scoring?: string;
  setupComplete: boolean;
}

interface FantasyLeagueSetupProps {
  fantasySetupData: Partial<FantasyLeague>;
  fantasySetupStep: number;
  setFantasySetupData: (fn: (prev: Partial<FantasyLeague>) => Partial<FantasyLeague>) => void;
  setFantasySetupStep: (fn: (prev: number) => number) => void;
  isLoggedIn: boolean;
  onSave: (league: FantasyLeague) => void;
}

const SETUP_SPORTS = [
  { value: 'nfl', label: 'Football', icon: '🏈' },
  { value: 'mlb', label: 'Baseball', icon: '⚾' },
  { value: 'nba', label: 'Basketball', icon: '🏀' },
  { value: 'nhl', label: 'Hockey', icon: '🏒' },
] as const;

const SETUP_PLATFORMS: Record<string, Array<{ value: string; label: string }>> = {
  nfl: [{ value: 'espn', label: 'ESPN' }, { value: 'yahoo', label: 'Yahoo' }, { value: 'fantrax', label: 'Fantrax' }, { value: 'cbs', label: 'CBS' }, { value: 'nfl_com', label: 'NFL.com' }],
  mlb: [{ value: 'espn', label: 'ESPN' }, { value: 'yahoo', label: 'Yahoo' }, { value: 'fantrax', label: 'Fantrax' }, { value: 'cbs', label: 'CBS' }, { value: 'nfbc', label: 'NFBC' }],
  nba: [{ value: 'espn', label: 'ESPN' }, { value: 'yahoo', label: 'Yahoo' }, { value: 'fantrax', label: 'Fantrax' }, { value: 'cbs', label: 'CBS' }],
  nhl: [{ value: 'espn', label: 'ESPN' }, { value: 'yahoo', label: 'Yahoo' }, { value: 'fantrax', label: 'Fantrax' }, { value: 'cbs', label: 'CBS' }],
};

const SETUP_TYPES: Record<string, Array<{ value: string; label: string }>> = {
  nfl: [{ value: 'ppr', label: 'PPR' }, { value: 'half_ppr', label: 'Half PPR' }, { value: 'standard', label: 'Standard' }],
  mlb: [{ value: 'h2h', label: 'Head-to-Head' }, { value: 'roto', label: 'Rotisserie' }, { value: 'roto_h2h', label: 'Roto H2H' }],
  nba: [{ value: 'h2h', label: 'Head-to-Head' }, { value: 'roto', label: 'Rotisserie' }],
  nhl: [{ value: 'h2h', label: 'Head-to-Head' }, { value: 'roto', label: 'Rotisserie' }],
};

const STEP_NAMES = ['Sport', 'Platform', 'Teams', 'Format', 'Save'];
const btnBase = 'px-3 py-1.5 rounded-xl border text-xs font-bold transition-all';
const btnActive = 'border-violet-400/70 bg-violet-700/30 text-violet-200';
const btnInactive = 'border-violet-700/40 bg-violet-900/15 text-violet-400 hover:bg-violet-700/20 hover:border-violet-500/50';

export function FantasyLeagueSetup({
  fantasySetupData,
  fantasySetupStep,
  setFantasySetupData,
  setFantasySetupStep,
  isLoggedIn,
  onSave,
}: FantasyLeagueSetupProps) {
  const toast = useToast();
  const activeSport = (fantasySetupData.sport || 'nfl') as string;
  const platforms = SETUP_PLATFORMS[activeSport] ?? SETUP_PLATFORMS.nfl;
  const leagueTypes = SETUP_TYPES[activeSport] ?? SETUP_TYPES.nfl;
  const isNfbc = fantasySetupData.platform === 'nfbc';
  const teamSizes = isNfbc ? [12, 15] : [8, 10, 12, 14, 16, 20, 24, 30];
  const sportIcon = SETUP_SPORTS.find(s => s.value === activeSport)?.icon ?? '🏆';

  return (
    <div className="mb-5 bg-gradient-to-br from-[oklch(0.12_0.03_280/0.5)] via-[oklch(0.09_0.01_280/0.8)] to-[oklch(0.10_0.04_300/0.3)] border border-violet-700/30 rounded-2xl p-4 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-bold text-violet-300">Set up your fantasy league</span>
        <span className="ml-auto text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">
          {STEP_NAMES[fantasySetupStep]} · {fantasySetupStep + 1}/{STEP_NAMES.length}
        </span>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 mb-4">
        {STEP_NAMES.map((_, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full transition-all ${i < fantasySetupStep ? 'bg-violet-400' : i === fantasySetupStep ? 'bg-violet-300 scale-125' : 'bg-[var(--bg-surface)]'}`} />
            {i < STEP_NAMES.length - 1 && <div className={`w-4 h-px transition-all ${i < fantasySetupStep ? 'bg-violet-500/50' : 'bg-[var(--bg-elevated)]'}`} />}
          </div>
        ))}
      </div>

      {/* Step 0: Sport */}
      {fantasySetupStep === 0 && (
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-2.5">What sport is your fantasy league?</p>
          <div className="grid grid-cols-2 gap-2">
            {SETUP_SPORTS.map(s => (
              <button
                key={s.value}
                onClick={() => {
                  const defaultPlatform = (SETUP_PLATFORMS[s.value] ?? SETUP_PLATFORMS.nfl)[0].value;
                  const defaultType = (SETUP_TYPES[s.value] ?? SETUP_TYPES.nfl)[0].value;
                  setFantasySetupData(d => ({ ...d, sport: s.value, platform: defaultPlatform, leagueType: defaultType }));
                  setFantasySetupStep(() => 1);
                }}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${fantasySetupData.sport === s.value ? btnActive : btnInactive}`}
              >
                <span className="text-xl">{s.icon}</span>
                <span className="text-sm font-bold">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Platform */}
      {fantasySetupStep === 1 && (
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-2.5">{sportIcon} Which platform is your {activeSport.toUpperCase()} league on?</p>
          <div className="flex flex-wrap gap-2">
            {platforms.map(p => (
              <button
                key={p.value}
                onClick={() => {
                  const sizes = p.value === 'nfbc' ? [12, 15] : [8, 10, 12, 14, 16, 20, 24, 30];
                  const newSize = sizes.includes(fantasySetupData.teams ?? 12) ? (fantasySetupData.teams ?? 12) : 12;
                  setFantasySetupData(d => ({ ...d, platform: p.value, teams: newSize }));
                  setFantasySetupStep(() => 2);
                }}
                className={`${btnBase} ${fantasySetupData.platform === p.value ? btnActive : btnInactive}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Teams */}
      {fantasySetupStep === 2 && (
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-2.5">How many teams in your league?</p>
          {isNfbc ? (
            <div className="flex gap-3">
              {[12, 15].map(n => (
                <button
                  key={n}
                  onClick={() => { setFantasySetupData(d => ({ ...d, teams: n })); setFantasySetupStep(() => 3); }}
                  className={`flex-1 py-4 rounded-xl border text-2xl font-black transition-all ${(fantasySetupData.teams ?? 12) === n ? btnActive : btnInactive}`}
                >
                  {n}<span className="block text-[10px] font-normal opacity-60 mt-0.5">teams</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-center">
                <span className="text-4xl font-black text-white tabular-nums">{fantasySetupData.teams ?? 12}</span>
                <span className="text-xs text-[var(--text-faint)] ml-1">teams</span>
              </div>
              <input
                type="range" min={8} max={30} step={1}
                value={fantasySetupData.teams ?? 12}
                onChange={e => setFantasySetupData(d => ({ ...d, teams: parseInt(e.target.value) }))}
                className="w-full accent-violet-400 cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-[var(--text-faint)]"><span>8</span><span>16</span><span>24</span><span>30</span></div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {teamSizes.map(n => (
                  <button
                    key={n}
                    onClick={() => setFantasySetupData(d => ({ ...d, teams: n }))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${(fantasySetupData.teams ?? 12) === n ? btnActive : btnInactive}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setFantasySetupStep(() => 3)}
                className="w-full py-2 rounded-xl bg-violet-700/30 border border-violet-500/40 text-violet-300 text-xs font-bold hover:bg-violet-700/40 transition-all"
              >
                Continue →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: League Type */}
      {fantasySetupStep === 3 && (
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-2.5">Scoring format for your {activeSport.toUpperCase()} league?</p>
          <div className="space-y-2">
            {leagueTypes.map(t => (
              <button
                key={t.value}
                onClick={() => { setFantasySetupData(d => ({ ...d, leagueType: t.value })); setFantasySetupStep(() => 4); }}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${fantasySetupData.leagueType === t.value ? btnActive : btnInactive}`}
              >
                <span className="font-bold">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: League name + team name → save */}
      {fantasySetupStep === 4 && (
        <div className="space-y-2.5">
          <p className="text-xs text-[var(--text-muted)] mb-1">Almost done! Name your league and team.</p>
          <input
            type="text"
            placeholder="League name (e.g. The Winners Circle)"
            value={fantasySetupData.leagueName || ''}
            onChange={e => setFantasySetupData(d => ({ ...d, leagueName: e.target.value }))}
            className="w-full bg-[var(--bg-overlay)] border border-violet-700/40 rounded-xl px-3 py-2 text-sm text-white placeholder-[var(--text-faint)] focus:outline-none focus:border-violet-500/60 focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent transition-all"
            maxLength={60}
          />
          <input
            type="text"
            placeholder="Your team name (e.g. Gronk's Hammers)"
            value={fantasySetupData.teamName || ''}
            onChange={e => setFantasySetupData(d => ({ ...d, teamName: e.target.value }))}
            className="w-full bg-[var(--bg-overlay)] border border-violet-700/40 rounded-xl px-3 py-2 text-sm text-white placeholder-[var(--text-faint)] focus:outline-none focus:border-violet-500/60 focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent transition-all"
            maxLength={40}
          />
          {/* Summary chips */}
          <div className="flex flex-wrap gap-1.5 text-[10px]">
            {[
              `${sportIcon} ${activeSport.toUpperCase()}`,
              (fantasySetupData.platform ?? 'ESPN').toUpperCase(),
              `${fantasySetupData.teams ?? 12} teams`,
              leagueTypes.find(t => t.value === fantasySetupData.leagueType)?.label ?? fantasySetupData.leagueType ?? '',
            ].map((chip, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full bg-violet-900/20 border border-violet-700/30 text-violet-400 font-medium">{chip}</span>
            ))}
          </div>
          <button
            onClick={async () => {
              if (!fantasySetupData.teamName?.trim()) return;
              const league: FantasyLeague = {
                sport: fantasySetupData.sport || 'nfl',
                platform: fantasySetupData.platform || 'espn',
                teams: fantasySetupData.teams || 12,
                leagueType: fantasySetupData.leagueType || 'ppr',
                teamName: fantasySetupData.teamName.trim(),
                leagueName: (fantasySetupData.leagueName || '').trim() || 'My League',
                setupComplete: true,
                scoring: fantasySetupData.leagueType === 'ppr' ? 'PPR' : fantasySetupData.leagueType === 'half_ppr' ? 'Half-PPR' : 'Standard',
              };
              if (isLoggedIn) {
                try {
                  const res = await fetch('/api/fantasy/leagues', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name: league.leagueName,
                      sport: league.sport,
                      platform: league.platform,
                      leagueSize: league.teams,
                      scoringType: league.leagueType,
                      teams: [{ name: league.teamName, draftPosition: 1 }],
                    }),
                  });
                  if (!res.ok) console.warn('[fantasy] League DB save failed:', res.status);
                } catch (err) {
                  console.warn('[fantasy] League DB save error:', err);
                }
              }
              localStorage.setItem('leverage_fantasy_league', JSON.stringify(league));
              onSave(league);
              toast.success(`League saved! Welcome, ${league.teamName} 🏆`);
            }}
            disabled={!fantasySetupData.teamName?.trim()}
            className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:from-[var(--bg-surface)] disabled:to-[var(--bg-surface)] disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-violet-900/20"
          >
            Save League 🚀
          </button>
        </div>
      )}

      {fantasySetupStep > 0 && (
        <button
          onClick={() => setFantasySetupStep(s => Math.max(0, s - 1))}
          className="mt-2.5 text-[10px] text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
        >
          ← Back
        </button>
      )}
    </div>
  );
}
