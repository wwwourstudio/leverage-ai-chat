import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getRateLimitId } from '@/lib/middleware/rate-limit';

/**
 * GET /api/settings
 * Returns combined profile, preferences, and stats for the authenticated user.
 * Handles missing DB columns (e.g. arbitrage_alerts) gracefully.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    // Fetch in parallel — any missing tables return null gracefully
    const [profileResult, prefsResult, statsResult] = await Promise.allSettled([
      supabase
        .from('user_profiles')
        .select('id, display_name, avatar_url, subscription_tier, credits_remaining, created_at')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('user_preferences')
        .select('tracked_sports, preferred_books, bankroll, risk_tolerance, theme, email_notifications, push_notifications, odds_alerts, line_movement_alerts, custom_instructions, updated_at')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('user_stats')
        .select('total_analyses, wins, losses, roi, favorite_sport, favorite_book')
        .eq('user_id', user.id)
        .single(),
    ]);

    const profileData = profileResult.status === 'fulfilled' ? profileResult.value.data : null;
    const prefsData   = prefsResult.status   === 'fulfilled' ? prefsResult.value.data   : null;
    const statsData   = statsResult.status   === 'fulfilled' ? statsResult.value.data   : null;

    // Fetch arbitrage_alerts separately — it may not exist in older DB instances
    let arbitrage_alerts = true;
    try {
      const { data: arbData } = await supabase
        .from('user_preferences')
        .select('arbitrage_alerts')
        .eq('user_id', user.id)
        .single();
      if (arbData && typeof arbData.arbitrage_alerts === 'boolean') {
        arbitrage_alerts = arbData.arbitrage_alerts;
      }
    } catch {
      // Column doesn't exist — use default true
    }

    return NextResponse.json({
      success: true,
      profile: {
        id:                   user.id,
        email:                user.email ?? '',
        name:                 profileData?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        avatar:               profileData?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
        subscription_tier:    profileData?.subscription_tier ?? 'free',
        credits_remaining:    profileData?.credits_remaining ?? 0,
        member_since:         profileData?.created_at ?? user.created_at ?? null,
      },
      preferences: {
        tracked_sports:       prefsData?.tracked_sports       ?? ['NBA', 'NFL'],
        preferred_books:      prefsData?.preferred_books      ?? [],
        bankroll:             Number(prefsData?.bankroll)     || 0,
        risk_tolerance:       prefsData?.risk_tolerance       ?? 'medium',
        theme:                prefsData?.theme                ?? 'dark',
        email_notifications:  prefsData?.email_notifications  ?? true,
        push_notifications:   prefsData?.push_notifications   ?? false,
        odds_alerts:          prefsData?.odds_alerts          ?? true,
        line_movement_alerts: prefsData?.line_movement_alerts ?? true,
        arbitrage_alerts,
        custom_instructions:  prefsData?.custom_instructions  ?? '',
      },
      stats: {
        total_analyses: statsData?.total_analyses ?? 0,
        wins:           statsData?.wins           ?? 0,
        losses:         statsData?.losses         ?? 0,
        roi:            Number(statsData?.roi)    || 0,
        favorite_sport: statsData?.favorite_sport ?? null,
        favorite_book:  statsData?.favorite_book  ?? null,
      },
    });
  } catch (err) {
    console.error('[v0] [API/settings] GET error:', err);
    return NextResponse.json({ success: false, error: 'Failed to load settings' }, { status: 500 });
  }
}

/**
 * PATCH /api/settings
 * Saves profile and preferences. Handles missing arbitrage_alerts column gracefully:
 * on error code 42703 (unknown column), retries without that field.
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    // Rate limit: 10 settings updates per minute per user
    const rl = checkRateLimit('settings-patch', getRateLimitId(req, user.id), { limit: 10, windowMs: 60_000 });
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
      );
    }

    // Reject oversized payloads before parsing
    const contentLength = Number(req.headers.get('content-length') ?? 0);
    if (contentLength > 50_000) {
      return NextResponse.json({ success: false, error: 'Request too large' }, { status: 413 });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    // Update display name via Supabase auth metadata
    if (typeof body.name === 'string' && body.name.trim()) {
      await supabase.auth.updateUser({ data: { full_name: body.name.trim().slice(0, 100) } });
      // Also update user_profiles table
      await supabase
        .from('user_profiles')
        .update({ display_name: body.name.trim().slice(0, 100), updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
    }

    // Base preferences payload (columns that always exist)
    const basePayload: Record<string, unknown> = {
      user_id:              user.id,
      tracked_sports:       Array.isArray(body.tracked_sports)  ? body.tracked_sports  : ['NBA', 'NFL'],
      preferred_books:      Array.isArray(body.preferred_books) ? body.preferred_books : [],
      bankroll:             typeof body.bankroll === 'number'    ? Math.max(0, body.bankroll) : 0,
      risk_tolerance:       ['conservative','medium','aggressive'].includes(body.risk_tolerance) ? body.risk_tolerance : 'medium',
      theme:                ['dark','light','system'].includes(body.theme) ? body.theme : 'dark',
      default_sport:        (Array.isArray(body.tracked_sports) && body.tracked_sports[0]) || 'NBA',
      email_notifications:  typeof body.email_notifications  === 'boolean' ? body.email_notifications  : true,
      push_notifications:   typeof body.push_notifications   === 'boolean' ? body.push_notifications   : false,
      odds_alerts:          typeof body.odds_alerts          === 'boolean' ? body.odds_alerts          : true,
      line_movement_alerts: typeof body.line_movement_alerts === 'boolean' ? body.line_movement_alerts : true,
      updated_at:           new Date().toISOString(),
    };

    // Try with arbitrage_alerts first
    const fullPayload = {
      ...basePayload,
      arbitrage_alerts: typeof body.arbitrage_alerts === 'boolean' ? body.arbitrage_alerts : true,
    };

    const { error: prefsError } = await supabase
      .from('user_preferences')
      .upsert(fullPayload, { onConflict: 'user_id' });

    if (prefsError) {
      // 42703 = column does not exist; PGRST204 = column not found in schema cache
      const isMissingColumn = prefsError.code === '42703'
        || prefsError.message?.includes('arbitrage_alerts')
        || (prefsError as any).code === 'PGRST204';

      if (isMissingColumn) {
        console.warn('[v0] [API/settings] arbitrage_alerts column missing — retrying without it');
        const { error: retryError } = await supabase
          .from('user_preferences')
          .upsert(basePayload, { onConflict: 'user_id' });
        if (retryError) throw retryError;
      } else {
        throw prefsError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[v0] [API/settings] PATCH error:', err);
    // Return a generic message to avoid leaking internal schema details
    return NextResponse.json({ success: false, error: 'Failed to save settings' }, { status: 500 });
  }
}
