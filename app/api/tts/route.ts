import { NextRequest, NextResponse } from 'next/server';
import { GROK_VOICES, GROK_VOICE_DEFAULT } from '@/lib/constants';

export const maxDuration = 30;

const TTS_ENDPOINT = 'https://api.x.ai/v1/tts';
const VALID_VOICE_IDS = new Set(GROK_VOICES.map(v => v.id));

/**
 * Normalize raw AI response text for natural spoken delivery.
 * - Strips all markdown (headings, bold, italic, code, tables, links, lists)
 * - Converts sports betting notation to spoken form
 * - Inserts [pause] tags after sentence endings for natural pacing
 */
function prepareSpeechText(raw: string): string {
  return raw
    // Remove fenced code blocks entirely — they don't translate to speech
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    // Strip markdown images
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // Strip markdown links — keep label text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Strip headings
    .replace(/^#{1,6}\s+/gm, '')
    // Strip bold/italic
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
    // Strip table rows and separators
    .replace(/^\|.*\|$/gm, '')
    .replace(/^[-|: ]+$/gm, '')
    // Strip horizontal rules
    .replace(/^-{3,}$/gm, '')
    .replace(/^\*{3,}$/gm, '')
    // Strip list markers (bullets and numbers)
    .replace(/^[ \t]*[-*+]\s+/gm, '')
    .replace(/^[ \t]*\d+\.\s+/gm, '')
    // Sports betting notation → spoken form
    .replace(/\+(\d+(?:\.\d+)?)/g, 'plus $1')        // +150 → plus 150
    .replace(/(-\d+(?:\.\d+)?)(?=\s|$)/g, 'minus $1') // -7.5 → minus 7.5 (only isolated)
    .replace(/(\d+(?:\.\d+)?)%/g, '$1 percent')        // 47% → 47 percent
    .replace(/\$(\d[\d,]*(?:\.\d+)?)/g, '$1 dollars')  // $1,200 → 1200 dollars
    .replace(/\bo\/u\b/gi, 'over under')
    .replace(/\bO\/U\b/g, 'over under')
    .replace(/\bML\b/g, 'moneyline')
    .replace(/\bGB\b/g, 'games back')
    // Add a natural pause after sentence-ending punctuation
    .replace(/([.!?])(\s+[A-Z])/g, '$1 [pause] $2')
    // Clean up excess whitespace / blank lines
    .replace(/\n{2,}/g, ' [pause] ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'TTS unavailable' }, { status: 503 });
  }

  let text: string;
  let voice_id: string;
  try {
    const body = await req.json();
    text = typeof body.text === 'string' ? body.text.trim() : '';
    // Accept both `voice` (legacy) and `voice_id` from callers
    const requested = body.voice_id ?? body.voice ?? GROK_VOICE_DEFAULT;
    voice_id = VALID_VOICE_IDS.has(requested) ? requested : GROK_VOICE_DEFAULT;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  // xAI does not provide a TTS endpoint — server-side TTS is unavailable.
  // All voice playback uses the browser's SpeechSynthesis API via lib/voice-player.ts.
  void prepareSpeechText; // keep helper available if server TTS is added later
  void voice_id;
  return NextResponse.json(
    { error: 'Server-side TTS is not available. Voice playback uses browser SpeechSynthesis.' },
    { status: 501 },
  );
}
