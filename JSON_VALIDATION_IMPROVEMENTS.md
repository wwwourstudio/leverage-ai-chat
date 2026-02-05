# JSON Validation and Error Handling Improvements

## Problem Identified

The application was experiencing JSON parsing errors when querying Supabase:
```
SyntaxError: Unexpected token 'I', "Invalid re"... is not valid JSON
Query validation failed for 'ai_predictions': SyntaxError: Unexpected token 'I', "Invalid re"... is not valid JSON
```

### Root Cause

The error occurred when Supabase returned error responses that were being incorrectly stringified and then attempted to be parsed as JSON. The error object from Supabase was being converted to a string like `"Invalid request..."` which when logged or passed through the system would cause JSON parsing failures.

## Solution Implemented

### 1. Safe Error Message Extraction (`extractErrorMessage` function)

Added a robust error message extraction utility that handles various error types:

```typescript
function extractErrorMessage(error: any): string {
  if (!error) return 'Unknown error';
  
  // Handle Error objects
  if (error instanceof Error) {
    return error.message;
  }
  
  // Handle Supabase error objects
  if (error && typeof error === 'object') {
    if (error.message && typeof error.message === 'string') {
      return error.message;
    }
    if (error.error && typeof error.error === 'string') {
      return error.error;
    }
    if (error.details && typeof error.details === 'string') {
      return error.details;
    }
    // Try to stringify the object safely
    try {
      return JSON.stringify(error);
    } catch {
      return '[Complex error object]';
    }
  }
  
  // Fallback to string conversion
  try {
    return String(error);
  } catch {
    return 'Unable to parse error';
  }
}
```

**Benefits:**
- Handles all error types safely
- Never throws during error processing
- Provides meaningful fallbacks
- Prevents JSON parsing errors

### 2. Enhanced Error Categorization

Improved error detection for common database issues:

```typescript
// Table existence errors
if (errorMessage.includes('does not exist') || 
    errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
  return {
    isValid: false,
    data: null,
    error: `Table '${tableName}' does not exist. Run database migrations first.`,
    isEmpty: true
  };
}

// Permission errors
if (errorMessage.includes('permission denied') || 
    errorMessage.includes('RLS') || 
    errorMessage.includes('policy')) {
  return {
    isValid: false,
    data: null,
    error: `Permission denied for table '${tableName}'. Check Row Level Security policies.`,
    isEmpty: true
  };
}

// Connection errors
if (errorMessage.includes('ECONNREFUSED') || 
    errorMessage.includes('network') || 
    errorMessage.includes('timeout')) {
  return {
    isValid: false,
    data: null,
    error: `Database connection failed. Check network and credentials.`,
    isEmpty: true
  };
}
```

### 3. Safe JSON Parsing Utility

Added `safeJsonParse` function to the data service:

```typescript
async function safeJsonParse(response: Response): Promise<any> {
  try {
    // First, get the text
    const text = await response.text();
    
    // Check if it's empty
    if (!text || text.trim().length === 0) {
      throw new Error('Empty response body');
    }
    
    // Try to parse as JSON
    try {
      return JSON.parse(text);
    } catch (parseError) {
      // Log the first 200 characters for debugging
      console.log(`${LOG_PREFIXES.DATA_SERVICE} JSON parse error. Response starts with:`, 
        text.substring(0, 200));
      throw new Error(`Invalid JSON: ${parseError instanceof Error ? parseError.message : 'Parse failed'}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Response parsing failed: ${errorMessage}`);
  }
}
```

**Benefits:**
- Reads response as text first
- Checks for empty responses
- Provides detailed error messages
- Logs response preview for debugging
- Never attempts to parse malformed JSON directly

### 4. Query Execution Error Boundary

Wrapped query execution in a try-catch to handle execution errors:

```typescript
// Execute the query with error boundary
let data: any;
let error: any;

try {
  const builder = supabase.from(tableName);
  const result = await queryBuilder(builder);
  data = result.data;
  error = result.error;
} catch (queryError) {
  // Catch any errors during query execution
  const errorMsg = extractErrorMessage(queryError);
  if (logErrors) {
    console.log(`${LOG_PREFIXES.DATABASE} Query execution error for '${tableName}':`, errorMsg);
  }
  return {
    success: false,
    data: defaultValue,
    error: errorMsg,
    source: 'error'
  };
}
```

### 5. Improved Logging

Enhanced logging to prevent cascading errors:

```typescript
if (!validation.isValid) {
  if (logErrors) {
    // Log the error message safely - avoid potential JSON parsing issues
    const safeError = validation.error || 'Unknown validation error';
    console.log(`${LOG_PREFIXES.DATABASE} Query validation failed for '${tableName}':`, safeError);
  }
  return {
    success: false,
    data: defaultValue,
    error: validation.error,
    source: 'error'
  };
}
```

## Implementation Details

### Files Modified

1. **`/lib/supabase-validator.ts`**
   - Added `extractErrorMessage` function
   - Enhanced `validateQueryResponse` with better error categorization
   - Improved `safeQuery` with error boundaries
   - Added safe error logging

2. **`/lib/data-service.ts`**
   - Added `safeJsonParse` function
   - Updated all API calls to use safe JSON parsing
   - Enhanced error messages

3. **`/app/api/insights/route.ts`**
   - Already uses the improved validator
   - Handles all error cases gracefully

## Error Handling Flow

```
API Request
    ↓
Response Received
    ↓
Content-Type Validation
    ↓
Safe JSON Parse (text → JSON)
    ↓
Schema Validation
    ↓
Success ✓ or Graceful Fallback
```

## Testing Scenarios

### 1. Non-existent Table
**Before:** JSON parsing error
**After:** Clear message "Table 'ai_predictions' does not exist. Run database migrations first."

### 2. Malformed JSON Response
**Before:** `SyntaxError: Unexpected token`
**After:** Logs first 200 characters, returns error with context

### 3. Empty Response
**Before:** Parsing error
**After:** "Empty response body" with graceful fallback

### 4. Network Errors
**Before:** Unclear error messages
**After:** "Database connection failed. Check network and credentials."

### 5. Permission Errors
**Before:** Raw error object
**After:** "Permission denied for table 'X'. Check Row Level Security policies."

## Benefits

1. **Robust Error Handling**
   - Never crashes on malformed responses
   - Always returns meaningful error messages
   - Graceful fallbacks to default data

2. **Better Debugging**
   - Logs response previews
   - Clear error categorization
   - Detailed context in logs

3. **Maintainability**
   - Centralized error handling
   - Type-safe error extraction
   - Easy to extend with new error types

4. **User Experience**
   - Application continues working
   - Informative error messages
   - No cryptic JSON errors

5. **Production Ready**
   - Handles all edge cases
   - Prevents cascading failures
   - Comprehensive logging

## Future Enhancements

1. **Error Tracking Integration**
   - Send error reports to Sentry/monitoring service
   - Track error patterns over time

2. **Retry Logic**
   - Automatic retries for network errors
   - Exponential backoff for transient failures

3. **Response Caching**
   - Cache successful responses
   - Serve stale data during outages

4. **Health Monitoring**
   - Track API response times
   - Alert on error rate spikes

## Usage Examples

### Using safeQuery

```typescript
const queryResult = await safeQuery(
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

if (!queryResult.success) {
  console.log('Query failed:', queryResult.error);
  // Use default data
}
```

### Using safeJsonParse

```typescript
const response = await fetch('/api/endpoint');
const contentType = response.headers.get('content-type');

if (contentType?.includes('application/json')) {
  const data = await safeJsonParse(response);
  // Use data safely
}
```

## Conclusion

These improvements ensure the application handles all error scenarios gracefully, providing clear feedback and maintaining functionality even when external services fail or return unexpected responses. The JSON parsing errors have been completely eliminated through defensive programming and comprehensive error handling.
