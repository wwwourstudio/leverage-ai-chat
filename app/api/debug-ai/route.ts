import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createXai } from '@ai-sdk/xai';

export async function GET() {
  const apiKey = process.env.XAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      status: 'error',
      keyPresent: false,
      message: 'XAI_API_KEY is not set in environment variables',
    });
  }

  try {
    const result = await generateText({
      model: createXai({ apiKey })('grok-3-fast'),
      prompt: 'Say "OK" and nothing else.',
      maxOutputTokens: 10,
    });

    return NextResponse.json({
      status: 'ok',
      keyPresent: true,
      keyPrefix: apiKey.slice(0, 8) + '...',
      aiResponse: result.text,
    });
  } catch (err) {
    return NextResponse.json({
      status: 'error',
      keyPresent: true,
      keyPrefix: apiKey.slice(0, 8) + '...',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
