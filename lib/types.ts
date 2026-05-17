/**
 * Type Utilities and Definitions
 * Provides type-safe utilities for error handling and common patterns
 */

// ============================================
// Error Handling Types
// ============================================

/**
 * Type guard to check if error is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'An unknown error occurred';
}

/**
 * HTTP Error with status code
 */
export class HTTPError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'HTTPError';
  }
}

/**
 * Type guard for HTTP errors
 */
export function isHTTPError(error: unknown): error is HTTPError {
  return error instanceof HTTPError;
}

/**
 * Extract status code from error
 */
export function getErrorStatus(error: unknown): number | undefined {
  if (isHTTPError(error)) {
    return error.status;
  }
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

// ============================================
// API Response Types
// ============================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T = unknown> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
  error?: string;
}

// ============================================
// Database Types
// ============================================

/**
 * Generic query result
 */
export interface QueryResult<T = unknown> {
  data: T[] | null;
  error: unknown;
  count?: number;
}

/**
 * Record with timestamps
 */
export interface TimestampedRecord {
  created_at: string;
  updated_at?: string;
}

/**
 * Record with ID
 */
export interface IdentifiableRecord {
  id: string | number;
}

// ============================================
// Utility Types
// ============================================

/**
 * Make specific properties required
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specific properties optional
 */
export type PartialFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Non-nullable fields
 */
export type NonNullableFields<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};

/**
 * Deep partial
 */
export type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

// ============================================
// Function Types
// ============================================

/**
 * Async function type
 */
export type AsyncFunction<T = unknown, Args extends unknown[] = unknown[]> = (
  ...args: Args
) => Promise<T>;

/**
 * Retry options
 */
export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

/**
 * Cache entry
 */
export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  promise?: Promise<T>;
}

// ============================================
// Type Guards
// ============================================

/**
 * Check if value is defined
 */
export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

/**
 * Check if value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Check if value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Check if value is an object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if value is an array
 */
export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

// ============================================
// Result Type (for functional error handling)
// ============================================

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Create a successful result
 */
export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Create an error result
 */
export function Err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Wrap a promise in a Result type
 */
export async function tryAsync<T>(
  fn: () => Promise<T>
): Promise<Result<T, Error>> {
  try {
    const value = await fn();
    return Ok(value);
  } catch (error) {
    return Err(isError(error) ? error : new Error(getErrorMessage(error)));
  }
}

/**
 * Wrap a synchronous function in a Result type
 */
export function trySync<T>(fn: () => T): Result<T, Error> {
  try {
    const value = fn();
    return Ok(value);
  } catch (error) {
    return Err(isError(error) ? error : new Error(getErrorMessage(error)));
  }
}

// ============================================================================
// Card System Types — single source of truth for the entire cards pipeline
// ============================================================================

/** Canonical card shape shared by the generator, data service, and all renderers. */
export interface CardData {
  /** Stable deterministic ID (djb2 hash of type+category+title+index). */
  id?: string;
  /** Card type — must be a value from the CARD_TYPES constant. */
  type: string;
  title: string;
  /** Icon name for display (e.g. "TrendingUp"). */
  icon?: string;
  /** Display category (e.g. "NBA", "DFS", "MLB"). */
  category: string;
  /** Subtype label (e.g. "Point Spread", "Player Prop"). */
  subcategory: string;
  /** Tailwind CSS gradient classes for the card background. */
  gradient: string;
  /** Card-type-specific payload. Always an object — never undefined at runtime (normalised at generator boundary). */
  data: Record<string, any>;
  /**
   * Card status. Optional in authoring/generation; the generator's stamp step
   * normalises to "neutral" so downstream consumers always receive a string.
   */
  status?: string;
  /** true = live API data, false = placeholder / estimated. */
  realData?: boolean;
  /** Source metadata (bookmaker, gameId, fetchedAt timestamp, etc.). */
  metadata?: Record<string, any>;
  /** Statcast summary metrics — used by StatcastCard only. */
  summary_metrics?: Array<{ label: string; value: string }>;
  /** Source / timestamp label shown on Statcast cards. */
  last_updated?: string;
  /** Contextual insight note shown at the bottom of Statcast cards. */
  trend_note?: string;
}
