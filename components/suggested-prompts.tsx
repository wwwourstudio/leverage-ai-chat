'use client';

import {
  TrendingUp,
  Trophy,
  Medal,
  Activity,
  Zap,
  Award,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface SuggestedAction {
  label: string;
  icon: LucideIcon;
  category: string;
  query?: string;
}

interface SuggestedPromptsProps {
  // For welcome grid
  showWelcomeGrid: boolean;
  onWelcomeAction: (query: string) => void;

  // For prompt pills
  suggestedPrompts: SuggestedAction[];
  quickActions: SuggestedAction[];
  hasMessages: boolean; // messages.length > 1
  lastUserQuery: string;
  selectedCategory: string;
  onPromptClick: (query: string) => void;
}

const WELCOME_CATEGORIES = [
  { label: 'Betting', desc: 'Live odds & arbitrage', icon: TrendingUp, color: 'text-blue-400', bg: 'from-blue-600/10 to-blue-900/5', border: 'border-blue-500/20', sample: 'Live arbitrage alerts across sportsbooks', sampleIcon: Zap },
  { label: 'Fantasy', desc: 'Draft & waiver tools', icon: Trophy, color: 'text-purple-400', bg: 'from-purple-600/10 to-purple-900/5', border: 'border-purple-500/20', sample: 'NFBC draft strategy for my pick position', sampleIcon: Award },
  { label: 'DFS', desc: 'Optimal lineups', icon: Medal, color: 'text-amber-400', bg: 'from-amber-600/10 to-amber-900/5', border: 'border-amber-500/20', sample: 'DFS NFL optimal lineups for DraftKings', sampleIcon: BarChart3 },
  { label: 'Predictions', desc: 'Kalshi markets', icon: Activity, color: 'text-cyan-400', bg: 'from-cyan-600/10 to-cyan-900/5', border: 'border-cyan-500/20', sample: 'Show me trending Kalshi prediction markets right now', sampleIcon: Sparkles },
];

export function SuggestedPrompts({
  showWelcomeGrid,
  onWelcomeAction,
  suggestedPrompts,
  quickActions,
  hasMessages,
  lastUserQuery,
  selectedCategory,
  onPromptClick,
}: SuggestedPromptsProps) {
  const isSuggested = suggestedPrompts.length > 0 && hasMessages;
  const pills = isSuggested ? suggestedPrompts : quickActions;

  return (
    <>
      {/* Welcome categorized quick-start grid — shown only on fresh session */}
      {showWelcomeGrid && (
        <div className="mb-3 sm:block">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[oklch(0.40_0.01_280)] mb-2 px-1">
            Get started — choose a category
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
            {WELCOME_CATEGORIES.map(({ label, desc, icon: Icon, color, bg, border, sample, sampleIcon: SampleIcon }) => (
              <button
                key={label}
                onClick={() => onWelcomeAction(sample)}
                className={`group/cat flex flex-col items-start gap-1 p-2 sm:p-2.5 rounded-xl bg-gradient-to-br ${bg} border ${border} hover:border-opacity-60 transition-all hover:scale-[1.02] active:scale-[0.98] text-left`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${color}`} />
                  <span className={`text-[11px] sm:text-xs font-bold ${color}`}>{label}</span>
                </div>
                <p className="text-[9px] sm:text-[10px] text-[oklch(0.45_0.008_280)] leading-tight">{desc}</p>
                <div className="hidden sm:flex items-center gap-1 mt-0.5 opacity-0 group-hover/cat:opacity-100 transition-opacity">
                  <SampleIcon className="w-3 h-3 text-[oklch(0.45_0.008_280)]" />
                  <span className="text-[9px] text-[oklch(0.45_0.008_280)] line-clamp-1">{sample}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Follow up on: label */}
      {lastUserQuery && suggestedPrompts.length > 0 && hasMessages && (
        <div className="mb-3 px-1 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">
            Follow up on:
          </span>
          <span className="text-[11px] text-[var(--text-muted)] truncate max-w-[420px]">
            {lastUserQuery.length > 72 ? lastUserQuery.slice(0, 72) + '\u2026' : lastUserQuery}
          </span>
        </div>
      )}

      {/* Dynamic Contextual Suggestions or Platform Prompts */}
      <div className="relative mb-5">
        <div className="absolute left-0 inset-y-0 w-6 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 inset-y-0 w-14 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />
        <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory md:snap-none scrollbar-hide pb-1 px-2">
          {pills.map((action, idx) => {
            const Icon = action.icon;
            const submitText = action.query || action.label;

            return (
              <button
                key={`${action.label}-${idx}`}
                onClick={() => onPromptClick(submitText)}
                className={`group/prompt flex items-center gap-1.5 md:gap-2.5 px-2.5 md:px-4 py-1 md:py-2.5 rounded-full border text-xs md:text-sm font-medium whitespace-nowrap transition-all duration-200 snap-start ${
                  isSuggested
                    ? 'bg-[var(--bg-overlay)] border-blue-500/50 text-white/80 hover:bg-gradient-to-r hover:from-blue-600/20 hover:via-purple-600/20 hover:to-blue-600/20 hover:border-blue-400/70'
                    : selectedCategory === 'kalshi'
                      ? 'bg-[var(--bg-overlay)] border-cyan-800/50 text-[var(--text-muted)] hover:bg-cyan-900/20 hover:border-cyan-600/50 hover:text-cyan-300'
                      : 'bg-[var(--bg-overlay)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:border-[oklch(0.28_0.02_280)] hover:text-white/80'
                }`}
              >
                <Icon className={`w-3 h-3 md:w-4 md:h-4 flex-shrink-0 ${
                  isSuggested ? 'text-[var(--text-muted)] group-hover/prompt:text-blue-400'
                  : selectedCategory === 'kalshi' ? 'text-cyan-600 group-hover/prompt:text-cyan-400'
                  : 'text-[var(--text-faint)] group-hover/prompt:text-[var(--text-muted)]'
                }`} />
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
