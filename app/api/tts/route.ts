import { NextRequest, NextResponse } from 'next/server';
import { GROK_VOICES, GROK_VOICE_DEFAULT } from '@/lib/constants';

export const maxDuration = 30;

const TTS_ENDPOINT = 'https://api.x.ai/v1/tts';
const VALID_VOICE_IDS = new Set(GROK_VOICES.map(v => v.id));

/**
 * Strip markdown so the xAI TTS model receives clean prose.
 * The xAI TTS model handles natural pacing — no [pause] injection needed.
 */
function cleanForSpeech(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, '')             // fenced code blocks
    .replace(/`[^`]+`/g, '')                     // inline code
    .replace(/!\[.*?\]\(.*?\)/g, '')             // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')    // links → label text
    .replace(/^#{1,6}\s+/gm, '')                 // headings
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')    // bold / italic
    .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
    .replace(/^\|.*\|$/gm, '')                   // table rows
    .replace(/^[-|: ]+$/gm, '')                  // table separators
    .replace(/^[ \t]*[-*+]\s+/gm, '')            // bullet lists
    .replace(/^[ \t]*\d+\.\s+/gm, '')            // numbered lists
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 4000);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'TTS unavailable — XAI_API_KEY not configured' }, { status: 503 });
  }

  let text: string;
  let voice_id: string;
  try {
    const body = await req.json();
    text = typeof body.text === 'string' ? body.text.trim() : '';
    const requested = body.voice_id ?? body.voice ?? GROK_VOICE_DEFAULT;
    voice_id = VALID_VOICE_IDS.has(requested) ? requested : GROK_VOICE_DEFAULT;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  const input = cleanForSpeech(text);

  const resp = await fetch(TTS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: input,
      voice_id,
      language: 'en',
      output_format: { codec: 'mp3', sample_rate: 24000, bit_rate: 128000 },
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    console.error('[TTS] xAI error:', resp.status, err.slice(0, 300));
    return NextResponse.json({ error: 'TTS request failed', status: resp.status }, { status: resp.status >= 500 ? 502 : resp.status });
  }

  // Stream audio bytes straight to the client — no server buffering
  return new Response(resp.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  });
}
