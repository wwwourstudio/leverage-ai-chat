# Data Cards Component System

## Overview

A modular, scalable component architecture for displaying live data from multiple sources including Sports Odds API, Grok AI, Supabase, and Weather APIs.

## Architecture

### Core Components

- **BaseCard**: Reusable card wrapper with loading, error, and empty states
- **DynamicCardRenderer**: Smart component that routes cards to appropriate specialized components
- **CardSkeleton**: Loading state skeletons for better UX
- **DataRow/DataGrid**: Flexible data display components

### Specialized Cards

1. **BettingCard** - Sports betting odds, spreads, moneylines, totals
2. **DFSCard** - Daily Fantasy Sports lineup strategies
3. **FantasyCard** - Season-long fantasy insights
4. **KalshiCard** - Prediction market opportunities
5. **WeatherCard** - Game weather conditions and impact analysis

## Usage

### Basic Implementation

```tsx
import { DynamicCardRenderer } from '@/components/data-cards';

<DynamicCardRenderer
  card={cardData}
  onAnalyze={(card) => handleAnalysis(card)}
/>
```

### Card List

```tsx
import { CardList } from '@/components/data-cards';

<CardList
  cards={cards}
  onAnalyze={handleAnalysis}
  isLoading={loading}
/>
```

### Loading States

```tsx
import { CardSkeleton, CardGrid } from '@/components/data-cards';

<CardGrid count={3} /> // Shows 3 skeleton cards
```

## Card Data Structure

```typescript
interface CardData {
  type: string;           // Card type identifier
  title: string;          // Card title
  category: string;       // Main category (e.g., "NBA", "DFS")
  subcategory: string;    // Sub-category (e.g., "Point Spread")
  gradient: string;       // Tailwind gradient classes
  data: Record<string, string | number>;  // Key-value pairs
  status: string;         // Status badge (hot, value, optimal, etc.)
  realData?: boolean;     // Indicates live vs simulated data
}
```

## Styling

### Category-Specific Colors

The system uses semantic design tokens defined in `globals.css`:

- **Betting**: Orange/Red (`--betting-accent`)
- **DFS**: Purple (`--dfs-accent`)
- **Fantasy**: Green/Teal (`--fantasy-accent`)
- **Kalshi**: Cyan/Blue (`--kalshi-accent`)
- **Weather**: Blue/Gray (`--weather-accent`)

### Status Badges

Cards automatically display status badges based on data significance:
- 🔥 HOT - High-value opportunity
- 📈 VALUE - Good value play
- 🎯 OPTIMAL - Best available option
- ⚡ EDGE - Market inefficiency detected
- 🏆 ELITE - Premium selection

## State Management

### Loading State
Cards show skeleton loaders while fetching data.

### Error State
Displays user-friendly error messages with retry options.

### Empty State
Shows helpful messages when no data is available.

## API Integration

Cards automatically fetch data from:

1. **Sports Odds API** - Live betting lines
2. **Grok AI** - Intelligent insights
3. **Supabase** - Historical data
4. **Weather API** - Game conditions

## Weather Integration

Weather cards are automatically generated for NFL and MLB games when:
- Stadium location data is available
- Weather conditions are significant enough to impact gameplay

Weather impacts include:
- Wind speed effects on passing game
- Precipitation and ball handling
- Temperature extremes
- Snow/ice conditions

## Performance

- Components are client-side only (`'use client'`)
- Skeleton loaders prevent layout shift
- Responsive grid automatically adjusts columns
- Hover effects use GPU-accelerated transforms

## Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- Screen reader friendly labels
- Color contrast meets WCAG AA standards

## Future Enhancements

- [ ] Card favoriting/pinning
- [ ] Real-time data updates via WebSocket
- [ ] Card sharing functionality
- [ ] Advanced filtering and sorting
- [ ] Historical data comparison views
- [ ] Mobile swipe gestures
- [ ] Card animations and transitions
