import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuth,
  AuthRequiredError,
  unauthorized,
  internalError,
  parseJsonBody,
  JsonParseError,
  badRequest,
} from '@/lib/api/route-helpers';

/**
 * GET /api/user/profile
 * Returns the authenticated user's profile (name, email, avatar, preferences).
 */
export async function GET() {
  try {
    const { supabase, user } = await requireAuth();

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
    if (err instanceof AuthRequiredError) return unauthorized();
    console.error('[API/user/profile GET]', err);
    return internalError('Failed to load profile');
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
    const { supabase, user } = await requireAuth();

    const body = await parseJsonBody<{ name?: string; avatar?: string }>(req);
    const metadata: Record<string, string> = {};
    if (typeof body.name === 'string' && body.name.trim()) {
      metadata['full_name'] = body.name.trim().slice(0, 100);
    }
    if (typeof body.avatar === 'string') {
      metadata['avatar_url'] = body.avatar.slice(0, 500);
    }

    if (Object.keys(metadata).length > 0) {
      await supabase.auth.updateUser({ data: metadata });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthRequiredError) return unauthorized();
    if (err instanceof JsonParseError) return badRequest('Invalid request body');
    console.error('[API/user/profile PATCH]', err);
    return internalError('Failed to update profile');
  }
}
