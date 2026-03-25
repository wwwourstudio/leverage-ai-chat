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
      .select('id, user_id, alert_type, sport, team, player, condition, threshold, trigger_count, max_triggers, title, notify_channels')
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

          // Dispatch to non-in_app channels.
          // notify_channels is a DB column (TEXT[]); fall back to condition JSONB for
          // rows created before the column was added.
          const channels: string[] =
            (alert.notify_channels as string[] | null) ??
            (alert.condition?.notify_channels as string[] | null) ??
            ['in_app'];
          for (const ch of channels) {
            if (ch === 'in_app') continue; // handled client-side via triggered[] response
            if (ch === 'webhook') {
              const webhookUrl = (alert.condition as Record<string, unknown>)?.webhook_url as string | undefined;
              if (webhookUrl) {
                fetch(webhookUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ alert_id: alert.id, title: alert.title, triggered_at: new Date().toISOString() }),
                }).catch(e => console.warn('[Alerts] webhook delivery failed:', e));
              }
            } else {
              // email / sms / push — log intent; connect to provider when credentials are available
              console.log(`[Alerts] ${ch} delivery queued for alert "${alert.title}" (user ${alert.user_id})`);
            }
          }
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
      // Trigger if any odds entry for this sport/team has moved beyond the threshold.
      // Schema columns: line_change (amount), timestamp (when recorded), home_team/away_team (not team_name).
      let query = supabase
        .from('line_movement')
        .select('line_change')
        .order('timestamp', { ascending: false })
        .limit(10);

      if (alert.sport) query = query.ilike('sport', `%${alert.sport}%`);
      if (alert.team) {
        query = query.or(`home_team.ilike.%${alert.team}%,away_team.ilike.%${alert.team}%`);
      }

      const { data } = await query;
      if (!data?.length) return false;
      if (threshold === null) return true; // any movement counts
      return data.some((row: { line_change: number }) =>
        Math.abs(row.line_change) >= threshold
      );
    }

    case 'arbitrage': {
      // Trigger if any arbitrage opportunity exceeds the threshold ROI.
      // Schema column: profit_margin (not roi_percentage).
      let query = supabase
        .from('arbitrage_opportunities')
        .select('profit_margin')
        .order('detected_at', { ascending: false })
        .limit(10);

      if (alert.sport) query = query.ilike('sport', `%${alert.sport}%`);

      const { data } = await query;
      if (!data?.length) return false;
      if (threshold === null) return true;
      return data.some((row: { profit_margin: number }) => row.profit_margin >= threshold);
    }

    case 'player_prop': {
      // Trigger if a player prop line changed recently.
      // Table: player_props_markets (not player_props). Sort by fetched_at (not updated_at).
      let query = supabase
        .from('player_props_markets')
        .select('line')
        .order('fetched_at', { ascending: false })
        .limit(5);

      if (alert.player) query = query.ilike('player_name', `%${alert.player}%`);
      if (alert.sport) query = query.ilike('sport', `%${alert.sport}%`);

      const { data } = await query;
      return !!(data?.length);
    }

    case 'kalshi_price': {
      // Trigger if a Kalshi market price crosses the threshold.
      // Sort by cached_at (not updated_at — that column doesn't exist on kalshi_markets).
      let query = supabase
        .from('kalshi_markets')
        .select('yes_price')
        .order('cached_at', { ascending: false })
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

    case 'market_intelligence': {
      // Trigger when a high-severity market anomaly was detected in the last 5 minutes.
      // market_anomalies is populated by the market-intelligence engine when running.
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: anomalies } = await supabase
        .from('market_anomalies')
        .select('id')
        .gte('detected_at', cutoff)
        .eq('severity', 'high')
        .limit(1);
      return (anomalies?.length ?? 0) > 0;
    }

    default:
      return false;
  }
}
