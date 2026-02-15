### 1. Deploy Database Schema

Execute in Supabase SQL Editor:

```bash
# Run: /scripts/quantitative-trading-schema.sql
# Creates 11 tables, indexes, and helper functions
# Initializes default capital state: $10k, 25% risk, 5% max position
```

### 2. Use the System

```typescript
import { allocateCapital } from '@/lib/allocator';

const opportunities = [
  {
    market_id: 'nba_lakers_ml',
    prob: 0.58,         // Your model's probability
    odds: +120,         // American odds from bookmaker
    edge: 0.045,        // 4.5% edge
    confidence: 0.85,   // 85% confidence in model
    sport: 'NBA',
    matchup: 'Lakers @ Celtics'
  }
];

const result = allocateCapital({
  opportunities,
  totalCapital: 10000,
  riskBudget: 0.25,          // 25% max at risk
  maxSinglePosition: 0.05,   // 5% max per bet
  kellyScale: 0.25           // 1/4 Kelly
});

// Result:
// {
//   allocations: [{ allocated_capital: 382.50, ... }],
//   totalAllocated: 382.50,
//   remainingCapital: 9617.50,
//   utilizationRate: 0.153  // 15.3% of risk budget used
// }
```

---