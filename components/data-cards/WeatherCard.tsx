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
