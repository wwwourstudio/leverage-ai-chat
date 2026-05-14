import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuth,
  AuthRequiredError,
  unauthorized,
  badRequest,
  serviceUnavailable,
  parseJsonBody,
  JsonParseError,
  internalError,
} from '@/lib/api/route-helpers';
import { generateJson, AiNotConfiguredError } from '@/lib/api/ai-generate';

const VALID_TYPES = ['odds_change', 'line_movement', 'player_prop', 'arbitrage', 'kalshi_price', 'game_start'];

const SYSTEM = `You are a sports betting alert configuration assistant. Based on the user's partial description, suggest an optimal alert configuration.

Available alert types: odds_change, line_movement, player_prop, arbitrage, kalshi_price, game_start
Available sports: NBA, NFL, MLB, NHL, NCAA Football, NCAA Basketball, Premier League, MLS

Respond ONLY with a JSON object (no markdown, no explanation):
{
  "title": "concise alert name (max 60 chars)",
  "alert_type": "one of the available alert types",
  "threshold": number or null (e.g. 2.5 for line movement points, 3.0 for arbitrage ROI%, 65 for kalshi price),
  "description": "brief description of what this alert monitors (max 100 chars)",
  "sport": "sport name or null"
}`;

/**
 * POST /api/alerts/suggest
 * Accepts partial alert input and returns an AI-generated alert configuration suggestion.
 * Body: { input: string, alert_type?: string, sport?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    void user; // auth confirmed; user ID not needed for this endpoint

    const body = await parseJsonBody<{ input?: string; alert_type?: string; sport?: string }>(req);
    const { input, alert_type, sport } = body;

    if (!input || input.trim().length < 2) return badRequest('Input too short');

    const prompt = `User input: "${input.trim()}"
${alert_type ? `Preferred alert type: ${alert_type}` : ''}
${sport ? `Sport context: ${sport}` : ''}`;

    const suggestion = await generateJson<{
      title?: string;
      alert_type?: string;
      threshold?: number | null;
      description?: string;
      sport?: string | null;
    }>(prompt, { system: SYSTEM, maxOutputTokens: 200 });

    if (!suggestion.title || !VALID_TYPES.includes(suggestion.alert_type ?? '')) {
      throw new Error('Invalid suggestion format');
    }

    return NextResponse.json({
      success: true,
      suggestion: {
        title: String(suggestion.title).slice(0, 60),
        alert_type: suggestion.alert_type,
        threshold: suggestion.threshold ?? null,
        description: suggestion.description ? String(suggestion.description).slice(0, 100) : null,
        sport: suggestion.sport || null,
      },
    });
  } catch (err) {
    if (err instanceof AuthRequiredError) return unauthorized();
    if (err instanceof JsonParseError) return badRequest(err.message);
    if (err instanceof AiNotConfiguredError) return serviceUnavailable(err.message);
    console.error('[Alerts] Suggest failed:', err);
    return internalError('Failed to generate suggestion');
  }
}
