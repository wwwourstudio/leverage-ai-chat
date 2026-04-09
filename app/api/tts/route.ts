import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

const TTS_ENDPOINT = 'https://api.x.ai/v1/audio/speech';
const TTS_MODEL = 'grok-3-mini-tts';
const VALID_VOICES = new Set(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']);

export async function POST(req: NextRequest) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'TTS unavailable' }, { status: 503 });
  }

  let text: string;
  let voice: string;
  try {
    const body = await req.json();
    text = typeof body.text === 'string' ? body.text.trim() : '';
    voice = VALID_VOICES.has(body.voice) ? body.voice : 'alloy';
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
    body: JSON.stringify({ model: TTS_MODEL, input, voice }),
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
