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
  const isHigh = score >= 7;
  const isMid = score >= 4;
  const color = isHigh ? 'from-red-500 to-rose-400' : isMid ? 'from-amber-500 to-yellow-400' : 'from-emerald-500 to-green-400';
  const label = isHigh ? 'HIGH IMPACT' : isMid ? 'MODERATE' : 'LOW IMPACT';
  const textCls = isHigh ? 'text-red-400' : isMid ? 'text-amber-400' : 'text-emerald-400';
  const ringCls = isHigh ? 'ring-red-500/40 bg-red-500/10' : isMid ? 'ring-amber-500/40 bg-amber-500/10' : 'ring-emerald-500/40 bg-emerald-500/10';

  return (
    <div className="space-y-2.5">
      {/* Hero score row */}
      <div className="flex items-center gap-3">
        <div className={cn('w-11 h-11 rounded-full ring-2 flex items-center justify-center shrink-0', ringCls)}>
          <span className={cn('text-base font-black tabular-nums leading-none', textCls)}>{score}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn('text-xs font-black uppercase tracking-widest', textCls)}>{label}</div>
          <div className="text-[9px] text-[var(--text-faint)] font-semibold mt-0.5">Game Impact · {score}/10</div>
        </div>
      </div>
      {/* Impact bar */}
      <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
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
      <div className="flex justify-between text-[9px] font-semibold text-[var(--text-faint)]">
        <span>Wind Speed</span>
        <span className="font-black text-foreground tabular-nums">
          {wind} mph <span className="font-normal text-[var(--text-muted)]">· {label}</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
        <div
          className={cn('h-full rounded-full bg-gradient-to-r', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// Parse wind direction from strings like "15mph NW" or "NW 15mph"
function parseWindDirection(wind?: string): string | null {
  if (!wind) return null;
  const match = String(wind).match(/\b(N|NE|E|SE|S|SW|W|NW|north|south|east|west|northeast|northwest|southeast|southwest)\b/i);
  if (!match) return null;
  const dir = match[1].toUpperCase();
  return dir.length > 2 ? dir.slice(0, 2) : dir;
}

// Wind compass showing 8-direction rose with active direction highlighted
function WindCompass({ direction }: { direction: string }) {
  return (
    <div className="grid grid-cols-3 gap-0.5 w-14 h-14">
      {['NW','N','NE','W','','E','SW','S','SE'].map((d, i) => (
        <div key={i} className={cn(
          'flex items-center justify-center text-[8px] font-black rounded',
          d === '' ? 'bg-[var(--bg-elevated)] rounded-full w-3.5 h-3.5 m-auto' : 'h-full',
          d === direction ? 'text-sky-300 bg-sky-500/20' : d ? 'text-[var(--text-faint)]' : '',
        )}>
          {d}
        </div>
      ))}
    </div>
  );
}

// Sport-specific impact context lookup
const SPORT_WEATHER_CONTEXT: Record<string, Array<{ condition: (w: number, p: number, t: number) => boolean; text: string }>> = {
  nfl: [
    { condition: (w) => w >= 15, text: '≥15mph crosswind reduces passing efficiency' },
    { condition: (_, p) => p > 0.1, text: 'Rain increases fumble risk and reduces passing yards' },
    { condition: (__, ___, t) => t < 32, text: 'Freezing temps favor running game over pass-heavy offenses' },
  ],
  mlb: [
    { condition: (_, __, t) => t > 75, text: 'Warm temps carry balls further — HR-friendly conditions' },
    { condition: (w) => w >= 10, text: 'Wind out boosts HR probability; wind in suppresses scoring' },
    { condition: (_, p) => p > 0.05, text: 'Wet ball complicates pitcher grip — expect more walks' },
  ],
  default: [
    { condition: (w) => w >= 20, text: 'Strong winds may affect ball-flight and kicking game' },
    { condition: (_, p) => p > 0.2, text: 'Precipitation typically reduces overall scoring' },
  ],
};

function getSportContext(category: string, wind: number, precip: number, temp: number): string | null {
  const sport = category.toLowerCase().includes('nfl') || category.toLowerCase().includes('football') ? 'nfl'
    : category.toLowerCase().includes('mlb') || category.toLowerCase().includes('baseball') ? 'mlb'
    : 'default';
  const rules = SPORT_WEATHER_CONTEXT[sport] ?? SPORT_WEATHER_CONTEXT.default;
  const matched = rules.find(r => r.condition(wind, precip, temp));
  return matched?.text ?? null;
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
  const windDirection = parseWindDirection(data.wind);
  const sportContext = getSportContext(
    String(data.sport ?? category ?? ''),
    isNaN(windNum) ? 0 : windNum,
    isNaN(precipNum) ? 0 : precipNum,
    isNaN(tempNum) ? 70 : tempNum,
  );
  // Parse precipitation probability (e.g. "30% chance of rain")
  const precipProbMatch = String(data.precipitation ?? '').match(/(\d+)%/);
  const precipPct = precipProbMatch ? parseInt(precipProbMatch[1]) : null;

  const extraKeys = Object.keys(data).filter(k => !KNOWN_KEYS.has(k) && data[k] != null);

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-background border transition-all duration-300',
      isHero
        ? 'border-[var(--border-hover)] shadow-[0_0_32px_oklch(0.3_0.06_260/0.15)]'
        : 'border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[0_0_20px_oklch(0.3_0.04_280/0.08)]',
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
          <div className="mt-3 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] px-3 py-2.5">
            <ImpactMeter score={impactScore} />
          </div>
        )}

        {/* ── Wind bar + direction compass ──────────────────────────── */}
        {!isNaN(windNum) && windNum > 0 && (
          <div className="rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] px-3 py-2.5">
            <div className={cn('flex gap-3 items-center', windDirection ? 'mb-2' : '')}>
              <div className="flex-1">
                <WindBar wind={windNum} />
              </div>
              {windDirection && <WindCompass direction={windDirection} />}
            </div>
          </div>
        )}

        {/* ── Humidity + precipitation stats ───────────────────────── */}
        {(data.humidity || (!isNaN(precipNum) && precipNum >= 0)) && (
          <div className={cn('grid gap-1.5', data.humidity && !isNaN(precipNum) ? 'grid-cols-2' : 'grid-cols-1')}>
            {data.humidity && (
              <div className="flex flex-col items-center gap-0.5 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] px-2 py-2.5">
                <Droplets className="w-3.5 h-3.5 text-sky-400 mb-0.5" />
                <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Humidity</span>
                <span className="text-sm font-black text-foreground tabular-nums">{String(data.humidity)}</span>
              </div>
            )}
            {!isNaN(precipNum) && precipNum >= 0 && (
              <div className="flex flex-col items-center gap-0.5 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] px-2 py-2.5">
                <CloudRain className="w-3.5 h-3.5 text-blue-400 mb-0.5" />
                <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Precip</span>
                <span className="text-sm font-black text-foreground tabular-nums">{String(data.precipitation)}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Precipitation probability bar ────────────────────────── */}
        {precipPct !== null && (
          <div className="rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] px-3 py-2.5 space-y-1">
            <div className="flex justify-between text-[9px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
              <span>Precip. Probability</span>
              <span className={precipPct >= 60 ? 'text-blue-400' : precipPct >= 30 ? 'text-sky-400' : 'text-[var(--text-muted)]'}>{precipPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
              <div
                className={cn('h-full rounded-full', precipPct >= 60 ? 'bg-blue-500' : precipPct >= 30 ? 'bg-sky-500' : 'bg-sky-400/50')}
                style={{ width: `${precipPct}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Sport-specific impact context ─────────────────────────── */}
        {sportContext && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)]">
            <Wind className="w-3 h-3 text-sky-400/70 shrink-0 mt-0.5" />
            <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">{sportContext}</p>
          </div>
        )}

        {/* ── Game impact alert ─────────────────────────────────────── */}
        {data.gameImpact && (
          <div className={cn('flex items-start gap-2 px-3 py-2.5 rounded-xl border', cfg.alertBg)}>
            <cfg.AlertIcon className={cn('w-3.5 h-3.5 shrink-0 mt-0.5', cfg.textCls)} />
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              {String(data.gameImpact)}
            </p>
          </div>
        )}

        {/* ── Extra key-value data ──────────────────────────────────── */}
        {extraKeys.length > 0 && (
          <div className="space-y-1">
            {extraKeys.map(k => (
              <div key={k} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[var(--bg-overlay)]">
                <span className="text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wide">
                  {k.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span className="text-xs font-bold text-foreground tabular-nums">{String(data[k])}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── CTA ──────────────────────────────────────────────────── */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)] hover:text-foreground hover:bg-[var(--bg-elevated)] hover:border-[var(--border-hover)] transition-all duration-150"
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
