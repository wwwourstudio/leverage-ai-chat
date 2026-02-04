# Supabase Validation System

## Overview

Comprehensive error handling and data validation for Supabase database operations, preventing JSON parsing errors and gracefully handling missing tables or invalid data.

## Problem Solved

**Before:** Application would crash with "Invalid JSON" errors when:
- Database tables don't exist yet
- Supabase returns malformed data
- Row Level Security (RLS) blocks queries
- Network issues cause incomplete responses

**After:** Application gracefully degrades with:
- ✅ Table existence checks before queries
- ✅ Response validation and sanitization
- ✅ Schema validation for data integrity
- ✅ Intelligent caching to reduce API calls
- ✅ Detailed error logging for debugging
- ✅ Fallback to default values

---

## Core Functions

### 1. `checkTableExists()`

Validates table existence before querying.

```typescript
const exists = await checkTableExists(supabase, 'ai_predictions');
if (!exists) {
  // Use fallback data
}
```

**Features:**
- 5-minute cache to prevent repeated checks
- Returns `false` instead of throwing errors
- Logs missing tables for debugging

---

### 2. `safeQuery()`

Wrapper for safe database queries with automatic validation.

```typescript
const result = await safeQuery(
  supabase,
  'ai_predictions',
  (builder) => builder
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100),
  {
    defaultValue: [],
    logErrors: true
  }
);

if (result.success) {
  // Use result.data
} else {
  // Handle result.error
}
```

**Return Structure:**
```typescript
{
  success: boolean;
  data: T[];
  error: string | null;
  source: 'database' | 'default' | 'error';
}
```

---

### 3. `validateQueryResponse()`

Validates and sanitizes query responses.

```typescript
const validation = validateQueryResponse(data, error, 'ai_predictions');

if (validation.isValid) {
  console.log('Data valid:', validation.data);
} else {
  console.log('Error:', validation.error);
}
```

**Detects:**
- Table doesn't exist errors
- Permission/RLS errors
- Invalid data formats
- Empty results

---

### 4. `validateDataSchema()`

Ensures data matches expected structure.

```typescript
const schemaValidation = validateDataSchema(
  predictions,
  ['id', 'model', 'prediction_data', 'created_at'],
  'ai_predictions'
);

console.log(`Valid: ${schemaValidation.validRecords.length}`);
console.log(`Invalid: ${schemaValidation.invalidCount}`);
console.log(`Missing fields: ${schemaValidation.missingFields}`);
```

**Benefits:**
- Filters out malformed records
- Identifies missing required fields
- Prevents downstream errors
- Provides detailed validation reports

---

## Implementation Examples

### Example 1: Insights Route (Basic Query)

```typescript
import { safeQuery, APP_TABLES } from '@/lib/supabase-validator';

const queryResult = await safeQuery(
  supabase,
  APP_TABLES.AI_PREDICTIONS,
  (builder) => builder
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100),
  {
    defaultValue: [],
    logErrors: true
  }
);

if (!queryResult.success || queryResult.source !== 'database') {
  return {
    insights: getDefaultInsights(),
    dataSource: queryResult.source,
    message: queryResult.error || 'Table not yet created'
  };
}

// Validate schema
const schemaValidation = validateDataSchema(
  queryResult.data,
  ['id', 'model', 'created_at'],
  APP_TABLES.AI_PREDICTIONS
);

// Calculate metrics from valid records only
const insights = calculateInsights(schemaValidation.validRecords);
```

---

### Example 2: Analyze Route (Insert with Validation)

```typescript
import { checkTableExists, APP_TABLES } from '@/lib/supabase-validator';

// Check table exists before inserting
const tableExists = await checkTableExists(supabase, APP_TABLES.AI_RESPONSE_TRUST);

if (tableExists) {
  const { error } = await supabase
    .from(APP_TABLES.AI_RESPONSE_TRUST)
    .insert({
      response_id: `resp_${Date.now()}`,
      model_id: 'grok-3',
      sport: 'nba',
      // ... other fields
    });

  if (error) {
    console.log('Insert failed:', error.message);
  } else {
    console.log('Trust metrics stored');
  }
} else {
  console.log('Table does not exist, skipping storage');
}
```

---

### Example 3: Historical Data Query

```typescript
const queryResult = await safeQuery(
  supabase,
  APP_TABLES.AI_RESPONSE_TRUST,
  (builder) => builder
    .select('final_confidence')
    .eq('model_id', 'grok-3')
    .order('created_at', { ascending: false })
    .limit(20),
  {
    defaultValue: [],
    logErrors: false // Silent fallback for optional data
  }
);

if (queryResult.success && queryResult.data.length > 0) {
  // Filter out invalid records
  const validData = queryResult.data.filter(
    (row) => typeof row.final_confidence === 'number'
  );
  
  if (validData.length > 0) {
    const average = validData.reduce((sum, row) => 
      sum + row.final_confidence, 0
    ) / validData.length;
  }
}
```

---

## Table Reference

### `APP_TABLES` Constants

Centralized table name references:

```typescript
export const APP_TABLES = {
  AI_PREDICTIONS: 'ai_predictions',
  AI_RESPONSE_TRUST: 'ai_response_trust',
  AI_AUDIT_LOG: 'ai_audit_log',
  ODDS_BENFORD_BASELINES: 'odds_benford_baselines',
  VALIDATION_THRESHOLDS: 'validation_thresholds',
  LIVE_ODDS_CACHE: 'live_odds_cache',
} as const;
```

---

## Schema Definitions

Expected field structures for validation:

```typescript
export const SCHEMA_DEFINITIONS = {
  AI_PREDICTIONS: [
    'id',
    'model',
    'prediction_data',
    'created_at'
  ],
  AI_RESPONSE_TRUST: [
    'id',
    'model_id',
    'sport',
    'market_type',
    'benford_score',
    'odds_alignment_score',
    'consensus_score',
    'historical_accuracy_score',
    'final_confidence',
    'created_at'
  ],
} as const;
```

---

## Error Handling Patterns

### Pattern 1: Graceful Degradation

```typescript
try {
  const result = await safeQuery(/* ... */);
  
  if (result.success) {
    return { data: result.data, source: 'database' };
  } else {
    return { data: defaultData, source: 'default', error: result.error };
  }
} catch (error) {
  return { data: defaultData, source: 'error', error: String(error) };
}
```

### Pattern 2: Conditional Features

```typescript
const tableExists = await checkTableExists(supabase, 'premium_features');

if (tableExists) {
  // Enable premium features
} else {
  // Show upgrade prompt or use basic features
}
```

### Pattern 3: Data Migration Safety

```typescript
// Clear cache after running migrations
import { clearTableCache } from '@/lib/supabase-validator';

async function runMigrations() {
  // Run migrations...
  
  // Clear cache to force fresh table checks
  clearTableCache();
  
  console.log('Migrations complete, cache cleared');
}
```

---

## Caching Strategy

**Table Existence Cache:**
- Duration: 5 minutes
- Benefit: Reduces redundant metadata queries
- Invalidation: Manual via `clearTableCache()`

**Why 5 Minutes?**
- Long enough to prevent excessive checks
- Short enough to detect new tables quickly
- Automatic on app restart

---

## Common Error Messages

### "Table does not exist"
**Cause:** Database table hasn't been created yet
**Solution:** Run Supabase migrations from `/supabase/migrations/`
**Fallback:** Application returns default data

### "Permission denied"
**Cause:** Row Level Security (RLS) blocking query
**Solution:** Update RLS policies in Supabase dashboard
**Fallback:** Application returns default data

### "Invalid data format"
**Cause:** Response isn't an array as expected
**Solution:** Check query and table structure
**Fallback:** Returns empty array

---

## Testing Database Queries

### Test Table Existence

```typescript
import { checkTableExists } from '@/lib/supabase-validator';

const tables = [
  'ai_predictions',
  'ai_response_trust',
  'ai_audit_log'
];

for (const table of tables) {
  const exists = await checkTableExists(supabase, table);
  console.log(`${table}: ${exists ? '✓' : '✗'}`);
}
```

### Test Query Validation

```typescript
const testQuery = async () => {
  const result = await safeQuery(
    supabase,
    'test_table',
    (builder) => builder.select('*').limit(1),
    { logErrors: true }
  );
  
  console.log('Success:', result.success);
  console.log('Source:', result.source);
  console.log('Error:', result.error);
  console.log('Data:', result.data);
};
```

---

## Migration Guide

### Before (Unsafe)

```typescript
const { data, error } = await supabase
  .from('ai_predictions')
  .select('*');

if (error) {
  console.error(error); // ❌ Doesn't handle missing tables
}

// ❌ Assumes data is valid
const results = data.map(row => row.confidence);
```

### After (Safe)

```typescript
const result = await safeQuery(
  supabase,
  APP_TABLES.AI_PREDICTIONS,
  (builder) => builder.select('*'),
  { defaultValue: [] }
);

if (!result.success) {
  console.log(result.error); // ✅ Handles all error types
  return defaultData;
}

// ✅ Validate schema before using
const validation = validateDataSchema(
  result.data,
  ['id', 'confidence'],
  APP_TABLES.AI_PREDICTIONS
);

const results = validation.validRecords.map(row => row.confidence);
```

---

## Best Practices

1. **Always use `safeQuery()` instead of raw Supabase queries**
2. **Validate data schema after queries**
3. **Provide meaningful default values**
4. **Log errors but don't crash**
5. **Clear cache after migrations**
6. **Use `APP_TABLES` constants for table names**
7. **Test with missing tables in development**

---

## Troubleshooting

### Issue: Cache not updating after migrations

**Solution:**
```typescript
import { clearTableCache } from '@/lib/supabase-validator';
clearTableCache(); // Clear all
clearTableCache('ai_predictions'); // Clear specific table
```

### Issue: RLS blocking queries

**Solution:** Check Supabase RLS policies:
```sql
-- Allow read access
CREATE POLICY "Allow read access" ON ai_predictions
FOR SELECT USING (true);
```

### Issue: Schema validation failing

**Solution:** Check expected vs actual fields:
```typescript
const validation = validateDataSchema(data, SCHEMA_DEFINITIONS.AI_PREDICTIONS, 'ai_predictions');
console.log('Missing fields:', validation.missingFields);
```

---

## Performance Considerations

- **Table checks:** Cached for 5 minutes
- **Query overhead:** Minimal (~10ms per query)
- **Memory usage:** Small cache map
- **Network calls:** Reduced via caching

---

## Future Enhancements

- [ ] Automatic retry on transient errors
- [ ] Query result caching
- [ ] Webhook-based cache invalidation
- [ ] Schema migration detection
- [ ] Performance metrics tracking
- [ ] Circuit breaker pattern

---

## Related Documentation

- [ENV_CONFIGURATION.md](./ENV_CONFIGURATION.md) - Supabase environment setup
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common database issues
- [Supabase Migration](./supabase/migrations/20260201_trust_integrity_system.sql) - Database schema
