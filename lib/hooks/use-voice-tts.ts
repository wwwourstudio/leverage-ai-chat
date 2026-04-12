'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { GROK_VOICE_STORAGE_KEY, GROK_VOICE_DEFAULT } from '@/lib/constants';

const VOICE_MODE_KEY = 'leverage_voice_mode';

/**
 * useVoiceTTS — shared hook for Grok voice readback.
 *
 * Watches `lastAssistantMessage` and auto-speaks it via /api/tts whenever
 * voice mode is enabled and a new message arrives.
 *
 * Returns state and controls needed to render the voice mode button.
 */
export function useVoiceTTS(lastAssistantMessage: string | undefined) {
  const [voiceMode, setVoiceMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevMessageRef = useRef<string | undefined>(undefined);

  // Restore voice mode preference from localStorage on mount
  useEffect(() => {
    if (localStorage.getItem(VOICE_MODE_KEY) === '1') setVoiceMode(true);
  }, []);

  const toggleVoiceMode = useCallback(() => {
    setVoiceMode(v => {
      const next = !v;
      localStorage.setItem(VOICE_MODE_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // Auto-speak when a new assistant message arrives and voice mode is active
  useEffect(() => {
    if (!voiceMode || !lastAssistantMessage) return;
    if (lastAssistantMessage === prevMessageRef.current) return;
    prevMessageRef.current = lastAssistantMessage;

    // Stop any in-progress audio before starting a new one
    stopSpeaking();

    const voice_id = localStorage.getItem(GROK_VOICE_STORAGE_KEY) ?? GROK_VOICE_DEFAULT;

    // Send the raw message — the /api/tts server route handles all normalization
    const text = lastAssistantMessage.slice(0, 1200);

    setIsSpeaking(true);
    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice_id }),
    })
      .then(r => {
        if (!r.ok) throw new Error('TTS failed');
        return r.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); setIsSpeaking(false); };
        audio.onerror = () => { URL.revokeObjectURL(url); setIsSpeaking(false); };
        audio.play();
      })
      .catch(() => setIsSpeaking(false));
  }, [voiceMode, lastAssistantMessage, stopSpeaking]);

  // Stop audio on unmount
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  return { voiceMode, isSpeaking, toggleVoiceMode, stopSpeaking };
}
