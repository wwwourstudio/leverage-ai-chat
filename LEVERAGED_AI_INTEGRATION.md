# LeveragedAI Integration Documentation

## Overview

**LeveragedAI** is a powerful abstraction layer that combines Supabase database operations with Grok 4 AI intelligence to create smarter, more efficient data workflows. Instead of treating database operations and AI analysis as separate concerns, LeveragedAI unifies them into a cohesive system where AI enhances every data interaction.

## What is LeveragedAI?

LeveragedAI provides:

1. **AI-Enhanced Queries** - Fetch data from Supabase and automatically generate insights
2. **Intelligent Data Enrichment** - Add AI-generated fields to database records
3. **AI-Validated Insertions** - Validate data quality before storing using Grok 4
4. **Smart Caching** - Reduce database load with AI-powered optimization
5. **Seamless Fallbacks** - Gracefully handle database or AI unavailability

## Architecture

```
┌─────────────────┐
│   Application   │
│     Layer       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LeveragedAI    │ ◄─── Unified AI + DB Layer
│   (lib/         │
│  leveraged-ai)  │
└────┬───────┬────┘
     │       │
     ▼       ▼
┌─────────┐ ┌──────────┐
│Supabase │ │  Grok 4  │
│   DB    │ │    AI    │
└─────────┘ └──────────┘
```

## Key Features

### 1. AI-Enhanced Queries

Fetch data and optionally process it with AI in a single operation:

```typescript
import { queryWithAI } from '@/lib/leveraged-ai';

const result = await queryWithAI(
  'ai_response_trust',
  (builder) => builder
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100),
  {
    enableAIProcessing: true,
    aiContext: 'Analyzing betting performance',
    summarize: true,
    enrichWithInsights: true,
    timeout: 2000
  }
);

// Result includes:
// - result.data: Raw database records
// - result.aiSummary: AI-generated summary
// - result.aiInsights: Key insights and patterns
// - result.processingTime: Total time taken
```

### 2. Data Enrichment with AI

Add AI-generated content to records:

```typescript
import { enrichWithAI } from '@/lib/leveraged-ai';

const bets = await fetchBets();
const enrichedBets = await enrichWithAI(
  bets,
  (bet) => `Analyze this ${bet.sport} bet: ${bet.description}. Provide a risk assessment.`,
  'riskAnalysis'
);

// Each record now has an 'riskAnalysis' field
```

### 3. AI-Validated Insertions

Validate data quality before storing:

```typescript
import { getLeveragedAI } from '@/lib/leveraged-ai';

const leveragedAI = getLeveragedAI();
const result = await leveragedAI.insertWithAIValidation(
  'ai_response_trust',
  trustMetricsData,
  'Trust metrics for sports betting AI analysis'
);

if (result.success) {
  console.log('Data stored successfully');
  if (result.aiValidation) {
    console.log('AI validation:', result.aiValidation);
  }
}
```

## Integration Points

### API Routes Refactored

#### 1. `/api/insights/route.ts`

**Before:**
- Manual Supabase client creation
- Separate query and AI processing
- Complex error handling

**After:**
- Single `queryWithAI` call
- AI insights automatically included
- Simplified error handling
- Better performance with built-in timeouts

```typescript
// New approach
const queryResult = await queryWithAI(
  APP_TABLES.AI_RESPONSE_TRUST,
  (builder) => builder.select('*').order('created_at', { ascending: false }).limit(100),
  {
    enableAIProcessing: true,
    aiContext: 'Analyzing betting prediction performance metrics',
    summarize: true,
    timeout: 2000
  }
);

return NextResponse.json({
  insights,
  aiSummary: queryResult.aiSummary, // ← AI-generated summary
  aiInsights: queryResult.aiInsights, // ← AI-generated insights
  processingTime: queryResult.processingTime
});
```

#### 2. `/api/analyze/route.ts`

**Before:**
- Direct Supabase operations
- Manual trust metric storage
- Separate historical accuracy calculation

**After:**
- LeveragedAI for AI-validated insertions
- Unified trust metrics storage
- AI-enhanced historical analysis

```typescript
// Store with AI validation
await leveragedAI.insertWithAIValidation(
  APP_TABLES.AI_RESPONSE_TRUST,
  metricsData,
  'Trust metrics for sports betting AI analysis'
);

// Historical accuracy with AI
const queryResult = await leveragedAI.queryWithAI(
  APP_TABLES.AI_RESPONSE_TRUST,
  (builder) => builder.select('final_confidence').eq('model_id', AI_CONFIG.MODEL_NAME),
  { timeout: 1000 }
);
```

## Benefits

### 1. Code Simplification
- **Before**: ~50 lines for query + AI processing
- **After**: ~10 lines with `queryWithAI`

### 2. Better Error Handling
- Unified error handling across DB and AI
- Graceful fallbacks when either service is unavailable
- Built-in timeouts prevent hanging requests

### 3. Performance Optimization
- Parallel execution of DB queries and AI processing where possible
- Smart caching reduces redundant operations
- Configurable timeouts prevent slow queries

### 4. Enhanced Functionality
- AI insights on every query (optional)
- Data validation before insertion
- Automatic enrichment capabilities
- Better observability with detailed logging

### 5. Maintainability
- Single source of truth for DB + AI operations
- Consistent patterns across the codebase
- Easy to test and mock
- Clear separation of concerns

## Configuration

LeveragedAI requires:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Grok AI Configuration
XAI_API_KEY=your_xai_api_key
```

## Usage Patterns

### Pattern 1: Simple Query (No AI)

```typescript
const result = await queryWithAI('table_name', 
  (builder) => builder.select('*'),
  { enableAIProcessing: false } // Fast, database-only
);
```

### Pattern 2: Query with AI Summary

```typescript
const result = await queryWithAI('table_name',
  (builder) => builder.select('*'),
  {
    enableAIProcessing: true,
    summarize: true,
    timeout: 2000
  }
);
console.log(result.aiSummary);
```

### Pattern 3: Query with Full AI Analysis

```typescript
const result = await queryWithAI('table_name',
  (builder) => builder.select('*'),
  {
    enableAIProcessing: true,
    enrichWithInsights: true,
    summarize: true,
    aiContext: 'Looking for trends in betting patterns',
    timeout: 3000
  }
);
console.log(result.aiInsights); // Patterns and trends
console.log(result.aiSummary); // Concise summary
```

### Pattern 4: Batch Enrichment

```typescript
const leveragedAI = getLeveragedAI();
const enriched = await leveragedAI.enrichRecordsWithAI(
  records,
  (record) => `Analyze: ${record.description}`,
  'aiAnalysis'
);
```

## API Reference

### `queryWithAI<T>(tableName, queryBuilder, options)`

Fetch data with optional AI processing.

**Parameters:**
- `tableName`: Database table name
- `queryBuilder`: Function to build Supabase query
- `options`: Configuration object
  - `enableAIProcessing`: Enable AI analysis (default: false)
  - `aiContext`: Context for AI analysis
  - `enrichWithInsights`: Generate insights (default: false)
  - `summarize`: Generate summary (default: false)
  - `timeout`: Query timeout in ms (default: 5000)

**Returns:**
```typescript
{
  success: boolean;
  data: T[];
  aiInsights?: string;
  aiSummary?: string;
  source: 'database' | 'cache' | 'fallback';
  processingTime: number;
  error?: string;
}
```

### `enrichWithAI<T>(records, enrichmentPrompt, enrichmentField)`

Add AI-generated fields to records.

**Parameters:**
- `records`: Array of records to enrich
- `enrichmentPrompt`: Function that takes a record and returns a prompt
- `enrichmentField`: Name of the field to add (default: 'aiEnrichment')

**Returns:**
```typescript
T[] // Records with added AI field
```

### `getLeveragedAI()`

Get singleton LeveragedAI instance.

**Returns:** `LeveragedAI` instance

### Class: `LeveragedAI`

#### Methods:

- `isReady()`: Check if both Supabase and Grok AI are initialized
- `queryWithAI<T>(...)`: AI-enhanced query
- `enrichRecordsWithAI<T>(...)`: Batch enrichment
- `insertWithAIValidation<T>(...)`: Validated insertion
- `getSupabaseClient()`: Get raw Supabase client for advanced operations

## Migration Guide

### Migrating Existing Code

**Step 1: Import LeveragedAI**

```typescript
// Before
import { createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';

// After
import { queryWithAI, getLeveragedAI } from '@/lib/leveraged-ai';
```

**Step 2: Replace Query Logic**

```typescript
// Before
const supabase = createClient(url, key);
const { data, error } = await supabase.from('table').select('*');
// ... then separate AI processing

// After
const result = await queryWithAI('table',
  (builder) => builder.select('*'),
  { enableAIProcessing: true, summarize: true }
);
```

**Step 3: Use AI-Enhanced Features**

```typescript
// Add AI insights to responses
return NextResponse.json({
  ...existingData,
  aiSummary: result.aiSummary,
  aiInsights: result.aiInsights
});
```

## Best Practices

1. **Use Timeouts**: Always set reasonable timeouts to prevent hanging
2. **Enable AI Selectively**: Only use AI processing when needed to save costs
3. **Cache Results**: LeveragedAI handles caching, but consider additional app-level caching
4. **Handle Fallbacks**: Always provide fallback data for when services are unavailable
5. **Monitor Performance**: Use `processingTime` to track and optimize queries
6. **Validate Context**: Provide clear `aiContext` for better AI analysis
7. **Test Graceful Degradation**: Ensure app works when AI or DB is down

## Performance Considerations

- **AI Processing**: Adds 1-3 seconds to queries
- **Timeouts**: Default 5 seconds, configurable
- **Caching**: Results cached for 5 minutes
- **Parallel Execution**: DB and AI run in parallel when possible
- **Fallback Speed**: Instant fallback to cached or default data

## Future Enhancements

- [ ] Vector embeddings for semantic search
- [ ] Multi-model AI support (GPT-4, Claude, etc.)
- [ ] Advanced caching strategies (Redis integration)
- [ ] Real-time data sync with AI processing
- [ ] Batch processing optimization
- [ ] Custom AI model fine-tuning support
- [ ] Performance analytics dashboard

## Troubleshooting

### Issue: AI not generating insights

**Solution:**
- Check `XAI_API_KEY` is set
- Verify `enableAIProcessing: true` in options
- Check logs for AI service errors

### Issue: Queries timing out

**Solution:**
- Increase `timeout` value in options
- Optimize database queries (add indexes)
- Reduce `limit` on select queries
- Disable AI processing temporarily

### Issue: Database connection failed

**Solution:**
- Verify Supabase credentials
- Check network connectivity
- Ensure Supabase project is active (not paused)
- Reconnect integration in v0 project settings

## Support

For issues or questions:
1. Check logs with `console.log` statements
2. Review error messages in API responses
3. Verify all environment variables are set
4. Test database connectivity separately
5. Confirm Grok 4 API access

## Conclusion

LeveragedAI represents a paradigm shift from treating databases and AI as separate systems to a unified approach where intelligence is built into every data operation. This refactoring improves code quality, performance, and maintainability while unlocking new capabilities through AI-enhanced workflows.
