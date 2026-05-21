import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseJsonBody, JsonParseError, badRequest, internalError } from '@/lib/api/route-helpers';

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody<{ vote: string; messageExcerpt?: string; sessionId?: string }>(request);
    const { vote, messageExcerpt, sessionId } = body;

    if (!vote || !['helpful', 'improve'].includes(vote)) {
      return badRequest('Invalid vote');
    }

    // Try to persist to Supabase — degrade gracefully if not configured
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      await supabase
        .schema('api' as any)
        .from('ai_feedback')
        .insert({
          user_id: user?.id ?? null,
          session_id: sessionId ?? null,
          vote,
          message_excerpt: messageExcerpt?.slice(0, 500) ?? null,
        });
    } catch {
      // Non-blocking — feedback is best-effort
      console.log('[API/feedback] Supabase insert skipped (not configured or table missing)');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof JsonParseError) return badRequest('Invalid request body');
    console.error('[API/feedback] Error:', error);
    return internalError('Internal error');
  }
}
