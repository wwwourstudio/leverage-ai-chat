/**
 * Unit Tests for lib/config.ts
 * Covers: env getters, service status checks, validateEnv, assertServicesConfigured
 *
 * NOTE: vitest.setup.ts pre-sets NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY.  Tests that need those absent must
 * delete and restore them themselves.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  getServerEnv,
  getClientEnv,
  validateEnv,
  getGrokApiKey,
  getOddsApiKey,
  isSupabaseConfigured,
  isGrokConfigured,
  isOddsApiConfigured,
  checkSupabaseConfig,
  checkGrokConfig,
  checkOddsConfig,
  getServiceStatus,
  getConfigStatus,
  assertServicesConfigured,
  checkClientConfig,
} from '@/lib/config';

// ============================================================================
// Helpers
// ============================================================================

/** Temporarily set env vars, restoring them after the test. */
function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const originals: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    originals[k] = process.env[k];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(originals)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  }
}

// ============================================================================
// getServerEnv
// ============================================================================

describe('getServerEnv', () => {
  it('returns the env var value when set', () => {
    withEnv({ TEST_VAR: 'hello' }, () => {
      expect(getServerEnv('TEST_VAR')).toBe('hello');
    });
  });

  it('returns the defaultValue when the var is missing', () => {
    withEnv({ TEST_VAR: undefined }, () => {
      expect(getServerEnv('TEST_VAR', { defaultValue: 'fallback' })).toBe('fallback');
    });
  });

  it('returns undefined when missing and no default', () => {
    withEnv({ TEST_VAR: undefined }, () => {
      expect(getServerEnv('TEST_VAR')).toBeUndefined();
    });
  });

  it('throws when required and missing', () => {
    withEnv({ TEST_VAR: undefined }, () => {
      expect(() => getServerEnv('TEST_VAR', { required: true })).toThrow(
        'Missing required environment variable: TEST_VAR'
      );
    });
  });

  it('does not throw when required and present', () => {
    withEnv({ TEST_VAR: 'present' }, () => {
      expect(() => getServerEnv('TEST_VAR', { required: true })).not.toThrow();
    });
  });
});

// ============================================================================
// getClientEnv
// ============================================================================

describe('getClientEnv', () => {
  it('returns undefined and warns when key lacks NEXT_PUBLIC_ prefix', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    withEnv({ SECRET_KEY: 'secret' }, () => {
      const result = getClientEnv('SECRET_KEY');
      expect(result).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Client env vars must be prefixed with NEXT_PUBLIC_")
      );
    });
    warnSpy.mockRestore();
  });

  it('returns the value for a NEXT_PUBLIC_ var', () => {
    withEnv({ NEXT_PUBLIC_TEST: 'pub-value' }, () => {
      expect(getClientEnv('NEXT_PUBLIC_TEST')).toBe('pub-value');
    });
  });

  it('returns defaultValue when missing', () => {
    withEnv({ NEXT_PUBLIC_MISSING: undefined }, () => {
      expect(getClientEnv('NEXT_PUBLIC_MISSING', { defaultValue: 'default' })).toBe('default');
    });
  });

  it('throws when required and missing', () => {
    withEnv({ NEXT_PUBLIC_MISSING: undefined }, () => {
      expect(() => getClientEnv('NEXT_PUBLIC_MISSING', { required: true })).toThrow(
        'Missing required environment variable: NEXT_PUBLIC_MISSING'
      );
    });
  });
});

// ============================================================================
// validateEnv
// ============================================================================

describe('validateEnv', () => {
  it('reports valid when all vars are set', () => {
    withEnv({ VAR_A: 'a', VAR_B: 'b' }, () => {
      const result = validateEnv(['VAR_A', 'VAR_B']);
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
      expect(result.message).toMatch(/configured/i);
    });
  });

  it('reports missing vars', () => {
    withEnv({ VAR_A: 'a', VAR_B: undefined }, () => {
      const result = validateEnv(['VAR_A', 'VAR_B']);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('VAR_B');
      expect(result.message).toMatch(/VAR_B/);
    });
  });

  it('reports all missing when none are set', () => {
    withEnv({ VAR_X: undefined, VAR_Y: undefined }, () => {
      const result = validateEnv(['VAR_X', 'VAR_Y']);
      expect(result.valid).toBe(false);
      expect(result.missing).toHaveLength(2);
    });
  });

  it('returns valid for empty required list', () => {
    const result = validateEnv([]);
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// isSupabaseConfigured
// ============================================================================

describe('isSupabaseConfigured', () => {
  it('returns true when both Supabase vars are set', () => {
    withEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    }, () => {
      expect(isSupabaseConfigured()).toBe(true);
    });
  });

  it('returns false when URL is missing', () => {
    withEnv({
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    }, () => {
      expect(isSupabaseConfigured()).toBe(false);
    });
  });

  it('returns false when anon key is missing', () => {
    withEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    }, () => {
      expect(isSupabaseConfigured()).toBe(false);
    });
  });

  it('returns false when both are missing', () => {
    withEnv({
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    }, () => {
      expect(isSupabaseConfigured()).toBe(false);
    });
  });
});

// ============================================================================
// isGrokConfigured / isOddsApiConfigured
// ============================================================================

describe('isGrokConfigured', () => {
  it('returns true when XAI_API_KEY is set', () => {
    withEnv({ XAI_API_KEY: 'xai-key', GROK_API_KEY: undefined }, () => {
      expect(isGrokConfigured()).toBe(true);
    });
  });

  it('returns true when GROK_API_KEY is set as fallback', () => {
    withEnv({ XAI_API_KEY: undefined, GROK_API_KEY: 'grok-key' }, () => {
      expect(isGrokConfigured()).toBe(true);
    });
  });

  it('returns false when neither key is set', () => {
    withEnv({ XAI_API_KEY: undefined, GROK_API_KEY: undefined }, () => {
      expect(isGrokConfigured()).toBe(false);
    });
  });
});

describe('isOddsApiConfigured', () => {
  it('returns true when ODDS_API_KEY is set', () => {
    withEnv({ ODDS_API_KEY: 'odds-key' }, () => {
      expect(isOddsApiConfigured()).toBe(true);
    });
  });

  it('returns false when ODDS_API_KEY is missing', () => {
    withEnv({ ODDS_API_KEY: undefined }, () => {
      expect(isOddsApiConfigured()).toBe(false);
    });
  });
});

// ============================================================================
// checkSupabaseConfig
// ============================================================================

describe('checkSupabaseConfig', () => {
  it('returns configured=true when required vars are present', () => {
    withEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'key',
    }, () => {
      const status = checkSupabaseConfig();
      expect(status.configured).toBe(true);
      expect(status.missing).toHaveLength(0);
    });
  });

  it('returns configured=false and lists missing vars', () => {
    withEnv({
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    }, () => {
      const status = checkSupabaseConfig();
      expect(status.configured).toBe(false);
      expect(status.missing).toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(status.missing).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    });
  });

  it('includes warnings for missing optional vars', () => {
    withEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'key',
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    }, () => {
      const status = checkSupabaseConfig();
      expect(status.warnings.some(w => w.includes('SUPABASE_SERVICE_ROLE_KEY'))).toBe(true);
    });
  });
});

// ============================================================================
// checkGrokConfig
// ============================================================================

describe('checkGrokConfig', () => {
  it('returns configured=true when key is present', () => {
    withEnv({ XAI_API_KEY: 'my-key', GROK_API_KEY: undefined }, () => {
      const status = checkGrokConfig();
      expect(status.configured).toBe(true);
      expect(status.missing).toHaveLength(0);
    });
  });

  it('returns configured=false and lists XAI_API_KEY as missing', () => {
    withEnv({ XAI_API_KEY: undefined, GROK_API_KEY: undefined }, () => {
      const status = checkGrokConfig();
      expect(status.configured).toBe(false);
      expect(status.missing).toContain('XAI_API_KEY');
    });
  });
});

// ============================================================================
// checkOddsConfig
// ============================================================================

describe('checkOddsConfig', () => {
  it('returns configured=true when ODDS_API_KEY is set', () => {
    withEnv({ ODDS_API_KEY: 'odds' }, () => {
      const status = checkOddsConfig();
      expect(status.configured).toBe(true);
    });
  });

  it('returns configured=false and lists missing key', () => {
    withEnv({ ODDS_API_KEY: undefined }, () => {
      const status = checkOddsConfig();
      expect(status.configured).toBe(false);
      expect(status.missing).toContain('ODDS_API_KEY');
    });
  });

  it('includes a usage warning when configured', () => {
    withEnv({ ODDS_API_KEY: 'odds' }, () => {
      const status = checkOddsConfig();
      expect(status.warnings.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// getServiceStatus
// ============================================================================

describe('getServiceStatus', () => {
  it('reports allConfigured=true when all services have keys', () => {
    withEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'key',
      XAI_API_KEY: 'xai',
      ODDS_API_KEY: 'odds',
    }, () => {
      const status = getServiceStatus();
      expect(status.allConfigured).toBe(true);
      expect(status.overall.ready).toBe(true);
      expect(status.overall.criticalMissing).toBe(0);
    });
  });

  it('reports allConfigured=false when a service is missing', () => {
    withEnv({
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      XAI_API_KEY: undefined,
      ODDS_API_KEY: undefined,
    }, () => {
      const status = getServiceStatus();
      expect(status.allConfigured).toBe(false);
      expect(status.overall.criticalMissing).toBeGreaterThan(0);
    });
  });

  it('exposes oddsApi as an alias for odds', () => {
    withEnv({ ODDS_API_KEY: 'odds' }, () => {
      const status = getServiceStatus();
      expect(status.oddsApi).toBe(status.odds);
    });
  });
});

// ============================================================================
// getConfigStatus
// ============================================================================

describe('getConfigStatus', () => {
  it('reflects individual service flags', () => {
    withEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'key',
      XAI_API_KEY: 'xai',
      ODDS_API_KEY: 'odds',
    }, () => {
      const cfg = getConfigStatus();
      expect(cfg.supabase).toBe(true);
      expect(cfg.grok).toBe(true);
      expect(cfg.odds).toBe(true);
      expect(cfg.allReady).toBe(true);
    });
  });

  it('sets allReady=false when any service is missing', () => {
    withEnv({ XAI_API_KEY: undefined, GROK_API_KEY: undefined }, () => {
      const cfg = getConfigStatus();
      expect(cfg.grok).toBe(false);
      expect(cfg.allReady).toBe(false);
    });
  });
});

// ============================================================================
// assertServicesConfigured
// ============================================================================

describe('assertServicesConfigured', () => {
  it('does not throw when all requested services are configured', () => {
    withEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'key',
      XAI_API_KEY: 'xai',
      ODDS_API_KEY: 'odds',
    }, () => {
      expect(() => assertServicesConfigured(['supabase', 'grok', 'odds'])).not.toThrow();
    });
  });

  it('throws with a helpful message when supabase is missing', () => {
    withEnv({
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    }, () => {
      expect(() => assertServicesConfigured(['supabase'])).toThrow(
        /Supabase/i
      );
    });
  });

  it('throws listing all unconfigured services', () => {
    withEnv({
      XAI_API_KEY: undefined,
      GROK_API_KEY: undefined,
      ODDS_API_KEY: undefined,
    }, () => {
      expect(() => assertServicesConfigured(['grok', 'odds'])).toThrow(
        /Grok AI|Odds API/
      );
    });
  });

  it('does not throw when passed an empty services list', () => {
    expect(() => assertServicesConfigured([])).not.toThrow();
  });
});

// ============================================================================
// checkClientConfig
// ============================================================================

describe('checkClientConfig', () => {
  it('returns ready=true when both public vars are set', () => {
    withEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'key',
    }, () => {
      const cfg = checkClientConfig();
      expect(cfg.supabaseUrl).toBe(true);
      expect(cfg.supabaseKey).toBe(true);
      expect(cfg.ready).toBe(true);
    });
  });

  it('returns ready=false when URL is missing', () => {
    withEnv({ NEXT_PUBLIC_SUPABASE_URL: undefined }, () => {
      const cfg = checkClientConfig();
      expect(cfg.supabaseUrl).toBe(false);
      expect(cfg.ready).toBe(false);
    });
  });
});
