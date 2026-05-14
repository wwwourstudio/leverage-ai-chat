/**
 * Generic in-memory TTL cache.
 *
 * Replaces the repeated `new Map<string, { data: T; timestamp: number }>()` pattern
 * that was scattered across ~9 files. All callers that need a simple key→value cache
 * with expiry should use this instead of rolling their own.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;

  constructor(maxSize = 200) {
    this.maxSize = maxSize;
  }

  /** Return the cached value if it exists and hasn't expired; otherwise undefined. */
  get(key: string, ttlMs: number): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > ttlMs) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data;
  }

  /** Store a value. Evicts the oldest entry if maxSize is exceeded. */
  set(key: string, value: T): void {
    this.store.set(key, { data: value, timestamp: Date.now() });
    if (this.store.size > this.maxSize) {
      // Remove the single oldest entry
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  /** Clear entries whose keys start with `prefix`, or all entries when omitted. */
  clear(prefix?: string): void {
    if (!prefix) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  get size(): number {
    return this.store.size;
  }

  keys(): string[] {
    return [...this.store.keys()];
  }
}
