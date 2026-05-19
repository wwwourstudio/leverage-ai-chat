/**
 * Redis cache layer with automatic in-memory fallback.
 *
 * When UPSTASH_REDIS_REST_URL / TOKEN are set, reads and writes go to Redis
 * (shared across all serverless instances and deploys).  When Redis is absent
 * or throws, every operation silently falls back to a per-instance Map so
 * the app always works without Redis configured.
 *
 * Usage:
 *   const hit = await cacheGet<MyType>('my:key');
 *   await cacheSet('my:key', value, 120); // 120 s TTL
 */

import { getRedis } from '@/lib/redis';

// ── In-memory fallback ────────────────────────────────────────────────────────
// Bounded at 500 entries; evicts oldest on overflow.
// Provides warmth for rapid successive requests on the same warm instance.

interface MemEntry { s: string; exp: number }
const _mem = new Map<string, MemEntry>();

function _memGet(key: string): string | null {
  const e = _mem.get(key);
  if (!e) return null;
  if (Date.now() > e.exp) { _mem.delete(key); return null; }
  return e.s;
}

function _memSet(key: string, s: string, ttlSeconds: number): void {
  _mem.set(key, { s, exp: Date.now() + ttlSeconds * 1_000 });
  if (_mem.size > 500) {
    const oldest = _mem.keys().next().value;
    if (oldest !== undefined) _mem.delete(oldest);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Read from Redis (then in-memory fallback). Returns null on miss or error.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const r = getRedis();
    if (r) {
      const v = await r.get<string>(key);
      if (v !== null && v !== undefined) {
        // Upstash may auto-deserialize JSON objects; handle both cases
        return (typeof v === 'string' ? JSON.parse(v) : v) as T;
      }
      return null;
    }
  } catch {
    // Redis error — fall through to memory
  }
  const v = _memGet(key);
  return v !== null ? (JSON.parse(v) as T) : null;
}

/**
 * Write to Redis AND in-memory (for same-instance warmth).
 * Never throws — fire-and-forget safe: `void cacheSet(k, v, ttl)`.
 */
export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const s = JSON.stringify(value);
  _memSet(key, s, ttlSeconds); // always populate memory for immediate re-use
  try {
    const r = getRedis();
    if (r) await r.set(key, s, { ex: ttlSeconds });
  } catch {
    // Non-critical — in-memory copy already written above
  }
}

/**
 * Delete a key from Redis and in-memory.
 */
export async function cacheDel(key: string): Promise<void> {
  _mem.delete(key);
  try {
    const r = getRedis();
    if (r) await r.del(key);
  } catch { /* non-critical */ }
}

/**
 * Delete all keys matching a prefix (scan-based; use sparingly in hot paths).
 */
export async function cacheDelPrefix(prefix: string): Promise<void> {
  for (const k of _mem.keys()) {
    if (k.startsWith(prefix)) _mem.delete(k);
  }
  try {
    const r = getRedis();
    if (!r) return;
    let cursor = 0;
    do {
      const [next, keys] = await r.scan(cursor, { match: `${prefix}*`, count: 100 });
      cursor = Number(next);
      if (keys.length) await r.del(...keys);
    } while (cursor !== 0);
  } catch { /* non-critical */ }
}

// ── Time-bucket helpers (for key construction) ────────────────────────────────

/** e.g. bucket(120_000) → changes every 2 minutes */
export function bucket(intervalMs: number): number {
  return Math.floor(Date.now() / intervalMs);
}
