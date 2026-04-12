import { NextRequest, NextResponse } from 'next/server';
import { GROK_VOICES, GROK_VOICE_DEFAULT } from '@/lib/constants';

export const maxDuration = 30;

const TTS_ENDPOINT = 'https://api.x.ai/v1/tts';
const VALID_VOICE_IDS = new Set(GROK_VOICES.map(v => v.id));

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
    // Accept both `voice` (legacy) and `voice_id` (new) from callers
    const requested = body.voice_id ?? body.voice ?? GROK_VOICE_DEFAULT;
    voice_id = VALID_VOICE_IDS.has(requested) ? requested : GROK_VOICE_DEFAULT;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  // Cap input at 4096 chars to stay within model limits
  const input = text.slice(0, 4096);

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
      output_format: { codec: 'mp3', sample_rate: 44100, bit_rate: 128000 },
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    console.error('[TTS] xAI error:', resp.status, err.slice(0, 200));
    return NextResponse.json({ error: 'TTS request failed' }, { status: 502 });
  }

  const audio = await resp.arrayBuffer();
  return new Response(audio, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  });
}
