import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HTTP_STATUS } from '@/lib/constants';

/**
 * POST /api/chats/[id]/share
 * Enable public sharing for a chat thread. Returns the share token.
 *
 * DELETE /api/chats/[id]/share
 * Disable public sharing (revoke the share link).
 *
 * DB prerequisite (run in Supabase SQL editor):
 *   ALTER TABLE api.chat_threads
 *     ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
 *     ADD COLUMN IF NOT EXISTS share_token uuid NOT NULL DEFAULT gen_random_uuid();
 *   CREATE INDEX IF NOT EXISTS idx_chat_threads_share_token
 *     ON api.chat_threads(share_token);
 */

// ── POST — enable sharing ────────────────────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: HTTP_STATUS.UNAUTHORIZED },
      );
    }

    // Mark as public and return the share token
    const { data: thread, error } = await supabase
      .from('chat_threads')
      .update({ is_public: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('share_token')
      .single();

    if (error) {
      // Handle missing column gracefully (schema not yet migrated)
      const isMissingColumn =
        error.message?.includes('is_public') ||
        error.message?.includes('share_token') ||
        (error as any).code === '42703';
      if (isMissingColumn) {
        return NextResponse.json(
          { success: false, error: 'Sharing feature requires a database migration. Run the share migration SQL first.' },
          { status: 501 },
        );
      }
      console.error('[v0] [API/chats/share] POST error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to enable sharing' },
        { status: HTTP_STATUS.INTERNAL_ERROR },
      );
    }

    if (!thread) {
      return NextResponse.json(
        { success: false, error: 'Thread not found' },
        { status: HTTP_STATUS.NOT_FOUND },
      );
    }

    return NextResponse.json({ success: true, shareToken: thread.share_token });
  } catch (err) {
    console.error('[v0] [API/chats/share] POST error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: HTTP_STATUS.INTERNAL_ERROR },
    );
  }
}

// ── DELETE — revoke sharing ──────────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: HTTP_STATUS.UNAUTHORIZED },
      );
    }

    const { error } = await supabase
      .from('chat_threads')
      .update({ is_public: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[v0] [API/chats/share] DELETE error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to revoke sharing' },
        { status: HTTP_STATUS.INTERNAL_ERROR },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[v0] [API/chats/share] DELETE error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: HTTP_STATUS.INTERNAL_ERROR },
    );
  }
}

// ── GET — load shared chat (no auth required) ────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // id here is actually the share_token (UUID) passed via the share URL
    const { data: thread, error } = await supabase
      .from('chat_threads')
      .select('id, title, category, created_at')
      .eq('share_token', id)
      .eq('is_public', true)
      .single();

    if (error || !thread) {
      return NextResponse.json(
        { success: false, error: 'Shared chat not found or access revoked' },
        { status: HTTP_STATUS.NOT_FOUND },
      );
    }

    const { data: messages, error: msgError } = await supabase
      .from('chat_messages')
      .select('id, role, content, created_at, model_used')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true })
      .limit(100);

    if (msgError) {
      console.error('[v0] [API/chats/share] GET messages error:', msgError);
      return NextResponse.json(
        { success: false, error: 'Failed to load messages' },
        { status: HTTP_STATUS.INTERNAL_ERROR },
      );
    }

    return NextResponse.json({ success: true, thread, messages: messages ?? [] });
  } catch (err) {
    console.error('[v0] [API/chats/share] GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: HTTP_STATUS.INTERNAL_ERROR },
    );
  }
}
