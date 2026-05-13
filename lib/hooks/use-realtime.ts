import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Real-time subscription hook for Supabase tables
 *
 * @param table - Table name to subscribe to
 * @param filter - Optional filter { column: 'sport', value: 'NBA' }
 * @returns { data, loading, error }
 */
export function useRealtime<T>(
  table: string,
  filterOrCallback?: { column: string; value: any } | ((payload: any) => void),
) {
  const filter = typeof filterOrCallback === 'object' ? filterOrCallback : undefined;
  const onEvent = typeof filterOrCallback === 'function' ? filterOrCallback : undefined;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Keep a ref to the latest onEvent so the subscription always calls the
  // current callback without needing to resubscribe on every parent re-render.
  const onEventRef = useRef(onEvent);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    let channel: RealtimeChannel | undefined;
    let isCancelled = false;

    async function setupRealtime() {
      let supabase;
      try {
        supabase = createClient();
      } catch (clientError) {
        console.warn(`[Realtime] Supabase client unavailable for ${table}; realtime disabled.`, clientError);
        if (!isCancelled) {
          setError(clientError as Error);
          setLoading(false);
        }
        return;
      }

      try {
        // Initial fetch
        let query = supabase.from(table).select('*');

        if (filter) {
          query = query.eq(filter.column, filter.value);
        }

        const { data: initialData, error: fetchError } = await query;

        if (fetchError) throw fetchError;
        if (isCancelled) return;

        setData(initialData || []);
        setLoading(false);

        // Subscribe to real-time changes
        channel = supabase
          .channel(`${table}_changes`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'api',
              table: table,
              filter: filter ? `${filter.column}=eq.${filter.value}` : undefined,
            },
            (payload: any) => {
              if (onEventRef.current) {
                onEventRef.current(payload);
              }
              if (payload.eventType === 'INSERT') {
                setData((prev) => [...prev, payload.new as T]);
              } else if (payload.eventType === 'UPDATE') {
                setData((prev) =>
                  prev.map((item: any) =>
                    item.id === (payload.new as any).id ? (payload.new as T) : item,
                  ),
                );
              } else if (payload.eventType === 'DELETE') {
                setData((prev) => prev.filter((item: any) => item.id !== (payload.old as any).id));
              }
            },
          )
          .subscribe();
      } catch (err) {
        console.error(`[Realtime] Error setting up subscription for ${table}:`, err);
        if (!isCancelled) {
          setError(err as Error);
          setLoading(false);
        }
      }
    }

    setupRealtime();

    return () => {
      isCancelled = true;
      if (channel) {
        let supabase;
        try {
          supabase = createClient();
          supabase.removeChannel(channel);
        } catch {
          // noop: if client is unavailable in teardown, there's nothing to cleanup.
        }
      }
    };
  }, [table, filter?.column, filter?.value]);

  return { data, loading, error };
}

// Alias export for backward compatibility
export { useRealtime as useRealtimeSubscription };
