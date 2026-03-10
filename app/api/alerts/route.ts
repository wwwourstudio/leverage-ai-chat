import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const VALID_ALERT_TYPES = [
  'odds_change',
  'line_movement',
  'player_prop',
  'arbitrage',
  'kalshi_price',
  'game_start',
] as const;

/**
 * GET /api/alerts
 * Returns the authenticated user's alerts, newest first.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('user_alerts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[Alerts] GET failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}

/**
 * POST /api/alerts
 * Creates a new alert for the authenticated user.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { title, alert_type, sport, team, player, description, threshold, max_triggers } = body as {
    title?: string;
    alert_type?: string;
    sport?: string;
    team?: string;
    player?: string;
    description?: string;
    threshold?: number | null;
    max_triggers?: number | null;
  };

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 });
  }

  if (!alert_type || !VALID_ALERT_TYPES.includes(alert_type as typeof VALID_ALERT_TYPES[number])) {
    return NextResponse.json({ success: false, error: 'Invalid alert_type' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('user_alerts')
    .insert({
      user_id: user.id,
      title: title.trim(),
      alert_type,
      sport: sport || null,
      team: team || null,
      player: player || null,
      description: description || null,
      threshold: threshold ?? null,
      max_triggers: max_triggers ?? 1,
      condition: {
        marketType: alert_type,
        threshold: threshold ?? null,
      },
      is_active: true,
      trigger_count: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('[Alerts] POST failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data }, { status: 201 });
}
