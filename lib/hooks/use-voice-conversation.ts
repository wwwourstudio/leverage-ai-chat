'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { GROK_VOICE_STORAGE_KEY, GROK_VOICE_DEFAULT } from '@/lib/constants';

export type VoiceConvState = 'idle' | 'listening' | 'processing' | 'speaking';

interface UseVoiceConversationOpts {
  onSendMessage: (text: string) => void;
  /** Last COMPLETE (non-streaming) assistant message content */
  lastCompleteAssistantMessage?: string;
  /** True while the AI is generating a response */
  isAITyping: boolean;
}

/**
 * Manages a full voice conversation loop using Web Speech APIs.
 * Cycle: listen → user speaks → processing → AI responds → speak → listen → ...
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
  // Start false to match SSR — set to true in useEffect once we know the browser supports it
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

  // ── Speech Synthesis (output) ──────────────────────────────────────────────

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingPreview('');
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    // Strip markdown and cap for natural speech
    const clean = text
      .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
      .replace(/\*([\s\S]+?)\*/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/`{1,3}[\s\S]*?`{1,3}/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .trim()
      .slice(0, 900);

    if (!clean) {
      if (isActiveRef.current) {
        setConvState('listening');
        // startListening called below — use a flag
      }
      return;
    }

    const voicePref = localStorage.getItem(GROK_VOICE_STORAGE_KEY) ?? GROK_VOICE_DEFAULT;
    const utterance = new SpeechSynthesisUtterance(clean);

    const applyVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      // Map our voice names to system voice preferences
      const voiceMap: Record<string, string[]> = {
        alloy:   ['Samantha', 'Google US English', 'en-US-Neural2-F', 'Microsoft Aria'],
        echo:    ['Daniel', 'Google UK English Male', 'Microsoft Guy', 'Tom'],
        fable:   ['Karen', 'Tessa', 'Google UK English Female', 'Microsoft Hazel'],
        onyx:    ['Alex', 'Fred', 'Google UK English Male', 'Microsoft David'],
        nova:    ['Victoria', 'Zira', 'Google US English', 'Microsoft Zira'],
        shimmer: ['Fiona', 'Moira', 'Google UK English Female', 'Microsoft Susan'],
      };
      const prefs = voiceMap[voicePref] ?? voiceMap.alloy;
      let selected: SpeechSynthesisVoice | null = null;
      for (const name of prefs) {
        selected = voices.find(v => v.name.includes(name)) ?? null;
        if (selected) break;
      }
      if (!selected) selected = voices.find(v => v.lang.startsWith('en')) ?? null;
      if (selected) utterance.voice = selected;

      utterance.rate   = voicePref === 'nova' ? 1.08 : voicePref === 'onyx' ? 0.92 : 1.0;
      utterance.pitch  = voicePref === 'onyx' ? 0.85 : voicePref === 'nova' ? 1.08 : 1.0;
      utterance.volume = 1.0;
    };

    applyVoice();

    utterance.onstart = () => {
      setConvState('speaking');
      setSpeakingPreview(clean.slice(0, 180));
    };

    const afterSpeak = () => {
      setSpeakingPreview('');
      if (isActiveRef.current) {
        setConvState('listening');
      } else {
        setConvState('idle');
      }
    };
    utterance.onend   = afterSpeak;
    utterance.onerror = afterSpeak;

    // If voices not loaded yet, wait for them
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        applyVoice();
        window.speechSynthesis.speak(utterance);
      };
    } else {
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // ── Speech Recognition (input) ─────────────────────────────────────────────

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
      // 'no-speech' is normal (user was quiet) — restart
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

  // When AI finishes typing, speak the new complete message
  useEffect(() => {
    if (!isActive) return;
    if (isAITyping) return; // still streaming
    if (!lastCompleteAssistantMessage) return;
    if (lastCompleteAssistantMessage === prevSpokenRef.current) return;

    prevSpokenRef.current = lastCompleteAssistantMessage;
    speak(lastCompleteAssistantMessage);
  }, [isActive, lastCompleteAssistantMessage, isAITyping, speak]);

  // While AI is typing, show processing state and pause listening
  useEffect(() => {
    if (!isActive) return;
    if (isAITyping) {
      stopSpeaking();
      stopListening();
      setConvState('processing');
    }
  }, [isActive, isAITyping, stopSpeaking, stopListening]);

  // When listening state is set (after speak ends), restart mic
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

  /** Read a specific message aloud (for individual message playback) */
  const readAloud = useCallback((text: string) => {
    speak(text);
    setConvState('speaking');
  }, [speak]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      stopListening();
    };
  }, [stopSpeaking, stopListening]);

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
