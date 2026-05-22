import { NextRequest, NextResponse } from 'next/server';
import { rateLimitGuard, checkContentLength, parseJsonBody, JsonParseError, badRequest } from '@/lib/api/route-helpers';

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
    const sizeError = checkContentLength(request, 10_000);
    if (sizeError) return sizeError;

    let body: Record<string, unknown>;
    try {
      body = await parseJsonBody<Record<string, unknown>>(request);
    } catch (e) {
      if (e instanceof JsonParseError) return badRequest('Invalid JSON body');
      throw e;
    }
    const rawInstructions: string = typeof body?.instructions === 'string'
      ? body.instructions.slice(0, 2000)
      : '';
    // Strip common prompt-injection patterns before storing. The instructions are
    // injected into the AI system prompt, so adversarial content like "IGNORE ALL
    // PREVIOUS INSTRUCTIONS" could override system behavior.
    const instructions = rawInstructions
      .replace(/ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|context)/gi, '')
      .replace(/\bact\s+as\s+(if\s+you\s+(are|were)\s+)?(?:an?\s+)?(different|new|evil|uncensored|jailbroken|DAN)\b/gi, '')
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '') // strip non-printable control chars
      .trim();

    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthenticated' });
    }

    // Rate limit: 10 instruction saves per minute per user
    const rlError = rateLimitGuard(request, user.id, 'instructions-put', { limit: 10, windowMs: 60_000 });
    if (rlError) return rlError;

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
