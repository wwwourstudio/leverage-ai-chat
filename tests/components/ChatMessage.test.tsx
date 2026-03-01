// @vitest-environment jsdom
/**
 * Component Tests for components/chat-message.tsx
 * Covers: user messages, assistant messages, markdown rendering,
 *         edit mode, copy/edit buttons, confidence, modelUsed, trust metrics.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatMessage } from '@/components/chat-message';

// ── Mock lucide-react icons ───────────────────────────────────────────────────
vi.mock('lucide-react', () => ({
  Shield: () => <span data-testid="icon-shield" />,
  Copy: () => <span data-testid="icon-copy" />,
  Edit3: () => <span data-testid="icon-edit3" />,
  CheckCheck: () => <span data-testid="icon-check" />,
  X: () => <span data-testid="icon-x" />,
  Zap: () => <span data-testid="icon-zap" />,
  Brain: () => <span data-testid="icon-brain" />,
}));

// ── Mock TrustMetricsDisplay (avoids rendering complex child) ─────────────────
vi.mock('@/components/trust-metrics-display', () => ({
  TrustMetricsDisplay: ({ metrics }: { metrics: any }) => (
    <div data-testid="trust-metrics">{JSON.stringify(metrics)}</div>
  ),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeMessage(overrides: Partial<Parameters<typeof ChatMessage>[0]['message']> = {}) {
  return {
    role: 'user' as const,
    content: 'Hello world',
    timestamp: new Date('2025-01-01T12:00:00Z'),
    ...overrides,
  };
}

// ============================================================================
// User messages
// ============================================================================

describe('ChatMessage — user message', () => {
  it('renders user message content', () => {
    render(<ChatMessage message={makeMessage({ role: 'user', content: 'What are the NBA odds?' })} />);
    expect(screen.getByText('What are the NBA odds?')).toBeTruthy();
  });

  it('does not show copy or edit buttons for user messages', () => {
    render(<ChatMessage message={makeMessage({ role: 'user' })} />);
    // Copy and Edit buttons are only rendered for assistant messages
    expect(screen.queryByTitle('Copy response')).toBeNull();
    expect(screen.queryByTitle('Edit')).toBeNull();
  });

  it('shows a timestamp', () => {
    render(<ChatMessage message={makeMessage({ role: 'user' })} />);
    // timestamp renders as a <p> element with relative time text
    // "just now" for a very recent timestamp
    const allParagraphs = document.querySelectorAll('p');
    const timestampEl = Array.from(allParagraphs).find(
      p => /ago|just now/i.test(p.textContent ?? '')
    );
    expect(timestampEl).toBeTruthy();
  });
});

// ============================================================================
// Assistant messages
// ============================================================================

describe('ChatMessage — assistant message', () => {
  it('renders assistant message content as markdown', () => {
    render(
      <ChatMessage
        message={makeMessage({
          role: 'assistant',
          content: 'Here is the analysis.',
        })}
      />
    );
    expect(screen.getByText('Here is the analysis.')).toBeTruthy();
  });

  it('renders ## header as styled paragraph', () => {
    render(
      <ChatMessage
        message={makeMessage({
          role: 'assistant',
          content: '## NBA Analysis\nSome content here',
        })}
      />
    );
    expect(screen.getByText('NBA Analysis')).toBeTruthy();
  });

  it('renders bullet list items', () => {
    render(
      <ChatMessage
        message={makeMessage({
          role: 'assistant',
          content: '- Item one\n- Item two\n- Item three',
        })}
      />
    );
    expect(screen.getByText('Item one')).toBeTruthy();
    expect(screen.getByText('Item two')).toBeTruthy();
  });

  it('shows copy button', () => {
    render(
      <ChatMessage
        message={makeMessage({ role: 'assistant' })}
      />
    );
    expect(screen.getByTitle('Copy response')).toBeTruthy();
  });

  it('shows edit button', () => {
    render(
      <ChatMessage
        message={makeMessage({ role: 'assistant' })}
      />
    );
    expect(screen.getByTitle('Edit')).toBeTruthy();
  });

  it('calls onCopy when copy button is clicked', () => {
    const onCopy = vi.fn();
    render(
      <ChatMessage
        message={makeMessage({ role: 'assistant' })}
        onCopy={onCopy}
      />
    );
    fireEvent.click(screen.getByTitle('Copy response'));
    expect(onCopy).toHaveBeenCalledOnce();
  });

  it('shows confidence when provided', () => {
    render(
      <ChatMessage
        message={makeMessage({ role: 'assistant', confidence: 85 })}
      />
    );
    expect(screen.getByText('85% confidence')).toBeTruthy();
  });

  it('shows model name when modelUsed is provided', () => {
    render(
      <ChatMessage
        message={makeMessage({ role: 'assistant', modelUsed: 'grok-3-fast' })}
      />
    );
    // The component normalizes "grok-3-fast" → "Grok 4"
    expect(screen.getByText('Grok 4')).toBeTruthy();
  });

  it('shows trust shield button when trustMetrics are provided', () => {
    render(
      <ChatMessage
        message={makeMessage({ role: 'assistant', trustMetrics: { score: 90 } })}
      />
    );
    expect(screen.getByTitle('Trust metrics')).toBeTruthy();
  });

  it('toggles trust metrics display when shield button is clicked', () => {
    render(
      <ChatMessage
        message={makeMessage({ role: 'assistant', trustMetrics: { score: 90 } })}
      />
    );
    // Initially hidden
    expect(screen.queryByTestId('trust-metrics')).toBeNull();

    // Click to show
    fireEvent.click(screen.getByTitle('Trust metrics'));
    expect(screen.getByTestId('trust-metrics')).toBeTruthy();

    // Click to hide again
    fireEvent.click(screen.getByTitle('Trust metrics'));
    expect(screen.queryByTestId('trust-metrics')).toBeNull();
  });

  it('does not show shield button when no trustMetrics', () => {
    render(
      <ChatMessage message={makeMessage({ role: 'assistant' })} />
    );
    expect(screen.queryByTitle('Trust metrics')).toBeNull();
  });
});

// ============================================================================
// Edit mode
// ============================================================================

describe('ChatMessage — edit mode', () => {
  it('enters edit mode when edit button is clicked', () => {
    render(
      <ChatMessage
        message={makeMessage({ role: 'assistant', content: 'Original content' })}
        onEdit={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTitle('Edit'));
    // Should render textarea
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('shows Save and Cancel buttons in edit mode', () => {
    render(
      <ChatMessage
        message={makeMessage({ role: 'assistant' })}
        onEdit={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTitle('Edit'));
    expect(screen.getByText('Save')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('calls onEdit with new content when Save is clicked', () => {
    const onEdit = vi.fn();
    render(
      <ChatMessage
        message={makeMessage({ role: 'assistant', content: 'Original' })}
        onEdit={onEdit}
      />
    );
    fireEvent.click(screen.getByTitle('Edit'));

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Updated content' } });
    fireEvent.click(screen.getByText('Save'));

    expect(onEdit).toHaveBeenCalledWith('Updated content');
  });

  it('cancels edit mode and restores content when Cancel is clicked', () => {
    render(
      <ChatMessage
        message={makeMessage({ role: 'assistant', content: 'Original' })}
        onEdit={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTitle('Edit'));
    expect(screen.getByRole('textbox')).toBeTruthy();

    fireEvent.click(screen.getByText('Cancel'));
    // Back to view mode
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Original')).toBeTruthy();
  });
});

// ============================================================================
// Markdown inline rendering
// ============================================================================

describe('ChatMessage — markdown inline', () => {
  it('renders **bold** as a <strong> element', () => {
    render(
      <ChatMessage
        message={makeMessage({
          role: 'assistant',
          content: 'The **Lakers** are favored',
        })}
      />
    );
    const strong = document.querySelector('strong');
    expect(strong).toBeTruthy();
    expect(strong?.textContent).toBe('Lakers');
  });

  it('renders plain text without bold markers unchanged', () => {
    render(
      <ChatMessage
        message={makeMessage({
          role: 'assistant',
          content: 'Plain text without formatting',
        })}
      />
    );
    expect(screen.getByText('Plain text without formatting')).toBeTruthy();
    expect(document.querySelector('strong')).toBeNull();
  });
});
