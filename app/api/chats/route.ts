import { NextRequest, NextResponse } from 'next/server';
import { HTTP_STATUS } from '@/lib/constants';
import {
  requireAuth,
  AuthRequiredError,
  unauthorized,
  badRequest,
  payloadTooLarge,
  parseJsonBody,
  JsonParseError,
  rateLimitGuard,
  internalError,
} from '@/lib/api/route-helpers';

// ============================================================================
// GET /api/chats — List authenticated user's chat threads
// ============================================================================

export async function GET() {
  try {
    const { supabase, user } = await requireAuth();

    const { data: threads, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      const isMissingTable =
        error.message?.toLowerCase().includes('does not exist') ||
        (error as any).code === '42P01' ||
        (error as any).code === 'PGRST200';
      if (isMissingTable) return NextResponse.json({ success: true, threads: [] });
      console.error('[v0] [API/chats] List error:', error);
      return internalError('Failed to fetch chat threads');
    }

    return NextResponse.json({ success: true, threads: threads ?? [] });
  } catch (err) {
    if (err instanceof AuthRequiredError) return unauthorized();
    console.error('[v0] [API/chats] GET error:', err);
    return internalError();
  }
}

// ============================================================================
// POST /api/chats — Create a new chat thread
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuth();

    const rl = rateLimitGuard(request, user.id, 'chats-post', { limit: 30, windowMs: 60_000 });
    if (rl) return rl;

    const sizeCheck = request.headers.get('content-length');
    if (Number(sizeCheck ?? 0) > 10_000) return payloadTooLarge();

    const body = await parseJsonBody(request);
    const { title = 'New Chat', category = 'all', tags = [] } = body as Record<string, unknown>;

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
        return NextResponse.json({
          success: true,
          thread: {
            id: `local-${Date.now()}`,
            title,
            category,
            tags,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        });
      }
      console.error('[v0] [API/chats] Create error:', error);
      return internalError('Failed to create chat thread');
    }

    return NextResponse.json({ success: true, thread }, { status: HTTP_STATUS.OK });
  } catch (err) {
    if (err instanceof AuthRequiredError) return unauthorized();
    if (err instanceof JsonParseError) return badRequest(err.message);
    console.error('[v0] [API/chats] POST error:', err);
    return internalError();
  }
}
