import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createXai } from '@ai-sdk/xai';
import { getGrokApiKey } from '@/lib/config';
import { HTTP_STATUS } from '@/lib/constants';

// ── In-memory cache (10-minute TTL) ─────────────────────────────────────────

interface CacheEntry {
  prompts: Array<{ label: string; query: string }>;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function getCached(key: string): Array<{ label: string; query: string }> | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.prompts;
}

function setCached(key: string, prompts: Array<{ label: string; query: string }>): void {
  cache.set(key, { prompts, expiresAt: Date.now() + 10 * 60 * 1000 });
}

// ── Route handler ─────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const category = searchParams.get('category') || 'all';
  const sport = searchParams.get('sport') || '';

  const cacheKey = `${category}:${sport}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json({ success: true, prompts: cached, cached: true });
  }

  const apiKey = getGrokApiKey();
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'AI not configured' }, { status: HTTP_STATUS.SERVICE_UNAVAILABLE });
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const sportLabel = sport ? sport.toUpperCase() : 'any sport';
  const categoryLabel = category === 'all' ? 'sports betting and fantasy' : category === 'dfs' ? 'Daily Fantasy Sports (DFS)' : category;

  const systemPrompt = `You generate quick-action prompt suggestions for a sports AI chat application called Leverage AI. Your suggestions must be highly specific, timely, and directly useful to bettors and fantasy players. Never use placeholder text — always name real teams, matchups, or player types. Return ONLY valid JSON with no markdown.`;

  const userPrompt = `Today is ${today}. The user is in the "${categoryLabel}" section${sport ? `, focused on ${sportLabel}` : ''}. Generate exactly 5 suggested questions that a serious sports bettor or fantasy player would want to ask right now. Make them specific and action-oriented — reference real team names, upcoming matchups, current trends, and prop bet opportunities relevant to this week. For DFS, include lineup-building angles. For fantasy, include waiver wire and start/sit decisions. For betting, include line value and sharp money angles.

Return a JSON array of 5 objects: [{"label": "Short label (3-5 words)", "query": "Full question the user wants answered (1-2 sentences, specific and actionable)"}]`;

  try {
    const { text } = await generateText({
      model: createXai({ apiKey })('grok-3-fast'),
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 600,
      temperature: 0.8,
    });

    // Extract JSON from the response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('[v0] [prompts] No JSON array in Grok response:', text.slice(0, 200));
      return NextResponse.json({ success: false, error: 'Invalid AI response format' }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
    }

    const prompts: Array<{ label: string; query: string }> = JSON.parse(jsonMatch[0]);

    // Validate shape
    const valid = Array.isArray(prompts) && prompts.every(p => typeof p.label === 'string' && typeof p.query === 'string');
    if (!valid) {
      return NextResponse.json({ success: false, error: 'Malformed AI response' }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
    }

    setCached(cacheKey, prompts);
    return NextResponse.json({ success: true, prompts });
  } catch (err: any) {
    console.error('[v0] [prompts] Error generating prompts:', err?.message ?? err);
    return NextResponse.json({ success: false, error: 'Failed to generate prompts' }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
  }
}
