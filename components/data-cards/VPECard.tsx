'use client';

import { memo } from 'react';
import { TrendingUp, Activity, Users, CheckCircle, AlertTriangle } from 'lucide-react';
import { BaseCard } from './BaseCard';
import { DataRow } from './DataRow';
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

function roleIcon(role?: string) {
  if (role === 'Pitcher') return Activity;
  if (role === 'Team') return Users;
  return TrendingUp;
}

function roleGradient(role?: string): string {
  if (role === 'Pitcher') return 'from-violet-500 to-purple-600';
  if (role === 'Team') return 'from-blue-500 to-cyan-600';
  return 'from-emerald-500 to-teal-600';
}

function fmtNum(v: number | undefined, digits = 2): string {
  if (v === undefined || isNaN(v)) return 'N/A';
  return v.toFixed(digits);
}

/** Circular gauge ring for the VPE score — mirrors MLBProjectionCard's BreakoutRing */
function VPEGauge({ score }: { score: number }) {
  const normalized = Math.min(100, Math.max(0, score));
  const color = normalized >= 70 ? 'text-emerald-400' : normalized >= 40 ? 'text-blue-400' : 'text-[var(--text-faint)]';
  const stroke = normalized >= 70 ? '#34d399' : normalized >= 40 ? '#60a5fa' : '#6b7280';
  const circumference = 2 * Math.PI * 20;
  const dashOffset = circumference * (1 - normalized / 100);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative w-12 h-12">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" stroke="var(--border-subtle)" strokeWidth="4" fill="none" />
          <circle
            cx="24" cy="24" r="20"
            stroke={stroke}
            strokeWidth="4" fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('text-[10px] font-black', color)}>{normalized.toFixed(0)}</span>
        </div>
      </div>
      <span className={cn('text-[8px] font-black uppercase tracking-wider', color)}>VPE</span>
    </div>
  );
}

export const VPECard = memo(function VPECard({ card, onAnalyze, isHero }: VPECardProps) {
  const d = (card.data ?? {}) as VPECardData;
  const role = d.role ?? 'Hitter';
  const Icon = roleIcon(role);
  const gradient = card.gradient || roleGradient(role);

  const kalshiMarkets: KalshiMarketRef[] = Array.isArray(d.kalshiMarkets) ? d.kalshiMarkets : [];
  const benfordValid = d.benfordValid !== false;
  const benfordScore = typeof d.benfordScore === 'number' ? d.benfordScore : 1;

  // Normalize VPE score to 0–100 for gauge display
  const rawVpe = typeof d.vpeScore === 'number' ? d.vpeScore : undefined;
  const gaugeScore = rawVpe !== undefined ? Math.min(100, Math.max(0, rawVpe * 10)) : undefined;

  return (
    <BaseCard
      icon={Icon}
      title={card.title ?? `VPE: ${d.playerName ?? 'Unknown'}`}
      category={card.category ?? 'MLB'}
      subcategory={card.subcategory ?? `VPE ${role} Projection`}
      gradient={gradient}
      onAnalyze={onAnalyze}
      isHero={isHero}
    >
      <div className="space-y-2">
        {/* VPE gauge + core score */}
        {gaugeScore !== undefined && (
          <div className="flex items-center gap-3">
            <VPEGauge score={gaugeScore} />
            <div className="flex-1">
              <DataRow label="VPE Score" value={fmtNum(rawVpe)} highlight trend="up" />
              {d.tradeValue !== undefined && (
                <DataRow label="Trade Value" value={fmtNum(d.tradeValue as number, 1)} />
              )}
            </div>
          </div>
        )}

        {/* VPE score without gauge (fallback) */}
        {gaugeScore === undefined && d.vpeScore !== undefined && (
          <DataRow label="VPE Score" value={fmtNum(d.vpeScore as number)} highlight trend="up" />
        )}

        {/* Hitter metrics */}
        {role === 'Hitter' && d.powerIndex !== undefined && (
          <DataRow label="Power Breakout Index" value={fmtNum(d.powerIndex as number)} />
        )}

        {/* Pitcher metrics */}
        {role === 'Pitcher' && d.stuffScore !== undefined && (
          <DataRow label="Stuff+" value={fmtNum(d.stuffScore as number)} />
        )}
        {role === 'Pitcher' && d.kSkill !== undefined && (
          <DataRow label="K-Skill" value={fmtNum(d.kSkill as number)} />
        )}

        {/* Team metrics */}
        {role === 'Team' && d.projectedWins !== undefined && (
          <DataRow label="Projected Wins" value={fmtNum(d.projectedWins as number, 1)} highlight />
        )}

        {/* Trade value (fallback when no gauge shown) */}
        {gaugeScore === undefined && d.tradeValue !== undefined && (
          <DataRow label="Trade Value" value={fmtNum(d.tradeValue as number, 1)} />
        )}

        {/* Kalshi prediction markets — YES/NO chips */}
        {kalshiMarkets.length > 0 && (
          <div className="pt-2 border-t border-[var(--border-subtle)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
              Kalshi Markets
            </p>
            <div className="space-y-1.5">
              {kalshiMarkets.slice(0, 3).map((m) => (
                <div
                  key={m.ticker}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-overlay)] border border-[var(--border-subtle)]"
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
        <div className="flex items-center gap-1.5 pt-1">
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
      </div>
    </BaseCard>
  );
});
