'use client';

import { cn } from '@/lib/utils';

interface OddsNumberProps {
  value: number | string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Show +/- sign on positive numbers (default: true) */
  showSign?: boolean;
}

const SIZE_CLASS: Record<string, string> = {
  sm: 'text-[1.25rem]',
  md: 'text-[1.625rem]',
  lg: 'text-[2rem]',
  xl: 'text-[2.5rem]',
};

function oddsColor(value: number | string): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return '';
  if (n > 0)   return 'odds-positive';   // blue — positive EV feel
  if (n >= -150) return 'odds-negative'; // near-even money — white
  return 'odds-heavy';                   // heavy chalk — muted
}

function formatOdds(value: number | string, showSign: boolean): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return String(value);
  if (n > 0 && showSign) return `+${n}`;
  return String(n);
}

export function OddsNumber({ value, size = 'md', className, showSign = true }: OddsNumberProps) {
  return (
    <span
      className={cn(
        'font-black leading-none tracking-tight',
        SIZE_CLASS[size],
        oddsColor(value),
        className,
      )}
      data-odds
    >
      {formatOdds(value, showSign)}
    </span>
  );
}
