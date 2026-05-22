import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuth,
  AuthRequiredError,
  unauthorized,
  badRequest,
  notFound,
  internalError,
  parseJsonBody,
  JsonParseError,
  checkContentLength,
} from '@/lib/api/route-helpers';

// ============================================================================
// GET /api/chats/[id]/messages — Load messages for a thread
// ============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase } = await requireAuth();

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', id)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('[v0] [API/chats/messages] GET error:', error);
      return internalError('Failed to fetch messages');
    }

    return NextResponse.json({ success: true, messages: messages ?? [] });
  } catch (err) {
    if (err instanceof AuthRequiredError) return unauthorized();
    console.error('[v0] [API/chats/messages] GET error:', err);
    return internalError();
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
    const { supabase, user } = await requireAuth();

    // Reject oversized payloads before parsing
    const sizeError = checkContentLength(request, 500_000); // 500KB — cards JSONB can add ~50KB per message
    if (sizeError) return sizeError;

    const body = await parseJsonBody<Record<string, unknown>>(request);

    // Normalize to array: batch mode uses `{ messages: [...] }`, single uses `{ role, content, ... }`
    type MsgInput = { role: string; content: string; model_used?: string; confidence?: number; is_welcome?: boolean; cards?: unknown[] };
    const isBatch = Array.isArray(body.messages);
    const msgs: MsgInput[] = isBatch
      ? (body.messages as MsgInput[])
      : [{ role: body.role as string, content: body.content as string, model_used: body.model_used as string | undefined, confidence: body.confidence as number | undefined, is_welcome: (body.is_welcome as boolean | undefined) ?? false, cards: body.cards as unknown[] | undefined }];

    if (!msgs.length || msgs.some(m => !m.role || m.content == null)) {
      return badRequest('Missing required fields: role, content');
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
      const firstContent = String(msgs[0].content).slice(0, 80);
      const { error: createErr } = await supabase
        .from('chat_threads')
        .upsert(
          { id, user_id: user.id, title: firstContent },
          { onConflict: 'id', ignoreDuplicates: true }
        );

      if (createErr) {
        console.error('[v0] [API/chats/messages] Could not recreate thread:', createErr);
        return notFound('Thread not found');
      }
      console.log(`[v0] [API/chats/messages] Auto-recreated stale thread ${id} for user ${user.id}`);
    }

    const rows = msgs.map(m => ({
      thread_id: id,
      role: m.role,
      content: String(m.content).slice(0, 50000),
      cards: Array.isArray(m.cards) ? m.cards : null,
      model_used: m.model_used ?? null,
      confidence: m.confidence ?? null,
      is_welcome: m.is_welcome ?? false,
    }));

    const { data: inserted, error } = await supabase
      .from('chat_messages')
      .insert(rows)
      .select();

    if (error) {
      console.error('[v0] [API/chats/messages] POST error:', error);
      return internalError('Failed to save message');
    }

    const lastMsg = msgs[msgs.length - 1];
    // Update thread's updated_at so it sorts to top of sidebar
    await supabase
      .from('chat_threads')
      .update({
        updated_at: new Date().toISOString(),
        preview: String(lastMsg.content).slice(0, 120),
      })
      .eq('id', id)
      .eq('user_id', user.id);

    // Return single message for backwards-compat; array for batch callers
    return NextResponse.json(isBatch
      ? { success: true, messages: inserted ?? [] }
      : { success: true, message: (inserted ?? [])[0] });
  } catch (err) {
    if (err instanceof AuthRequiredError) return unauthorized();
    if (err instanceof JsonParseError) return badRequest('Invalid JSON body');
    console.error('[v0] [API/chats/messages] POST error:', err);
    return internalError();
  }
}
