'use client';

import { Sparkles, TrendingUp, Trophy, Award, BarChart3 } from 'lucide-react';

interface Props {
  welcomeText?: string;
  onPromptSelect?: (prompt: string) => void;
}

const EXAMPLE_PROMPTS = [
  'Show MLB HR props with positive EV',
  'Which teams have sharp money today?',
  'Best pitcher strikeout props tonight',
];

const SPORTS_GRID = [
  { key: 'MLB', label: 'MLB', icon: TrendingUp, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', prompt: 'Show me today\'s MLB betting edges and player prop opportunities' },
  { key: 'NBA', label: 'NBA', icon: Trophy, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', prompt: 'Show me today\'s NBA lines with sharp money and positive EV bets' },
  { key: 'NFL', label: 'NFL', icon: Award, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', prompt: 'Show me NFL spreads, totals, and player props with edge' },
  { key: 'NHL', label: 'NHL', icon: BarChart3, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20', prompt: 'Show me NHL puck lines and top prop opportunities today' },
];

/**
 * Empty-state display shown when a chat has no messages yet.
 */
export function WelcomeScreen({ onPromptSelect }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] py-10 px-4 text-center">
      {/* Logo mark */}
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 blur-xl opacity-30" />
        <div className="relative w-16 h-16 bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
      </div>

      {/* Headline */}
      <h2 className="text-2xl font-black text-white mb-2 tracking-tight">
        Your AI sports betting edge
      </h2>
      <p className="text-sm text-[oklch(0.50_0.01_280)] mb-8 max-w-sm">
        Real-time odds, sharp money signals, EV calculations, and prop analytics — all in one conversation.
      </p>

      {/* Example prompt chips */}
      {onPromptSelect && (
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {EXAMPLE_PROMPTS.map(prompt => (
            <button
              key={prompt}
              onClick={() => onPromptSelect(prompt)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border border-[oklch(0.25_0.02_260)] bg-[oklch(0.11_0.015_260)] text-[oklch(0.65_0.01_280)] hover:border-blue-500/50 hover:text-blue-300 hover:bg-blue-500/10 transition-all duration-150"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Sport quick-launch grid */}
      {onPromptSelect && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg">
          {SPORTS_GRID.map(sport => {
            const Icon = sport.icon;
            return (
              <button
                key={sport.key}
                onClick={() => onPromptSelect(sport.prompt)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border ${sport.bg} hover:scale-105 active:scale-95 transition-all duration-150`}
              >
                <Icon className={`w-5 h-5 ${sport.color}`} />
                <span className="text-[10px] font-black uppercase tracking-wider text-[oklch(0.65_0.01_280)]">{sport.label}</span>
                <span className="text-[9px] text-[oklch(0.42_0.01_280)]">Today's analysis</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
