'use client';

import { useEffect, useRef } from 'react';
import { X, Mic, Volume2, Loader2, Sparkles } from 'lucide-react';
import type { VoiceConvState } from '@/lib/hooks/use-voice-conversation';
import { cn } from '@/lib/utils';

interface VoiceConversationOverlayProps {
  state: VoiceConvState;
  liveTranscript: string;
  speakingPreview: string;
  onClose: () => void;
}

// Animated waveform bars — used in both listening & speaking states
function WaveformBars({ count = 7, color = 'white', speed = '0.9s' }: { count?: number; color?: string; speed?: string }) {
  return (
    <div className="flex items-center justify-center gap-[3px]" style={{ height: 20 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 3,
            borderRadius: 2,
            background: color,
            animation: `voiceWave ${speed} ease-in-out ${(i * 0.12).toFixed(2)}s infinite`,
            height: '100%',
            transformOrigin: 'center',
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
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const stateConfig = {
    idle: {
      orbGradient:  'from-slate-600 via-slate-700 to-slate-800',
      ringColor:    'rgba(148,163,184,0.2)',
      glowColor:    'rgba(148,163,184,0.15)',
      label:        'Tap mic to speak',
      sublabel:     'Voice mode ready',
      showBars:     false,
      barsSpeed:    '1s',
      barsColor:    'rgba(255,255,255,0.5)',
      pingColor:    'rgb(148 163 184)',
    },
    listening: {
      orbGradient:  'from-blue-500 via-cyan-500 to-blue-600',
      ringColor:    'rgba(59,130,246,0.3)',
      glowColor:    'rgba(59,130,246,0.25)',
      label:        'Listening…',
      sublabel:     liveTranscript || 'Speak to Grok',
      showBars:     true,
      barsSpeed:    '0.75s',
      barsColor:    'rgba(255,255,255,0.9)',
      pingColor:    'rgb(59 130 246)',
    },
    processing: {
      orbGradient:  'from-amber-500 via-orange-500 to-amber-600',
      ringColor:    'rgba(245,158,11,0.3)',
      glowColor:    'rgba(245,158,11,0.2)',
      label:        'Grok is thinking…',
      sublabel:     'Analyzing your request',
      showBars:     false,
      barsSpeed:    '1s',
      barsColor:    'rgba(255,255,255,0.5)',
      pingColor:    'rgb(245 158 11)',
    },
    speaking: {
      orbGradient:  'from-violet-500 via-purple-500 to-indigo-600',
      ringColor:    'rgba(139,92,246,0.3)',
      glowColor:    'rgba(139,92,246,0.25)',
      label:        'Grok is speaking',
      sublabel:     '',
      showBars:     true,
      barsSpeed:    '0.65s',
      barsColor:    'rgba(255,255,255,0.85)',
      pingColor:    'rgb(139 92 246)',
    },
  };

  const cfg = stateConfig[state];

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(24px)' }}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Keyframe injection */}
      <style>{`
        @keyframes voiceWave {
          0%, 100% { transform: scaleY(0.3); opacity: 0.6; }
          50%       { transform: scaleY(1);   opacity: 1;   }
        }
        @keyframes voicePingFast {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0;   }
        }
        @keyframes voicePingSlow {
          0%   { transform: scale(1);   opacity: 0.4; }
          100% { transform: scale(2.8); opacity: 0;   }
        }
        @keyframes voiceGlow {
          0%, 100% { opacity: 0.4; transform: scale(0.95); }
          50%       { opacity: 0.8; transform: scale(1.05); }
        }
      `}</style>

      {/* Top bar */}
      <div className="absolute top-5 left-0 right-0 flex items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-white/50" />
          <span className="text-white/50 text-sm font-semibold tracking-wide">Grok Voice</span>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/10 transition-all"
          aria-label="Close voice mode"
        >
          <X className="w-4 h-4 text-white/80" />
        </button>
      </div>

      {/* Central orb area */}
      <div className="relative flex items-center justify-center" style={{ width: 240, height: 240 }}>

        {/* Outer glow */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${cfg.glowColor} 0%, transparent 70%)`,
            animation: state === 'idle' ? undefined : 'voiceGlow 2s ease-in-out infinite',
          }}
        />

        {/* Ping rings — listening & speaking only */}
        {(state === 'listening' || state === 'speaking') && (
          <>
            <div
              className="absolute rounded-full"
              style={{
                width: 160, height: 160,
                border: `1.5px solid ${cfg.pingColor}`,
                opacity: 0.5,
                animation: 'voicePingFast 2s ease-out infinite',
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                width: 160, height: 160,
                border: `1.5px solid ${cfg.pingColor}`,
                opacity: 0.3,
                animation: 'voicePingSlow 2.8s ease-out 0.6s infinite',
              }}
            />
          </>
        )}

        {/* Main orb */}
        <div
          className={cn(
            'relative flex flex-col items-center justify-center w-40 h-40 rounded-full bg-gradient-to-br transition-all duration-700',
            cfg.orbGradient,
          )}
          style={{
            boxShadow: `0 0 60px ${cfg.ringColor}, 0 0 120px ${cfg.glowColor}, inset 0 1px 0 rgba(255,255,255,0.15)`,
          }}
        >
          {/* Inner highlight */}
          <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%)' }} />

          {/* Icon + waveform */}
          <div className="relative flex flex-col items-center gap-2">
            {state === 'listening' && (
              <>
                <Mic className="w-10 h-10 text-white drop-shadow-lg" />
                <WaveformBars count={7} color={cfg.barsColor} speed={cfg.barsSpeed} />
              </>
            )}
            {state === 'processing' && (
              <Loader2 className="w-12 h-12 text-white drop-shadow-lg animate-spin" />
            )}
            {state === 'speaking' && (
              <>
                <Volume2 className="w-10 h-10 text-white drop-shadow-lg" />
                <WaveformBars count={7} color={cfg.barsColor} speed={cfg.barsSpeed} />
              </>
            )}
            {state === 'idle' && (
              <Mic className="w-12 h-12 text-white/50" />
            )}
          </div>
        </div>
      </div>

      {/* State text */}
      <div className="mt-8 flex flex-col items-center gap-2 px-8">
        <p className="text-white text-xl font-semibold text-center transition-all duration-300">
          {cfg.label}
        </p>
        {cfg.sublabel && (
          <p className="text-white/50 text-sm text-center max-w-[260px] leading-snug line-clamp-2">
            {cfg.sublabel}
          </p>
        )}
      </div>

      {/* Speaking preview card */}
      {state === 'speaking' && speakingPreview && (
        <div className="mt-6 mx-6 px-5 py-3.5 rounded-2xl max-w-sm w-full"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-white/65 text-xs leading-relaxed line-clamp-4 italic">
            "{speakingPreview}{speakingPreview.length >= 180 ? '…' : '"'}"
          </p>
        </div>
      )}

      {/* User transcript card */}
      {state === 'listening' && liveTranscript && (
        <div className="mt-6 mx-6 px-5 py-3.5 rounded-2xl max-w-sm w-full"
          style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}
        >
          <p className="text-blue-200 text-sm leading-relaxed">
            {liveTranscript}
          </p>
        </div>
      )}

      {/* Bottom hint */}
      <div className="absolute bottom-8 flex flex-col items-center gap-1">
        <p className="text-white/20 text-xs">
          {state === 'listening' ? 'Say anything — Grok will respond' :
           state === 'speaking'  ? 'Grok is responding…' :
           state === 'processing' ? 'Processing your message' :
           'Tap background to close'}
        </p>
      </div>
    </div>
  );
}
