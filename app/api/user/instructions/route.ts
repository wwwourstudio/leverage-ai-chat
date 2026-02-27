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

    const { data } = await supabase
      .from('user_preferences')
      .select('custom_instructions')
      .eq('user_id', user.id)
      .maybeSingle();

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
      console.error('[API/user/instructions] Upsert error:', error.message);
      return NextResponse.json({ success: false, error: error.message });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API/user/instructions] PUT error:', err);
    return NextResponse.json({ success: false, error: 'Internal error' });
  }
}
