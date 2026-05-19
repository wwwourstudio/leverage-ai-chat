import { Redis } from '@upstash/redis';

let _client: Redis | null = null;

/**
 * Returns the Upstash Redis client, or null when the env vars are absent.
 *
 * Required env vars:
 *   UPSTASH_REDIS_REST_URL   — from Upstash console → REST API
 *   UPSTASH_REDIS_REST_TOKEN — from Upstash console → REST API
 *
 * All cache operations tolerate null so the app degrades gracefully to the
 * in-memory fallback in lib/cache/redis-cache.ts without Redis configured.
 */
export function getRedis(): Redis | null {
  if (typeof process === 'undefined') return null;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!_client) _client = new Redis({ url, token });
  return _client;
}
