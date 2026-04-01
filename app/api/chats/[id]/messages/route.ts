import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HTTP_STATUS } from '@/lib/constants';

// ============================================================================
// GET /api/chats/[id]/messages — Load messages for a thread
// ============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', id)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('[v0] [API/chats/messages] GET error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch messages' },
        { status: HTTP_STATUS.INTERNAL_ERROR }
      );
    }

    return NextResponse.json({ success: true, messages: messages ?? [] });
  } catch (err) {
    console.error('[v0] [API/chats/messages] GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}

// ============================================================================
// POST /api/chats/[id]/messages — Append a message and refresh thread timestamp
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }

    // Reject oversized payloads before parsing
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > 500_000) { // 500KB — cards JSONB can add ~50KB per message
      return NextResponse.json({ success: false, error: 'Request too large' }, { status: 413 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: HTTP_STATUS.BAD_REQUEST });
    }
    const { role, content, model_used, confidence, is_welcome = false, cards } = body as any;

    if (!role || !content) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: role, content' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // Verify thread ownership before inserting (belt-and-suspenders beyond RLS).
    // If the thread is missing (e.g. stale UUID from a deleted/migrated session),
    // auto-create it so messages are never silently dropped.
    const { data: thread } = await supabase
      .from('chat_threads')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!thread) {
      // Thread is missing — stale UUID from a deleted or migrated session.
      // Auto-recreate it under the same UUID so the client state stays valid.
      // ignoreDuplicates handles the race when two saveMessage calls (user +
      // assistant) arrive simultaneously before the first insert commits.
      const { error: createErr } = await supabase
        .from('chat_threads')
        .upsert(
          { id, user_id: user.id, title: String(content).slice(0, 80) },
          { onConflict: 'id', ignoreDuplicates: true }
        );

      if (createErr) {
        console.error('[v0] [API/chats/messages] Could not recreate thread:', createErr);
        return NextResponse.json(
          { success: false, error: 'Thread not found' },
          { status: HTTP_STATUS.NOT_FOUND }
        );
      }
      console.log(`[v0] [API/chats/messages] Auto-recreated stale thread ${id} for user ${user.id}`);
    }

    const { data: message, error } = await supabase
      .from('chat_messages')
      .insert({
        thread_id: id,
        role,
        content: String(content).slice(0, 50000),
        cards: Array.isArray(cards) ? cards : null,
        model_used: model_used ?? null,
        confidence: confidence ?? null,
        is_welcome,
      })
      .select()
      .single();

    if (error) {
      console.error('[v0] [API/chats/messages] POST error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save message' },
        { status: HTTP_STATUS.INTERNAL_ERROR }
      );
    }

    // Update thread's updated_at so it sorts to top of sidebar
    await supabase
      .from('chat_threads')
      .update({
        updated_at: new Date().toISOString(),
        preview: String(content).slice(0, 120),
      })
      .eq('id', id)
      .eq('user_id', user.id);

    return NextResponse.json({ success: true, message });
  } catch (err) {
    console.error('[v0] [API/chats/messages] POST error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
