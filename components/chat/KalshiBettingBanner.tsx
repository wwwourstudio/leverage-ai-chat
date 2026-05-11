'use client';

interface KalshiBettingBannerProps {
  visible: boolean;
  onDismiss: () => void;
}

export function KalshiBettingBanner({ visible, onDismiss }: KalshiBettingBannerProps) {
  if (!visible) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/25 text-amber-300 text-[11px] font-semibold">
      <span className="shrink-0">⚠️</span>
      <span>Showing Kalshi prediction markets. For live sportsbook odds, switch to the <strong>Betting</strong> tab.</span>
      <button onClick={onDismiss} className="ml-auto text-amber-400/60 hover:text-amber-300 text-xs">✕</button>
    </div>
  );
}
