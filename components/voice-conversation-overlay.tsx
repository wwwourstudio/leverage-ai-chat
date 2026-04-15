'use client';

import { useEffect } from 'react';
import { X, Mic, Volume2, Loader2 } from 'lucide-react';
import type { VoiceConvState } from '@/lib/hooks/use-voice-conversation';
import { cn } from '@/lib/utils';

interface VoiceConversationOverlayProps {
  state: VoiceConvState;
  liveTranscript: string;
  speakingPreview: string;
  onClose: () => void;
}

const STATE_CONFIG = {
  idle: {
    orbGrad:  'from-slate-600 to-slate-700',
    glow:     'rgba(148,163,184,0.3)',
    label:    'Ready',
    sub:      'Tap mic to speak',
    pingColor: 'rgb(148 163 184)',
    showPing: false,
  },
  listening: {
    orbGrad:  'from-blue-500 to-cyan-500',
    glow:     'rgba(59,130,246,0.4)',
    label:    'Listening…',
    sub:      '',
    pingColor: 'rgb(59 130 246)',
    showPing: true,
  },
  processing: {
    orbGrad:  'from-amber-500 to-orange-500',
    glow:     'rgba(245,158,11,0.35)',
    label:    'Thinking…',
    sub:      '',
    pingColor: 'rgb(245 158 11)',
    showPing: false,
  },
  speaking: {
    orbGrad:  'from-violet-500 to-purple-600',
    glow:     'rgba(139,92,246,0.4)',
    label:    'Speaking',
    sub:      '',
    pingColor: 'rgb(139 92 246)',
    showPing: true,
  },
} as const;

/** Compact waveform: 5 animated bars */
function Waveform({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-[2px]" style={{ height: 14 }}>
      {[0.3, 0.7, 1, 0.6, 0.4].map((scale, i) => (
        <div
          key={i}
          style={{
            width: 2.5,
            height: '100%',
            borderRadius: 2,
            background: color,
            animation: `voiceWave 0.8s ease-in-out ${(i * 0.11).toFixed(2)}s infinite`,
            transformOrigin: 'center',
            transform: `scaleY(${scale})`,
          }}
        />
      ))}
    </div>
  );
}

export function VoiceConversationOverlay({
  state,
  liveTranscript,
  speakingPreview,
  onClose,
}: VoiceConversationOverlayProps) {
  const cfg = STATE_CONFIG[state];

  // Close on Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  const text = state === 'listening' && liveTranscript
    ? liveTranscript
    : state === 'speaking' && speakingPreview
    ? speakingPreview
    : cfg.sub;

  return (
    <div
      className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[9999] w-[340px] max-w-[calc(100vw-32px)]"
      role="dialog"
      aria-label="Grok Voice"
    >
      <div
        className="rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        style={{ background: 'rgba(8,8,18,0.92)', backdropFilter: 'blur(20px)' }}
      >
        {/* Main row */}
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Animated orb */}
          <div className="relative flex-shrink-0" style={{ width: 44, height: 44 }}>
            {/* Ping ring */}
            {cfg.showPing && (
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  border: `1px solid ${cfg.pingColor}`,
                  animation: 'voicePingFast 1.8s ease-out infinite',
                }}
              />
            )}
            {/* Orb */}
            <div
              className={cn(
                'absolute inset-0 rounded-full bg-gradient-to-br flex items-center justify-center',
                cfg.orbGrad,
              )}
              style={{
                boxShadow: `0 0 20px ${cfg.glow}`,
                animation: state !== 'idle' ? 'voiceGlow 2s ease-in-out infinite' : undefined,
              }}
            >
              {state === 'processing' ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : state === 'speaking' ? (
                <Volume2 className="w-4 h-4 text-white" />
              ) : (
                <Mic className="w-4 h-4 text-white" />
              )}
            </div>
          </div>

          {/* State info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{cfg.label}</span>
              {(state === 'listening' || state === 'speaking') && (
                <Waveform color="rgba(255,255,255,0.7)" />
              )}
            </div>
            {text && (
              <p className="text-xs text-white/50 truncate mt-0.5">{text}</p>
            )}
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white/8 hover:bg-white/15 border border-white/10 transition-all"
            aria-label="Close voice mode"
          >
            <X className="w-3.5 h-3.5 text-white/70" />
          </button>
        </div>

        {/* Speaking preview — expands below the main row */}
        {state === 'speaking' && speakingPreview && (
          <div className="px-4 pb-3 pt-0">
            <p className="text-[11px] text-white/40 leading-relaxed line-clamp-2 italic border-t border-white/5 pt-2.5">
              "{speakingPreview}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
