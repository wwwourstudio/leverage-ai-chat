/**
 * Unit Tests for lib/error-handlers.ts
 * Covers: error classes, buildErrorResponse, validateRequest/assertValid,
 *         withRetry, CircuitBreaker
 *
 * NextResponse is mocked so tests run outside the Next.js runtime.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data: unknown, init?: { status?: number }) => ({
      _data: data,
      _status: init?.status ?? 200,
    })),
  },
}));

import {
  APIError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  buildErrorResponse,
  validateRequest,
  assertValid,
  withRetry,
  CircuitBreaker,
} from '@/lib/error-handlers';
import { HTTPError } from '@/lib/types';

// ============================================================================
// Error Classes
// ============================================================================

describe('APIError', () => {
  it('stores message, statusCode, code, and details', () => {
    const err = new APIError('something broke', 422, 'CUSTOM_CODE', { field: 'x' });
    expect(err.message).toBe('something broke');
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('CUSTOM_CODE');
    expect(err.details).toEqual({ field: 'x' });
    expect(err.name).toBe('APIError');
  });

  it('defaults statusCode to 500', () => {
    expect(new APIError('err').statusCode).toBe(500);
  });

  it('is an instance of Error', () => {
    expect(new APIError('err') instanceof Error).toBe(true);
  });
});

describe('ValidationError', () => {
  it('has statusCode 400 and code VALIDATION_ERROR', () => {
    const err = new ValidationError('bad input', { name: 'required' });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.fields).toEqual({ name: 'required' });
    expect(err.name).toBe('ValidationError');
  });
});

describe('AuthenticationError', () => {
  it('has statusCode 401 and default message', () => {
    const err = new AuthenticationError();
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Authentication required');
    expect(err.code).toBe('AUTHENTICATION_ERROR');
    expect(err.name).toBe('AuthenticationError');
  });

  it('accepts a custom message', () => {
    expect(new AuthenticationError('Login required').message).toBe('Login required');
  });
});

describe('NotFoundError', () => {
  it('formats message as "<resource> not found"', () => {
    const err = new NotFoundError('User');
    expect(err.message).toBe('User not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.name).toBe('NotFoundError');
  });
});

describe('RateLimitError', () => {
  it('has statusCode 429 and default message', () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMIT');
    expect(err.name).toBe('RateLimitError');
  });

  it('accepts a custom message', () => {
    expect(new RateLimitError('Too many requests').message).toBe('Too many requests');
  });
});

describe('ServiceUnavailableError', () => {
  it('formats message as "<service> is currently unavailable"', () => {
    const err = new ServiceUnavailableError('Database');
    expect(err.message).toBe('Database is currently unavailable');
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe('SERVICE_UNAVAILABLE');
    expect(err.name).toBe('ServiceUnavailableError');
  });
});

// ============================================================================
// buildErrorResponse
// ============================================================================

describe('buildErrorResponse', () => {
  it('maps an APIError to its fields', () => {
    const err = new APIError('API broke', 422, 'MY_CODE', { reason: 'test' });
    const res = buildErrorResponse(err);
    expect(res.success).toBe(false);
    expect(res.error).toBe('API broke');
    expect(res.code).toBe('MY_CODE');
    expect(res.details).toEqual({ reason: 'test' });
    expect(res.timestamp).toBeTruthy();
  });

  it('maps an HTTPError', () => {
    const err = new HTTPError('Gateway timeout', 504, 'upstream');
    const res = buildErrorResponse(err);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Gateway timeout');
    expect(res.details).toBe('upstream');
  });

  it('maps a standard Error', () => {
    const res = buildErrorResponse(new Error('plain error'));
    expect(res.success).toBe(false);
    expect(res.error).toBe('plain error');
    expect(res.code).toBeUndefined();
  });

  it('falls back to a generic message for unknown types', () => {
    const res = buildErrorResponse({ weird: true });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/internal server error/i);
    expect(res.details).toBeTruthy();
  });

  it('includes the requestId when provided', () => {
    const res = buildErrorResponse(new Error('x'), 'req-123');
    expect(res.requestId).toBe('req-123');
  });

  it('timestamp is a valid ISO string', () => {
    const res = buildErrorResponse(new Error('ts'));
    expect(() => new Date(res.timestamp)).not.toThrow();
    expect(new Date(res.timestamp).getTime()).toBeGreaterThan(0);
  });
});

// ============================================================================
// validateRequest
// ============================================================================

describe('validateRequest', () => {
  it('returns valid=true when all rules pass', () => {
    const result = validateRequest(
      { name: 'Alice', age: 30 },
      { name: { required: true, type: 'string' }, age: { type: 'number' } }
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('fails when a required field is missing', () => {
    const result = validateRequest({}, { name: { required: true } });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toMatch(/required/i);
  });

  it('fails on type mismatch', () => {
    const result = validateRequest(
      { age: 'not-a-number' },
      { age: { type: 'number' } }
    );
    expect(result.valid).toBe(false);
    expect(result.errors.age).toMatch(/number/i);
  });

  it('correctly identifies arrays vs objects for type checking', () => {
    const arrResult = validateRequest({ items: [1, 2] }, { items: { type: 'array' } });
    expect(arrResult.valid).toBe(true);

    const objResult = validateRequest({ data: {} }, { data: { type: 'object' } });
    expect(objResult.valid).toBe(true);
  });

  it('applies min/max to numbers', () => {
    const schema = { score: { type: 'number' as const, min: 0, max: 100 } };

    expect(validateRequest({ score: 50 }, schema).valid).toBe(true);
    expect(validateRequest({ score: -1 }, schema).valid).toBe(false);
    expect(validateRequest({ score: 101 }, schema).valid).toBe(false);
  });

  it('applies min/max to string length', () => {
    const schema = { username: { type: 'string' as const, min: 3, max: 10 } };

    expect(validateRequest({ username: 'alice' }, schema).valid).toBe(true);
    expect(validateRequest({ username: 'ab' }, schema).valid).toBe(false);
    expect(validateRequest({ username: 'a'.repeat(11) }, schema).valid).toBe(false);
  });

  it('validates regex patterns on strings', () => {
    const schema = { email: { pattern: /^\S+@\S+\.\S+$/ } };

    expect(validateRequest({ email: 'user@example.com' }, schema).valid).toBe(true);
    expect(validateRequest({ email: 'not-an-email' }, schema).valid).toBe(false);
  });

  it('validates enum membership', () => {
    const schema = { status: { enum: ['active', 'inactive'] } };

    expect(validateRequest({ status: 'active' }, schema).valid).toBe(true);
    expect(validateRequest({ status: 'pending' }, schema).valid).toBe(false);
  });

  it('applies custom validator returning false', () => {
    const schema = {
      value: { custom: (v: unknown) => (v as number) % 2 === 0 },
    };
    expect(validateRequest({ value: 4 }, schema).valid).toBe(true);
    expect(validateRequest({ value: 3 }, schema).valid).toBe(false);
  });

  it('applies custom validator returning a string message', () => {
    const schema = {
      value: { custom: (v: unknown) => (v as number) > 0 ? true : 'must be positive' },
    };
    const result = validateRequest({ value: -1 }, schema);
    expect(result.valid).toBe(false);
    expect(result.errors.value).toBe('must be positive');
  });

  it('skips optional fields that are absent', () => {
    const result = validateRequest({}, { optField: { type: 'string' } });
    expect(result.valid).toBe(true);
  });

  it('accumulates multiple field errors', () => {
    const result = validateRequest(
      {},
      { a: { required: true }, b: { required: true } }
    );
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors)).toHaveLength(2);
  });
});

// ============================================================================
// assertValid
// ============================================================================

describe('assertValid', () => {
  it('does not throw when validation passes', () => {
    expect(() =>
      assertValid({ name: 'Bob' }, { name: { required: true } })
    ).not.toThrow();
  });

  it('throws ValidationError when validation fails', () => {
    expect(() =>
      assertValid({}, { name: { required: true } })
    ).toThrow(ValidationError);
  });

  it('thrown error carries the field errors', () => {
    try {
      assertValid({}, { name: { required: true } });
    } catch (err) {
      expect(err instanceof ValidationError).toBe(true);
      expect((err as ValidationError).fields).toHaveProperty('name');
    }
  });
});

// ============================================================================
// withRetry
// ============================================================================

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns the result immediately when the function succeeds on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const promise = withRetry(fn, { maxRetries: 3, initialDelay: 100 });
    await vi.runAllTimersAsync();
    expect(await promise).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries and succeeds on a later attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('ok');

    const promise = withRetry(fn, { maxRetries: 3, initialDelay: 10 });
    await vi.runAllTimersAsync();
    expect(await promise).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws the last error after exhausting retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));
    const promise = withRetry(fn, { maxRetries: 2, initialDelay: 10 });

    // Attach the rejection handler before advancing timers to prevent
    // the unhandled-rejection warning from firing between runAllTimersAsync
    // and the assertion.
    const assertion = expect(promise).rejects.toThrow('always fails');
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('calls the onRetry callback on each retry', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const promise = withRetry(fn, { maxRetries: 2, initialDelay: 10, onRetry });
    await vi.runAllTimersAsync();
    await promise;
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });
});

// ============================================================================
// CircuitBreaker
// ============================================================================

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('starts CLOSED and allows requests through', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 1000 });
    const fn = vi.fn().mockResolvedValue('result');
    expect(await cb.execute(fn)).toBe('result');
    expect(cb.getState()).toBe('CLOSED');
  });

  it('opens after reaching the failure threshold', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeout: 1000 });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(cb.execute(fn)).rejects.toThrow('fail');
    await expect(cb.execute(fn)).rejects.toThrow('fail');

    expect(cb.getState()).toBe('OPEN');
  });

  it('throws immediately when OPEN without waiting', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 5000 });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(cb.execute(fn)).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');

    // Should throw without calling fn again
    await expect(cb.execute(fn)).rejects.toThrow('Circuit breaker is open');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('transitions to HALF_OPEN after resetTimeout', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 500 });
    const alwaysFails = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(cb.execute(alwaysFails)).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');

    vi.advanceTimersByTime(600);

    // Next call should be attempted (HALF_OPEN state)
    const fn = vi.fn().mockResolvedValue('recovered');
    expect(await cb.execute(fn)).toBe('recovered');
    expect(cb.getState()).toBe('CLOSED');
  });

  it('resets to CLOSED and clears failure count', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 1000 });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(cb.execute(fn)).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');

    cb.reset();
    expect(cb.getState()).toBe('CLOSED');
  });

  it('calls onStateChange callback when state changes', async () => {
    const onStateChange = vi.fn();
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeout: 1000,
      onStateChange,
    });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(cb.execute(fn)).rejects.toThrow();
    expect(onStateChange).toHaveBeenCalledWith('OPEN');
  });

  it('recovers to CLOSED after a successful HALF_OPEN call', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 100 });
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    await expect(cb.execute(fn)).rejects.toThrow();
    vi.advanceTimersByTime(200);

    await cb.execute(fn);
    expect(cb.getState()).toBe('CLOSED');
  });
});
