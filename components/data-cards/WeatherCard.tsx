'use client';

import {
  Cloud, CloudRain, Sun, Wind, Droplets, CloudLightning,
  Snowflake, Eye, ChevronRight, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SPORT_KEYS } from '@/lib/constants';

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

interface ConditionEntry {
  keywords: string[];
  Icon: React.ComponentType<{ className?: string }>;
  emoji: string;
}

const CONDITION_MAP: ConditionEntry[] = [
  { keywords: ['thunder', 'lightning'],                      Icon: CloudLightning, emoji: '⛈️'  },
  { keywords: ['rain', 'storm', 'shower'],                   Icon: CloudRain,      emoji: '🌧️' },
  { keywords: ['snow', 'blizzard', 'flurr'],                 Icon: Snowflake,      emoji: '❄️'  },
  { keywords: ['wind', 'gust'],                              Icon: Wind,           emoji: '🌬️' },
  { keywords: ['sun', 'clear', 'fair', 'sunny'],             Icon: Sun,            emoji: '☀️'  },
  { keywords: ['fog', 'mist', 'haze'],                       Icon: Eye,            emoji: '🌫️' },
  { keywords: ['cloud', 'overcast'],                         Icon: Cloud,          emoji: '☁️'  },
];

function matchCondition(condition?: string): ConditionEntry | undefined {
  if (!condition) return undefined;
  const lower = condition.toLowerCase();
  return CONDITION_MAP.find(e => e.keywords.some(k => lower.includes(k)));
}

function getConditionIcon(condition?: string): React.ComponentType<{ className?: string }> {
  return matchCondition(condition)?.Icon ?? Cloud;
}

function getConditionEmoji(condition?: string): string {
  return matchCondition(condition)?.emoji ?? '🌤️';
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

const WIND_ARROW_MAP: Record<string, string> = {
  N: '↑', NE: '↗', E: '→', SE: '↘',
  S: '↓', SW: '↙', W: '←', NW: '↖',
};

function getWindArrow(direction?: string): string {
  if (!direction) return '';
  return WIND_ARROW_MAP[direction.toUpperCase()] ?? '';
}

function parseWindDirection(wind?: string): string | null {
  if (!wind) return null;
  const match = String(wind).match(/\b(N|NE|E|SE|S|SW|W|NW|north|south|east|west|northeast|northwest|southeast|southwest)\b/i);
  if (!match) return null;
  const dir = match[1].toUpperCase();
  return dir.length > 2 ? dir.slice(0, 2) : dir;
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

function getSportKey(category: string): string {
  const lower = category.toLowerCase();
  if (lower.includes(SPORT_KEYS.NFL.SHORT) || lower.includes('football')) return SPORT_KEYS.NFL.SHORT;
  if (lower.includes(SPORT_KEYS.MLB.SHORT) || lower.includes('baseball'))  return SPORT_KEYS.MLB.SHORT;
  if (lower.includes(SPORT_KEYS.NBA.SHORT) || lower.includes('basketball')) return SPORT_KEYS.NBA.SHORT;
  if (lower.includes(SPORT_KEYS.NHL.SHORT) || lower.includes('hockey'))    return SPORT_KEYS.NHL.SHORT;
  return 'default';
}

// Sport-specific impact context lookup
const SPORT_WEATHER_CONTEXT: Record<string, Array<{ condition: (w: number, p: number, t: number) => boolean; text: string }>> = {
  [SPORT_KEYS.NFL.SHORT]: [
    { condition: (w) => w >= 15, text: '≥15mph crosswind reduces passing efficiency' },
    { condition: (_, p) => p > 0.1, text: 'Rain increases fumble risk and reduces passing yards' },
    { condition: (__, ___, t) => t < 32, text: 'Freezing temps favor running game over pass-heavy offenses' },
  ],
  [SPORT_KEYS.MLB.SHORT]: [
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
  const sport = getSportKey(category);
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
  const conditionEmoji = getConditionEmoji(data.condition);

  const impactScore = data.impactScore !== undefined
    ? Number(data.impactScore)
    : computeImpactScore(data);

  const windNum = parseNum(data.wind);
  const tempNum = parseNum(data.temperature ?? '70');
  const precipNum = parseNum(data.precipitation);
  const windDirection = parseWindDirection(data.wind);
  const windArrow = getWindArrow(windDirection ?? undefined);
  const sportContext = getSportContext(
    String(data.sport ?? category ?? ''),
    isNaN(windNum) ? 0 : windNum,
    isNaN(precipNum) ? 0 : precipNum,
    isNaN(tempNum) ? 70 : tempNum,
  );

  // Parse precipitation probability (e.g. "30% chance of rain")
  const precipProbMatch = String(data.precipitation ?? '').match(/(\d+)%/);
  const precipPct = precipProbMatch ? parseInt(precipProbMatch[1]) : null;

  // Impact badge config
  const impactBadge = impactScore !== null
    ? impactScore >= 7
      ? { label: 'HIGH IMPACT', cls: 'bg-red-500/15 border-red-500/30 text-red-300' }
      : impactScore >= 4
      ? { label: 'MEDIUM', cls: 'bg-amber-500/15 border-amber-500/30 text-amber-300' }
      : { label: 'LOW', cls: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' }
    : null;

  // Condition-based background tint for the header
  const conditionGrad = (() => {
    const c = (data.condition ?? '').toLowerCase();
    if (c.includes('sun') || c.includes('clear') || c.includes('sunny')) return 'from-amber-700/60 via-yellow-800/40 to-amber-950/30';
    if (c.includes('rain') || c.includes('storm') || c.includes('shower')) return 'from-blue-700/60 via-blue-800/40 to-blue-950/30';
    if (c.includes('wind') || c.includes('gust')) return 'from-slate-600/60 via-gray-700/40 to-slate-900/30';
    if (c.includes('snow') || c.includes('blizzard')) return 'from-sky-600/60 via-cyan-700/40 to-sky-950/30';
    if (c.includes('thunder') || c.includes('lightning')) return 'from-purple-700/60 via-violet-800/40 to-purple-950/30';
    return cfg.headerGrad;
  })();

  const extraKeys = Object.keys(data).filter(k => !KNOWN_KEYS.has(k) && data[k] != null);

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-glow,0_0_40px_rgb(0_0_0/0.3))] transition-all duration-300',
      isHero && 'sm:rounded-3xl border-[var(--border-hover)]',
    )}>

      {/* Condition-tinted gradient header */}
      <div className={cn('relative px-4 pt-4 pb-5 bg-gradient-to-br', conditionGrad)}>
        {/* Status + impact badges */}
        <div className="flex items-center gap-2 mb-3">
          <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse shrink-0', cfg.dotCls)} />
          <span className={cn('text-[9px] font-black uppercase tracking-widest', cfg.textCls)}>{cfg.label}</span>
          {impactBadge && (
            <span className={cn('ml-auto text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border', impactBadge.cls)}>
              {impactBadge.label}
            </span>
          )}
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 mb-2">
          <ConditionIcon className="w-3 h-3 text-white/60" />
          <span className="text-[9px] font-black uppercase tracking-widest text-white/70">{category}</span>
          <span className="text-white/30">·</span>
          <span className="text-[9px] text-white/50 truncate">{subcategory}</span>
        </div>

        <h3 className={cn('font-black text-white leading-snug text-balance', isHero ? 'text-lg' : 'text-sm')}>
          {title}
        </h3>

        {data.location && (
          <p className="text-[11px] text-white/60 mt-1 line-clamp-1">{data.location}</p>
        )}

        {/* Temperature hero + emoji */}
        <div className="flex items-end gap-3 mt-3">
          <span className="text-4xl" role="img" aria-label={data.condition ?? 'weather'}>
            {conditionEmoji}
          </span>
          {!isNaN(tempNum) && (
            <div>
              <span className="text-4xl font-black text-white tabular-nums leading-none">
                {Math.round(tempNum)}°F
              </span>
              {data.condition && (
                <p className="text-sm text-white/70 mt-0.5">{data.condition}</p>
              )}
            </div>
          )}
          {isNaN(tempNum) && data.condition && (
            <span className="text-base text-white/70 mb-1">{data.condition}</span>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">

        {/* Wind: arrow + speed + compass */}
        {!isNaN(windNum) && windNum > 0 && (
          <div className="mt-3 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-3 py-3">
            <div className="flex items-center gap-3 mb-2">
              {windArrow && (
                <span className="text-2xl font-black text-sky-300 leading-none select-none">
                  {windArrow}
                </span>
              )}
              <div className="flex-1">
                <WindBar wind={windNum} />
              </div>
              {windDirection && <WindCompass direction={windDirection} />}
            </div>
          </div>
        )}

        {/* Humidity + Precip 2×2 grid */}
        {(data.humidity || (!isNaN(precipNum) && precipNum >= 0)) && (
          <div className={cn('grid gap-2', data.humidity && !isNaN(precipNum) ? 'grid-cols-2' : 'grid-cols-1')}>
            {data.humidity && (
              <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-2.5 text-center">
                <Droplets className="w-4 h-4 text-sky-400 mx-auto mb-1" />
                <div className="text-lg font-black tabular-nums text-foreground">{String(data.humidity)}</div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5 uppercase tracking-wide">Humidity</div>
              </div>
            )}
            {!isNaN(precipNum) && precipNum >= 0 && (
              <div className={cn(
                'rounded-xl border p-2.5 text-center',
                precipNum > 0.1
                  ? 'bg-blue-500/10 border-blue-500/20'
                  : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]',
              )}>
                <CloudRain className={cn('w-4 h-4 mx-auto mb-1', precipNum > 0.1 ? 'text-blue-400' : 'text-[var(--text-muted)]')} />
                <div className="text-lg font-black tabular-nums text-foreground">{String(data.precipitation)}</div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5 uppercase tracking-wide">Precip</div>
              </div>
            )}
          </div>
        )}

        {/* Precipitation probability bar */}
        {precipPct !== null && (
          <div className={cn(
            'rounded-xl border px-3 py-2.5 space-y-1',
            precipPct >= 60 ? 'bg-blue-500/8 border-blue-500/20' : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]',
          )}>
            <div className="flex justify-between text-[9px] font-bold uppercase tracking-wide">
              <span className="text-[var(--text-faint)]">Precip. Probability</span>
              <span className={precipPct >= 60 ? 'text-blue-400 font-black' : precipPct >= 30 ? 'text-sky-400' : 'text-[var(--text-muted)]'}>
                {precipPct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-[var(--bg-overlay)] overflow-hidden">
              <div
                className={cn('h-full rounded-full', precipPct >= 60 ? 'bg-blue-500' : precipPct >= 30 ? 'bg-sky-500' : 'bg-sky-400/50')}
                style={{ width: `${precipPct}%` }}
              />
            </div>
            {precipPct >= 60 && (
              <p className="text-[9px] text-blue-300/70 font-semibold">⚠ High precipitation probability</p>
            )}
          </div>
        )}

        {/* Sport-specific impact context */}
        {sportContext && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
            <Wind className="w-3 h-3 text-sky-400/70 shrink-0 mt-0.5" />
            <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">{sportContext}</p>
          </div>
        )}

        {/* Game impact alert */}
        {data.gameImpact && (
          <div className={cn('flex items-start gap-2 px-3 py-2.5 rounded-xl border', cfg.alertBg)}>
            <cfg.AlertIcon className={cn('w-3.5 h-3.5 shrink-0 mt-0.5', cfg.textCls)} />
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              {String(data.gameImpact)}
            </p>
          </div>
        )}

        {/* Extra key-value data */}
        {extraKeys.length > 0 && (
          <div className="space-y-1">
            {extraKeys.map(k => (
              <div key={k} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)]">
                <span className="text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wide">
                  {k.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span className="text-xs font-bold text-foreground tabular-nums">{String(data[k])}</span>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)] hover:text-sky-400 hover:bg-[var(--bg-overlay)] hover:border-sky-500/30 transition-all duration-150"
            aria-label={`Analyze ${title}`}
          >
            <ConditionIcon className="w-3.5 h-3.5" />
            View Weather Analysis
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </article>
  );
}
