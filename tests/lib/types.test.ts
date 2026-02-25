/**
 * Unit Tests for lib/types.ts
 * Covers: error utilities, type guards, Result<T,E> pattern, tryAsync/trySync
 */

import { describe, it, expect } from 'vitest';
import {
  isError,
  getErrorMessage,
  HTTPError,
  isHTTPError,
  getErrorStatus,
  isDefined,
  isString,
  isNumber,
  isObject,
  isArray,
  Ok,
  Err,
  tryAsync,
  trySync,
} from '@/lib/types';

// ============================================================================
// isError
// ============================================================================

describe('isError', () => {
  it('returns true for Error instances', () => {
    expect(isError(new Error('oops'))).toBe(true);
  });

  it('returns true for Error subclasses', () => {
    class CustomError extends Error {}
    expect(isError(new CustomError('sub'))).toBe(true);
  });

  it('returns false for plain strings', () => {
    expect(isError('error string')).toBe(false);
  });

  it('returns false for plain objects', () => {
    expect(isError({ message: 'not an error' })).toBe(false);
  });

  it('returns false for null and undefined', () => {
    expect(isError(null)).toBe(false);
    expect(isError(undefined)).toBe(false);
  });

  it('returns false for numbers', () => {
    expect(isError(42)).toBe(false);
  });
});

// ============================================================================
// getErrorMessage
// ============================================================================

describe('getErrorMessage', () => {
  it('returns the message from an Error instance', () => {
    expect(getErrorMessage(new Error('bang'))).toBe('bang');
  });

  it('returns a string directly', () => {
    expect(getErrorMessage('plain error')).toBe('plain error');
  });

  it('returns the message property from an object', () => {
    expect(getErrorMessage({ message: 'obj error' })).toBe('obj error');
  });

  it('coerces a non-string message property to string', () => {
    expect(getErrorMessage({ message: 404 })).toBe('404');
  });

  it('returns fallback for null', () => {
    expect(getErrorMessage(null)).toBe('An unknown error occurred');
  });

  it('returns fallback for undefined', () => {
    expect(getErrorMessage(undefined)).toBe('An unknown error occurred');
  });

  it('returns fallback for numbers', () => {
    expect(getErrorMessage(500)).toBe('An unknown error occurred');
  });
});

// ============================================================================
// HTTPError
// ============================================================================

describe('HTTPError', () => {
  it('stores message, status, and details', () => {
    const err = new HTTPError('Not found', 404, { resource: 'user' });
    expect(err.message).toBe('Not found');
    expect(err.status).toBe(404);
    expect(err.details).toEqual({ resource: 'user' });
  });

  it('sets name to HTTPError', () => {
    expect(new HTTPError('x', 500).name).toBe('HTTPError');
  });

  it('is an instance of Error', () => {
    expect(new HTTPError('x', 500) instanceof Error).toBe(true);
  });

  it('works without details', () => {
    const err = new HTTPError('Server error', 500);
    expect(err.details).toBeUndefined();
  });
});

// ============================================================================
// isHTTPError
// ============================================================================

describe('isHTTPError', () => {
  it('returns true for HTTPError instances', () => {
    expect(isHTTPError(new HTTPError('x', 400))).toBe(true);
  });

  it('returns false for standard Error', () => {
    expect(isHTTPError(new Error('nope'))).toBe(false);
  });

  it('returns false for plain objects', () => {
    expect(isHTTPError({ status: 404 })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isHTTPError(null)).toBe(false);
  });
});

// ============================================================================
// getErrorStatus
// ============================================================================

describe('getErrorStatus', () => {
  it('extracts status from an HTTPError', () => {
    expect(getErrorStatus(new HTTPError('bad', 403))).toBe(403);
  });

  it('extracts a numeric status from a plain object', () => {
    expect(getErrorStatus({ status: 404 })).toBe(404);
  });

  it('returns undefined when the plain object status is not a number', () => {
    expect(getErrorStatus({ status: 'not-a-number' })).toBeUndefined();
  });

  it('returns undefined for a standard Error', () => {
    expect(getErrorStatus(new Error('no status'))).toBeUndefined();
  });

  it('returns undefined for null', () => {
    expect(getErrorStatus(null)).toBeUndefined();
  });

  it('returns undefined for a bare string', () => {
    expect(getErrorStatus('error')).toBeUndefined();
  });
});

// ============================================================================
// isDefined
// ============================================================================

describe('isDefined', () => {
  it('returns true for truthy values', () => {
    expect(isDefined('hello')).toBe(true);
    expect(isDefined(1)).toBe(true);
    expect(isDefined({})).toBe(true);
  });

  it('returns true for falsy-but-defined values', () => {
    expect(isDefined(0)).toBe(true);
    expect(isDefined(false)).toBe(true);
    expect(isDefined('')).toBe(true);
  });

  it('returns false for null', () => {
    expect(isDefined(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isDefined(undefined)).toBe(false);
  });
});

// ============================================================================
// isString
// ============================================================================

describe('isString', () => {
  it('returns true for string values', () => {
    expect(isString('')).toBe(true);
    expect(isString('hello')).toBe(true);
  });

  it('returns false for non-string values', () => {
    expect(isString(42)).toBe(false);
    expect(isString(null)).toBe(false);
    expect(isString([])).toBe(false);
    expect(isString({})).toBe(false);
  });
});

// ============================================================================
// isNumber
// ============================================================================

describe('isNumber', () => {
  it('returns true for finite numbers', () => {
    expect(isNumber(0)).toBe(true);
    expect(isNumber(3.14)).toBe(true);
    expect(isNumber(-100)).toBe(true);
  });

  it('returns false for NaN', () => {
    expect(isNumber(NaN)).toBe(false);
  });

  it('returns false for strings that look like numbers', () => {
    expect(isNumber('42')).toBe(false);
  });

  it('returns false for null and undefined', () => {
    expect(isNumber(null)).toBe(false);
    expect(isNumber(undefined)).toBe(false);
  });
});

// ============================================================================
// isObject
// ============================================================================

describe('isObject', () => {
  it('returns true for plain objects', () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ key: 'value' })).toBe(true);
  });

  it('returns false for arrays', () => {
    expect(isObject([])).toBe(false);
  });

  it('returns false for null', () => {
    expect(isObject(null)).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(isObject('string')).toBe(false);
    expect(isObject(42)).toBe(false);
    expect(isObject(true)).toBe(false);
  });
});

// ============================================================================
// isArray
// ============================================================================

describe('isArray', () => {
  it('returns true for arrays', () => {
    expect(isArray([])).toBe(true);
    expect(isArray([1, 2, 3])).toBe(true);
  });

  it('returns false for plain objects', () => {
    expect(isArray({})).toBe(false);
  });

  it('returns false for null and strings', () => {
    expect(isArray(null)).toBe(false);
    expect(isArray('not-array')).toBe(false);
  });
});

// ============================================================================
// Ok / Err
// ============================================================================

describe('Ok', () => {
  it('creates a successful result with the given value', () => {
    const result = Ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(42);
  });

  it('works with complex values', () => {
    const result = Ok({ data: [1, 2, 3] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.data).toEqual([1, 2, 3]);
  });
});

describe('Err', () => {
  it('creates a failed result with the given error', () => {
    const error = new Error('failure');
    const result = Err(error);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(error);
  });

  it('works with string errors', () => {
    const result = Err('something went wrong');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('something went wrong');
  });
});

describe('Result discriminated union', () => {
  it('Ok and Err discriminate correctly on the ok field', () => {
    const success = Ok('yes');
    const failure = Err('no');

    expect(success.ok).toBe(true);
    expect(failure.ok).toBe(false);
  });
});

// ============================================================================
// tryAsync
// ============================================================================

describe('tryAsync', () => {
  it('returns Ok when the promise resolves', async () => {
    const result = await tryAsync(() => Promise.resolve('data'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('data');
  });

  it('returns Err when the promise rejects with an Error', async () => {
    const err = new Error('async failure');
    const result = await tryAsync(() => Promise.reject(err));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(err);
      expect(result.error.message).toBe('async failure');
    }
  });

  it('wraps non-Error rejections in an Error', async () => {
    const result = await tryAsync(() => Promise.reject('raw string rejection'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe('raw string rejection');
    }
  });

  it('wraps rejected objects with message in an Error', async () => {
    const result = await tryAsync(() => Promise.reject({ message: 'obj rejection' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe('obj rejection');
    }
  });
});

// ============================================================================
// trySync
// ============================================================================

describe('trySync', () => {
  it('returns Ok when the function succeeds', () => {
    const result = trySync(() => 'sync value');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('sync value');
  });

  it('returns Err when the function throws an Error', () => {
    const err = new Error('sync failure');
    const result = trySync(() => { throw err; });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(err);
    }
  });

  it('wraps non-Error throws in an Error', () => {
    const result = trySync(() => { throw 'raw throw'; });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe('raw throw');
    }
  });
});
