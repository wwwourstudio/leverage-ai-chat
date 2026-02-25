// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorBoundary, withErrorBoundary } from '@/components/error-boundary';

// Mock lucide-react icons to avoid SVG rendering issues in jsdom
vi.mock('lucide-react', () => ({
  AlertTriangle: () => <span data-testid="alert-icon" />,
  RefreshCw: () => <span data-testid="refresh-icon" />,
}));

// Helper component that throws an error on demand
function BombComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test explosion');
  }
  return <div data-testid="safe-content">All Good</div>;
}

// Suppress console.error output from React's error boundary machinery in tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ErrorBoundary', () => {
  describe('normal rendering', () => {
    it('renders children when there is no error', () => {
      render(
        <ErrorBoundary>
          <div data-testid="child">Hello</div>
        </ErrorBoundary>
      );
      expect(screen.getByTestId('child')).toBeTruthy();
      expect(screen.getByText('Hello')).toBeTruthy();
    });

    it('does not show error UI when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div>Normal content</div>
        </ErrorBoundary>
      );
      expect(screen.queryByText('Something went wrong')).toBeNull();
    });
  });

  describe('error state', () => {
    it('shows default error UI when a child throws', () => {
      render(
        <ErrorBoundary>
          <BombComponent shouldThrow />
        </ErrorBoundary>
      );
      expect(screen.getByText('Something went wrong')).toBeTruthy();
    });

    it('hides children content when error occurs', () => {
      render(
        <ErrorBoundary>
          <BombComponent shouldThrow />
        </ErrorBoundary>
      );
      expect(screen.queryByTestId('safe-content')).toBeNull();
    });

    it('shows the error message in technical details', () => {
      render(
        <ErrorBoundary>
          <BombComponent shouldThrow />
        </ErrorBoundary>
      );
      expect(screen.getByText('Test explosion')).toBeTruthy();
    });

    it('renders the Try Again button', () => {
      render(
        <ErrorBoundary>
          <BombComponent shouldThrow />
        </ErrorBoundary>
      );
      expect(screen.getByRole('button', { name: /Try Again/i })).toBeTruthy();
    });

    it('shows icons in error UI', () => {
      render(
        <ErrorBoundary>
          <BombComponent shouldThrow />
        </ErrorBoundary>
      );
      expect(screen.getByTestId('alert-icon')).toBeTruthy();
      expect(screen.getByTestId('refresh-icon')).toBeTruthy();
    });

    it('shows common error cause suggestions', () => {
      render(
        <ErrorBoundary>
          <BombComponent shouldThrow />
        </ErrorBoundary>
      );
      expect(screen.getByText(/Network connectivity/i)).toBeTruthy();
    });
  });

  describe('custom fallback', () => {
    it('renders custom fallback instead of default error UI', () => {
      render(
        <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom Error</div>}>
          <BombComponent shouldThrow />
        </ErrorBoundary>
      );
      expect(screen.getByTestId('custom-fallback')).toBeTruthy();
      expect(screen.getByText('Custom Error')).toBeTruthy();
    });

    it('does not show default error UI when custom fallback is provided', () => {
      render(
        <ErrorBoundary fallback={<div>Custom</div>}>
          <BombComponent shouldThrow />
        </ErrorBoundary>
      );
      expect(screen.queryByText('Something went wrong')).toBeNull();
    });
  });

  describe('reset behavior', () => {
    it('clears error state and re-renders children after Try Again click', () => {
      // Control throwing via a mutable variable so we can stop it
      // before the boundary re-renders after reset
      let shouldThrow = true;

      function ToggleableBomb() {
        if (shouldThrow) throw new Error('Test explosion');
        return <div data-testid="safe-content">All Good</div>;
      }

      render(
        <ErrorBoundary>
          <ToggleableBomb />
        </ErrorBoundary>
      );

      // Error UI is shown
      expect(screen.getByText('Something went wrong')).toBeTruthy();

      // Disable throwing BEFORE clicking reset so the child renders cleanly
      shouldThrow = false;
      fireEvent.click(screen.getByRole('button', { name: /Try Again/i }));

      // After reset the boundary re-renders ToggleableBomb which no longer throws
      expect(screen.getByTestId('safe-content')).toBeTruthy();
    });
  });

  describe('withErrorBoundary HOC', () => {
    it('wraps component in ErrorBoundary', () => {
      function SimpleComponent() {
        return <div data-testid="hoc-content">HOC Content</div>;
      }
      const Wrapped = withErrorBoundary(SimpleComponent);
      render(<Wrapped />);
      expect(screen.getByTestId('hoc-content')).toBeTruthy();
    });

    it('catches errors in wrapped component', () => {
      const Wrapped = withErrorBoundary(BombComponent);
      render(<Wrapped shouldThrow />);
      expect(screen.getByText('Something went wrong')).toBeTruthy();
    });

    it('uses custom fallback when provided to withErrorBoundary', () => {
      const Wrapped = withErrorBoundary(
        BombComponent,
        <div data-testid="hoc-fallback">HOC Fallback</div>
      );
      render(<Wrapped shouldThrow />);
      expect(screen.getByTestId('hoc-fallback')).toBeTruthy();
    });
  });
});
