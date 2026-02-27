'use client';

import { Cloud, CloudRain, Sun, Wind } from 'lucide-react';
import { BaseCard } from './BaseCard';
import { DataRow } from './DataRow';

interface WeatherCardProps {
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
    [key: string]: any;
  };
  status: string;
  onAnalyze?: () => void;
  isLoading?: boolean;
  error?: string;
  isHero?: boolean;
}

const getWeatherIcon = (condition?: string) => {
  if (!condition) return Cloud;
  const lower = condition.toLowerCase();
  if (lower.includes('rain') || lower.includes('storm')) return CloudRain;
  if (lower.includes('wind')) return Wind;
  if (lower.includes('sun') || lower.includes('clear')) return Sun;
  return Cloud;
};

const statusMap: Record<string, any> = {
  alert: { icon: CloudRain, label: 'ALERT', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400' },
  favorable: { icon: Sun, label: 'FAVORABLE', bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400' },
  neutral: { icon: Cloud, label: 'NEUTRAL', bg: 'bg-gray-500/20', border: 'border-gray-500/30', text: 'text-gray-400' },
};

/** Compute a 1–10 weather impact score from available data fields */
function computeImpactScore(data: WeatherCardProps['data']): number | null {
  const wind = parseFloat(data.wind ?? '0');
  const precip = parseFloat(data.precipitation ?? '0');
  const temp = parseFloat(data.temperature ?? '70');
  if (isNaN(wind) && isNaN(precip)) return null;
  let score = 1;
  // Wind: 0–15mph = 0pts, 15–25 = 2pts, 25–35 = 4pts, >35 = 6pts
  const w = isNaN(wind) ? 0 : wind;
  score += w > 35 ? 6 : w > 25 ? 4 : w > 15 ? 2 : 0;
  // Precip: 0 = 0pts, 0.1–0.5 = 2pts, >0.5 = 4pts
  const p = isNaN(precip) ? 0 : precip;
  score += p > 0.5 ? 4 : p > 0.1 ? 2 : 0;
  // Temp extremes: <32 or >95 = 2pts, <20 or >100 = 3pts
  const t = isNaN(temp) ? 70 : temp;
  if (t < 20 || t > 100) score += 3;
  else if (t < 32 || t > 95) score += 2;
  return Math.min(10, Math.max(1, Math.round(score)));
}

export function WeatherCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  status,
  onAnalyze,
  isLoading,
  error
}: WeatherCardProps) {
  const statusBadge = statusMap[status] || statusMap.neutral;
  const WeatherIcon = getWeatherIcon(data.condition);
  const impactScore = data.impactScore !== undefined
    ? Number(data.impactScore)
    : computeImpactScore(data);

  return (
    <BaseCard
      icon={WeatherIcon}
      title={title}
      category={category}
      subcategory={subcategory}
      gradient={gradient}
      status={statusBadge}
      onAnalyze={onAnalyze}
      isLoading={isLoading}
      error={error}
    >
      <div className="space-y-2.5">
        {/* Impact score pill */}
        {impactScore !== null && (
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold mb-1 ${
            impactScore >= 7 ? 'bg-red-500/15 text-red-400 border border-red-500/25' :
            impactScore >= 4 ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' :
            'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
          }`}>
            <Wind className="w-3 h-3" />
            Impact: {impactScore}/10
          </div>
        )}
        {data.location && <DataRow label="Location" value={data.location} highlight />}
        {data.temperature && <DataRow label="Temperature" value={data.temperature} />}
        {data.condition && <DataRow label="Condition" value={data.condition} />}
        {data.wind && <DataRow label="Wind" value={data.wind} />}
        {data.humidity && <DataRow label="Humidity" value={data.humidity} />}
        {data.precipitation && <DataRow label="Precipitation" value={data.precipitation} />}
        {data.gameImpact && (
          <div className="pt-2 mt-2 border-t border-[oklch(0.20_0.015_280)]">
            <DataRow label="Game Impact" value={data.gameImpact} highlight />
          </div>
        )}
      </div>
    </BaseCard>
  );
}
