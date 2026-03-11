import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createXai } from '@ai-sdk/xai';
import { createClient } from '@/lib/supabase/server';
import { getGrokApiKey } from '@/lib/config';
import { AI_CONFIG, SETTINGS_SUGGEST_PROMPT } from '@/lib/constants';

/**
 * POST /api/settings/suggest
 * Returns AI-powered personalization suggestions based on the user's profile + stats.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const apiKey = getGrokApiKey();
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'AI service not configured' }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));

    // Build a concise context string for the AI
    const stats       = body.stats       ?? {};
    const prefs       = body.preferences ?? {};
    const tier        = body.subscription_tier ?? 'free';

    const contextParts: string[] = [
      `Subscription: ${tier}`,
      `Sports tracked: ${(prefs.tracked_sports ?? []).join(', ') || 'none'}`,
      `Preferred sportsbooks: ${(prefs.preferred_books ?? []).join(', ') || 'none'}`,
      `Risk tolerance: ${prefs.risk_tolerance ?? 'medium'}`,
      `Bankroll: $${prefs.bankroll ?? 0}`,
      `Notifications: email=${prefs.email_notifications}, push=${prefs.push_notifications}, odds=${prefs.odds_alerts}, lines=${prefs.line_movement_alerts}, arb=${prefs.arbitrage_alerts}`,
      `Total analyses: ${stats.total_analyses ?? 0}`,
      `Record: ${stats.wins ?? 0}W–${stats.losses ?? 0}L`,
      `ROI: ${stats.roi != null ? `${Number(stats.roi).toFixed(1)}%` : 'unknown'}`,
      `Favorite sport: ${stats.favorite_sport ?? 'unknown'}`,
      `Favorite book: ${stats.favorite_book ?? 'unknown'}`,
    ];

    const context = contextParts.join(' | ');
    const prompt = SETTINGS_SUGGEST_PROMPT.replace('{CONTEXT}', context);

    const xai = createXai({ apiKey });
    const { text } = await generateText({
      model: xai(AI_CONFIG.FAST_MODEL_NAME ?? 'grok-3-fast'),
      prompt,
      maxOutputTokens: 600,
      temperature: 0.4,
    });

    // Parse response — strip markdown fences if present
    let suggestions: unknown[] = [];
    try {
      const clean = text.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(clean);
      suggestions = Array.isArray(parsed) ? parsed.slice(0, 5) : [];
    } catch {
      console.warn('[v0] [API/settings/suggest] non-JSON response:', text.slice(0, 200));
      return NextResponse.json({ success: false, error: 'AI returned invalid suggestions' }, { status: 500 });
    }

    return NextResponse.json({ success: true, suggestions });
  } catch (err) {
    console.error('[v0] [API/settings/suggest] error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
