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

    // Fetch in parallel — maybeSingle() returns null (not 406) when row is absent
    const [profileResult, prefsResult, statsResult] = await Promise.allSettled([
      supabase
        .from('user_profiles')
        .select('id, display_name, avatar_url, subscription_tier, credits_remaining, created_at')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('user_preferences')
        .select('tracked_sports, preferred_books, bankroll, risk_tolerance, theme, email_notifications, push_notifications, odds_alerts, line_movement_alerts, custom_instructions, updated_at')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('user_stats')
        .select('total_analyses, wins, losses, roi, favorite_sport, favorite_book')
        .eq('user_id', user.id)
        .maybeSingle(),
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
        .maybeSingle();
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
 * Saves profile and preferences. Handles missing columns (bankroll, arbitrage_alerts, etc.)
 * on stale DB instances by iteratively stripping the offending column and retrying
 * (up to 5 times) on PGRST204 / 42703 errors.
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

    // Base preferences payload — only columns guaranteed to exist in all DB versions
    const basePayload: Record<string, unknown> = {
      user_id:              user.id,
      tracked_sports:       Array.isArray(body.tracked_sports)  ? body.tracked_sports  : ['NBA', 'NFL'],
      preferred_books:      Array.isArray(body.preferred_books) ? body.preferred_books : [],
      risk_tolerance:       ['conservative','medium','aggressive'].includes(body.risk_tolerance as string) ? body.risk_tolerance as string : 'medium',
      theme:                ['dark','light','system'].includes(body.theme as string) ? body.theme as string : 'dark',
      default_sport:        (Array.isArray(body.tracked_sports) && body.tracked_sports[0]) || 'NBA',
      email_notifications:  typeof body.email_notifications  === 'boolean' ? body.email_notifications  : true,
      push_notifications:   typeof body.push_notifications   === 'boolean' ? body.push_notifications   : false,
      odds_alerts:          typeof body.odds_alerts          === 'boolean' ? body.odds_alerts          : true,
      line_movement_alerts: typeof body.line_movement_alerts === 'boolean' ? body.line_movement_alerts : true,
      updated_at:           new Date().toISOString(),
    };

    // Start with the full payload including optional newer columns
    let payload: Record<string, unknown> = {
      ...basePayload,
      bankroll:         typeof body.bankroll === 'number' ? Math.max(0, body.bankroll) : 0,
      arbitrage_alerts: typeof body.arbitrage_alerts === 'boolean' ? body.arbitrage_alerts : true,
    };

    // Retry loop: strip any column the DB says it doesn't know about (PGRST204 / 42703)
    // and retry up to 5 times so we degrade gracefully on stale DB instances.
    const MAX_RETRIES = 5;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const { error: prefsError } = await supabase
        .from('user_preferences')
        .upsert(payload, { onConflict: 'user_id' });

      if (!prefsError) break; // success

      const isMissingColumn =
        prefsError.code === '42703' ||
        (prefsError as any).code === 'PGRST204';

      if (!isMissingColumn) throw prefsError; // unrelated error — surface it

      // Extract the offending column name from the error message
      // PostgREST: "Could not find the 'col' column of 'table' in the schema cache"
      // PostgreSQL: column "col" of relation "table" does not exist
      const match =
        prefsError.message?.match(/Could not find the '(\w+)' column/) ||
        prefsError.message?.match(/column "(\w+)"/) ||
        prefsError.message?.match(/'(\w+)' column/);

      const missingCol = match?.[1];
      if (missingCol && missingCol in payload) {
        console.warn(`[v0] [API/settings] column '${missingCol}' missing in DB — dropping and retrying`);
        const next = { ...payload };
        delete next[missingCol];
        payload = next;
      } else {
        // Can't identify or strip the column; give up
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
