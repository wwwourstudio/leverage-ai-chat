/**
 * voice-player.ts — module-level singleton for Grok voice readback.
 *
 * Uses the browser's built-in SpeechSynthesis API (free, instant, no API key).
 * The xAI /v1/audio/speech endpoint is not supported by xAI — using browser
 * synthesis avoids the 502 errors from the dead TTS server route.
 *
 * Module-level singleton: every caller (auto-speak hook, per-message buttons)
 * shares one utterance instance. Starting a new utterance stops the previous one.
 */

import { GROK_VOICE_STORAGE_KEY, GROK_VOICE_DEFAULT } from '@/lib/constants';

let currentUtterance: SpeechSynthesisUtterance | null = null;
let pendingOnEnd: (() => void) | null = null;

/** Map our Grok voice names to system voice name preferences */
const VOICE_PREFS: Record<string, string[]> = {
  alloy:   ['Samantha', 'Google US English', 'Microsoft Aria', 'en-US'],
  echo:    ['Daniel', 'Google UK English Male', 'Microsoft Guy', 'Tom'],
  fable:   ['Karen', 'Tessa', 'Google UK English Female', 'Microsoft Hazel'],
  onyx:    ['Alex', 'Fred', 'Google UK English Male', 'Microsoft David'],
  nova:    ['Victoria', 'Zira', 'Google US English', 'Microsoft Zira'],
  shimmer: ['Fiona', 'Moira', 'Google UK English Female', 'Microsoft Susan'],
};

function pickVoice(voiceId: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const prefs = VOICE_PREFS[voiceId] ?? VOICE_PREFS.alloy;
  for (const name of prefs) {
    const found = voices.find(v => v.name.includes(name) || v.lang === name);
    if (found) return found;
  }
  return voices.find(v => v.lang.startsWith('en')) ?? null;
}

function cleanText(text: string): string {
  return text
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    .replace(/\*([\s\S]+?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/`{1,3}[\s\S]*?`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim()
    .slice(0, 900);
}

/** Stop any currently playing voice and fire its onEnd callback. */
export function stopVoice(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  currentUtterance = null;
  if (pendingOnEnd) {
    pendingOnEnd();
    pendingOnEnd = null;
  }
}

/**
 * Speak `text` using browser SpeechSynthesis.
 * Stops any in-progress speech first.
 *
 * @param text        Raw text — markdown is stripped automatically
 * @param opts.voice_id  Grok voice name (alloy/echo/fable/onyx/nova/shimmer)
 * @param opts.onStart   Called just before speech begins
 * @param opts.onEnd     Called when speech finishes or is stopped
 */
export function speakText(
  text: string,
  opts: { voice_id?: string; onStart?: () => void; onEnd?: () => void } = {},
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    opts.onEnd?.();
    return;
  }

  // Stop any current speech
  window.speechSynthesis.cancel();
  currentUtterance = null;
  pendingOnEnd = null;

  const clean = cleanText(text);
  if (!clean) { opts.onEnd?.(); return; }

  const voiceId =
    opts.voice_id ??
    (typeof localStorage !== 'undefined'
      ? (localStorage.getItem(GROK_VOICE_STORAGE_KEY) ?? GROK_VOICE_DEFAULT)
      : GROK_VOICE_DEFAULT);

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate  = voiceId === 'nova' ? 1.08 : voiceId === 'onyx' ? 0.92 : 1.0;
  utterance.pitch = voiceId === 'onyx' ? 0.85 : voiceId === 'nova' ? 1.08 : 1.0;
  utterance.volume = 1.0;

  const applyVoice = () => {
    const v = pickVoice(voiceId);
    if (v) utterance.voice = v;
  };
  applyVoice();

  const onDone = () => {
    if (currentUtterance === utterance) {
      currentUtterance = null;
      pendingOnEnd = null;
    }
    opts.onEnd?.();
  };

  utterance.onstart = () => { opts.onStart?.(); };
  utterance.onend   = onDone;
  utterance.onerror = onDone;

  currentUtterance = utterance;
  pendingOnEnd = onDone;

  // Voices may not be loaded yet (especially on first page load)
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      applyVoice();
      window.speechSynthesis.speak(utterance);
    };
  } else {
    window.speechSynthesis.speak(utterance);
  }
}
