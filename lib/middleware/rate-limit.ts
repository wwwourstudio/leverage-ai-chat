/**
 * Shared in-process rate limiter.
 *
 * Uses a per-store Map keyed by an opaque identifier (IP, user ID, etc.).
 * Each store is isolated so different routes can have independent limits.
 *
 * NOTE: In-process only — state resets on cold start and is not shared across
 * multiple Vercel instances. For distributed multi-region rate limiting use
 * Upstash Redis: https://github.com/upstash/ratelimit
 */

interface RateEntry {
  count: number;
  resetAt: number;
}

// Top-level map: storeKey → (identifier → RateEntry)
const _stores = new Map<string, Map<string, RateEntry>>();

export interface RateLimitOptions {
  /** Max requests allowed per window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets (only set when allowed=false) */
  retryAfter?: number;
}

/**
 * Check whether `identifier` has exceeded `limit` requests in `windowMs`.
 *
 * @param storeKey  Unique name for this rate-limit bucket (e.g. 'chats-post')
 * @param identifier  Per-user identifier (IP address or user ID)
 * @param options  Limit and window configuration
 */
export function checkRateLimit(
  storeKey: string,
  identifier: string,
  options: RateLimitOptions,
): RateLimitResult {
  if (!_stores.has(storeKey)) {
    _stores.set(storeKey, new Map());
  }
  const store = _stores.get(storeKey)!;
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || now > entry.resetAt) {
    store.set(identifier, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true };
  }

  if (entry.count >= options.limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true };
}

/**
 * Extract the best available rate-limit identifier from a Next.js request.
 * Prefers authenticated user ID (not spoofable) over IP (spoofable via headers).
 */
export function getRateLimitId(
  request: { headers: { get: (k: string) => string | null } },
  userId?: string,
): string {
  if (userId) return `user:${userId}`;
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';
  return `ip:${ip}`;
}
