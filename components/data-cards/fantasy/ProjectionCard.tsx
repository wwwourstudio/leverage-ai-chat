'use client';

import { memo } from 'react';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Shell, PosBadge, TierBadge, type FantasyCardProps } from './shared';

export const ProjectionCard = memo(function ProjectionCard({ data, ...p }: FantasyCardProps) {
  const { pos, team, pts, vbd, adp, tier, analysis } = data;
  const vbdNum = typeof vbd === 'number' ? vbd : parseFloat(String(vbd ?? 0));

  return (
    <Shell {...p} status={data.status ?? 'value'} Icon={User}>
      <div className="flex items-center gap-2">
        {pos && <PosBadge pos={pos} />}
        {tier && <TierBadge tier={tier} />}
        {team && <span className="text-xs text-[oklch(0.52_0.01_280)] font-medium">{team}</span>}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: 'Proj Pts', val: pts,  color: 'text-white' },
          { label: 'VBD',      val: vbd != null ? `${vbdNum >= 0 ? '+' : ''}${vbdNum}` : null, color: vbdNum >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'ADP',      val: adp,  color: 'text-white' },
        ].filter(s => s.val != null).map(s => (
          <div key={s.label} className="flex flex-col items-center gap-0.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] py-2.5">
            <span className="text-[8px] font-bold uppercase tracking-wider text-[oklch(0.38_0.01_280)]">{s.label}</span>
            <span className={cn('text-lg font-black tabular-nums', s.color)}>{s.val}</span>
          </div>
        ))}
      </div>
      {analysis && (
        <p className="text-xs text-[oklch(0.52_0.01_280)] leading-relaxed">{analysis}</p>
      )}
    </Shell>
  );
});
