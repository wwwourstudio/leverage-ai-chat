'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessageSource {
  name: string;
  type: 'database' | 'api' | 'model' | 'cache';
  reliability: number;
  url?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  cards?: unknown[];
  confidence?: number;
  modelUsed?: string;
  processingTime?: number;
  sources?: ChatMessageSource[];
  trustMetrics?: unknown;
  isStreaming?: boolean;
  isPartial?: boolean;
  isError?: boolean;
  // Extra optional fields for compatibility with page-client.tsx Message type
  isWelcome?: boolean;
  isEditing?: boolean;
  editHistory?: Array<{ content: string; timestamp: Date }>;
  insights?: Record<string, number | undefined>;
  clarificationOptions?: string[];
  useFallback?: boolean;
}

export interface UseChatOptions {
  /** API endpoint to POST messages to. Defaults to '/api/analyze'. */
  api?: string;
  /** Messages pre-populated on mount. */
  initialMessages?: ChatMessage[];
  /** Extra fields merged into every request body (used only when prepareBody is not set). */
  context?: Record<string, unknown>;
  /**
   * Custom request body builder. Receives (content, extra) where extra is the
   * second argument passed to sendMessage(). When provided, this replaces the
   * default body shape of { userMessage, context }.
   */
  prepareBody?: (content: string, extra?: Record<string, unknown>) => Record<string, unknown>;
  /**
   * Whether the hook auto-appends the user message to state before fetching.
   * Set false when the caller manages user message appending itself.
   * Default: true
   */
  appendUserMessage?: boolean;
  /** Called when a non-abort error occurs. */
  onError?: (error: Error) => void;
  /** Called after the assistant message is fully resolved. */
  onFinish?: (message: ChatMessage) => void;
}

// ─── SSE event shapes emitted by /api/analyze ────────────────────────────────

interface SseTextEvent {
  type: 'text';
  delta?: string;
}

interface SseReplaceEvent {
  type: 'replace';
  text?: string;
}

interface SseDoneEvent {
  type: 'done';
  success: boolean;
  text?: string;
  cards?: unknown[];
  confidence?: number;
  modelUsed?: string;
  processingTime?: number;
  sources?: ChatMessageSource[];
  trustMetrics?: unknown;
  clarificationOptions?: string[];
  useFallback?: boolean;
  [key: string]: unknown;
}

type SseEvent = SseTextEvent | SseReplaceEvent | SseDoneEvent;

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useChat
 *
 * Custom chat hook for the Leverage AI app. Connects to `/api/analyze` (or a
 * custom `api` option) which streams responses via Server-Sent Events using the
 * app's own SSE protocol — NOT the standard Vercel AI SDK streaming format.
 *
 * SSE event types handled:
 *  - `{type:"text",  delta:"..."}` — streaming token, batched via rAF
 *  - `{type:"replace",text:"..."}` — full content replacement
 *  - `{type:"done",  ...}` — stream complete, carries final metadata
 *
 * Generic parameter T allows callers to use a richer Message type that extends
 * ChatMessage (e.g. page-client.tsx's local Message interface).
 */
export function useChat<T extends ChatMessage = ChatMessage>(options: UseChatOptions = {}): {
  messages: T[];
  setMessages: React.Dispatch<React.SetStateAction<T[]>>;
  isLoading: boolean;
  error: Error | null;
  sendMessage: (content: string, extra?: Record<string, unknown>) => Promise<T | null>;
  clearMessages: () => void;
  abort: () => void;
} {
  const {
    api = '/api/analyze',
    initialMessages = [],
    context: baseContext,
    prepareBody,
    appendUserMessage = true,
    onError,
    onFinish,
  } = options;

  const [messages, setMessages] = useState<T[]>(initialMessages as T[]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const sendMessage = useCallback(
    async (content: string, extra?: Record<string, unknown>): Promise<T | null> => {
      if (!content.trim()) return null;

      // Cancel any in-flight request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setError(null);
      setIsLoading(true);

      if (appendUserMessage) {
        const userMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'user',
          content,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMessage as T]);
      }

      let streamingId: string | undefined;
      let hadPartialContent = false;

      try {
        const body = prepareBody
          ? prepareBody(content, extra)
          : { userMessage: content, context: { ...baseContext, ...extra } };

        const res = await fetch(api, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          let errorMsg: string;
          if (res.status === 429) {
            const retryAfter = res.headers.get('Retry-After');
            const secs = retryAfter ? parseInt(retryAfter, 10) : 3600;
            const mins = Math.ceil(secs / 60);
            errorMsg = `Rate limit reached — try again in ${mins} minute${mins !== 1 ? 's' : ''}.`;
          } else if (res.status === 401) {
            errorMsg = 'Sign in to continue chatting.';
          } else if (res.status >= 500) {
            errorMsg = 'Server error — AI is temporarily unavailable. Please retry.';
          } else {
            try {
              const parsed = JSON.parse(text);
              errorMsg = parsed.error || parsed.message || `Request failed (${res.status})`;
            } catch {
              errorMsg = `Request failed (${res.status})`;
            }
          }
          throw new Error(errorMsg);
        }

        if (res.headers.get('Content-Type')?.includes('text/event-stream')) {
          // ── Streaming path ─────────────────────────────────────────────────
          streamingId = crypto.randomUUID();
          if (mountedRef.current) {
            setMessages((prev) => [
              ...prev,
              {
                id: streamingId!,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
                cards: [],
                isStreaming: true,
              } as unknown as T,
            ]);
          }

          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let buf = '';
          let donePayload: SseDoneEvent | null = null;
          let streamContent = '';

          // rAF batching: accumulate tokens between frames to avoid calling
          // setMessages on every single token (~100-300 per response).
          let rafHandle: ReturnType<typeof requestAnimationFrame> | null = null;
          const flushToState = () => {
            const snapshot = streamContent;
            if (mountedRef.current) {
              setMessages((prev) =>
                prev.map((m) => (m.id === streamingId ? ({ ...m, content: snapshot } as T) : m))
              );
            }
            rafHandle = null;
          };

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              const parts = buf.split('\n\n');
              buf = parts.pop() ?? '';

              for (const part of parts) {
                if (!part.startsWith('data: ')) continue;
                let ev: SseEvent;
                try {
                  ev = JSON.parse(part.slice(6)) as SseEvent;
                } catch {
                  continue;
                }

                if (ev.type === 'text') {
                  streamContent += ev.delta ?? '';
                  if (rafHandle === null) {
                    rafHandle = requestAnimationFrame(flushToState);
                  }
                } else if (ev.type === 'replace') {
                  streamContent = ev.text ?? streamContent;
                  if (rafHandle !== null) {
                    cancelAnimationFrame(rafHandle);
                    rafHandle = null;
                  }
                  if (mountedRef.current) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === streamingId ? ({ ...m, content: streamContent } as T) : m
                      )
                    );
                  }
                } else if (ev.type === 'done') {
                  donePayload = ev;
                }
              }
            }
          } catch (streamErr) {
            // Network error mid-stream — cancel pending RAF and keep partial content
            if (rafHandle !== null) {
              cancelAnimationFrame(rafHandle);
              rafHandle = null;
            }
            hadPartialContent = streamContent.length > 0;
            if (mountedRef.current) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamingId
                    ? ({ ...m, isStreaming: false, content: streamContent || m.content } as T)
                    : m
                )
              );
            }
            throw streamErr;
          }

          // Flush any tokens buffered in the last partial frame
          if (rafHandle !== null) {
            cancelAnimationFrame(rafHandle);
            rafHandle = null;
          }
          if (streamContent && mountedRef.current) {
            setMessages((prev) =>
              prev.map((m) => (m.id === streamingId ? ({ ...m, content: streamContent } as T) : m))
            );
          }

          // Finalize assistant message with done-event metadata
          const finalFields: Partial<ChatMessage> = donePayload
            ? {
                content: donePayload.text || streamContent,
                cards: donePayload.cards || [],
                confidence: donePayload.confidence,
                modelUsed: donePayload.modelUsed,
                processingTime: donePayload.processingTime,
                sources: donePayload.sources,
                trustMetrics: donePayload.trustMetrics,
                clarificationOptions: donePayload.clarificationOptions,
                useFallback: donePayload.useFallback,
              }
            : { content: streamContent, cards: [] };

          if (mountedRef.current) {
            setMessages((prev) =>
              prev
                .map((m) =>
                  m.id === streamingId
                    ? ({ ...m, isStreaming: false, ...finalFields } as T)
                    : m
                )
                .slice(-30)
            );
          }

          const finishedMsg: T = {
            id: streamingId,
            role: 'assistant',
            timestamp: new Date(),
            ...finalFields,
            content: finalFields.content ?? streamContent,
          } as T;

          onFinish?.(finishedMsg);
          return finishedMsg;
        } else {
          // ── JSON fallback path ─────────────────────────────────────────────
          const json = await res.json().catch(() => ({
            success: false,
            error: 'Invalid response from server',
          }));

          if (!json.success) {
            throw new Error(json.error || 'Request failed');
          }

          const assistantMsg: T = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: json.text || '',
            timestamp: new Date(),
            cards: json.cards || [],
            confidence: json.confidence,
            modelUsed: json.modelUsed,
            processingTime: json.processingTime,
            sources: json.sources,
            trustMetrics: json.trustMetrics,
            clarificationOptions: json.clarificationOptions,
            useFallback: json.useFallback,
          } as T;

          if (mountedRef.current) {
            setMessages((prev) => [...prev, assistantMsg].slice(-30));
          }
          onFinish?.(assistantMsg);
          return assistantMsg;
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // User cancelled — remove any in-flight streaming message
          if (streamingId && mountedRef.current) {
            setMessages((prev) => prev.filter((m) => m.id !== streamingId).slice(-30));
          }
          return null;
        }

        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[useChat] Error:', error);

        if (mountedRef.current) {
          if (streamingId) {
            if (hadPartialContent) {
              // Preserve partial content rather than discarding it
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamingId
                    ? ({
                        ...m,
                        isStreaming: false,
                        isPartial: true,
                        content: m.content + '\n\n*[Response interrupted — partial result]*',
                      } as T)
                    : m
                )
              );
            } else {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamingId ? ({ ...m, isStreaming: false, isError: true } as T) : m
                )
              );
            }
          }

          if (!hadPartialContent) {
            const errorMsg: T = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: error.message || 'Something went wrong. Please try again.',
              timestamp: new Date(),
              isError: true,
            } as T;
            setMessages((prev) => [...prev, errorMsg].slice(-30));
          }

          setError(error);
        }

        onError?.(error);
        return null;
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [api, baseContext, prepareBody, appendUserMessage, onError, onFinish]
  );

  return { messages, setMessages, isLoading, error, sendMessage, clearMessages, abort };
}
