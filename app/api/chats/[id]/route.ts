import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuth,
  AuthRequiredError,
  unauthorized,
  badRequest,
  checkContentLength,
  parseJsonBody,
  JsonParseError,
  internalError,
} from '@/lib/api/route-helpers';

// ============================================================================
// PATCH /api/chats/[id] — Update thread metadata (title, starred, preview)
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, user } = await requireAuth();
    const { id } = await params;

    const sizeError = checkContentLength(request);
    if (sizeError) return sizeError;

    const body = await parseJsonBody<Record<string, unknown>>(request);
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
      .eq('user_id', user.id);

    if (error) {
      console.error('[v0] [API/chats/id] PATCH error:', error);
      return internalError('Failed to update chat thread');
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthRequiredError) return unauthorized();
    if (err instanceof JsonParseError) return badRequest(err.message);
    console.error('[v0] [API/chats/id] PATCH error:', err);
    return internalError();
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
    const { supabase, user } = await requireAuth();
    const { id } = await params;

    const { error } = await supabase
      .from('chat_threads')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[v0] [API/chats/id] DELETE error:', error);
      return internalError('Failed to delete chat thread');
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthRequiredError) return unauthorized();
    console.error('[v0] [API/chats/id] DELETE error:', err);
    return internalError();
  }
}
