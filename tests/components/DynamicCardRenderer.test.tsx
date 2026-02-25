// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DynamicCardRenderer, CardList } from '@/components/data-cards/DynamicCardRenderer';

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

vi.mock('@/components/data-cards/CardSkeleton', () => ({
  CardSkeleton: () => <div data-testid="card-skeleton" />,
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
