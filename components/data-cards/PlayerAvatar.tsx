'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface PlayerAvatarProps {
  playerName: string;
  photoUrl?: string | null;
  sport?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** Sport-specific color for the initials fallback avatar */
function sportAvatarColor(sport?: string): string {
  if (!sport) return 'bg-slate-700 text-slate-300';
  const s = sport.toLowerCase();
  if (s.includes('basketball') || s === 'nba') return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
  if (s.includes('football') || s === 'nfl') return 'bg-green-500/20 text-green-300 border-green-500/30';
  if (s.includes('baseball') || s === 'mlb') return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  if (s.includes('hockey') || s === 'nhl') return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
  return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
}

/** Extract up to 2 initials from a player name */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZE_CLASSES = {
  sm: { container: 'w-7 h-7', text: 'text-[9px]', img: 'w-7 h-7' },
  md: { container: 'w-9 h-9', text: 'text-[11px]', img: 'w-9 h-9' },
  lg: { container: 'w-12 h-12', text: 'text-sm', img: 'w-12 h-12' },
};

export function PlayerAvatar({ playerName, photoUrl, sport, size = 'md', className }: PlayerAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const sizes = SIZE_CLASSES[size];
  const colorCls = sportAvatarColor(sport);
  const initials = getInitials(playerName);

  if (photoUrl && !imgFailed) {
    return (
      <div className={cn('relative rounded-full overflow-hidden border border-white/10 shrink-0', sizes.container, className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt={playerName}
          className={cn('object-cover object-top', sizes.img)}
          onError={() => setImgFailed(true)}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-full border flex items-center justify-center font-bold shrink-0',
        sizes.container,
        sizes.text,
        colorCls,
        className,
      )}
      title={playerName}
      aria-label={playerName}
    >
      {initials}
    </div>
  );
}
