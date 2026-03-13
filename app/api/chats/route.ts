import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HTTP_STATUS } from '@/lib/constants';
import { checkRateLimit, getRateLimitId } from '@/lib/middleware/rate-limit';

// ============================================================================
// GET /api/chats — List authenticated user's chat threads
// ============================================================================

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }

    const { data: threads, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      // If the table doesn't exist yet (schema not migrated), return empty list gracefully
      const isMissingTable =
        error.message?.toLowerCase().includes('does not exist') ||
        (error as any).code === '42P01' ||
        (error as any).code === 'PGRST200';
      if (isMissingTable) {
        return NextResponse.json({ success: true, threads: [] });
      }
      console.error('[v0] [API/chats] List error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch chat threads' },
        { status: HTTP_STATUS.INTERNAL_ERROR }
      );
    }

    return NextResponse.json({ success: true, threads: threads ?? [] });
  } catch (err) {
    console.error('[v0] [API/chats] GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}

// ============================================================================
// POST /api/chats — Create a new chat thread
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }

    // Rate limit: 30 new chats per minute per user
    const rl = checkRateLimit('chats-post', getRateLimitId(request, user.id), { limit: 30, windowMs: 60_000 });
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
      );
    }

    // Reject oversized payloads before parsing
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > 10_000) {
      return NextResponse.json({ success: false, error: 'Request too large' }, { status: 413 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: HTTP_STATUS.BAD_REQUEST });
    }
    const { title = 'New Chat', category = 'all', tags = [] } = body;

    const { data: thread, error } = await supabase
      .from('chat_threads')
      .insert({
        user_id: user.id,
        title: String(title).slice(0, 200),
        category: String(category),
        tags,
      })
      .select()
      .single();

    if (error) {
      const isMissingTable =
        error.message?.toLowerCase().includes('does not exist') ||
        (error as any).code === '42P01' ||
        (error as any).code === 'PGRST200';
      if (isMissingTable) {
        // Table not yet migrated — return a stub thread so the client can still function
        return NextResponse.json({
          success: true,
          thread: { id: `local-${Date.now()}`, title, category, tags, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        });
      }
      console.error('[v0] [API/chats] Create error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create chat thread' },
        { status: HTTP_STATUS.INTERNAL_ERROR }
      );
    }

    return NextResponse.json({ success: true, thread });
  } catch (err) {
    console.error('[v0] [API/chats] POST error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
