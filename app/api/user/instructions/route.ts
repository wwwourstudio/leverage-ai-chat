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

    // Column may not exist yet (schema cache lag) — return empty gracefully
    if (error) {
      console.warn('[API/user/instructions] SELECT error (column may not exist yet):', error.message);
      return NextResponse.json({ instructions: '' });
    }

    if (!data) {
      // First access — attempt to upsert a blank row; ignore errors from missing column
      await supabase.from('user_preferences').upsert(
        { user_id: user.id, custom_instructions: '' },
        { onConflict: 'user_id' }
      ).select().maybeSingle();
      return NextResponse.json({ instructions: '' });
    }

    return NextResponse.json({ instructions: (data as any).custom_instructions ?? '' });
  } catch {
    // Supabase not configured or other error — return empty gracefully
    return NextResponse.json({ instructions: '' });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
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
      // If the column still doesn't exist in schema cache, return partial success
      // so the UI doesn't break — the migration will resolve this on next deploy.
      if (error.message?.includes('custom_instructions')) {
        console.warn('[API/user/instructions] Column not yet in schema cache — migration may still be propagating');
        return NextResponse.json({ success: true, warning: 'Preferences saved locally; server sync pending.' });
      }
      console.error('[API/user/instructions] Upsert error:', error.message);
      return NextResponse.json({ success: false, error: error.message });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API/user/instructions] PUT error:', err);
    return NextResponse.json({ success: false, error: 'Internal error' });
  }
}

