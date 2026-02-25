import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateQueryResponse,
  validateDataSchema,
  clearTableCache,
  checkTableExists,
} from '@/lib/supabase-validator';

// ---- validateQueryResponse ----

describe('validateQueryResponse', () => {
  describe('error cases', () => {
    it('returns invalid result with error message when error is present', () => {
      const result = validateQueryResponse(null, { message: 'Connection failed' }, 'test_table');
      expect(result.isValid).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toBe('Connection failed');
      expect(result.isEmpty).toBe(true);
    });

    it('returns table-not-found error for "does not exist" message', () => {
      const error = { message: 'relation "test_table" does not exist' };
      const result = validateQueryResponse(null, error, 'test_table');
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/does not exist/i);
      expect(result.error).toMatch(/migration/i);
    });

    it('returns permission error for RLS policy error', () => {
      const error = { message: 'permission denied for RLS policy on test_table' };
      const result = validateQueryResponse(null, error, 'test_table');
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/Permission denied/i);
      expect(result.error).toMatch(/Row Level Security/i);
    });

    it('returns permission error for "policy" in message', () => {
      const error = { message: 'new row violates row-level security policy' };
      const result = validateQueryResponse(null, error, 'test_table');
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/Permission denied/i);
    });

    it('returns connection error for ECONNREFUSED', () => {
      const error = { message: 'ECONNREFUSED 127.0.0.1:5432' };
      const result = validateQueryResponse(null, error, 'test_table');
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/connection failed/i);
    });

    it('returns connection error for timeout', () => {
      const error = { message: 'query timeout exceeded' };
      const result = validateQueryResponse(null, error, 'test_table');
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/connection failed/i);
    });

    it('handles Error instance as error parameter', () => {
      const error = new Error('Something broke');
      const result = validateQueryResponse(null, error, 'test_table');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Something broke');
    });

    it('handles error with code property (PostgrestError)', () => {
      const error = { code: '42P01', message: 'table not found' };
      const result = validateQueryResponse(null, error, 'test_table');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('handles string error', () => {
      const result = validateQueryResponse(null, 'raw error string', 'test_table');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('raw error string');
    });
  });

  describe('valid data cases', () => {
    it('returns valid empty result when data is null (no error)', () => {
      const result = validateQueryResponse(null, null, 'test_table');
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
      expect(result.isEmpty).toBe(true);
    });

    it('returns valid empty result when data is undefined (no error)', () => {
      const result = validateQueryResponse(undefined, null, 'test_table');
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.isEmpty).toBe(true);
    });

    it('returns valid result with data array', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const result = validateQueryResponse(data, null, 'test_table');
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.error).toBeNull();
      expect(result.isEmpty).toBe(false);
    });

    it('returns empty: true for empty array', () => {
      const result = validateQueryResponse([], null, 'test_table');
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.isEmpty).toBe(true);
    });

    it('returns invalid result when data is not an array', () => {
      const result = validateQueryResponse({ id: 1 }, null, 'test_table');
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/expected array/i);
    });

    it('returns invalid result when data is a string', () => {
      const result = validateQueryResponse('some string', null, 'test_table');
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/expected array/i);
    });
  });
});

// ---- validateDataSchema ----

describe('validateDataSchema', () => {
  it('returns valid empty result for empty array input', () => {
    const result = validateDataSchema([], ['id', 'name'], 'test_table');
    expect(result.isValid).toBe(true);
    expect(result.validRecords).toEqual([]);
    expect(result.invalidCount).toBe(0);
    expect(result.missingFields).toEqual([]);
  });

  it('returns all records when all have required fields', () => {
    const data = [
      { id: '1', name: 'Alice', score: 100 },
      { id: '2', name: 'Bob', score: 200 },
    ];
    const result = validateDataSchema(data, ['id', 'name'], 'test_table');
    expect(result.isValid).toBe(true);
    expect(result.validRecords).toHaveLength(2);
    expect(result.invalidCount).toBe(0);
  });

  it('filters out records missing required fields', () => {
    const data = [
      { id: '1', name: 'Alice' },
      { id: '2' },             // missing 'name'
      { name: 'Charlie' },     // missing 'id'
    ];
    const result = validateDataSchema(data, ['id', 'name'], 'test_table');
    expect(result.validRecords).toHaveLength(1);
    expect(result.invalidCount).toBe(2);
    expect(result.missingFields).toContain('name');
    expect(result.missingFields).toContain('id');
  });

  it('marks isValid as false when any record is invalid', () => {
    const data = [{ id: '1' }]; // missing 'name'
    const result = validateDataSchema(data, ['id', 'name'], 'test_table');
    expect(result.isValid).toBe(false);
  });

  it('handles null/non-object records gracefully', () => {
    const data = [null, undefined, 'invalid', { id: '1', name: 'Alice' }] as any[];
    const result = validateDataSchema(data, ['id', 'name'], 'test_table');
    expect(result.invalidCount).toBe(3);
    expect(result.validRecords).toHaveLength(1);
  });

  it('accepts records with extra fields beyond required ones', () => {
    const data = [{ id: '1', name: 'Alice', extra: 'field', another: 42 }];
    const result = validateDataSchema(data, ['id', 'name'], 'test_table');
    expect(result.isValid).toBe(true);
    expect(result.validRecords).toHaveLength(1);
  });

  it('collects missing field names from invalid records', () => {
    const data = [
      { id: '1' },  // missing name (Array.every short-circuits on first missing field)
      { id: '2' },  // missing name
    ];
    const result = validateDataSchema(data, ['id', 'name'], 'test_table');
    // 'name' is missing from both records
    expect(result.missingFields).toContain('name');
    expect(result.missingFields).not.toContain('id');
    expect(result.invalidCount).toBe(2);
  });

  it('sanitizes Date objects in records', () => {
    const now = new Date();
    const data = [{ id: '1', created_at: now }];
    const result = validateDataSchema(data, ['id', 'created_at'], 'test_table');
    expect(result.isValid).toBe(true);
    expect(result.validRecords[0].created_at).toBe(now.toISOString());
  });
});

// ---- clearTableCache ----

describe('clearTableCache', () => {
  it('runs without error when clearing a specific table', () => {
    expect(() => clearTableCache('some_table')).not.toThrow();
  });

  it('runs without error when clearing all tables', () => {
    expect(() => clearTableCache()).not.toThrow();
  });
});

// ---- checkTableExists ----

describe('checkTableExists', () => {
  it('returns true when supabase query succeeds without error', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    } as any;

    // Clear the internal cache to avoid stale results
    clearTableCache('live_odds_cache');

    const result = await checkTableExists(mockSupabase, 'live_odds_cache');
    expect(result).toBe(true);
  });

  it('returns false when supabase error contains "does not exist"', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            error: { message: 'relation "no_table" does not exist' },
          }),
        }),
      }),
    } as any;

    clearTableCache('no_table');

    const result = await checkTableExists(mockSupabase, 'no_table');
    expect(result).toBe(false);
  });

  it('returns false when supabase query throws', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation(() => {
        throw new Error('Network error');
      }),
    } as any;

    clearTableCache('broken_table');

    const result = await checkTableExists(mockSupabase, 'broken_table');
    expect(result).toBe(false);
  });

  it('uses cache on second call with same table name', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const mockSupabase = { from: mockFrom } as any;

    clearTableCache('cached_table');

    await checkTableExists(mockSupabase, 'cached_table');
    await checkTableExists(mockSupabase, 'cached_table');

    // Should only make one actual DB call due to caching
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});
