/**
 * voice-player.ts — singleton audio player for Grok voice readback.
 *
 * Primary path: POST /api/tts → xAI Grok TTS (real voices: ara/eve/rex/sal/leo)
 *   → stream MP3 → play via HTMLAudioElement
 *
 * Fallback: browser SpeechSynthesis (if xAI TTS fails or API key not configured)
 *
 * Module-level singleton ensures only one utterance plays at a time.
 * Every new speakText() call automatically stops the previous one.
 */

import { GROK_VOICE_STORAGE_KEY, GROK_VOICE_DEFAULT } from '@/lib/constants';

// ── Singleton state ────────────────────────────────────────────────────────────

/** Active HTMLAudioElement (xAI TTS path) */
let currentAudio: HTMLAudioElement | null = null;
let currentBlobUrl: string | null = null;

/** AbortController for in-flight /api/tts fetch */
let abortCtrl: AbortController | null = null;

/** Active SpeechSynthesisUtterance (fallback path) */
let currentUtterance: SpeechSynthesisUtterance | null = null;

/** Callback fired when speech ends or is stopped */
let pendingOnEnd: (() => void) | null = null;

// ── Text cleaning ──────────────────────────────────────────────────────────────

function cleanText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
    .replace(/^[ \t]*[-*+]\s+/gm, '')
    .replace(/^[ \t]*\d+\.\s+/gm, '')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 900);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Stop any currently playing audio and fire its onEnd callback immediately. */
export function stopVoice(): void {
  // Cancel in-flight fetch
  abortCtrl?.abort();
  abortCtrl = null;

  // Stop HTML audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = null;
  }

  // Stop browser synthesis
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  currentUtterance = null;

  // Fire the pending onEnd if any
  const fn = pendingOnEnd;
  pendingOnEnd = null;
  fn?.();
}

/**
 * Speak `text` using xAI Grok TTS (primary) or browser SpeechSynthesis (fallback).
 *
 * @param text       Raw markdown text — stripped automatically before playback
 * @param opts.voice_id   xAI voice: ara | eve | rex | sal | leo
 * @param opts.onStart    Called when audio actually begins playing
 * @param opts.onEnd      Called when audio finishes or is stopped
 */
export function speakText(
  text: string,
  opts: { voice_id?: string; onStart?: () => void; onEnd?: () => void } = {},
): void {
  if (typeof window === 'undefined') {
    opts.onEnd?.();
    return;
  }

  // Stop anything currently playing
  stopVoice();

  const clean = cleanText(text);
  if (!clean) { opts.onEnd?.(); return; }

  const voiceId =
    opts.voice_id ??
    (typeof localStorage !== 'undefined'
      ? (localStorage.getItem(GROK_VOICE_STORAGE_KEY) ?? GROK_VOICE_DEFAULT)
      : GROK_VOICE_DEFAULT);

  // Capture this invocation's onEnd so we can detect stale callbacks
  const onDone = () => {
    if (pendingOnEnd === onDone) pendingOnEnd = null;
    opts.onEnd?.();
  };
  pendingOnEnd = onDone;

  const ctrl = new AbortController();
  abortCtrl = ctrl;

  // ── Primary: xAI Grok TTS via server route ───────────────────────────────
  fetch('/api/tts', {
    method: 'POST',
    signal: ctrl.signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: clean, voice_id: voiceId }),
  })
    .then(async (resp) => {
      if (!resp.ok) throw new Error(`TTS ${resp.status}`);
      const blob = await resp.blob();
      if (ctrl.signal.aborted) return; // caller already called stopVoice()

      const url = URL.createObjectURL(blob);
      currentBlobUrl = url;

      const audio = new Audio(url);
      currentAudio = audio;

      audio.onplay = () => { if (currentAudio === audio) opts.onStart?.(); };
      audio.onended = () => {
        if (currentAudio === audio) {
          URL.revokeObjectURL(url);
          currentAudio = null;
          currentBlobUrl = null;
        }
        if (pendingOnEnd === onDone) onDone();
      };
      audio.onerror = () => {
        if (currentAudio === audio) {
          URL.revokeObjectURL(url);
          currentAudio = null;
          currentBlobUrl = null;
        }
        // Audio element errored — try browser fallback
        speakViaBrowser(clean, opts, onDone);
      };

      audio.play().catch(() => {
        // Autoplay policy blocked — fall back
        if (currentAudio === audio) {
          URL.revokeObjectURL(url);
          currentAudio = null;
          currentBlobUrl = null;
        }
        speakViaBrowser(clean, opts, onDone);
      });
    })
    .catch((err: unknown) => {
      if (err instanceof Error && err.name === 'AbortError') return;
      // Server TTS failed (no API key, network error, etc.) — browser fallback
      speakViaBrowser(clean, opts, onDone);
    });
}

// ── Fallback: browser SpeechSynthesis ─────────────────────────────────────────

function speakViaBrowser(
  clean: string,
  opts: { onStart?: () => void; onEnd?: () => void },
  onDone: () => void,
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (pendingOnEnd === onDone) onDone();
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(clean);
  currentUtterance = utterance;

  const applyEnVoice = () => {
    const v = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('en')) ?? null;
    if (v) utterance.voice = v;
  };
  applyEnVoice();

  utterance.onstart = () => { opts.onStart?.(); };
  utterance.onend = () => {
    if (currentUtterance === utterance) currentUtterance = null;
    if (pendingOnEnd === onDone) onDone();
  };
  utterance.onerror = () => {
    if (currentUtterance === utterance) currentUtterance = null;
    if (pendingOnEnd === onDone) onDone();
  };

  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      applyEnVoice();
      window.speechSynthesis.speak(utterance);
    };
  } else {
    window.speechSynthesis.speak(utterance);
  }
}
