import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HTTP_STATUS } from '@/lib/constants';

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

    const body = await request.json().catch(() => ({}));
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
