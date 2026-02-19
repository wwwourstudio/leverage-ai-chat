import '@testing-library/jest-dom/vitest';
import { vi, afterEach } from 'vitest';

// ============================================================================
// Global mocks for Node / browser APIs used throughout the app
// ============================================================================

// Provide a minimal fetch mock so tests that import modules with top-level
// fetch calls don't fail at import time.  Tests should override via
// vi.spyOn(globalThis, 'fetch') when they need specific responses.
if (!globalThis.fetch) {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

// Stub Next.js environment variables commonly referenced at module scope
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';

// ============================================================================
// Cleanup between tests
// ============================================================================

afterEach(() => {
  vi.restoreAllMocks();
});
