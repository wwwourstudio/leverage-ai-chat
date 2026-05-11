'use client';

import { AlertCircle, X } from 'lucide-react';
import { FREE_TIER } from '@/lib/constants';

interface RateLimitNotificationProps {
  visible: boolean;
  resetTimeMs: number;
  onDismiss: () => void;
}

export function RateLimitNotification({ visible, resetTimeMs, onDismiss }: RateLimitNotificationProps) {
  if (!visible) return null;

  const hoursUntilReset = Math.ceil((resetTimeMs - Date.now()) / (1000 * 60 * 60));

  return (
    <div className="relative max-w-5xl xl:max-w-6xl mx-auto mb-4">
      <div className="bg-gradient-to-r from-orange-500/10 via-red-500/10 to-orange-500/10 border border-orange-500/30 rounded-2xl p-4 backdrop-blur-sm shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 bg-orange-500/20 rounded-xl">
              <AlertCircle className="w-5 h-5 text-orange-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white mb-1">
                Chat Limit Reached
              </h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed" suppressHydrationWarning>
                You've reached your limit of {FREE_TIER.CHAT_LIMIT} chats per 24 hours. Your limit will reset in{' '}
                {hoursUntilReset} hours.
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="p-2 hover:bg-[var(--bg-elevated)] rounded-lg transition-all"
            aria-label="Close notification"
          >
            <X className="w-4 h-4 text-[var(--text-faint)] hover:text-foreground/80" />
          </button>
        </div>
      </div>
    </div>
  );
}
