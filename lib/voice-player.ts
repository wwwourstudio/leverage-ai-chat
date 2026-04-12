/**
 * voice-player.ts — module-level singleton audio player for Grok TTS.
 *
 * Using a module singleton (instead of React state) means every caller —
 * the auto-speak hook, per-message buttons, etc. — shares one audio instance.
 * Starting a new utterance automatically stops the previous one.
 */

import { GROK_VOICE_STORAGE_KEY, GROK_VOICE_DEFAULT } from '@/lib/constants';

let currentAudio: HTMLAudioElement | null = null;
let currentOnEnd: (() => void) | null = null;

/** Stop any currently playing voice audio and fire its onEnd callback. */
export function stopVoice(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (currentOnEnd) {
    currentOnEnd();
    currentOnEnd = null;
  }
}

/**
 * Fetch TTS audio for `text` from /api/tts and play it.
 * Stops any in-progress audio first.
 *
 * @param text    Raw text (server normalises markdown + sports notation)
 * @param opts.voice_id  xAI voice ID (defaults to localStorage preference)
 * @param opts.onStart   Called just before audio begins playing
 * @param opts.onEnd     Called when audio finishes or is stopped
 */
export async function speakText(
  text: string,
  opts: { voice_id?: string; onStart?: () => void; onEnd?: () => void } = {},
): Promise<void> {
  stopVoice();

  const voice_id =
    opts.voice_id ??
    (typeof window !== 'undefined'
      ? (localStorage.getItem(GROK_VOICE_STORAGE_KEY) ?? GROK_VOICE_DEFAULT)
      : GROK_VOICE_DEFAULT);

  let resp: Response;
  try {
    resp = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 1200), voice_id }),
    });
  } catch {
    opts.onEnd?.();
    return;
  }

  if (!resp.ok) {
    opts.onEnd?.();
    return;
  }

  let blob: Blob;
  try {
    blob = await resp.blob();
  } catch {
    opts.onEnd?.();
    return;
  }

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  const cleanup = () => {
    URL.revokeObjectURL(url);
    if (currentAudio === audio) {
      currentAudio = null;
      currentOnEnd = null;
    }
    opts.onEnd?.();
  };

  audio.onended = cleanup;
  audio.onerror = cleanup;

  currentAudio = audio;
  currentOnEnd = cleanup;

  opts.onStart?.();
  audio.play().catch(cleanup);
}
