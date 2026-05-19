'use client';

import {
  Cloud, CloudRain, Sun, Wind, Droplets, CloudLightning,
  Snowflake, Eye, ChevronRight, AlertTriangle, CheckCircle,
  MapPin, Clock,
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
    gameTime?: string;
    venue?: string;
    weatherCode?: string | number;
    // Impact category overrides
    windImpact?: string;        // 'favorable' | 'neutral' | 'adverse'
    precipImpact?: string;
    tempImpact?: string;
    visibilityImpact?: string;
    // NFL-specific position impacts
    offenseImpact?: string;
    defenseImpact?: string;
    kickerImpact?: string;
    // Flexible additional fields
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
    headerGrad: 'from-red-500/10 dark:from-red-700/70 dark:via-rose-800/55 dark:to-red-950/40',
    AlertIcon: AlertTriangle,
    alertBg: 'bg-red-500/10 border-red-500/25',
  },
  favorable: {
    label: 'FAVORABLE',
    dotCls: 'bg-blue-400',
    textCls: 'text-blue-400',
    headerGrad: 'from-blue-500/10 dark:from-blue-600/70 dark:via-teal-700/55 dark:to-blue-900/40',
    AlertIcon: CheckCircle,
    alertBg: 'bg-blue-500/10 border-blue-500/25',
  },
  neutral: {
    label: 'NEUTRAL',
    dotCls: 'bg-slate-400',
    textCls: 'text-slate-400',
    headerGrad: 'from-slate-400/10 dark:from-slate-600/70 dark:via-gray-700/55 dark:to-slate-900/40',
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
  { keywords: ['rain', 'storm', 'shower', 'heavy rain'],     Icon: CloudRain,      emoji: '🌧️' },
  { keywords: ['snow', 'blizzard', 'flurr', 'heavy snow'],   Icon: Snowflake,      emoji: '❄️'  },
  { keywords: ['wind', 'gust'],                              Icon: Wind,           emoji: '🌬️' },
  { keywords: ['sun', 'clear', 'fair', 'sunny'],             Icon: Sun,            emoji: '☀️'  },
  { keywords: ['fog', 'mist', 'haze'],                       Icon: Eye,            emoji: '🌫️' },
  { keywords: ['cloud', 'overcast', 'partly cloudy'],        Icon: Cloud,          emoji: '☁️'  },
];

// WMO weather code → condition string (mirrors lib/weather/index.ts)
function conditionFromCode(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly Cloudy';
  if (code <= 48) return 'Fog';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Heavy Rain';
  if (code <= 86) return 'Heavy Snow';
  if (code <= 99) return 'Thunderstorm';
  return '';
}

function resolveCondition(data: WeatherCardProps['data']): string | undefined {
  if (data.condition) return data.condition;
  if (data.weatherCode !== undefined) {
    const code = Number(data.weatherCode);
    if (!isNaN(code)) return conditionFromCode(code);
  }
  return undefined;
}

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
    : 'from-blue-500 to-blue-400';
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

// ─── Impact category badges ───────────────────────────────────────────────────

type ImpactLevel = 'favorable' | 'neutral' | 'adverse';

const IMPACT_BADGE_CLS: Record<ImpactLevel, string> = {
  favorable: 'bg-blue-500/15 border-blue-500/25 text-blue-300',
  neutral:   'bg-slate-500/10 border-slate-500/20 text-slate-400',
  adverse:   'bg-red-500/15 border-red-500/25 text-red-300',
};

/** Derive impact level for wind from mph value */
function windImpactLevel(mph: number): ImpactLevel {
  if (mph > 20) return 'adverse';
  if (mph > 10) return 'neutral';
  return 'favorable';
}

/** Derive impact level for precip from mm/inch value */
function precipImpactLevel(val: number): ImpactLevel {
  if (val > 0.1) return 'adverse';
  if (val > 0) return 'neutral';
  return 'favorable';
}

/** Derive impact level for temperature */
function tempImpactLevel(f: number): ImpactLevel {
  if (f < 32 || f > 95) return 'adverse';
  if (f < 45 || f > 85) return 'neutral';
  return 'favorable';
}

/** Parse an override string like "favorable"/"adverse"/"neutral" or "good"/"bad" */
function parseImpactOverride(val?: string): ImpactLevel | null {
  if (!val) return null;
  const l = val.toLowerCase();
  if (l.includes('favorable') || l.includes('good') || l.includes('ideal') || l.includes('low')) return 'favorable';
  if (l.includes('adverse') || l.includes('bad') || l.includes('high') || l.includes('severe')) return 'adverse';
  if (l.includes('neutral') || l.includes('moderate') || l.includes('medium')) return 'neutral';
  return null;
}

interface ImpactBadgeProps {
  label: string;
  level: ImpactLevel;
}

function ImpactBadge({ label, level }: ImpactBadgeProps) {
  const dot = level === 'favorable' ? 'bg-blue-400' : level === 'adverse' ? 'bg-red-400' : 'bg-slate-400';
  return (
    <div className={cn(
      'flex flex-col items-center gap-1 px-2 py-2 rounded-xl border text-center',
      IMPACT_BADGE_CLS[level],
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', dot)} />
      <span className="text-[9px] font-black uppercase tracking-wide leading-none">{label}</span>
    </div>
  );
}

// ─── NFL position impact grid ─────────────────────────────────────────────────

type PositionImpact = { label: string; value: string; level: ImpactLevel };

function parsePositionImpact(val?: string): PositionImpact['level'] {
  if (!val) return 'neutral';
  const l = val.toLowerCase();
  if (l.includes('minimal') || l.includes('good') || l.includes('low') || l.includes('favorable')) return 'favorable';
  if (l.includes('severe') || l.includes('high') || l.includes('bad') || l.includes('adverse')) return 'adverse';
  return 'neutral';
}

const POSITION_LEVEL_CLS: Record<ImpactLevel, string> = {
  favorable: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
  neutral:   'bg-slate-500/8 border-slate-500/15 text-slate-400',
  adverse:   'bg-red-500/10 border-red-500/20 text-red-300',
};

// ─── Known keys (don't render in extraKeys fallback) ─────────────────────────

const KNOWN_KEYS = new Set([
  'location', 'temperature', 'condition', 'wind', 'humidity',
  'precipitation', 'gameImpact', 'impactScore', 'realData', 'status', 'sport', 'source',
  'gameTime', 'venue', 'weatherCode',
  'windImpact', 'precipImpact', 'tempImpact', 'visibilityImpact',
  'offenseImpact', 'defenseImpact', 'kickerImpact',
  // fields from cards-generator "game-time" variant that are rendered explicitly
  'matchup', 'Temperature', 'Condition', 'Wind Speed', 'Rain Chance', 'Impact', 'Trend', 'Recommendation',
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

  // Resolve condition from explicit field or weatherCode
  const condition = resolveCondition(data);
  const ConditionIcon = getConditionIcon(condition);
  const conditionEmoji = getConditionEmoji(condition);

  const impactScore = data.impactScore !== undefined
    ? Number(data.impactScore)
    : computeImpactScore(data);

  const windNum = parseNum(data.wind ?? data['Wind Speed']);
  const tempNum = parseNum(data.temperature ?? data['Temperature'] ?? '70');
  const precipNum = parseNum(data.precipitation ?? data['Rain Chance']);
  const windDirection = parseWindDirection(data.wind ?? data['Wind Speed']);
  const windArrow = getWindArrow(windDirection ?? undefined);
  const sportContext = getSportContext(
    String(data.sport ?? category ?? ''),
    isNaN(windNum) ? 0 : windNum,
    isNaN(precipNum) ? 0 : precipNum,
    isNaN(tempNum) ? 70 : tempNum,
  );

  // Parse precipitation probability (e.g. "30% chance of rain" or "30%")
  const precipProbMatch = String(data.precipitation ?? data['Rain Chance'] ?? '').match(/(\d+)%/);
  const precipPct = precipProbMatch ? parseInt(precipProbMatch[1]) : null;

  // ── Impact badge config (overall) ──────────────────────────────────────────
  const impactBadge = impactScore !== null
    ? impactScore >= 7
      ? { label: 'HIGH IMPACT', cls: 'bg-red-500/15 border-red-500/30 text-red-300' }
      : impactScore >= 4
      ? { label: 'MEDIUM', cls: 'bg-amber-500/15 border-amber-500/30 text-amber-300' }
      : { label: 'LOW', cls: 'bg-blue-500/15 border-blue-500/30 text-blue-300' }
    : null;

  // ── Condition-based background tint for the header ──────────────────────────
  const conditionGrad = (() => {
    const c = (condition ?? '').toLowerCase();
    if (c.includes('sun') || c.includes('clear') || c.includes('sunny')) return 'from-amber-500/8 dark:from-amber-700/60 dark:via-yellow-800/40 dark:to-amber-950/30';
    if (c.includes('thunder') || c.includes('lightning')) return 'from-purple-500/8 dark:from-purple-700/60 dark:via-violet-800/40 dark:to-purple-950/30';
    if (c.includes('rain') || c.includes('storm') || c.includes('shower')) return 'from-blue-500/8 dark:from-blue-700/60 dark:via-blue-800/40 dark:to-blue-950/30';
    if (c.includes('snow') || c.includes('blizzard')) return 'from-sky-500/8 dark:from-sky-600/60 via-cyan-700/40 dark:to-sky-950/30';
    if (c.includes('wind') || c.includes('gust')) return 'from-slate-500/8 dark:from-slate-600/60 via-gray-700/40 dark:to-slate-900/30';
    if (c.includes('fog') || c.includes('mist')) return 'from-gray-500/8 dark:from-gray-600/60 via-slate-700/40 dark:to-gray-950/30';
    return cfg.headerGrad;
  })();

  // ── Impact category badges ──────────────────────────────────────────────────
  const windLevel: ImpactLevel = parseImpactOverride(data.windImpact) ?? (isNaN(windNum) ? 'neutral' : windImpactLevel(windNum));
  const precipLevel: ImpactLevel = parseImpactOverride(data.precipImpact) ?? (isNaN(precipNum) ? 'favorable' : precipImpactLevel(precipNum));
  const tempLevel: ImpactLevel = parseImpactOverride(data.tempImpact) ?? (isNaN(tempNum) ? 'neutral' : tempImpactLevel(tempNum));
  const visLevel: ImpactLevel = parseImpactOverride(data.visibilityImpact) ?? 'neutral';

  const hasImpactBadges = !isNaN(windNum) || !isNaN(precipNum) || !isNaN(tempNum) || data.windImpact || data.precipImpact || data.tempImpact || data.visibilityImpact;

  // ── NFL position impacts ────────────────────────────────────────────────────
  const hasNflPositionImpacts = data.offenseImpact || data.defenseImpact || data.kickerImpact;
  const positionImpacts: PositionImpact[] = hasNflPositionImpacts
    ? [
        { label: 'Offense', value: data.offenseImpact ?? 'Neutral', level: parsePositionImpact(data.offenseImpact) },
        { label: 'Defense', value: data.defenseImpact ?? 'Neutral', level: parsePositionImpact(data.defenseImpact) },
        { label: 'Kicker',  value: data.kickerImpact  ?? 'Neutral', level: parsePositionImpact(data.kickerImpact) },
      ]
    : [];

  // ── Extra key-value data (anything not covered above) ──────────────────────
  const extraKeys = Object.keys(data).filter(k => !KNOWN_KEYS.has(k) && data[k] != null);

  // ── Game time display ───────────────────────────────────────────────────────
  const gameTimeDisplay = data.gameTime ? String(data.gameTime) : null;
  const venueDisplay = data.venue ? String(data.venue) : null;

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
          <ConditionIcon className="w-3 h-3 text-[var(--foreground)]/60" />
          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--foreground)]/70">{category}</span>
          <span className="text-[var(--foreground)]/30">·</span>
          <span className="text-[9px] text-[var(--foreground)]/50 truncate">{subcategory}</span>
        </div>

        <h3 className={cn('font-black text-[var(--foreground)] leading-snug text-balance', isHero ? 'text-lg' : 'text-sm')}>
          {title}
        </h3>

        {/* Venue + game time */}
        {(venueDisplay || data.location || gameTimeDisplay) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5">
            {(venueDisplay ?? data.location) && (
              <span className="flex items-center gap-1 text-[10px] text-[var(--foreground)]/60">
                <MapPin className="w-2.5 h-2.5 shrink-0" />
                <span className="line-clamp-1">{venueDisplay ?? data.location}</span>
              </span>
            )}
            {gameTimeDisplay && (
              <span className="flex items-center gap-1 text-[10px] text-[var(--foreground)]/60">
                <Clock className="w-2.5 h-2.5 shrink-0" />
                <span>{gameTimeDisplay}</span>
              </span>
            )}
          </div>
        )}

        {/* Temperature hero + emoji */}
        <div className="flex items-end gap-3 mt-3 animate-card-enter-spring">
          <span className="text-4xl" role="img" aria-label={condition ?? 'weather'}>
            {conditionEmoji}
          </span>
          {!isNaN(tempNum) && (
            <div>
              <span className="text-4xl font-black text-[var(--foreground)] tabular-nums leading-none">
                {Math.round(tempNum)}°F
              </span>
              {condition && (
                <p className="text-sm text-[var(--foreground)]/70 mt-0.5">{condition}</p>
              )}
            </div>
          )}
          {isNaN(tempNum) && condition && (
            <span className="text-base text-[var(--foreground)]/70 mb-1">{condition}</span>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">

        {/* ── Impact category badges: Wind · Precip · Temp · Visibility ── */}
        {hasImpactBadges && (
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {([
              { label: 'Wind',       level: windLevel   },
              { label: 'Precip',     level: precipLevel },
              { label: 'Temp',       level: tempLevel   },
              { label: 'Visibility', level: visLevel    },
            ] as Array<{ label: string; level: ImpactLevel }>).map(({ label, level }, index) => (
              <div key={label} className="animate-fade-in-up" style={{ animationDelay: `${index * 75}ms` }}>
                <ImpactBadge label={label} level={level} />
              </div>
            ))}
          </div>
        )}

        {/* Wind: arrow + speed bar + compass */}
        {!isNaN(windNum) && windNum > 0 && (
          <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-3 py-3">
            <div className="flex items-center gap-3 mb-2">
              {windArrow && (
                <span className="text-2xl font-black text-sky-300 leading-none select-none" title={windDirection ?? undefined}>
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
        {(data.humidity || (!isNaN(precipNum) && precipNum >= 0 && precipPct === null)) && (
          <div className={cn('grid gap-2', data.humidity && !isNaN(precipNum) ? 'grid-cols-2' : 'grid-cols-1')}>
            {data.humidity && (
              <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-2.5 text-center animate-fade-in-up" style={{ animationDelay: '0ms' }}>
                <Droplets className="w-4 h-4 text-sky-400 mx-auto mb-1" />
                <div className="text-lg font-black tabular-nums text-foreground">{String(data.humidity)}</div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5 uppercase tracking-wide">Humidity</div>
              </div>
            )}
            {!isNaN(precipNum) && precipNum >= 0 && (
              <div className={cn(
                'rounded-xl border p-2.5 text-center animate-fade-in-up',
                precipNum > 0.1
                  ? 'bg-blue-500/10 border-blue-500/20'
                  : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]',
              )} style={{ animationDelay: '75ms' }}>
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
              <p className="text-[9px] text-blue-300/70 font-semibold">High precipitation probability</p>
            )}
          </div>
        )}

        {/* NFL position impact mini 3-col grid */}
        {positionImpacts.length > 0 && (
          <div className="rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-[var(--border-subtle)]">
              {positionImpacts.map(({ label, value, level }) => (
                <div key={label} className={cn('px-2 py-2.5 text-center', POSITION_LEVEL_CLS[level])}>
                  <div className="text-[9px] font-black uppercase tracking-wider mb-1 opacity-70">{label}</div>
                  <div className="text-[10px] font-bold leading-snug">{value}</div>
                </div>
              ))}
            </div>
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
