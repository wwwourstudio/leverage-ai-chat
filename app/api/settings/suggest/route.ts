import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuth,
  AuthRequiredError,
  unauthorized,
  serviceUnavailable,
  internalError,
} from '@/lib/api/route-helpers';
import { generateJson, AiNotConfiguredError } from '@/lib/api/ai-generate';
import { SETTINGS_SUGGEST_PROMPT } from '@/lib/constants';

/**
 * POST /api/settings/suggest
 * Returns AI-powered personalization suggestions based on the user's profile + stats.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    void user; // auth confirmed; user ID not needed for this endpoint

    const body = await req.json().catch(() => ({}));
    const stats = body.stats ?? {};
    const prefs = body.preferences ?? {};
    const tier = body.subscription_tier ?? 'free';

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

    const prompt = SETTINGS_SUGGEST_PROMPT.replace('{CONTEXT}', contextParts.join(' | '));

    const parsed = await generateJson<unknown[]>(prompt, { maxOutputTokens: 600, temperature: 0.4 });
    const suggestions = Array.isArray(parsed) ? parsed.slice(0, 5) : [];

    return NextResponse.json({ success: true, suggestions });
  } catch (err) {
    if (err instanceof AuthRequiredError) return unauthorized();
    if (err instanceof AiNotConfiguredError) return serviceUnavailable(err.message);
    if (err instanceof SyntaxError) {
      console.warn('[v0] [API/settings/suggest] non-JSON AI response');
      return internalError('AI returned invalid suggestions');
    }
    console.error('[v0] [API/settings/suggest] error:', err);
    return internalError();
  }
}
