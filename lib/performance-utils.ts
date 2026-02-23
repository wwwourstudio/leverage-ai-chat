/**
 * Performance Optimization Utilities
 * 
 * Collection of functions to improve app performance and reduce
 * forced reflows, excessive re-renders, and layout thrashing.
 */

/**
 * RequestAnimationFrame-based throttle
 * Ensures function only runs once per animation frame (60fps)
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  callback: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;

  return (...args: Parameters<T>) => {
    lastArgs = args;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (lastArgs) {
          callback(...lastArgs);
          lastArgs = null;
        }
        rafId = null;
      });
    }
  };
}

/**
 * Batch DOM reads to prevent layout thrashing
 * Groups all reads together before any writes
 */
export function batchDOMReads<T>(reads: Array<() => T>): T[] {
  return reads.map(read => read());
}

/**
 * Batch DOM writes to prevent layout thrashing
 * Groups all writes together after reads are complete
 */
export function batchDOMWrites(writes: Array<() => void>): void {
  requestAnimationFrame(() => {
    writes.forEach(write => write());
  });
}

/**
 * Measure performance of async operations
 */
export async function measureAsync<T>(
  label: string,
  operation: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await operation();
    const duration = performance.now() - start;
    console.log(`[v0] Performance: ${label} took ${duration.toFixed(2)}ms`);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`[v0] Performance: ${label} failed after ${duration.toFixed(2)}ms`, error);
    throw error;
  }
}

/**
 * Lazy load component with retry logic
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  retries = 3,
  interval = 1000
): Promise<{ default: T }> {
  return new Promise((resolve, reject) => {
    importFn()
      .then(resolve)
      .catch((error) => {
        if (retries === 0) {
          reject(error);
          return;
        }

        setTimeout(() => {
          lazyWithRetry(importFn, retries - 1, interval).then(resolve, reject);
        }, interval);
      });
  });
}

/**
 * Debounce function - classic implementation
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Throttle function - prevents excessive calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Intersection Observer helper for lazy loading
 */
export function observeIntersection(
  element: Element,
  callback: (entry: IntersectionObserverEntry) => void,
  options?: IntersectionObserverInit
): () => void {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(callback);
  }, options);

  observer.observe(element);

  return () => observer.disconnect();
}

/**
 * Memoize expensive computations
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  getCacheKey?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>) => {
    const key = getCacheKey ? getCacheKey(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}
