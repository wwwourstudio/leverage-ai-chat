'use client';

import {
  Cloud, CloudRain, Sun, Wind, Droplets, CloudLightning,
  Snowflake, Eye, ChevronRight, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeatherCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: {
    location?: string;
    temperature?: string;
    condition?: string;
    wind?: string;
    humidity?: string;
    precipitation?: string;
    gameImpact?: string;
    impactScore?: string | number;
    [key: string]: any;
  };
  status: string;
  onAnalyze?: () => void;
  isLoading?: boolean;
  error?: string;
  isHero?: boolean;
}

const statusConfig: Record<string, {
  label: string;
  dotCls: string;
  textCls: string;
  headerGrad: string;
  AlertIcon: React.ComponentType<{ className?: string }>;
  alertBg: string;
}> = {
  alert: {
    label: 'ALERT',
    dotCls: 'bg-red-400',
    textCls: 'text-red-400',
    headerGrad: 'from-red-700/70 via-rose-800/55 to-red-950/40',
    AlertIcon: AlertTriangle,
    alertBg: 'bg-red-500/10 border-red-500/25',
  },
  favorable: {
    label: 'FAVORABLE',
    dotCls: 'bg-emerald-400',
    textCls: 'text-emerald-400',
    headerGrad: 'from-emerald-600/70 via-teal-700/55 to-emerald-900/40',
    AlertIcon: CheckCircle,
    alertBg: 'bg-emerald-500/10 border-emerald-500/25',
  },
  neutral: {
    label: 'NEUTRAL',
    dotCls: 'bg-slate-400',
    textCls: 'text-slate-400',
    headerGrad: 'from-slate-600/70 via-gray-700/55 to-slate-900/40',
    AlertIcon: Cloud,
    alertBg: 'bg-slate-500/10 border-slate-500/25',
  },
};

function getConditionIcon(condition?: string): React.ComponentType<{ className?: string }> {
  if (!condition) return Cloud;
  const lower = condition.toLowerCase();
  if (lower.includes('thunder') || lower.includes('lightning')) return CloudLightning;
  if (lower.includes('rain') || lower.includes('storm') || lower.includes('shower')) return CloudRain;
  if (lower.includes('snow') || lower.includes('blizzard') || lower.includes('flurr')) return Snowflake;
  if (lower.includes('wind') || lower.includes('gust')) return Wind;
  if (lower.includes('sun') || lower.includes('clear') || lower.includes('fair') || lower.includes('sunny')) return Sun;
  if (lower.includes('fog') || lower.includes('mist') || lower.includes('haze')) return Eye;
  return Cloud;
}

function parseNum(val?: string | number): number {
  if (val == null) return NaN;
  const m = String(val).match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : NaN;
}

function computeImpactScore(data: WeatherCardProps['data']): number | null {
  const wind = parseNum(data.wind);
  const precip = parseNum(data.precipitation);
  const temp = parseNum(data.temperature ?? '70');
  if (isNaN(wind) && isNaN(precip)) return null;
  let score = 1;
  const w = isNaN(wind) ? 0 : wind;
  score += w > 35 ? 6 : w > 25 ? 4 : w > 15 ? 2 : 0;
  const p = isNaN(precip) ? 0 : precip;
  score += p > 0.5 ? 4 : p > 0.1 ? 2 : 0;
  const t = isNaN(temp) ? 70 : temp;
  if (t < 20 || t > 100) score += 3;
  else if (t < 32 || t > 95) score += 2;
  return Math.min(10, Math.max(1, Math.round(score)));
}

function ImpactMeter({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 7 ? 'from-red-500 to-rose-400'
    : score >= 4 ? 'from-amber-500 to-yellow-400'
    : 'from-emerald-500 to-green-400';
  const label = score >= 7 ? 'HIGH IMPACT' : score >= 4 ? 'MODERATE' : 'LOW IMPACT';
  const textCls = score >= 7 ? 'text-red-400' : score >= 4 ? 'text-amber-400' : 'text-emerald-400';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px] font-semibold text-[oklch(0.40_0.01_280)]">
        <span>Game Impact</span>
        <span className={cn('font-black', textCls)}>{label} · {score}/10</span>
      </div>
      <div className="h-2.5 rounded-full bg-[oklch(0.14_0.01_280)] overflow-hidden">
        <div
          className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function WindBar({ wind }: { wind: number }) {
  const pct = Math.min(100, (wind / 50) * 100);
  const label = wind > 35 ? 'Dangerous' : wind > 25 ? 'Strong' : wind > 15 ? 'Moderate' : 'Light';
  const color = wind > 35 ? 'from-red-500 to-rose-400'
    : wind > 25 ? 'from-amber-500 to-yellow-400'
    : wind > 15 ? 'from-blue-500 to-cyan-400'
    : 'from-emerald-500 to-green-400';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px] font-semibold text-[oklch(0.40_0.01_280)]">
        <span>Wind Speed</span>
        <span className="font-black text-white tabular-nums">
          {wind} mph <span className="font-normal text-[oklch(0.45_0.01_280)]">· {label}</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-[oklch(0.14_0.01_280)] overflow-hidden">
        <div
          className={cn('h-full rounded-full bg-gradient-to-r', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const KNOWN_KEYS = new Set([
  'location', 'temperature', 'condition', 'wind', 'humidity',
  'precipitation', 'gameImpact', 'impactScore', 'realData', 'status', 'sport', 'source',
]);

export function WeatherCard({
  title,
  category,
  subcategory,
  data,
  status,
  onAnalyze,
  isHero = false,
}: WeatherCardProps) {
  const cfg = statusConfig[status] || statusConfig.neutral;
  const ConditionIcon = getConditionIcon(data.condition);

  const impactScore = data.impactScore !== undefined
    ? Number(data.impactScore)
    : computeImpactScore(data);

  const windNum = parseNum(data.wind);
  const tempNum = parseNum(data.temperature ?? '70');
  const precipNum = parseNum(data.precipitation);

  const extraKeys = Object.keys(data).filter(k => !KNOWN_KEYS.has(k) && data[k] != null);

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.09_0.012_280)] border transition-all duration-300',
      isHero
        ? 'border-[oklch(0.28_0.025_260)] shadow-[0_0_32px_oklch(0.3_0.06_260/0.15)]'
        : 'border-[oklch(0.18_0.016_280)] hover:border-[oklch(0.28_0.02_280)] hover:shadow-[0_0_20px_oklch(0.3_0.04_280/0.08)]',
    )}>

      {/* ── Gradient header ──────────────────────────────────────────── */}
      <div className={cn('relative px-4 pt-3.5 pb-3 bg-gradient-to-br', cfg.headerGrad)}>
        {/* Status badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', cfg.dotCls)} />
          <span className={cn('text-[9px] font-black uppercase tracking-widest', cfg.textCls)}>{cfg.label}</span>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <ConditionIcon className="w-3 h-3 text-white/60" />
          <span className="text-[9px] font-black uppercase tracking-widest text-white/70">{category}</span>
          <span className="text-white/30">·</span>
          <span className="text-[9px] text-white/50 truncate">{subcategory}</span>
        </div>

        <h3 className={cn('font-black text-white leading-snug text-balance pr-16', isHero ? 'text-lg' : 'text-sm')}>
          {title}
        </h3>

        {data.location && (
          <p className="text-[11px] text-white/60 mt-1 line-clamp-1">{data.location}</p>
        )}

        {/* Temperature hero display */}
        {!isNaN(tempNum) && (
          <div className="flex items-end gap-2 mt-2">
            <span className="text-3xl font-black text-white tabular-nums leading-none">{Math.round(tempNum)}°F</span>
            {data.condition && (
              <span className="text-sm text-white/70 mb-0.5">{data.condition}</span>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pb-4 space-y-3">

        {/* ── Impact meter ─────────────────────────────────────────── */}
        {impactScore !== null && (
          <div className="mt-3 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] px-3 py-2.5">
            <ImpactMeter score={impactScore} />
          </div>
        )}

        {/* ── Wind bar ─────────────────────────────────────────────── */}
        {!isNaN(windNum) && windNum > 0 && (
          <div className="rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] px-3 py-2.5">
            <WindBar wind={windNum} />
          </div>
        )}

        {/* ── Humidity + precipitation stats ───────────────────────── */}
        {(data.humidity || (!isNaN(precipNum) && precipNum >= 0)) && (
          <div className={cn('grid gap-1.5', data.humidity && !isNaN(precipNum) ? 'grid-cols-2' : 'grid-cols-1')}>
            {data.humidity && (
              <div className="flex flex-col items-center gap-0.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] px-2 py-2.5">
                <Droplets className="w-3.5 h-3.5 text-sky-400 mb-0.5" />
                <span className="text-[8px] font-bold uppercase tracking-wider text-[oklch(0.38_0.01_280)]">Humidity</span>
                <span className="text-sm font-black text-white tabular-nums">{String(data.humidity)}</span>
              </div>
            )}
            {!isNaN(precipNum) && precipNum >= 0 && (
              <div className="flex flex-col items-center gap-0.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] px-2 py-2.5">
                <CloudRain className="w-3.5 h-3.5 text-blue-400 mb-0.5" />
                <span className="text-[8px] font-bold uppercase tracking-wider text-[oklch(0.38_0.01_280)]">Precip</span>
                <span className="text-sm font-black text-white tabular-nums">{String(data.precipitation)}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Game impact alert ─────────────────────────────────────── */}
        {data.gameImpact && (
          <div className={cn('flex items-start gap-2 px-3 py-2.5 rounded-xl border', cfg.alertBg)}>
            <cfg.AlertIcon className={cn('w-3.5 h-3.5 shrink-0 mt-0.5', cfg.textCls)} />
            <p className="text-[11px] text-[oklch(0.58_0.01_280)] leading-relaxed">
              {String(data.gameImpact)}
            </p>
          </div>
        )}

        {/* ── Extra key-value data ──────────────────────────────────── */}
        {extraKeys.length > 0 && (
          <div className="space-y-1">
            {extraKeys.map(k => (
              <div key={k} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[oklch(0.08_0.01_280)]">
                <span className="text-[10px] font-semibold text-[oklch(0.42_0.01_280)] uppercase tracking-wide">
                  {k.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span className="text-xs font-bold text-white tabular-nums">{String(data[k])}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── CTA ──────────────────────────────────────────────────── */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.17_0.015_280)] text-xs font-semibold text-[oklch(0.46_0.01_280)] hover:text-white hover:bg-[oklch(0.14_0.015_280)] hover:border-[oklch(0.26_0.02_280)] transition-all duration-150"
            aria-label={`Analyze ${title}`}
          >
            <ConditionIcon className="w-3.5 h-3.5" />
            View Weather Analysis
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}
