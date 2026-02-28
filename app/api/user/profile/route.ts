import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/user/profile
 * Returns the authenticated user's profile (name, email, avatar, preferences).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

    // Pull from auth metadata + user_preferences table
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('custom_instructions, updated_at')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({
      success: true,
      profile: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        avatar: user.user_metadata?.avatar_url ?? null,
        customInstructions: prefs?.custom_instructions ?? '',
        lastUpdated: prefs?.updated_at ?? null,
      },
    });
  } catch (err) {
    console.error('[API/user/profile GET]', err);
    return NextResponse.json({ success: false, error: 'Failed to load profile' }, { status: 500 });
  }
}

/**
 * PATCH /api/user/profile
 * Body: { name?: string; avatar?: string }
 * Updates mutable profile fields (display name, avatar URL).
 * Custom instructions use /api/user/instructions for consistency.
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const updates: Record<string, string> = {};
    if (typeof body.name === 'string' && body.name.trim()) {
      updates['data.full_name'] = body.name.trim().slice(0, 100);
    }
    if (typeof body.avatar === 'string') {
      updates['data.avatar_url'] = body.avatar.slice(0, 500);
    }

    if (Object.keys(updates).length > 0) {
      const metadata: Record<string, string> = {};
      if (updates['data.full_name']) metadata['full_name'] = updates['data.full_name'];
      if (updates['data.avatar_url']) metadata['avatar_url'] = updates['data.avatar_url'];
      await supabase.auth.updateUser({ data: metadata });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API/user/profile PATCH]', err);
    return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
  }
}
