import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createXai } from '@ai-sdk/xai';
import { createClient } from '@/lib/supabase/server';
import { getGrokApiKey } from '@/lib/config';

/**
 * POST /api/alerts/suggest
 *
 * Accepts partial alert input and returns an AI-generated alert configuration suggestion.
 * Requires authentication.
 *
 * Body: { input: string, alert_type?: string, sport?: string }
 * Returns: { suggestion: { title, alert_type, threshold, description } }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = getGrokApiKey();
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'AI service unavailable' }, { status: 503 });
  }

  let body: { input?: string; alert_type?: string; sport?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { input, alert_type, sport } = body;
  if (!input || input.trim().length < 2) {
    return NextResponse.json({ success: false, error: 'Input too short' }, { status: 400 });
  }

  const xai = createXai({ apiKey });

  const prompt = `You are a sports betting alert configuration assistant. Based on the user's partial description, suggest an optimal alert configuration.

User input: "${input.trim()}"
${alert_type ? `Preferred alert type: ${alert_type}` : ''}
${sport ? `Sport context: ${sport}` : ''}

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

  try {
    const { text } = await generateText({
      model: xai('grok-3-fast'),
      prompt,
      maxOutputTokens: 200,
    });

    // Parse the JSON response
    const cleaned = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    const suggestion = JSON.parse(cleaned);

    // Validate required fields
    const validTypes = ['odds_change', 'line_movement', 'player_prop', 'arbitrage', 'kalshi_price', 'game_start'];
    if (!suggestion.title || !validTypes.includes(suggestion.alert_type)) {
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
    console.error('[Alerts] Suggest failed:', err);
    return NextResponse.json({ success: false, error: 'Failed to generate suggestion' }, { status: 500 });
  }
}
