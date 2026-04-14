'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { speakText, stopVoice } from '@/lib/voice-player';

const VOICE_MODE_KEY = 'leverage_voice_mode';

/**
 * useVoiceTTS — shared hook for Grok voice readback.
 *
 * Watches `lastAssistantMessage` and auto-speaks it via the voice-player
 * singleton whenever voice mode is enabled and a new message arrives.
 *
 * Public API is unchanged — components don't need updating.
 */
export function useVoiceTTS(lastAssistantMessage: string | undefined) {
  const [voiceMode, setVoiceMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const prevMessageRef = useRef<string | undefined>(undefined);

  // Restore preference on mount
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
    stopVoice();
    setIsSpeaking(false);
  }, []);

  // Auto-speak when a new assistant message arrives and voice mode is active
  useEffect(() => {
    if (!voiceMode || !lastAssistantMessage) return;
    if (lastAssistantMessage === prevMessageRef.current) return;
    prevMessageRef.current = lastAssistantMessage;

    speakText(lastAssistantMessage, {
      onStart: () => setIsSpeaking(true),
      onEnd:   () => setIsSpeaking(false),
    });
  }, [voiceMode, lastAssistantMessage]);

  // Stop audio on unmount
  useEffect(() => () => { stopVoice(); }, []);

  return { voiceMode, isSpeaking, toggleVoiceMode, stopSpeaking };
}
