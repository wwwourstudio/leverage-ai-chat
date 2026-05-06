'use client';

import { useEffect, useRef } from 'react';

/**
 * Run `callback` on a fixed interval, but only while the document is visible.
 *
 * Pauses automatically when the user switches tabs / minimizes the window;
 * resumes immediately on visibility change. When the tab becomes visible
 * again, also fires `callback` once right away so data is fresh by the time
 * the user looks at it.
 *
 * Behavior:
 *   - Mount: schedules the interval and (if visible) fires once immediately
 *     when `fireOnMount` is true (default `false` to avoid double-fetch when
 *     the caller already does an initial fetch).
 *   - Tab hidden: interval ticks are skipped; nothing fires.
 *   - Tab visible again: fires once immediately, then resumes the cadence.
 *   - Unmount: interval cleared, listener removed.
 *
 * Pass `enabled = false` to pause the interval entirely without unmounting.
 */
export function useVisibilityInterval(
  callback: () => void,
  intervalMs: number,
  options?: { enabled?: boolean; fireOnMount?: boolean },
): void {
  const enabled = options?.enabled !== false;
  const fireOnMount = options?.fireOnMount === true;

  // Stable ref so the effect doesn't restart when the caller passes a new
  // callback identity each render — common with closures over state.
  const cbRef = useRef(callback);
  useEffect(() => { cbRef.current = callback; }, [callback]);

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    const tick = () => {
      if (document.visibilityState === 'visible') cbRef.current();
    };

    if (fireOnMount && document.visibilityState === 'visible') {
      cbRef.current();
    }

    const id = setInterval(tick, intervalMs);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') cbRef.current();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, intervalMs, fireOnMount]);
}
