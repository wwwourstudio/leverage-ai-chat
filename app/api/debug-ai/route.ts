import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createXai } from '@ai-sdk/xai';

export async function GET() {
  const results: Record<string, any> = {};

  // ── 1. XAI / Grok ─────────────────────────────────────────────────────────
  const xaiKey = process.env.XAI_API_KEY;
  if (!xaiKey) {
    results.xai = { status: 'missing', message: 'XAI_API_KEY not set in Vercel environment variables' };
  } else {
    try {
      const r = await generateText({
        model: createXai({ apiKey: xaiKey })('grok-3-mini'),
        prompt: 'Reply with the single word OK.',
        maxOutputTokens: 10,
      });
      results.xai = { status: 'ok', keyPrefix: xaiKey.slice(0, 8) + '...', aiResponse: r.text.trim() };
    } catch (err) {
      results.xai = {
        status: 'error',
        keyPrefix: xaiKey.slice(0, 8) + '...',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── 2. Odds API ────────────────────────────────────────────────────────────
  const oddsKey = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
  if (!oddsKey) {
    results.odds = { status: 'missing', message: 'ODDS_API_KEY not set in Vercel environment variables' };
  } else {
    try {
      const res = await fetch(
        `https://api.the-odds-api.com/v4/sports?apiKey=${oddsKey}`,
        { signal: AbortSignal.timeout(8000) }
      );
      const remaining = res.headers.get('x-requests-remaining') ?? 'unknown';
      const used = res.headers.get('x-requests-used') ?? 'unknown';
      if (res.ok) {
        results.odds = {
          status: 'ok',
          keyPrefix: oddsKey.slice(0, 8) + '...',
          requestsRemaining: remaining,
          requestsUsed: used,
        };
      } else {
        const body = await res.text();
        results.odds = {
          status: 'error',
          httpStatus: res.status,
          keyPrefix: oddsKey.slice(0, 8) + '...',
          error: body.substring(0, 200),
        };
      }
    } catch (err) {
      results.odds = {
        status: 'error',
        keyPrefix: oddsKey.slice(0, 8) + '...',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── 3. Kalshi ──────────────────────────────────────────────────────────────
  const kalshiKey = process.env.KALSHI_API_KEY;
  const kalshiHeaders: Record<string, string> = { Accept: 'application/json', 'User-Agent': 'LeverageAI/1.0' };
  if (kalshiKey) kalshiHeaders['Authorization'] = `Bearer ${kalshiKey}`;

  try {
    const res = await fetch(
      'https://trading-api.kalshi.com/trade-api/v2/markets?limit=1&status=open',
      { headers: kalshiHeaders, signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const data = await res.json();
      results.kalshi = {
        status: 'ok',
        keyPresent: !!kalshiKey,
        marketsReturned: data.markets?.length ?? 0,
      };
    } else {
      const body = await res.text();
      results.kalshi = {
        status: 'error',
        httpStatus: res.status,
        keyPresent: !!kalshiKey,
        error: body.substring(0, 200),
      };
    }
  } catch (err) {
    results.kalshi = {
      status: 'error',
      keyPresent: !!kalshiKey,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // ── 4. Weather (Open-Meteo – no key needed) ────────────────────────────────
  try {
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=40.71&longitude=-74.01&current_weather=true',
      { signal: AbortSignal.timeout(6000) }
    );
    if (res.ok) {
      results.weather = { status: 'ok', message: 'Open-Meteo reachable (no API key required)' };
    } else {
      results.weather = { status: 'error', httpStatus: res.status };
    }
  } catch (err) {
    results.weather = { status: 'error', error: err instanceof Error ? err.message : String(err) };
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const allOk = Object.values(results).every((r) => r.status === 'ok');
  const missing = Object.entries(results)
    .filter(([, r]) => r.status === 'missing')
    .map(([k]) => k);
  const errors = Object.entries(results)
    .filter(([, r]) => r.status === 'error')
    .map(([k]) => k);

  return NextResponse.json({
    summary: allOk ? 'ALL SYSTEMS OK' : `ISSUES: missing=[${missing.join(',')}] errors=[${errors.join(',')}]`,
    services: results,
    checkedAt: new Date().toISOString(),
  });
}
