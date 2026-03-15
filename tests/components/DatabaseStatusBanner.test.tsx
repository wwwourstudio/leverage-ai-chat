// @vitest-environment jsdom
/**
 * Component Tests for components/database-status-banner.tsx
 * Covers: initial checking state, connected (auto-dismiss), missing-schema state,
 *         error state, dismiss button, onDismiss callback.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseStatusBanner } from '@/components/db-status-banner';

// ── Mock lucide-react icons ───────────────────────────────────────────────────
vi.mock('lucide-react', () => ({
  Database: () => <span data-testid="icon-database" />,
  AlertCircle: () => <span data-testid="icon-alert-circle" />,
  CheckCircle2: () => <span data-testid="icon-check-circle" />,
  ExternalLink: () => <span data-testid="icon-external-link" />,
  X: () => <span data-testid="icon-x" />,
  Loader2: () => <span data-testid="icon-loader" />,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function mockFetchResponse(data: object, status = 200) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

// ============================================================================
// Initial "checking" state
// ============================================================================

describe('DatabaseStatusBanner — checking state', () => {
  beforeEach(() => {
    // Delay fetch so we can observe the checking state
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise(resolve =>
        setTimeout(() => resolve(new Response(JSON.stringify({ success: true }), { status: 200 })), 5000)
      )
    );
  });

  it('shows "Checking database connection..." while loading', () => {
    render(<DatabaseStatusBanner />);
    expect(screen.getByText('Checking database connection...')).toBeTruthy();
  });

  it('shows the loading spinner icon while checking', () => {
    render(<DatabaseStatusBanner />);
    expect(screen.getByTestId('icon-loader')).toBeTruthy();
  });
});

// ============================================================================
// Connected (success) state — banner auto-dismisses
// ============================================================================

describe('DatabaseStatusBanner — connected state', () => {
  it('renders null when database is connected (auto-dismiss)', async () => {
    mockFetchResponse({ success: true });
    const { container } = render(<DatabaseStatusBanner />);

    // Wait for fetch to resolve and component to update
    await waitFor(() => {
      // The component returns null when status === 'connected'
      // So the container should be empty
      expect(container.firstChild).toBeNull();
    });
  });
});

// ============================================================================
// Missing-schema state
// ============================================================================

describe('DatabaseStatusBanner — missing-schema state', () => {
  it('shows "Database Setup Required" title', async () => {
    mockFetchResponse({ setupRequired: true, message: 'Tables need to be created' });
    render(<DatabaseStatusBanner />);

    await waitFor(() => {
      expect(screen.getByText('Database Setup Required')).toBeTruthy();
    });
  });

  it('shows the setup message', async () => {
    mockFetchResponse({ setupRequired: true, message: 'Tables need to be created' });
    render(<DatabaseStatusBanner />);

    await waitFor(() => {
      expect(screen.getByText('Tables need to be created')).toBeTruthy();
    });
  });

  it('shows setup instructions', async () => {
    mockFetchResponse({ setupRequired: true, message: 'Run migration' });
    render(<DatabaseStatusBanner />);

    await waitFor(() => {
      // Text appears in both the <li> step and the <a> link — use getAllByText
      expect(screen.getAllByText(/Open Supabase SQL Editor/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows "Open Supabase SQL Editor" link', async () => {
    mockFetchResponse({ setupRequired: true, message: 'Run migration' });
    render(<DatabaseStatusBanner />);

    await waitFor(() => {
      // The link text appears in both the link and button
      const links = screen.getAllByText('Open Supabase SQL Editor');
      expect(links.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Error state
// ============================================================================

describe('DatabaseStatusBanner — error state', () => {
  it('shows "Database Connection Issue" title on error', async () => {
    mockFetchResponse({ success: false, message: 'Connection refused' });
    render(<DatabaseStatusBanner />);

    await waitFor(() => {
      expect(screen.getByText('Database Connection Issue')).toBeTruthy();
    });
  });

  it('shows error message', async () => {
    mockFetchResponse({ success: false, message: 'Connection refused' });
    render(<DatabaseStatusBanner />);

    await waitFor(() => {
      expect(screen.getByText('Connection refused')).toBeTruthy();
    });
  });

  it('shows troubleshooting tips for error state', async () => {
    mockFetchResponse({ success: false, message: 'Oops' });
    render(<DatabaseStatusBanner />);

    await waitFor(() => {
      expect(screen.getByText(/Supabase environment variables/i)).toBeTruthy();
    });
  });
});

// ============================================================================
// Network failure (fetch returns null / throws)
// ============================================================================

describe('DatabaseStatusBanner — network failure', () => {
  it('auto-dismisses and renders null when fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));
    const { container } = render(<DatabaseStatusBanner />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});

// ============================================================================
// Dismiss button
// ============================================================================

describe('DatabaseStatusBanner — dismiss', () => {
  it('renders dismiss (X) button', async () => {
    mockFetchResponse({ setupRequired: true, message: 'Set up DB' });
    render(<DatabaseStatusBanner />);

    await waitFor(() => screen.getByText('Database Setup Required'));
    expect(screen.getByLabelText('Dismiss')).toBeTruthy();
  });

  it('hides the banner when dismiss button is clicked', async () => {
    mockFetchResponse({ setupRequired: true, message: 'Set up DB' });
    const { container } = render(<DatabaseStatusBanner />);

    await waitFor(() => screen.getByLabelText('Dismiss'));
    fireEvent.click(screen.getByLabelText('Dismiss'));

    expect(container.firstChild).toBeNull();
  });

  it('calls onDismiss callback when dismiss button is clicked', async () => {
    const onDismiss = vi.fn();
    mockFetchResponse({ setupRequired: true, message: 'Set up DB' });
    render(<DatabaseStatusBanner onDismiss={onDismiss} />);

    await waitFor(() => screen.getByLabelText('Dismiss'));
    fireEvent.click(screen.getByLabelText('Dismiss'));

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
