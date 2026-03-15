import { NextResponse } from 'next/server';
import { getSupabaseServiceKey, getSupabaseUrl } from '@/lib/config';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/alerts/check
 *
 * Authenticated endpoint. Evaluates active alerts for the current user only.
 * For each alert whose condition is met, increments trigger_count and sets
 * last_triggered_at.
 *
 * Returns: { triggered: Array<{ id, title }> }
 */
export async function GET() {
  // Authenticate the caller — only return alerts belonging to them
  const authSupabase = await createServerClient();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ triggered: [] });
  }

  const supabaseUrl = getSupabaseUrl();
  const serviceKey = getSupabaseServiceKey();

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ triggered: [] });
  }

  // Service-role client for cross-table evaluation queries (line_movement, arbitrage, etc.)
  const supabase = createClient(supabaseUrl, serviceKey, {
    db: { schema: 'api' },
  });

  try {
    // Fetch active alerts scoped to the authenticated user
    // NOTE: PostgREST cannot compare two columns in .or(), so we filter by trigger limit in JS
    const { data: allAlerts, error: fetchError } = await supabase
      .from('user_alerts')
      .select('id, user_id, alert_type, sport, team, player, condition, threshold, trigger_count, max_triggers, title')
      .eq('is_active', true)
      .eq('user_id', user.id);

    if (fetchError || !allAlerts) {
      console.error('[Alerts] Failed to fetch alerts:', fetchError);
      return NextResponse.json({ triggered: [] });
    }

    // Filter out alerts that have already hit their max trigger count
    const alerts = allAlerts.filter((a: any) =>
      a.max_triggers === null || a.trigger_count < a.max_triggers
    );

    const triggered: { id: string; title: string }[] = [];

    for (const alert of alerts) {
      const fired = await evaluateAlert(supabase, alert);
      if (fired) {
        const { error: updateError } = await supabase
          .from('user_alerts')
          .update({
            trigger_count: (alert.trigger_count ?? 0) + 1,
            last_triggered_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', alert.id);

        if (!updateError) {
          triggered.push({ id: alert.id, title: alert.title });
          console.log(`[Alerts] Fired alert "${alert.title}" for user ${alert.user_id}`);
        }
      }
    }

    return NextResponse.json({ triggered });
  } catch (err) {
    console.error('[Alerts] check error:', err);
    return NextResponse.json({ triggered: [] });
  }
}

async function evaluateAlert(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  alert: {
    id: string;
    alert_type: string;
    sport: string | null;
    team: string | null;
    player: string | null;
    threshold: number | null;
    condition: Record<string, unknown>;
  }
): Promise<boolean> {
  const threshold = alert.threshold ?? (alert.condition?.threshold as number | null) ?? null;

  switch (alert.alert_type) {
    case 'odds_change':
    case 'line_movement': {
      // Trigger if any odds entry for this sport/team has moved beyond the threshold
      let query = supabase
        .from('line_movement')
        .select('movement_amount')
        .order('recorded_at', { ascending: false })
        .limit(10);

      if (alert.sport) query = query.ilike('sport', `%${alert.sport}%`);
      if (alert.team) query = query.ilike('team_name', `%${alert.team}%`);

      const { data } = await query;
      if (!data?.length) return false;
      if (threshold === null) return true; // any movement counts
      return data.some((row: { movement_amount: number }) =>
        Math.abs(row.movement_amount) >= threshold
      );
    }

    case 'arbitrage': {
      // Trigger if any arbitrage opportunity exceeds the threshold ROI
      let query = supabase
        .from('arbitrage_opportunities')
        .select('roi_percentage')
        .order('detected_at', { ascending: false })
        .limit(10);

      if (alert.sport) query = query.ilike('sport', `%${alert.sport}%`);

      const { data } = await query;
      if (!data?.length) return false;
      if (threshold === null) return true;
      return data.some((row: { roi_percentage: number }) => row.roi_percentage >= threshold);
    }

    case 'player_prop': {
      // Trigger if a player prop line changed recently
      let query = supabase
        .from('player_props')
        .select('line')
        .order('updated_at', { ascending: false })
        .limit(5);

      if (alert.player) query = query.ilike('player_name', `%${alert.player}%`);
      if (alert.sport) query = query.ilike('sport', `%${alert.sport}%`);

      const { data } = await query;
      return !!(data?.length);
    }

    case 'kalshi_price': {
      // Trigger if a Kalshi market price crosses the threshold
      let query = supabase
        .from('kalshi_markets')
        .select('yes_price')
        .order('updated_at', { ascending: false })
        .limit(5);

      if (alert.team) query = query.ilike('title', `%${alert.team}%`);

      const { data } = await query;
      if (!data?.length) return false;
      if (threshold === null) return true;
      return data.some((row: { yes_price: number }) => row.yes_price >= threshold);
    }

    case 'game_start': {
      // Always fire game_start alerts (they rely on external push; here we just acknowledge)
      return false;
    }

    default:
      return false;
  }
}
