'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { speakText, stopVoice } from '@/lib/voice-player';

export type VoiceConvState = 'idle' | 'listening' | 'processing' | 'speaking';

interface UseVoiceConversationOpts {
  onSendMessage: (text: string) => void;
  /** Last COMPLETE (non-streaming) assistant message content */
  lastCompleteAssistantMessage?: string;
  /** True while the AI is generating a response */
  isAITyping: boolean;
}

/**
 * Manages a full voice conversation loop using Web Speech APIs + xAI Grok TTS.
 * Cycle: listen → user speaks → processing → AI responds → speak → listen → ...
 *
 * Speech output: xAI Grok TTS via /api/tts (real voices) with browser fallback.
 * Speech input:  Web Speech Recognition API.
 */
export function useVoiceConversation({
  onSendMessage,
  lastCompleteAssistantMessage,
  isAITyping,
}: UseVoiceConversationOpts) {
  const [isActive, setIsActive] = useState(false);
  const [convState, setConvState] = useState<VoiceConvState>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [speakingPreview, setSpeakingPreview] = useState('');
  // Start false to match SSR — set true in useEffect (avoids hydration mismatch)
  const [isSupported, setIsSupported] = useState(false);

  // Refs to avoid stale closures inside speech event handlers
  const isActiveRef = useRef(false);
  const isAITypingRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const prevSpokenRef = useRef<string>('');
  const convStateRef = useRef<VoiceConvState>('idle');

  // Keep refs in sync
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { isAITypingRef.current = isAITyping; }, [isAITyping]);
  useEffect(() => { convStateRef.current = convState; }, [convState]);

  // Detect browser support client-side only (avoids SSR hydration mismatch)
  useEffect(() => {
    setIsSupported(
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) &&
      typeof window.speechSynthesis !== 'undefined',
    );
  }, []);

  // ── Speech Output (xAI TTS via voice-player singleton) ────────────────────

  const stopSpeaking = useCallback(() => {
    stopVoice();
    setSpeakingPreview('');
  }, []);

  const speak = useCallback((text: string) => {
    // Show a preview of what's being spoken (first 160 chars)
    const preview = text
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
      .replace(/#{1,6}\s+/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/\n/g, ' ')
      .trim()
      .slice(0, 160);

    speakText(text, {
      onStart: () => {
        setConvState('speaking');
        setSpeakingPreview(preview);
      },
      onEnd: () => {
        setSpeakingPreview('');
        if (isActiveRef.current) {
          setConvState('listening');
        } else {
          setConvState('idle');
        }
      },
    });
  }, []);

  // ── Speech Input (Web Speech Recognition) ─────────────────────────────────

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, []);

  const startListening = useCallback(() => {
    if (!isActiveRef.current) return;

    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) return;

    stopListening();

    const rec = new SR();
    rec.continuous      = false;
    rec.interimResults  = true;
    rec.lang            = 'en-US';
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      const result = e.results[e.results.length - 1];
      const text   = result[0].transcript ?? '';
      setLiveTranscript(text);

      if (result.isFinal && text.trim()) {
        setLiveTranscript('');
        setConvState('processing');
        onSendMessage(text.trim());
      }
    };

    rec.onerror = (e: any) => {
      // 'no-speech' is normal (user was quiet) — restart after brief delay
      if (isActiveRef.current && !isAITypingRef.current) {
        if (e.error === 'no-speech') {
          setTimeout(() => {
            if (isActiveRef.current && !isAITypingRef.current && convStateRef.current === 'listening') {
              startListening();
            }
          }, 400);
        }
      }
    };

    rec.onend = () => {
      recognitionRef.current = null;
    };

    rec.start();
    recognitionRef.current = rec;
    setConvState('listening');
  }, [stopListening, onSendMessage]);

  // When AI finishes typing → speak the new complete message via xAI TTS
  useEffect(() => {
    if (!isActive) return;
    if (isAITyping) return; // still streaming
    if (!lastCompleteAssistantMessage) return;
    if (lastCompleteAssistantMessage === prevSpokenRef.current) return;

    prevSpokenRef.current = lastCompleteAssistantMessage;
    speak(lastCompleteAssistantMessage);
  }, [isActive, lastCompleteAssistantMessage, isAITyping, speak]);

  // While AI is typing → stop speaking, pause listening, show processing state
  useEffect(() => {
    if (!isActive) return;
    if (isAITyping) {
      stopSpeaking();
      stopListening();
      setConvState('processing');
    }
  }, [isActive, isAITyping, stopSpeaking, stopListening]);

  // When state becomes 'listening' (after speak ends) → restart mic
  useEffect(() => {
    if (isActive && convState === 'listening' && !recognitionRef.current) {
      startListening();
    }
  }, [isActive, convState, startListening]);

  // ── Public API ─────────────────────────────────────────────────────────────

  const activate = useCallback(() => {
    if (!isSupported) return;
    prevSpokenRef.current = lastCompleteAssistantMessage ?? '';
    setIsActive(true);
    isActiveRef.current = true;
    setLiveTranscript('');
    setSpeakingPreview('');
    setConvState('listening');
    startListening();
  }, [isSupported, lastCompleteAssistantMessage, startListening]);

  const deactivate = useCallback(() => {
    setIsActive(false);
    isActiveRef.current = false;
    setConvState('idle');
    setLiveTranscript('');
    setSpeakingPreview('');
    stopSpeaking();
    stopListening();
  }, [stopSpeaking, stopListening]);

  /** Read a specific message aloud via xAI TTS */
  const readAloud = useCallback((text: string) => {
    speak(text);
    setConvState('speaking');
  }, [speak]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVoice();
      stopListening();
    };
  }, [stopListening]);

  return {
    isActive,
    isSupported,
    convState,
    liveTranscript,
    speakingPreview,
    activate,
    deactivate,
    readAloud,
  };
}
