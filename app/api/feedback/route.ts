import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vote, messageExcerpt, sessionId } = body;

    if (!vote || !['helpful', 'improve'].includes(vote)) {
      return NextResponse.json({ success: false, error: 'Invalid vote' }, { status: 400 });
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
    console.error('[API/feedback] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
