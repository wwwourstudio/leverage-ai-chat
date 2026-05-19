import { Redis } from '@upstash/redis';

let _client: Redis | null = null;

/**
 * Returns the Upstash Redis client, or null when env vars are absent.
 *
 * Supports both naming conventions:
 *   KV_REST_API_URL / KV_REST_API_TOKEN       — Vercel ↔ Upstash integration (auto-injected)
 *   UPSTASH_REDIS_REST_URL / _REST_TOKEN       — manual Upstash setup
 *
 * All cache operations tolerate null so the app degrades gracefully to the
 * in-memory fallback in lib/cache/redis-cache.ts without Redis configured.
 */
export function getRedis(): Redis | null {
  if (typeof process === 'undefined') return null;
  const url   = process.env.KV_REST_API_URL   ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN  ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!_client) _client = new Redis({ url, token });
  return _client;
}
