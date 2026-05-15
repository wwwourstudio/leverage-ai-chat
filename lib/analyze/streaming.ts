/**
 * lib/analyze/streaming.ts
 * SSE helpers, xAI middleware, and message-builder for the analyze endpoint.
 */
import { wrapLanguageModel, type ModelMessage } from 'ai';
import { createXai } from '@ai-sdk/xai';
import type { ImageAttachment } from './types';

// ── xAI / Anthropic compatibility middleware ───────────────────────────────────
/**
 * xAI internally routes to Anthropic and adds cache_control to ALL content blocks.
 * When an assistant message has only tool calls (no text), xAI sends content:""
 * which Anthropic rejects with "cache_control cannot be set for empty text blocks".
 * Fix: inject a minimal stub text into any tool-only assistant history message.
 */
export function createXaiMiddleware(rawModel: ReturnType<ReturnType<typeof createXai>>) {
  return wrapLanguageModel({
    model: rawModel,
    middleware: {
      specificationVersion: 'v3' as const,
      transformParams: async ({ params }) => {
        const patched = params.prompt.map((msg) => {
          if (msg.role !== 'assistant') return msg;
          const parts = msg.content as Array<{ type: string; text?: string }>;
          const hasText     = parts.some((p) => p.type === 'text' && p.text && p.text.length > 0);
          const hasToolCall = parts.some((p) => p.type === 'tool-call');
          if (!hasText && hasToolCall) {
            return { ...msg, content: [{ type: 'text', text: '.' }, ...parts] };
          }
          return msg;
        });
        return { ...params, prompt: patched } as typeof params;
      },
    },
  });
}

// ── Conversation message builder ───────────────────────────────────────────────
/**
 * Build streamText/generateText call options with conversation memory.
 *
 * Returns { system, messages } where `system` is a plain string (the correct
 * Vercel AI SDK pattern for xAI/Grok). Prior user/assistant turns are capped
 * at the last 6 turns and ~4000 chars total to stay within the model context window.
 */
export function buildMessagesWithCacheAndMemory(
  cachedSystem: string,
  dynamicSystem: string,
  userPrompt: string,
  imgs: ImageAttachment[] | undefined,
  priorTurns: Array<{ role: string; content: string }> | undefined,
): { system: string; messages: ModelMessage[] } {
  const system = dynamicSystem.trim().length > 0
    ? `${cachedSystem}\n\n${dynamicSystem}`
    : cachedSystem;

  // Memory: last 6 prior turns, each capped at 1500 chars, total ~4000 chars
  const memoryMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  if (Array.isArray(priorTurns) && priorTurns.length > 0) {
    const last6 = priorTurns.slice(-6);
    let totalChars = 0;
    for (const m of last6) {
      const role    = m.role === 'user' || m.role === 'assistant' ? m.role : 'assistant';
      const content = (m.content ?? '').slice(0, 1500);
      if (!content) continue;
      if (totalChars + content.length > 4000) break;
      totalChars += content.length;
      memoryMessages.push({ role, content });
    }
  }

  type TextPart  = { type: 'text'; text: string };
  type ImagePart = { type: 'image'; image: string; mimeType: string };

  let userMessageObj: { role: 'user'; content: string | Array<TextPart | ImagePart> };
  if (imgs?.length) {
    const content: Array<TextPart | ImagePart> = [{ type: 'text', text: userPrompt }];
    for (const img of imgs) {
      content.push({ type: 'image', image: img.base64, mimeType: img.mimeType });
    }
    userMessageObj = { role: 'user', content };
  } else {
    userMessageObj = { role: 'user', content: userPrompt };
  }

  const messages: ModelMessage[] = [
    ...memoryMessages,
    userMessageObj as unknown as ModelMessage,
  ];
  return { system, messages };
}

// ── SSE encoding helpers ───────────────────────────────────────────────────────

export interface SSEHelpers {
  /** Encode a JSON object as an SSE `data:` frame. */
  sseChunk: (data: object) => Uint8Array;
  /**
   * Write a chunk to the ReadableStream controller.
   * Silently drops writes after the stream is closed/cancelled to avoid
   * unhandled rejections in Vercel logs when clients disconnect mid-stream.
   */
  safeEnqueue: (ctrl: ReadableStreamDefaultController, chunk: Uint8Array) => void;
  /** Mark the stream as closed and call controller.close() safely. */
  closeStream: (ctrl: ReadableStreamDefaultController) => void;
}

/** Create SSE helpers bound to a single-stream closed-state flag. */
export function createSSEHelpers(): SSEHelpers {
  let closed = false;
  const encoder = new TextEncoder();
  return {
    sseChunk: (data: object) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
    safeEnqueue: (ctrl: ReadableStreamDefaultController, chunk: Uint8Array) => {
      if (closed) return;
      try { ctrl.enqueue(chunk); } catch { closed = true; }
    },
    closeStream: (ctrl: ReadableStreamDefaultController) => {
      closed = true;
      try { ctrl.close(); } catch { /* ignore */ }
    },
  };
}

// ── Tool call badge summaries ──────────────────────────────────────────────────
/** Map a tool call result to a short human-readable badge shown in the chat UI. */
export function toolResultSummary(toolName: string, result: unknown): string {
  try {
    const r = result as Record<string, unknown>;
    if (toolName === 'query_mlb_projections') return `${(r?.projections as unknown[] | undefined)?.length ?? 0} MLB projections`;
    if (toolName === 'query_adp')             return `${(r?.players as unknown[] | undefined)?.length ?? 0} ADP entries`;
    if (toolName === 'query_statcast')         return r?.count ? `${r.count} Statcast records` : 'Statcast data';
    if (toolName === 'kalshi_get_markets')     return `${(r?.markets as unknown[] | undefined)?.length ?? 0} Kalshi markets`;
    if (toolName === 'kalshi_get_price')       return r?.probability ? `${(Number(r.probability) * 100).toFixed(0)}% probability` : 'Kalshi price';
    if (toolName === 'get_live_odds')          return `${(r?.events as unknown[] | undefined)?.length ?? 0} live odds`;
    if (toolName === 'get_props_latest')       return `${(r?.props as unknown[] | undefined)?.length ?? (r?.total as number | undefined) ?? 0} player props`;
    if (toolName === 'get_odds_movers')        return `${(r?.movers as unknown[] | undefined)?.length ?? 0} line movers`;
    if (toolName === 'predict_hr')             return 'HR model computed';
  } catch { /* ignore */ }
  return 'data fetched';
}
