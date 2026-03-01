// @vitest-environment jsdom
/**
 * Component Tests for components/data-cards/BettingCard.tsx
 * Covers: matchup display, moneylines, spreads, O/U totals, player prop mode,
 *         LIVE badge, FINAL state, injury alerts, weather notes, recommendation.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BettingCard } from '@/components/data-cards/BettingCard';

// ── Mock all lucide-react icons used by BettingCard ───────────────────────────
vi.mock('lucide-react', () => ({
  Clock: () => <span data-testid="icon-clock" />,
  TrendingUp: () => <span data-testid="icon-trending-up" />,
  TrendingDown: () => <span data-testid="icon-trending-down" />,
  Minus: () => <span data-testid="icon-minus" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  Zap: () => <span data-testid="icon-zap" />,
  Shield: () => <span data-testid="icon-shield" />,
  AlertTriangle: () => <span data-testid="icon-alert-triangle" />,
  Wind: () => <span data-testid="icon-wind" />,
  Brain: () => <span data-testid="icon-brain" />,
}));

// ── Mock PlayerAvatar (avoids image fetching) ─────────────────────────────────
vi.mock('@/components/data-cards/PlayerAvatar', () => ({
  PlayerAvatar: ({ playerName }: { playerName: string }) => (
    <span data-testid="player-avatar">{playerName}</span>
  ),
}));

// ── Mock constants functions used by BettingCard ──────────────────────────────
vi.mock('@/lib/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/constants')>();
  return {
    ...actual,
    getPlayerHeadshotUrl: () => null,
    getTeamLogoUrl: () => null,
  };
});

// ── Default props factory ─────────────────────────────────────────────────────
function makeProps(overrides: Partial<Parameters<typeof BettingCard>[0]> = {}) {
  return {
    type: 'betting',
    title: 'Lakers vs Celtics',
    category: 'NBA',
    subcategory: 'Moneyline',
    gradient: 'from-orange-600 to-orange-900',
    data: {},
    status: 'active',
    ...overrides,
  };
}

// ============================================================================
// Basic rendering
// ============================================================================

describe('BettingCard — basic rendering', () => {
  it('renders without crashing with minimal props', () => {
    render(<BettingCard {...makeProps()} />);
    // If no error is thrown and the article is rendered, test passes
    expect(document.querySelector('article')).toBeTruthy();
  });

  it('renders category and subcategory labels', () => {
    render(<BettingCard {...makeProps()} />);
    expect(screen.getByText('NBA')).toBeTruthy();
    expect(screen.getByText('Moneyline')).toBeTruthy();
  });

  it('renders title text when no matchup and no player prop', () => {
    render(<BettingCard {...makeProps({ data: {}, title: 'Unique Title 123' })} />);
    expect(screen.getByText('Unique Title 123')).toBeTruthy();
  });
});

// ============================================================================
// Matchup display
// ============================================================================

describe('BettingCard — matchup display', () => {
  it('renders away and home teams from matchup string', () => {
    render(
      <BettingCard
        {...makeProps({
          data: {
            matchup: 'Los Angeles Lakers @ Boston Celtics',
            sport: 'basketball_nba',
          },
        })}
      />
    );
    expect(screen.getByText('Los Angeles Lakers')).toBeTruthy();
    expect(screen.getByText('Boston Celtics')).toBeTruthy();
  });

  it('renders moneyline odds for both teams', () => {
    render(
      <BettingCard
        {...makeProps({
          data: {
            matchup: 'Lakers @ Celtics',
            homeOdds: '-150',
            awayOdds: '+130',
          },
        })}
      />
    );
    // Values appear in matchup header — use getAllByText since they may render in multiple places
    expect(screen.getAllByText('-150').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('+130').length).toBeGreaterThanOrEqual(1);
  });

  it('renders implied win probability', () => {
    render(
      <BettingCard
        {...makeProps({
          data: {
            matchup: 'Lakers @ Celtics',
            homeOdds: '-150',
            awayOdds: '+130',
          },
        })}
      />
    );
    // implied prob for -150 = 150/(150+100) = 60%
    expect(screen.getByText('60% win')).toBeTruthy();
  });

  it('shows FINAL badge when status=FINAL', () => {
    render(
      <BettingCard
        {...makeProps({
          data: {
            matchup: 'Lakers @ Celtics',
            status: 'FINAL',
            finalScore: '110-105',
          },
        })}
      />
    );
    expect(screen.getByText('FINAL')).toBeTruthy();
  });

  it('shows final score in center when status is FINAL', () => {
    render(
      <BettingCard
        {...makeProps({
          data: {
            matchup: 'Lakers @ Celtics',
            finalScore: '110-105',
          },
        })}
      />
    );
    expect(screen.getByText('110-105')).toBeTruthy();
  });
});

// ============================================================================
// Live badge
// ============================================================================

describe('BettingCard — live badge', () => {
  it('shows LIVE indicator when realData=true', () => {
    render(
      <BettingCard
        {...makeProps({
          data: { realData: true },
        })}
      />
    );
    expect(screen.getByText('LIVE')).toBeTruthy();
  });

  it('does not show LIVE indicator when realData=false', () => {
    render(
      <BettingCard
        {...makeProps({
          data: { realData: false },
        })}
      />
    );
    expect(screen.queryByText('LIVE')).toBeNull();
  });
});

// ============================================================================
// Odds grid
// ============================================================================

describe('BettingCard — odds grid', () => {
  it('renders O/U total when overUnder is provided', () => {
    render(
      <BettingCard
        {...makeProps({
          data: {
            matchup: 'Lakers @ Celtics',
            overUnder: 'O/U 220.5',
          },
        })}
      />
    );
    expect(screen.getByText('220.5')).toBeTruthy();
  });
});

// ============================================================================
// Player prop mode
// ============================================================================

describe('BettingCard — player prop mode', () => {
  it('renders player name when data.player is set', () => {
    render(
      <BettingCard
        {...makeProps({
          subcategory: 'Player Prop',
          data: { player: 'Aaron Judge', stat: 'Home Runs', odds: '+150' },
        })}
      />
    );
    // Player name appears in both the prop header and PlayerAvatar mock
    expect(screen.getAllByText('Aaron Judge').length).toBeGreaterThanOrEqual(1);
  });

  it('renders stat type for player prop', () => {
    render(
      <BettingCard
        {...makeProps({
          subcategory: 'Player Prop',
          data: { player: 'Aaron Judge', stat: 'Total Bases' },
        })}
      />
    );
    expect(screen.getByText('Total Bases')).toBeTruthy();
  });

  it('renders PlayerAvatar for player props', () => {
    render(
      <BettingCard
        {...makeProps({
          subcategory: 'Player Prop',
          data: { player: 'Shohei Ohtani' },
        })}
      />
    );
    expect(screen.getByTestId('player-avatar')).toBeTruthy();
  });
});

// ============================================================================
// Market intelligence panel
// ============================================================================

describe('BettingCard — market intelligence', () => {
  it('shows confidence bar when confidence is provided', () => {
    render(
      <BettingCard
        {...makeProps({
          data: { confidence: 75 },
        })}
      />
    );
    expect(screen.getByText('Model Confidence')).toBeTruthy();
    expect(screen.getByText('75%')).toBeTruthy();
  });

  it('shows sharp money bar when sharpPct is provided', () => {
    render(
      <BettingCard
        {...makeProps({
          data: { sharpPct: 65 },
        })}
      />
    );
    expect(screen.getByText('Sharp Money')).toBeTruthy();
    expect(screen.getByText('65%')).toBeTruthy();
  });
});

// ============================================================================
// Alerts
// ============================================================================

describe('BettingCard — alerts', () => {
  it('renders injury alert when provided', () => {
    render(
      <BettingCard
        {...makeProps({
          data: { injuryAlert: 'QB listed as questionable' },
        })}
      />
    );
    expect(screen.getByText('QB listed as questionable')).toBeTruthy();
  });

  it('renders weather note when provided', () => {
    render(
      <BettingCard
        {...makeProps({
          data: { weatherNote: 'Wind 25 mph, expect under pressure' },
        })}
      />
    );
    expect(screen.getByText('Wind 25 mph, expect under pressure')).toBeTruthy();
  });

  it('renders recommendation when provided', () => {
    render(
      <BettingCard
        {...makeProps({
          data: { recommendation: 'Bet the under — wind forecast unfavorable' },
        })}
      />
    );
    expect(screen.getByText('Bet the under — wind forecast unfavorable')).toBeTruthy();
  });
});

// ============================================================================
// Footer
// ============================================================================

describe('BettingCard — footer', () => {
  it('renders bookmaker name when provided', () => {
    render(
      <BettingCard
        {...makeProps({
          data: { bookmaker: 'DraftKings' },
        })}
      />
    );
    expect(screen.getByText('DraftKings')).toBeTruthy();
  });

  it('renders Analyze button when onAnalyze is provided', () => {
    const onAnalyze = vi.fn();
    render(<BettingCard {...makeProps({ onAnalyze })} />);
    expect(screen.getByText('Full Analysis')).toBeTruthy();
  });

  it('does not render Analyze button when onAnalyze is omitted', () => {
    render(<BettingCard {...makeProps()} />);
    expect(screen.queryByText('Full Analysis')).toBeNull();
  });
});
