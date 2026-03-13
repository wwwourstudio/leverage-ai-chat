import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/user/instructions
 * Returns the logged-in user's custom AI instructions from user_preferences.
 * Returns { instructions: '' } if unauthenticated or no row exists yet.
 *
 * PUT /api/user/instructions
 * Body: { instructions: string } (max 2000 chars)
 * Upserts custom_instructions for the logged-in user.
 * Returns { success: true } or { success: false } if unauthenticated.
 */

async function getSupabase() {
  // Dynamically import to avoid issues when Supabase is not configured
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/** True if the Supabase error indicates the column hasn't been migrated yet. */
function isMissingColumnError(msg: string): boolean {
  return msg.includes('custom_instructions') && (
    msg.includes('column') || msg.includes('schema cache')
  );
}

export async function GET() {
  try {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ instructions: '' });
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .select('custom_instructions')
      .eq('user_id', user.id)
      .maybeSingle();

    // Column not yet migrated — degrade silently so the UI still loads
    if (error && isMissingColumnError(error.message)) {
      console.warn('[API/user/instructions] custom_instructions column not yet migrated — returning empty');
      return NextResponse.json({ instructions: '' });
    }

    if (!data) {
      // First access — upsert a blank row so future PUTs can update
      await supabase.from('user_preferences').upsert(
        { user_id: user.id, custom_instructions: '' },
        { onConflict: 'user_id' }
      );
      return NextResponse.json({ instructions: '' });
    }

    return NextResponse.json({ instructions: data.custom_instructions ?? '' });
  } catch {
    // Supabase not configured or other error — return empty gracefully
    return NextResponse.json({ instructions: '' });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Reject oversized payloads before parsing
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > 10_000) {
      return NextResponse.json({ success: false, error: 'Request too large' }, { status: 413 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }
    const instructions: string = typeof body?.instructions === 'string'
      ? body.instructions.slice(0, 2000)
      : '';

    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthenticated' });
    }

    const { error } = await supabase.from('user_preferences').upsert(
      { user_id: user.id, custom_instructions: instructions, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

    if (error) {
      // Column not yet migrated — return success so the UI doesn't show an error,
      // but log a warning so the operator knows to run the migration.
      if (isMissingColumnError(error.message)) {
        console.warn('[API/user/instructions] custom_instructions column not yet migrated — instructions not saved. Run: ALTER TABLE api.user_preferences ADD COLUMN IF NOT EXISTS custom_instructions TEXT NOT NULL DEFAULT \'\';');
        return NextResponse.json({ success: true, migrationPending: true });
      }
      console.error('[API/user/instructions] Upsert error:', error.message);
      return NextResponse.json({ success: false, error: 'Failed to save instructions' });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API/user/instructions] PUT error:', err);
    return NextResponse.json({ success: false, error: 'Internal error' });
  }
}
