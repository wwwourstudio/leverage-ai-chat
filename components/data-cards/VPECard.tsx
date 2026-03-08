'use client';

import { memo } from 'react';
import { TrendingUp, Activity, Users, CheckCircle, AlertTriangle } from 'lucide-react';
import { BaseCard } from './BaseCard';
import { DataRow } from './DataRow';
import type { InsightCard } from '@/lib/types';

interface KalshiMarketRef {
  title: string;
  yesPrice: number;
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

export const VPECard = memo(function VPECard({ card, onAnalyze }: VPECardProps) {
  const d = (card.data ?? {}) as VPECardData;
  const role = d.role ?? 'Hitter';
  const Icon = roleIcon(role);
  const gradient = card.gradient || roleGradient(role);

  const kalshiMarkets: KalshiMarketRef[] = Array.isArray(d.kalshiMarkets) ? d.kalshiMarkets : [];
  const benfordValid = d.benfordValid !== false; // default true when absent
  const benfordScore = typeof d.benfordScore === 'number' ? d.benfordScore : 1;

  return (
    <BaseCard
      icon={Icon}
      title={card.title ?? `VPE: ${d.playerName ?? 'Unknown'}`}
      category={card.category ?? 'MLB'}
      subcategory={card.subcategory ?? `VPE ${role} Projection`}
      gradient={gradient}
      onAnalyze={onAnalyze}
    >
      <div className="space-y-2">
        {/* Core VPE score */}
        {d.vpeScore !== undefined && (
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

        {/* Trade value */}
        {d.tradeValue !== undefined && (
          <DataRow label="Trade Value" value={fmtNum(d.tradeValue as number, 1)} />
        )}

        {/* Kalshi prediction markets */}
        {kalshiMarkets.length > 0 && (
          <div className="pt-2 border-t border-[oklch(0.20_0.015_280)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[oklch(0.45_0.01_280)] mb-1.5">
              Kalshi Markets
            </p>
            <div className="space-y-1">
              {kalshiMarkets.slice(0, 3).map((m) => (
                <div
                  key={m.ticker}
                  className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[oklch(0.10_0.01_280)]"
                >
                  <span className="text-[11px] text-[oklch(0.70_0.005_85)] truncate max-w-[70%]">{m.title}</span>
                  <span className="text-[11px] font-bold text-emerald-400 shrink-0 ml-2">
                    {m.yesPrice}¢
                  </span>
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
