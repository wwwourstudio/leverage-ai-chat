# JSON Error Handling & Data Validation System

## Overview

This document describes the robust JSON parsing and data validation system implemented to prevent "Unexpected token" errors and handle malformed API responses gracefully.

## The Problem

The application was experiencing errors like:
```
Query validation failed for 'ai_predictions': SyntaxError: Unexpected token 'I', "Invalid re"... is not valid JSON
```

These errors occurred when:
1. Supabase returned error messages as plain text instead of JSON
2. The error logging attempted to serialize complex error objects
3. Network errors resulted in HTML error pages instead of JSON
4. Database tables didn't exist yet, returning error strings

## The Solution

### 1. Safe Error Message Extraction

```typescript
function safeExtractErrorMessage(error: any): string {
  if (!error) return 'Unknown error';
  
  // Handle string errors
  if (typeof error === 'string') return error;
  
  // Handle Error objects
  if (error instanceof Error) return error.message;
  
  // Handle Supabase error objects
  if (error.message) return String(error.message);
  if (error.error) return String(error.error);
  
  // Safe fallback with try-catch
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
```

**Benefits:**
- Never throws JSON parsing errors
- Handles all error types (string, Error, object)
- Graceful degradation with multiple fallbacks
- Safe stringification with error handling

### 2. JSON Validation Helpers

```typescript
// Check if value is valid JSON
export function isValidJson(value: any): boolean {
  if (typeof value === 'object' && value !== null) {
    return true; // Already an object
  }
  
  if (typeof value !== 'string') {
    return false;
  }

  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

// Safe JSON parsing with validation
export function safeJsonParse<T = any>(jsonString: string): {
  success: boolean;
  data: T | null;
  error: string | null;
} {
  if (!jsonString || typeof jsonString !== 'string') {
    return {
      success: false,
      data: null,
      error: 'Invalid input: not a string'
    };
  }

  try {
    const parsed = JSON.parse(jsonString);
    return {
      success: true,
      data: parsed as T,
      error: null
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'JSON parse error';
    return {
      success: false,
      data: null,
      error: `Failed to parse JSON: ${errorMessage}`
    };
  }
}
```

### 3. Enhanced Error Detection

The validator now detects specific error patterns:

```typescript
// Table doesn't exist
if (errorMessage.includes('does not exist') || 
    errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
  return { error: `Table '${tableName}' does not exist. Run database migrations first.` };
}

// Permission errors
if (errorMessage.includes('permission denied') || 
    errorMessage.includes('RLS') ||
    errorMessage.includes('policy')) {
  return { error: `Permission denied for table '${tableName}'. Check Row Level Security policies.` };
}

// Connection errors
if (errorMessage.includes('connection') || 
    errorMessage.includes('network') ||
    errorMessage.includes('timeout')) {
  return { error: `Database connection error: ${errorMessage}` };
}
```

### 4. Data Sanitization

Handles various data format issues:

```typescript
// Convert single objects to arrays
if (data && typeof data === 'object' && !Array.isArray(data)) {
  console.log(`Converting single object to array for '${tableName}'`);
  return { data: [data] };
}

// Remove null/undefined entries
const sanitizedData = data.filter(item => item !== null && item !== undefined);

if (sanitizedData.length < data.length) {
  console.log(`Removed ${data.length - sanitizedData.length} null/undefined entries`);
}
```

### 5. Safe Logging

All logging now uses safe string extraction:

```typescript
// Before (could cause errors)
console.log('Error:', error);

// After (always safe)
const safeError = validation.error || 'Unknown validation error';
console.log(`Query validation failed: ${safeError}`);
```

## Usage Examples

### Basic Query with Validation

```typescript
import { safeQuery, APP_TABLES } from '@/lib/supabase-validator';

const result = await safeQuery(
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

if (result.success) {
  // Use result.data safely
  console.log('Records:', result.data.length);
} else {
  // Handle error gracefully
  console.log('Using fallback:', result.error);
}
```

### JSON Validation

```typescript
import { isValidJson, safeJsonParse } from '@/lib/supabase-validator';

// Check if string is valid JSON
if (isValidJson(responseText)) {
  const data = JSON.parse(responseText);
}

// Safe parsing with error handling
const parseResult = safeJsonParse(responseText);
if (parseResult.success) {
  console.log('Parsed data:', parseResult.data);
} else {
  console.log('Parse error:', parseResult.error);
}
```

### Schema Validation

```typescript
import { validateDataSchema, APP_TABLES, SCHEMA_DEFINITIONS } from '@/lib/supabase-validator';

const schemaValidation = validateDataSchema(
  predictions,
  SCHEMA_DEFINITIONS.AI_PREDICTIONS,
  APP_TABLES.AI_PREDICTIONS
);

console.log(`Valid records: ${schemaValidation.validRecords.length}`);
console.log(`Invalid records: ${schemaValidation.invalidCount}`);
console.log(`Missing fields: ${schemaValidation.missingFields.join(', ')}`);
```

## Error Response Types Handled

### 1. Plain Text Errors
```
Input: "Invalid request"
Output: Safe string extraction, no parsing attempted
```

### 2. HTML Error Pages
```
Input: "<!DOCTYPE html><html>..."
Output: Detected as non-JSON, returns descriptive error
```

### 3. Supabase Error Objects
```
Input: { message: "...", details: "...", hint: "..." }
Output: Extracts message field safely
```

### 4. Network Errors
```
Input: TypeError: "Failed to fetch"
Output: Extracts error message, categorizes as connection error
```

### 5. NULL/Undefined Responses
```
Input: null
Output: Returns empty array as default, logs appropriately
```

## Best Practices

### DO ✅

1. **Always use safeQuery** for Supabase operations
2. **Check result.success** before using data
3. **Provide sensible defaults** in options
4. **Log errors** for debugging (they're now safe)
5. **Validate schemas** for data integrity

### DON'T ❌

1. **Don't use raw supabase.from()** without validation
2. **Don't assume data is an array** without checking
3. **Don't JSON.parse** without validation
4. **Don't log complex objects** directly
5. **Don't ignore the source field** in results

## Configuration

### Table Names

Centralized in `APP_TABLES`:

```typescript
export const APP_TABLES = {
  AI_PREDICTIONS: 'ai_predictions',
  AI_RESPONSE_TRUST: 'ai_response_trust',
  AI_AUDIT_LOG: 'ai_audit_log',
} as const;
```

### Schema Definitions

Define expected schemas for validation:

```typescript
export const SCHEMA_DEFINITIONS = {
  AI_PREDICTIONS: ['id', 'model', 'prediction_data', 'created_at'] as const,
  AI_RESPONSE_TRUST: [
    'id',
    'model_id',
    'sport',
    'market_type',
    'final_confidence',
    'created_at'
  ] as const,
} as const;
```

## Troubleshooting

### Error: "Table does not exist"

**Cause:** Database table not created yet

**Solution:** Run migrations:
```bash
# Check if Supabase is configured
curl https://your-app.vercel.app/api/health

# Migrations are in /supabase/migrations/
```

### Error: "Permission denied"

**Cause:** Row Level Security blocking access

**Solution:** Update RLS policies in Supabase dashboard:
```sql
-- Allow anonymous read access
ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read" ON ai_predictions
  FOR SELECT USING (true);
```

### Error: "Invalid data format: expected array"

**Cause:** API returned single object instead of array

**Solution:** Now handled automatically with object-to-array conversion

### High Invalid Record Count

**Cause:** Data doesn't match expected schema

**Solution:** Check schema definitions match database:
```typescript
// Update SCHEMA_DEFINITIONS to match your table
export const SCHEMA_DEFINITIONS = {
  AI_PREDICTIONS: ['id', 'model', 'created_at'] // Add/remove fields as needed
} as const;
```

## Performance Considerations

### Caching

Table existence checks are cached for 5 minutes:

```typescript
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
```

**Benefits:**
- Reduces database queries
- Improves response time
- Automatic cache invalidation

**Clear cache after migrations:**
```typescript
import { clearTableCache } from '@/lib/supabase-validator';

// Clear specific table
clearTableCache('ai_predictions');

// Clear all tables
clearTableCache();
```

### Query Optimization

1. **Use skipExistenceCheck** when table is known to exist:
```typescript
await safeQuery(supabase, tableName, queryFn, {
  skipExistenceCheck: true // Skip check for performance
});
```

2. **Batch operations** when possible
3. **Limit result sets** appropriately
4. **Use select** to fetch only needed columns

## Integration Testing

### Test Error Scenarios

```typescript
// Test table doesn't exist
const result1 = await safeQuery(supabase, 'nonexistent_table', ...);
expect(result1.success).toBe(true);
expect(result1.source).toBe('default');

// Test malformed data
const result2 = await validateQueryResponse(null, null, 'test');
expect(result2.data).toEqual([]);

// Test JSON parsing
const result3 = safeJsonParse('Invalid JSON');
expect(result3.success).toBe(false);
```

## Future Enhancements

1. **Retry Logic**: Automatic retry for transient errors
2. **Rate Limiting**: Prevent excessive queries
3. **Query Analytics**: Track query performance
4. **Schema Migration Tracking**: Detect schema changes
5. **Type Generation**: Auto-generate TypeScript types from schema

## Related Documentation

- [SUPABASE_VALIDATION_SYSTEM.md](./SUPABASE_VALIDATION_SYSTEM.md) - Complete validation system
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - General troubleshooting
- [ENV_CONFIGURATION.md](./ENV_CONFIGURATION.md) - Environment setup

## Support

If you encounter JSON parsing errors:

1. Check the logs for the specific error pattern
2. Verify Supabase connection in `/api/health`
3. Confirm tables exist in Supabase dashboard
4. Review RLS policies for access permissions
5. Clear table cache if schema changed
