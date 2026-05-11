'use client';

import { Trophy } from 'lucide-react';

interface FantasyLeagueContextBarProps {
  visible: boolean;
  teamName?: string;
  sport?: string;
  platform?: string;
  teams?: number;
  leagueType?: string;
  scoring?: string;
  onReset: () => void;
}

export function FantasyLeagueContextBar({
  visible,
  teamName,
  sport,
  platform,
  teams,
  leagueType,
  scoring,
  onReset,
}: FantasyLeagueContextBarProps) {
  if (!visible) return null;

  return (
    <div className="mb-3 flex items-center gap-2 px-1">
      <Trophy className="w-3.5 h-3.5 text-violet-500" />
      <span className="text-[11px] font-bold text-violet-400">{teamName}</span>
      <span className="text-[10px] text-[var(--text-faint)]">
        {sport?.toUpperCase()} · {platform?.toUpperCase()} · {teams} teams · {leagueType ?? scoring}
      </span>
      <button
        onClick={onReset}
        className="ml-auto text-[10px] text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
      >
        Edit league
      </button>
    </div>
  );
}
