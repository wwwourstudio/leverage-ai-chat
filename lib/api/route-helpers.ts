import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HTTP_STATUS } from '@/lib/constants';
import { checkRateLimit, getRateLimitId, type RateLimitOptions } from '@/lib/middleware/rate-limit';

// ── Response helpers ──────────────────────────────────────────────────────────

export const unauthorized = (msg = 'Unauthorized') =>
  NextResponse.json({ success: false, error: msg }, { status: HTTP_STATUS.UNAUTHORIZED });

export const badRequest = (msg: string) =>
  NextResponse.json({ success: false, error: msg }, { status: HTTP_STATUS.BAD_REQUEST });

export const notFound = (msg = 'Not found') =>
  NextResponse.json({ success: false, error: msg }, { status: HTTP_STATUS.NOT_FOUND });

export const payloadTooLarge = () =>
  NextResponse.json({ success: false, error: 'Request too large' }, { status: 413 });

export const tooManyRequests = (retryAfter: number) =>
  NextResponse.json(
    { success: false, error: 'Too many requests' },
    { status: HTTP_STATUS.TOO_MANY_REQUESTS, headers: { 'Retry-After': String(retryAfter) } }
  );

export const serviceUnavailable = (msg = 'Service unavailable') =>
  NextResponse.json({ success: false, error: msg }, { status: HTTP_STATUS.SERVICE_UNAVAILABLE });

export const internalError = (msg = 'Internal server error') =>
  NextResponse.json({ success: false, error: msg }, { status: HTTP_STATUS.INTERNAL_ERROR });

// ── Auth guard ────────────────────────────────────────────────────────────────

export class AuthRequiredError extends Error {
  constructor() { super('Unauthorized'); }
}

/**
 * Resolves the current Supabase session and returns { supabase, user }.
 * Throws AuthRequiredError if no authenticated session exists.
 * Catch it and return unauthorized() in your handler.
 */
export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthRequiredError();
  return { supabase, user };
}

// ── Body parsing ──────────────────────────────────────────────────────────────

export class JsonParseError extends Error {
  constructor() { super('Invalid JSON body'); }
}

/** Checks Content-Length header; returns a 413 response if it exceeds maxBytes, null otherwise. */
export function checkContentLength(req: NextRequest, maxBytes = 10_000): NextResponse | null {
  const len = Number(req.headers.get('content-length') ?? 0);
  return len > maxBytes ? payloadTooLarge() : null;
}

/**
 * Parses the request body as JSON.
 * Throws JsonParseError on malformed input — catch it and return badRequest().
 */
export async function parseJsonBody<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    return await req.json() as T;
  } catch {
    throw new JsonParseError();
  }
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

/**
 * Checks the rate limit for a given key + user.
 * Returns a 429 NextResponse if the limit is exceeded, null if the request is allowed.
 */
export function rateLimitGuard(
  req: NextRequest,
  userId: string,
  key: string,
  options: RateLimitOptions
): NextResponse | null {
  const rl = checkRateLimit(key, getRateLimitId(req, userId), options);
  return rl.allowed ? null : tooManyRequests(rl.retryAfter ?? 60);
}
