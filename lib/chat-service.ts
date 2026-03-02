/**
 * Chat persistence service — thin wrapper around Supabase API routes.
 *
 * All functions are fire-and-forget safe: they return gracefully on failure
 * so the UI never blocks on a persistence error. Errors are logged with the
 * [v0] [Chat] prefix.
 */

// Mirrors the Chat interface from page-client.tsx (without importing it, to
// avoid circular deps — this file is imported by the client component).
export interface ChatThread {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
  starred: boolean;
  category: string;
  tags: string[];
}

// Minimal message shape for persistence (cards/attachments are not persisted)
export interface PersistedMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  modelUsed?: string;
  confidence?: number;
  isWelcome?: boolean;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiCall(path: string, options?: RequestInit): Promise<any> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? 'API error');
  return json;
}

// ── Thread operations ─────────────────────────────────────────────────────────

/**
 * Load all chat threads for the authenticated user.
 * Returns [] on failure (graceful degradation).
 */
export async function loadThreads(): Promise<ChatThread[]> {
  try {
    const json = await apiCall('/api/chats');
    return (json.threads ?? []).map((t: any) => ({
      id: t.id,
      title: t.title,
      preview: t.preview ?? '',
      timestamp: new Date(t.updated_at ?? t.created_at),
      starred: t.starred ?? false,
      category: t.category ?? 'all',
      tags: t.tags ?? [],
    }));
  } catch (err) {
    console.warn('[v0] [Chat] loadThreads failed:', err);
    return [];
  }
}

/**
 * Create a new thread in Supabase and return it.
 * Returns null on failure.
 */
export async function createThread(category: string, title: string): Promise<ChatThread | null> {
  try {
    const json = await apiCall('/api/chats', {
      method: 'POST',
      body: JSON.stringify({ category, title }),
    });
    const t = json.thread;
    return {
      id: t.id,
      title: t.title,
      preview: t.preview ?? '',
      timestamp: new Date(t.created_at),
      starred: false,
      category: t.category ?? category,
      tags: t.tags ?? [],
    };
  } catch (err) {
    console.warn('[v0] [Chat] createThread failed:', err);
    return null;
  }
}

/**
 * Update thread metadata (title, preview, starred, category).
 * Fire-and-forget — does not block the UI.
 */
export async function updateThread(
  id: string,
  updates: Partial<Pick<ChatThread, 'title' | 'preview' | 'starred' | 'category' | 'tags'>>
): Promise<void> {
  try {
    await apiCall(`/api/chats/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  } catch (err) {
    console.warn('[v0] [Chat] updateThread failed:', err);
  }
}

/**
 * Delete a thread (cascade deletes messages via FK).
 * Fire-and-forget.
 */
export async function deleteThread(id: string): Promise<void> {
  try {
    await apiCall(`/api/chats/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('[v0] [Chat] deleteThread failed:', err);
  }
}

// ── Message operations ────────────────────────────────────────────────────────

/**
 * Load messages for a thread.
 * Returns [] on failure.
 */
export async function loadMessages(threadId: string): Promise<PersistedMessage[]> {
  try {
    const json = await apiCall(`/api/chats/${threadId}/messages`);
    return (json.messages ?? []).map((m: any) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: new Date(m.created_at),
      modelUsed: m.model_used ?? undefined,
      confidence: m.confidence ?? undefined,
      isWelcome: m.is_welcome ?? false,
    }));
  } catch (err) {
    console.warn('[v0] [Chat] loadMessages failed:', err);
    return [];
  }
}

/**
 * Append a single message to a thread.
 * Fire-and-forget — never blocks the UI.
 */
export async function saveMessage(
  threadId: string,
  msg: { role: 'user' | 'assistant'; content: string; model_used?: string; confidence?: number; is_welcome?: boolean }
): Promise<void> {
  try {
    await apiCall(`/api/chats/${threadId}/messages`, {
      method: 'POST',
      body: JSON.stringify(msg),
    });
  } catch (err) {
    console.warn('[v0] [Chat] saveMessage failed:', err);
  }
}
