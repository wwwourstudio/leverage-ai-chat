import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HTTP_STATUS } from '@/lib/constants';

// ============================================================================
// PATCH /api/chats/[id] — Update thread metadata (title, starred, preview)
// ============================================================================

export async function PATCH(
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
    if (contentLength > 10_000) {
      return NextResponse.json({ success: false, error: 'Request too large' }, { status: 413 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: HTTP_STATUS.BAD_REQUEST });
    }
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof body.title === 'string') updates.title = body.title.slice(0, 200);
    if (typeof body.preview === 'string') updates.preview = body.preview.slice(0, 500);
    if (typeof body.starred === 'boolean') updates.starred = body.starred;
    if (typeof body.category === 'string') updates.category = body.category;
    if (Array.isArray(body.tags)) updates.tags = body.tags;

    const { error } = await supabase
      .from('chat_threads')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id); // RLS double-check

    if (error) {
      console.error('[v0] [API/chats/id] PATCH error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update chat thread' },
        { status: HTTP_STATUS.INTERNAL_ERROR }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[v0] [API/chats/id] PATCH error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}

// ============================================================================
// DELETE /api/chats/[id] — Delete a thread (cascades to messages via FK)
// ============================================================================

export async function DELETE(
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

    const { error } = await supabase
      .from('chat_threads')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id); // RLS double-check

    if (error) {
      console.error('[v0] [API/chats/id] DELETE error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete chat thread' },
        { status: HTTP_STATUS.INTERNAL_ERROR }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[v0] [API/chats/id] DELETE error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
