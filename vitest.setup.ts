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
// Mock Next.js server-only modules that crash outside the runtime
// ============================================================================

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  }),
  headers: vi.fn().mockReturnValue(new Headers()),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn().mockReturnValue({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: vi.fn().mockReturnValue('/'),
  useSearchParams: vi.fn().mockReturnValue(new URLSearchParams()),
}));

// ============================================================================
// Cleanup between tests
// ============================================================================

afterEach(() => {
  vi.restoreAllMocks();
});
