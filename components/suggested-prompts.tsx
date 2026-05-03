'use client';

import { useState } from 'react';
import {
  TrendingUp,
  Trophy,
  Medal,
  Activity,
  Zap,
  Award,
  BarChart3,
  Sparkles,
  ChevronLeft,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface SuggestedAction {
  label: string;
  icon: LucideIcon;
  category: string;
  query?: string;
}

interface SubCategoryOption {
  label: string;
  query: string;
  icon: LucideIcon;
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
  selectedSport?: string;
  onPromptClick: (query: string) => void;
  // True when pills are sport-selection prompts needing user clarification
  clarificationMode?: boolean;
}

const WELCOME_CATEGORIES = [
  { label: 'Betting', desc: 'Live odds & arbitrage', icon: TrendingUp, color: 'text-blue-400', bg: 'from-blue-600/10 to-blue-900/5', border: 'border-blue-500/20' },
  { label: 'Fantasy', desc: 'Draft & waiver tools', icon: Trophy, color: 'text-purple-400', bg: 'from-purple-600/10 to-purple-900/5', border: 'border-purple-500/20' },
  { label: 'DFS', desc: 'Optimal lineups', icon: Medal, color: 'text-amber-400', bg: 'from-amber-600/10 to-amber-900/5', border: 'border-amber-500/20' },
  { label: 'Predictions', desc: 'Kalshi markets', icon: Activity, color: 'text-cyan-400', bg: 'from-cyan-600/10 to-cyan-900/5', border: 'border-cyan-500/20' },
];

function getSubCategories(category: string, sport: string): SubCategoryOption[] {
  const sportDisplay = sport ? sport.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
  const s = sportDisplay ? `${sportDisplay} ` : '';

  switch (category) {
    case 'Betting':
      return [
        { label: `${s}Live Odds`, query: `Show me ${sport ? sport + ' ' : ''}live odds and best lines across all sportsbooks`, icon: Zap },
        { label: `${s}Spread Bets`, query: `Best ${sport ? sport + ' ' : ''}point spread bets and value plays today`, icon: TrendingUp },
        { label: `${s}Player Props`, query: `Top ${sport ? sport + ' ' : ''}player prop bets with hit rate analysis`, icon: Award },
        { label: 'Arbitrage', query: `Find ${sport ? sport + ' ' : ''}arbitrage opportunities across all sportsbooks`, icon: BarChart3 },
      ];
    case 'Fantasy':
      return [
        { label: `${s}Waiver Wire`, query: `Best ${sport ? sport + ' ' : ''}waiver wire pickups and free agent adds this week`, icon: Trophy },
        { label: `${s}Trade Analysis`, query: `${sport ? sport + ' ' : ''}trade value chart and who to target in trades`, icon: TrendingUp },
        { label: `${s}Start/Sit`, query: `${sport ? sport + ' ' : ''}start or sit recommendations for this week`, icon: Award },
        { label: `${s}Draft Strategy`, query: `${sport ? sport + ' ' : ''}fantasy draft strategy, ADP analysis, and sleepers`, icon: Medal },
      ];
    case 'DFS':
      return [
        { label: `${s}DraftKings`, query: `Optimal ${sport ? sport + ' ' : ''}DraftKings lineup for tonight's slate`, icon: Award },
        { label: `${s}FanDuel`, query: `Best ${sport ? sport + ' ' : ''}FanDuel lineup and top value plays`, icon: Medal },
        { label: `${s}GPP Plays`, query: `Top ${sport ? sport + ' ' : ''}GPP tournament picks and contrarian plays`, icon: Sparkles },
        { label: 'Showdown', query: `${sport ? sport + ' ' : ''}DFS showdown slate captain and flex strategy`, icon: BarChart3 },
      ];
    case 'Predictions':
      return [
        { label: 'Top Trending', query: 'Show me the top trending Kalshi prediction markets right now', icon: Activity },
        { label: 'Sports Markets', query: 'What are the best sports prediction markets on Kalshi today?', icon: TrendingUp },
        { label: 'Political Markets', query: 'Show me political prediction markets and election probabilities', icon: BarChart3 },
        { label: 'High Volume', query: 'Which Kalshi markets have the highest trading volume right now?', icon: Sparkles },
      ];
    default:
      return [];
  }
}

export function SuggestedPrompts({
  showWelcomeGrid,
  onWelcomeAction,
  suggestedPrompts,
  quickActions,
  hasMessages,
  lastUserQuery,
  selectedCategory,
  selectedSport = '',
  onPromptClick,
  clarificationMode = false,
}: SuggestedPromptsProps) {
  const [pendingWelcomeCategory, setPendingWelcomeCategory] = useState<string | null>(null);

  const isSuggested = suggestedPrompts.length > 0 && hasMessages;
  const pills = isSuggested ? suggestedPrompts : quickActions;

  return (
    <>
      {/* Welcome categorized quick-start grid — shown only on fresh session */}
      {showWelcomeGrid && (
        <div className="mb-3 sm:block">
          {pendingWelcomeCategory === null ? (
            <>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)] mb-2 px-1">
                Get started — choose a category
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
                {WELCOME_CATEGORIES.map(({ label, desc, icon: Icon, color, bg, border }) => (
                  <button
                    key={label}
                    onClick={() => setPendingWelcomeCategory(label)}
                    className={`group/cat flex flex-col items-start gap-1 p-2 sm:p-2.5 rounded-xl bg-gradient-to-br ${bg} border ${border} hover:border-opacity-60 transition-all hover:scale-[1.02] active:scale-[0.98] text-left`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${color}`} />
                      <span className={`text-[11px] sm:text-xs font-bold ${color}`}>{label}</span>
                    </div>
                    <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] leading-tight">{desc}</p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2 px-1">
                <button
                  onClick={() => setPendingWelcomeCategory(null)}
                  className="flex items-center gap-1 text-[10px] font-bold text-[var(--text-faint)] hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-3 h-3" />
                  Back
                </button>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">
                  {pendingWelcomeCategory}
                  {selectedSport ? ` · ${selectedSport.replace(/-/g, ' ').toUpperCase()}` : ''}
                  {' '}— choose a focus
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
                {getSubCategories(pendingWelcomeCategory, selectedSport).map((sub) => {
                  const SubIcon = sub.icon;
                  return (
                    <button
                      key={sub.label}
                      onClick={() => {
                        setPendingWelcomeCategory(null);
                        onWelcomeAction(sub.query);
                      }}
                      className="group/sub flex flex-col items-start gap-1 p-2 sm:p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-blue-500/40 hover:bg-blue-900/20 transition-all hover:scale-[1.02] active:scale-[0.98] text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        <SubIcon className="w-3.5 h-3.5 text-blue-400 group-hover/sub:text-blue-300" />
                        <span className="text-[11px] sm:text-xs font-bold text-foreground/80 group-hover/sub:text-white">{sub.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Clarification header — shown when a sport choice is needed */}
      {clarificationMode && (
        <div className="mb-3 px-1 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-300/90">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            {lastUserQuery
              ? <>I can help with that — which sport are you asking about?</>
              : <>Which sport would you like to explore?</>
            }
          </span>
        </div>
      )}

      {/* Dynamic Contextual Suggestions or Platform Prompts */}
      <div className="relative mb-5">
        <div className="absolute left-0 inset-y-0 w-6 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 inset-y-0 w-14 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />
        <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory md:snap-none scrollbar-hide pb-1 px-2 pr-14">
          {pills.map((action, idx) => {
            const Icon = action.icon;
            const submitText = action.query || action.label;

            return (
              <button
                key={`${action.label}-${idx}`}
                onClick={() => onPromptClick(submitText)}
                style={{ animationDelay: `${idx * 40}ms` }}
                className={`group/prompt animate-fade-in-up flex items-center gap-1.5 md:gap-2.5 px-2.5 md:px-4 py-1 md:py-2.5 rounded-full border text-xs md:text-sm font-medium whitespace-nowrap transition-all duration-200 snap-start ${
                  clarificationMode
                    ? 'bg-[var(--bg-overlay)] border-amber-500/50 text-amber-200/80 hover:bg-amber-900/20 hover:border-amber-400/70 hover:text-amber-100'
                    : isSuggested
                      ? 'bg-[var(--bg-overlay)] border-blue-500/50 text-white/80 hover:bg-gradient-to-r hover:from-blue-600/20 hover:via-purple-600/20 hover:to-blue-600/20 hover:border-blue-400/70'
                      : selectedCategory === 'kalshi'
                        ? 'bg-[var(--bg-overlay)] border-cyan-800/50 text-[var(--text-muted)] hover:bg-cyan-900/20 hover:border-cyan-600/50 hover:text-cyan-300'
                        : 'bg-[var(--bg-overlay)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:border-[var(--border-hover)] hover:text-white/80'
                }`}
              >
                <Icon className={`w-3 h-3 md:w-4 md:h-4 flex-shrink-0 ${
                  clarificationMode ? 'text-amber-500 group-hover/prompt:text-amber-300'
                  : isSuggested     ? 'text-[var(--text-muted)] group-hover/prompt:text-blue-400'
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
