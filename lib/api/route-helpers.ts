import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HTTP_STATUS } from '@/lib/constants';
import { checkRateLimit, getRateLimitId, type RateLimitOptions } from '@/lib/middleware/rate-limit';
import { validateSportKey } from '@/lib/odds/index';

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

// ── Service-role guard ────────────────────────────────────────────────────────

/**
 * Validates the service-role secret from the given request header.
 * Returns a 401 response if the header is missing or wrong, null if valid.
 * Use for internal/cron endpoints that should never be publicly callable.
 */
export function requireServiceRole(
  req: NextRequest,
  headerName = 'x-service-role-key'
): NextResponse | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || req.headers.get(headerName) !== serviceKey) {
    return unauthorized();
  }
  return null;
}

// ── Query param helpers ───────────────────────────────────────────────────────

/**
 * Parses an integer query param with a default, clamped to [min, max].
 * Returns defaultVal if the param is missing or NaN.
 */
export function parseIntParam(
  searchParams: URLSearchParams,
  key: string,
  defaultVal: number,
  min: number,
  max: number
): number {
  const raw = parseInt(searchParams.get(key) ?? String(defaultVal), 10);
  return Math.min(max, Math.max(min, isNaN(raw) ? defaultVal : raw));
}

// ── Sport key validation ──────────────────────────────────────────────────────

export class InvalidSportError extends Error {
  constructor(sport: string) { super(`Unknown sport: ${sport}`); }
}

/**
 * Validates and normalizes a sport query param via lib/odds validateSportKey.
 * Returns undefined when sportParam is null/empty (sport is optional).
 * Throws InvalidSportError for unrecognized sport strings.
 */
export function parseAndValidateSport(sportParam: string | null | undefined): string | undefined {
  if (!sportParam) return undefined;
  const v = validateSportKey(sportParam);
  if (!v.isValid || !v.normalizedKey) throw new InvalidSportError(sportParam);
  return v.normalizedKey;
}
