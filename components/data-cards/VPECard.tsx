'use client';

import { memo } from 'react';
import { TrendingUp, Activity, Users, CheckCircle, AlertTriangle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InsightCard } from '@/lib/cards-generator';

interface KalshiMarketRef {
  title: string;
  yesPrice: number;
  noPrice?: number;
  ticker: string;
}

interface VPECardData {
  playerName?: string;
  role?: 'Hitter' | 'Pitcher' | 'Team';
  vpeScore?: number;
  powerIndex?: number;
  stuffScore?: number;
  kSkill?: number;
  projectedWins?: number;
  tradeValue?: number;
  benfordValid?: boolean;
  benfordScore?: number;
  kalshiMarkets?: KalshiMarketRef[];
  [key: string]: string | number | boolean | KalshiMarketRef[] | undefined;
}

interface VPECardProps {
  card: InsightCard;
  onAnalyze?: () => void;
  isHero?: boolean;
}

function roleGradientBg(role?: string): string {
  if (role === 'Pitcher') return 'from-violet-600/25 dark:via-purple-800/10 to-transparent';
  if (role === 'Team') return 'from-blue-600/25 dark:via-cyan-800/10 to-transparent';
  return 'from-violet-600/25 dark:via-indigo-800/10 to-transparent';
}

function roleBadgeStyle(role?: string): string {
  if (role === 'Pitcher') return 'bg-violet-500/15 border-violet-500/30 text-violet-300';
  if (role === 'Team') return 'bg-blue-500/15 border-blue-500/30 text-blue-300';
  return 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300';
}

function roleAccentColor(role?: string): string {
  if (role === 'Pitcher') return 'text-violet-400';
  if (role === 'Team') return 'text-blue-400';
  return 'text-indigo-400';
}

function fmtNum(v: number | undefined, digits = 2): string {
  if (v === undefined || isNaN(v)) return 'N/A';
  return v.toFixed(digits);
}

/** Large VPE score display with descriptive label */
function VPEScoreHero({ score, color }: { score: number; color: string }) {
  const normalized = Math.min(100, Math.max(0, score));
  const label =
    normalized >= 80 ? 'ELITE'
    : normalized >= 65 ? 'ABOVE AVG'
    : normalized >= 45 ? 'AVERAGE'
    : 'BELOW AVG';
  const circumference = 2 * Math.PI * 28;
  const dashOffset = circumference * (1 - normalized / 100);
  const stroke = normalized >= 70 ? '#34d399' : normalized >= 40 ? '#818cf8' : '#6b7280';

  return (
    <div className="flex items-center gap-4">
      {/* Circular gauge */}
      <div className="relative w-16 h-16 shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" stroke="var(--border-subtle)" strokeWidth="5" fill="none" />
          <circle
            cx="32" cy="32" r="28"
            stroke={stroke}
            strokeWidth="5" fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('text-sm font-black tabular-nums', color)}>{normalized.toFixed(0)}</span>
        </div>
      </div>

      <div>
        <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-0.5">VPE Score</p>
        <p className={cn('text-2xl font-black tabular-nums leading-none', color)}>
          {normalized.toFixed(1)}
        </p>
        <span className={cn('text-[9px] font-black uppercase tracking-wide', color)}>{label}</span>
      </div>
    </div>
  );
}

export const VPECard = memo(function VPECard({ card, onAnalyze, isHero }: VPECardProps) {
  const d = (card.data ?? {}) as VPECardData;
  const role = d.role ?? 'Hitter';
  const gradient = card.gradient || '';

  const kalshiMarkets: KalshiMarketRef[] = Array.isArray(d.kalshiMarkets) ? d.kalshiMarkets : [];
  const benfordValid = d.benfordValid !== false;
  const benfordScore = typeof d.benfordScore === 'number' ? d.benfordScore : 1;

  const rawVpe = typeof d.vpeScore === 'number' ? d.vpeScore : undefined;
  const gaugeScore = rawVpe !== undefined ? Math.min(100, Math.max(0, rawVpe * 10)) : undefined;
  const accentColor = roleAccentColor(role);
  const playerName = d.playerName ?? card.title ?? 'Unknown';

  // Build score tiles based on role
  const scoreTiles: Array<{ label: string; value: string }> = [];
  if (rawVpe !== undefined) scoreTiles.push({ label: 'VPE', value: fmtNum(rawVpe) });
  if (role === 'Hitter' && d.powerIndex !== undefined) {
    scoreTiles.push({ label: 'Power Idx', value: fmtNum(d.powerIndex as number) });
  }
  if (role === 'Pitcher' && d.stuffScore !== undefined) {
    scoreTiles.push({ label: 'Stuff+', value: fmtNum(d.stuffScore as number) });
  }
  if (role === 'Pitcher' && d.kSkill !== undefined) {
    scoreTiles.push({ label: 'K-Skill', value: fmtNum(d.kSkill as number) });
  }
  if (role === 'Team' && d.projectedWins !== undefined) {
    scoreTiles.push({ label: 'Proj W', value: fmtNum(d.projectedWins as number, 1) });
  }
  if (d.tradeValue !== undefined) {
    scoreTiles.push({ label: 'Trade Val', value: fmtNum(d.tradeValue as number, 1) });
  }

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-glow,0_0_40px_rgb(0_0_0/0.3))] transition-all duration-300',
      isHero && 'sm:rounded-3xl',
    )}>
      {/* Ambient gradient */}
      <div
        className={cn('absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none', roleGradientBg(role))}
        aria-hidden="true"
      />

      <div className="relative z-10 pl-5 pr-4 py-4 sm:pl-6 sm:pr-5 sm:py-5 space-y-4">
        {/* Header: category + role badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                {card.category ?? 'MLB'}
              </span>
              <span className="text-[var(--text-faint)]">/</span>
              <span className="text-[9px] text-[var(--text-faint)]">{card.subcategory ?? `VPE ${role}`}</span>
            </div>
            {/* Player name as hero */}
            <h3 className={cn('font-black text-foreground leading-tight text-balance', isHero ? 'text-xl' : 'text-base')}>
              {playerName}
            </h3>
          </div>
          {/* Role badge */}
          <span className={cn(
            'text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl border shrink-0',
            roleBadgeStyle(role),
          )}>
            {role}
          </span>
        </div>

        {/* VPE Score hero display */}
        {gaugeScore !== undefined ? (
          <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-4 py-4">
            <VPEScoreHero score={gaugeScore} color={accentColor} />
          </div>
        ) : rawVpe !== undefined && (
          <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-4 py-3 flex items-center gap-3">
            <TrendingUp className={cn('w-6 h-6 shrink-0', accentColor)} />
            <div>
              <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)]">VPE Score</p>
              <p className={cn('text-2xl font-black tabular-nums', accentColor)}>{fmtNum(rawVpe)}</p>
            </div>
          </div>
        )}

        {/* Three-tile metric row */}
        {scoreTiles.length > 0 && (
          <div className={cn('grid gap-2', scoreTiles.length >= 3 ? 'grid-cols-3' : scoreTiles.length === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
            {scoreTiles.slice(0, 3).map(tile => (
              <div key={tile.label} className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-2.5 text-center">
                <div className="text-lg font-black tabular-nums text-foreground">{tile.value}</div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5 uppercase tracking-wide">{tile.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Kalshi markets */}
        {kalshiMarkets.length > 0 && (
          <div className="pt-1 border-t border-[var(--border-subtle)] space-y-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
              Kalshi Markets
            </p>
            <div className="space-y-1.5">
              {kalshiMarkets.slice(0, 3).map((m) => (
                <div
                  key={m.ticker}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
                >
                  <span className="text-[11px] text-foreground/70 truncate flex-1">{m.title}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-md">
                      YES {m.yesPrice}¢
                    </span>
                    {m.noPrice != null && (
                      <span className="text-[10px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/25 px-1.5 py-0.5 rounded-md">
                        NO {m.noPrice}¢
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Benford validation badge */}
        <div className="flex items-center gap-1.5">
          {benfordValid ? (
            <>
              <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="text-[10px] text-emerald-400 font-medium">
                Data Valid ({Math.round(benfordScore * 100)}% Benford match)
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="text-[10px] text-amber-400 font-medium">
                Suspicious data distribution ({Math.round(benfordScore * 100)}%)
              </span>
            </>
          )}
        </div>

        {/* Analyze CTA */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className={cn(
              'flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border text-xs font-bold transition-all duration-150',
              'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]',
              'hover:border-violet-500/30 hover:text-violet-400 hover:bg-violet-500/5',
            )}
            aria-label={`Analyze ${playerName}`}
          >
            ANALYZE
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </article>
  );
});
