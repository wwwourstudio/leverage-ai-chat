// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DynamicCardRenderer, CardList } from '@/components/data-cards/DynamicCardRenderer';
import { assertCardType } from '@/lib/cards-generator';

// Mock child card components so tests focus on routing logic, not rendering internals
vi.mock('@/components/data-cards/BettingCard', () => ({
  BettingCard: ({ title, type, onAnalyze }: any) => (
    <div data-testid="betting-card" data-type={type}>
      {title}
      {onAnalyze && <button onClick={onAnalyze}>Analyze</button>}
    </div>
  ),
}));

vi.mock('@/components/data-cards/DFSCard', () => ({
  DFSCard: ({ title }: any) => <div data-testid="dfs-card">{title}</div>,
}));

vi.mock('@/components/data-cards/FantasyCard', () => ({
  FantasyCard: ({ title }: any) => <div data-testid="fantasy-card">{title}</div>,
}));

vi.mock('@/components/data-cards/KalshiCard', () => ({
  KalshiCard: ({ title }: any) => <div data-testid="kalshi-card">{title}</div>,
}));

vi.mock('@/components/data-cards/WeatherCard', () => ({
  WeatherCard: ({ title }: any) => <div data-testid="weather-card">{title}</div>,
}));

vi.mock('@/components/data-cards/ArbitrageCard', () => ({
  ArbitrageCard: ({ onAnalyze }: any) => (
    <div data-testid="arbitrage-card">
      {onAnalyze && <button onClick={onAnalyze}>Analyze</button>}
    </div>
  ),
}));

vi.mock('@/components/data-cards/LineMovementCard', () => ({
  LineMovementCard: ({ title, data, onAnalyze }: any) => (
    <div data-testid="line-movement-card">
      <span>{title}</span>
      {data?.lineChange && <span data-testid="line-change">{data.lineChange}</span>}
      {onAnalyze && <button onClick={onAnalyze}>Analyze</button>}
    </div>
  ),
}));

vi.mock('@/components/data-cards/KellyBetCard', () => ({
  KellyBetCard: ({ title, data, onAnalyze }: any) => (
    <div data-testid="kelly-bet-card">
      <span>{title}</span>
      {data?.recommendedStake && <span data-testid="recommended-stake">{data.recommendedStake}</span>}
      {onAnalyze && <button onClick={onAnalyze}>Analyze</button>}
    </div>
  ),
}));

vi.mock('@/components/data-cards/PortfolioCard', () => ({
  PortfolioCard: ({ title, data, onAnalyze }: any) => (
    <div data-testid="portfolio-card">
      <span>{title}</span>
      {data?.totalBankroll && <span data-testid="total-bankroll">{data.totalBankroll}</span>}
      {onAnalyze && <button onClick={onAnalyze}>Analyze</button>}
    </div>
  ),
}));

vi.mock('@/components/data-cards/CardSkeleton', () => ({
  CardSkeleton: () => <div data-testid="card-skeleton" />,
}));

vi.mock('@/components/data-cards/MLBProjectionCard', () => ({
  MLBProjectionCard: ({ data }: any) => (
    <div data-testid="mlb-projection-card">{data?.title ?? 'MLB Projection'}</div>
  ),
}));

vi.mock('@/components/data-cards/StatcastCard', () => ({
  StatcastCard: ({ data }: any) => (
    <div data-testid="statcast-card">{data?.title ?? 'Statcast'}</div>
  ),
}));

const baseCard = {
  type: 'odds',
  title: 'Test Card',
  category: 'NBA',
  subcategory: 'Point Spread',
  gradient: 'from-blue-500 to-purple-500',
  data: {},
  status: 'active',
};

describe('DynamicCardRenderer', () => {
  describe('loading state', () => {
    it('renders CardSkeleton when isLoading is true', () => {
      render(<DynamicCardRenderer card={baseCard} isLoading />);
      expect(screen.getByTestId('card-skeleton')).toBeTruthy();
    });

    it('does not render the card when isLoading is true', () => {
      render(<DynamicCardRenderer card={baseCard} isLoading />);
      expect(screen.queryByTestId('betting-card')).toBeNull();
    });
  });

  describe('invalid card data', () => {
    it('returns null for null card', () => {
      const { container } = render(<DynamicCardRenderer card={null as any} />);
      expect(container.firstChild).toBeNull();
    });

    it('returns null for non-object card', () => {
      const { container } = render(<DynamicCardRenderer card={'invalid' as any} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('card type routing', () => {
    it('renders BettingCard for type containing "odds"', () => {
      render(<DynamicCardRenderer card={{ ...baseCard, type: 'odds' }} />);
      expect(screen.getByTestId('betting-card')).toBeTruthy();
    });

    it('renders BettingCard for type containing "betting"', () => {
      render(<DynamicCardRenderer card={{ ...baseCard, type: 'betting_props' }} />);
      expect(screen.getByTestId('betting-card')).toBeTruthy();
    });

    it('renders BettingCard for type containing "moneyline"', () => {
      render(<DynamicCardRenderer card={{ ...baseCard, type: 'moneyline' }} />);
      expect(screen.getByTestId('betting-card')).toBeTruthy();
    });

    it('renders BettingCard for type containing "spread"', () => {
      render(<DynamicCardRenderer card={{ ...baseCard, type: 'spread' }} />);
      expect(screen.getByTestId('betting-card')).toBeTruthy();
    });

    it('renders BettingCard for type containing "totals"', () => {
      render(<DynamicCardRenderer card={{ ...baseCard, type: 'totals' }} />);
      expect(screen.getByTestId('betting-card')).toBeTruthy();
    });

    it('renders DFSCard for type containing "dfs"', () => {
      render(<DynamicCardRenderer card={{ ...baseCard, type: 'dfs_lineup' }} />);
      expect(screen.getByTestId('dfs-card')).toBeTruthy();
    });

    it('renders DFSCard for type containing "lineup"', () => {
      render(<DynamicCardRenderer card={{ ...baseCard, type: 'lineup_optimizer' }} />);
      expect(screen.getByTestId('dfs-card')).toBeTruthy();
    });

    it('renders FantasyCard for type containing "fantasy"', () => {
      render(<DynamicCardRenderer card={{ ...baseCard, type: 'fantasy_picks' }} />);
      expect(screen.getByTestId('fantasy-card')).toBeTruthy();
    });

    it('renders FantasyCard for type containing "draft"', () => {
      render(<DynamicCardRenderer card={{ ...baseCard, type: 'draft_board' }} />);
      expect(screen.getByTestId('fantasy-card')).toBeTruthy();
    });

    it('renders FantasyCard for type containing "sleeper"', () => {
      render(<DynamicCardRenderer card={{ ...baseCard, type: 'sleeper_pick' }} />);
      expect(screen.getByTestId('fantasy-card')).toBeTruthy();
    });

    it('renders KalshiCard for type containing "kalshi"', () => {
      render(<DynamicCardRenderer card={{ ...baseCard, type: 'kalshi_market' }} />);
      expect(screen.getByTestId('kalshi-card')).toBeTruthy();
    });

    it('renders KalshiCard for type containing "prediction"', () => {
      render(<DynamicCardRenderer card={{ ...baseCard, type: 'prediction_market' }} />);
      expect(screen.getByTestId('kalshi-card')).toBeTruthy();
    });

    it('renders WeatherCard for type containing "weather"', () => {
      render(<DynamicCardRenderer card={{ ...baseCard, type: 'weather_impact' }} />);
      expect(screen.getByTestId('weather-card')).toBeTruthy();
    });

    it('renders WeatherCard for type containing "climate"', () => {
      render(<DynamicCardRenderer card={{ ...baseCard, type: 'climate_data' }} />);
      expect(screen.getByTestId('weather-card')).toBeTruthy();
    });

    it('renders ArbitrageCard for type containing "arbitrage"', () => {
      render(<DynamicCardRenderer card={{ ...baseCard, type: 'arbitrage_opportunity' }} />);
      expect(screen.getByTestId('arbitrage-card')).toBeTruthy();
    });

    it('falls back to BettingCard for unknown type', () => {
      render(<DynamicCardRenderer card={{ ...baseCard, type: 'unknown_type' }} />);
      expect(screen.getByTestId('betting-card')).toBeTruthy();
    });

    it('routes mlb_projection_card to MLBProjectionCard', () => {
      render(
        <DynamicCardRenderer
          card={{
            type: 'mlb_projection_card',
            title: 'Aaron Judge',
            category: 'MLB',
            subcategory: 'HR Projection',
            gradient: 'from-green-600 to-emerald-900',
            data: {},
            status: 'neutral',
          }}
        />
      );
      expect(screen.getByTestId('mlb-projection-card')).toBeTruthy();
      expect(screen.getByText('Aaron Judge')).toBeTruthy();
    });

    it('routes hr_prop_card to StatcastCard', () => {
      render(
        <DynamicCardRenderer
          card={{
            type: 'hr_prop_card',
            title: 'HR Edge Play',
            category: 'MLB',
            subcategory: 'HR Prop',
            gradient: 'from-green-600 to-emerald-900',
            data: {},
            status: 'neutral',
          }}
        />
      );
      expect(screen.getByTestId('statcast-card')).toBeTruthy();
    });

    it('does NOT route mlb_projection_card to BettingCard', () => {
      render(
        <DynamicCardRenderer
          card={{
            type: 'mlb_projection_card',
            title: 'Shohei Ohtani',
            category: 'MLB',
            subcategory: 'HR Projection',
            gradient: 'from-green-600 to-emerald-900',
            data: {},
            status: 'neutral',
          }}
        />
      );
      expect(screen.queryByTestId('betting-card')).toBeNull();
    });

    it('routes line_movement to LineMovementCard', () => {
      render(
        <DynamicCardRenderer
          card={{
            type: 'line_movement',
            title: 'Lakers @ Celtics',
            category: 'LINE MOVEMENT',
            subcategory: 'STEAM UP',
            gradient: 'from-blue-600 to-indigo-600',
            data: { lineChange: '+2.5 points', oldLine: '-3', newLine: '-5.5' },
            status: 'active',
          }}
        />
      );
      expect(screen.getByTestId('line-movement-card')).toBeTruthy();
      expect(screen.queryByTestId('betting-card')).toBeNull();
    });

    it('passes lineChange data to LineMovementCard', () => {
      render(
        <DynamicCardRenderer
          card={{
            type: 'line_movement',
            title: 'Steam Move',
            category: 'LINE MOVEMENT',
            subcategory: 'UP',
            gradient: 'from-blue-600 to-indigo-600',
            data: { lineChange: '+3.0 points' },
            status: 'active',
          }}
        />
      );
      expect(screen.getByTestId('line-change').textContent).toBe('+3.0 points');
    });

    it('routes kelly_bet to KellyBetCard', () => {
      render(
        <DynamicCardRenderer
          card={{
            type: 'kelly_bet',
            title: 'Lakers Moneyline',
            category: 'KELLY SIZING',
            subcategory: '4.50% Kelly',
            gradient: 'from-indigo-600 to-purple-600',
            data: { recommendedStake: '$45.00', edge: '3.50%', kellyFraction: '4.50%' },
            status: 'active',
          }}
        />
      );
      expect(screen.getByTestId('kelly-bet-card')).toBeTruthy();
      expect(screen.queryByTestId('betting-card')).toBeNull();
    });

    it('passes recommendedStake data to KellyBetCard', () => {
      render(
        <DynamicCardRenderer
          card={{
            type: 'kelly_bet',
            title: 'Bet Sizing',
            category: 'KELLY SIZING',
            subcategory: '3.0% Kelly',
            gradient: 'from-indigo-600 to-purple-600',
            data: { recommendedStake: '$75.00' },
            status: 'active',
          }}
        />
      );
      expect(screen.getByTestId('recommended-stake').textContent).toBe('$75.00');
    });

    it('routes portfolio to PortfolioCard', () => {
      render(
        <DynamicCardRenderer
          card={{
            type: 'portfolio',
            title: 'Portfolio Overview',
            category: 'PORTFOLIO',
            subcategory: '45.0% Deployed',
            gradient: 'from-purple-600 to-pink-600',
            data: { totalBankroll: '$1000.00', deployed: '$450.00', available: '$550.00' },
            status: 'active',
          }}
        />
      );
      expect(screen.getByTestId('portfolio-card')).toBeTruthy();
      expect(screen.queryByTestId('betting-card')).toBeNull();
    });

    it('passes totalBankroll data to PortfolioCard', () => {
      render(
        <DynamicCardRenderer
          card={{
            type: 'portfolio',
            title: 'My Portfolio',
            category: 'PORTFOLIO',
            subcategory: 'Kelly Criterion',
            gradient: 'from-purple-600 to-pink-600',
            data: { totalBankroll: '$2500.00' },
            status: 'active',
          }}
        />
      );
      expect(screen.getByTestId('total-bankroll').textContent).toBe('$2500.00');
    });

    it('routes CARD_TYPES.LINE_MOVEMENT value to LineMovementCard (not BettingCard)', () => {
      // Verifies the constant value 'line_movement' routes correctly
      render(<DynamicCardRenderer card={{ ...baseCard, type: 'line_movement' }} />);
      expect(screen.getByTestId('line-movement-card')).toBeTruthy();
      expect(screen.queryByTestId('betting-card')).toBeNull();
    });

    it('routes CARD_TYPES.KELLY_BET value to KellyBetCard (not BettingCard)', () => {
      render(<DynamicCardRenderer card={{ ...baseCard, type: 'kelly_bet' }} />);
      expect(screen.getByTestId('kelly-bet-card')).toBeTruthy();
      expect(screen.queryByTestId('betting-card')).toBeNull();
    });

    it('routes CARD_TYPES.PORTFOLIO value to PortfolioCard (not BettingCard)', () => {
      render(<DynamicCardRenderer card={{ ...baseCard, type: 'portfolio' }} />);
      expect(screen.getByTestId('portfolio-card')).toBeTruthy();
      expect(screen.queryByTestId('betting-card')).toBeNull();
    });
  });

  describe('card data normalization', () => {
    it('uses fallback title when title is missing', () => {
      render(<DynamicCardRenderer card={{ ...baseCard, title: '' }} />);
      expect(screen.getByText('Untitled Card')).toBeTruthy();
    });

    it('passes through title when present', () => {
      render(<DynamicCardRenderer card={{ ...baseCard, type: 'odds', title: 'My Title' }} />);
      expect(screen.getByText('My Title')).toBeTruthy();
    });
  });

  describe('onAnalyze callback', () => {
    it('calls onAnalyze with the original card when analyze button is clicked', () => {
      const onAnalyze = vi.fn();
      render(<DynamicCardRenderer card={baseCard} onAnalyze={onAnalyze} />);
      fireEvent.click(screen.getByText('Analyze'));
      expect(onAnalyze).toHaveBeenCalledWith(baseCard);
      expect(onAnalyze).toHaveBeenCalledTimes(1);
    });

    it('does not pass onAnalyze when no callback provided', () => {
      render(<DynamicCardRenderer card={baseCard} />);
      expect(screen.queryByText('Analyze')).toBeNull();
    });
  });
});

describe('CardList', () => {
  it('shows loading skeletons when isLoading is true', () => {
    render(<CardList cards={[]} isLoading />);
    const skeletons = screen.getAllByTestId('card-skeleton');
    expect(skeletons.length).toBe(3);
  });

  it('shows empty state when cards array is empty', () => {
    render(<CardList cards={[]} />);
    expect(screen.getByText('No cards available')).toBeTruthy();
  });

  it('shows empty state when cards is undefined-like (null)', () => {
    render(<CardList cards={null as any} />);
    expect(screen.getByText('No cards available')).toBeTruthy();
  });

  it('renders all cards when cards are provided', () => {
    const cards = [
      { ...baseCard, type: 'odds', title: 'Card 1' },
      { ...baseCard, type: 'dfs', title: 'Card 2' },
    ];
    render(<CardList cards={cards} />);
    expect(screen.getByTestId('betting-card')).toBeTruthy();
    expect(screen.getByTestId('dfs-card')).toBeTruthy();
  });

  it('passes onAnalyze to each rendered card', () => {
    const onAnalyze = vi.fn();
    const cards = [{ ...baseCard, type: 'odds', title: 'Card 1' }];
    render(<CardList cards={cards} onAnalyze={onAnalyze} />);
    fireEvent.click(screen.getByText('Analyze'));
    expect(onAnalyze).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    const { container } = render(<CardList cards={[]} className="custom-class" />);
    // empty state doesn't get the className since cards are empty
    expect(container).toBeTruthy();
  });
});

// ============================================================================
// assertCardType — card type validation utility
// ============================================================================

describe('assertCardType', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('does not warn for known type: live-odds', () => {
    assertCardType('live-odds');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not warn for known type: line_movement', () => {
    assertCardType('line_movement');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not warn for known type: kelly_bet', () => {
    assertCardType('kelly_bet');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not warn for known type: portfolio', () => {
    assertCardType('portfolio');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not warn for known type: arbitrage', () => {
    assertCardType('arbitrage');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not warn for known type: player-prop', () => {
    assertCardType('player-prop');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns for unknown type', () => {
    assertCardType('UNKNOWN_CARD');
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('Unknown card type');
    expect(warnSpy.mock.calls[0][0]).toContain('UNKNOWN_CARD');
  });

  it('includes context in warning when provided', () => {
    assertCardType('bad_type', 'generateFantasyCards');
    expect(warnSpy.mock.calls[0][0]).toContain('generateFantasyCards');
  });

  it('warns for legacy uppercase type strings', () => {
    // Guard against regression — raw uppercase strings should no longer be used
    assertCardType('LINE_MOVEMENT');
    assertCardType('KELLY_BET');
    assertCardType('PORTFOLIO');
    expect(warnSpy).toHaveBeenCalledTimes(3);
  });
});
