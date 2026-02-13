# Enhanced Error Handling System

Production-ready error handling with actionable user guidance, retry mechanisms, and comprehensive troubleshooting.

## Overview

The enhanced error handling system provides:

- **Specific Error Types** - Predefined errors for common scenarios (API failures, network issues, rate limits)
- **Severity Levels** - Critical, Error, Warning, Info classifications
- **Actionable Guidance** - Clear troubleshooting steps and user actions
- **Retry Mechanisms** - Automatic retry logic with exponential backoff
- **Rich UI Components** - Beautiful error displays with collapsible details
- **Type Safety** - Full TypeScript support for error handling

## Architecture

```
lib/
  error-types.ts           - Error definitions and classifications
  api-error-handler.ts     - Server-side error utilities
hooks/
  use-enhanced-error.ts    - Client-side error hooks
components/
  enhanced-error-display.tsx - Error UI components
  example-error-usage.tsx    - Usage examples
```

## Quick Start

### 1. Using Errors in React Components

```tsx
import { useApiRequest } from '@/hooks/use-enhanced-error';
import { EnhancedErrorDisplay } from '@/components/enhanced-error-display';

function MyComponent() {
  const { data, loading, error, canRetry, execute, retry } = useApiRequest();

  const fetchData = () => execute(async () => {
    const response = await fetch('/api/odds');
    return response;
  });

  return (
    <div>
      <button onClick={fetchData} disabled={loading}>
        Fetch Data
      </button>

      {error && (
        <EnhancedErrorDisplay 
          error={error} 
          onRetry={canRetry ? () => retry(fetchData) : undefined}
        />
      )}

      {data && <div>Success: {JSON.stringify(data)}</div>}
    </div>
  );
}
```

### 2. Using Errors in API Routes

```typescript
import { createErrorResponse, createSuccessResponse, validateEnvVars } from '@/lib/api-error-handler';

export async function GET(request: Request) {
  // Validate environment
  const envError = validateEnvVars({
    ODDS_API_KEY: process.env.ODDS_API_KEY
  });
  
  if (envError) {
    return createErrorResponse(envError, 500);
  }

  try {
    const data = await fetchOdds();
    return createSuccessResponse(data);
  } catch (error) {
    // Specific error
    if (error.message.includes('rate limit')) {
      return createErrorResponse('API_RATE_LIMIT', 429);
    }
    
    // Generic fallback
    return createErrorResponse('UNKNOWN_ERROR', 500, error.message);
  }
}
```

## Available Error Types

### Network Errors
- `NETWORK_OFFLINE` - No internet connection
- `NETWORK_TIMEOUT` - Request timed out

### API Errors
- `API_KEY_MISSING` - API key not configured
- `API_KEY_INVALID` - Invalid or expired API key
- `API_RATE_LIMIT` - Rate limit exceeded (retry after cooldown)
- `API_QUOTA_EXCEEDED` - Monthly quota exceeded

### Database Errors
- `DATABASE_CONNECTION_FAILED` - Cannot connect to database
- `DATABASE_QUERY_FAILED` - Query execution failed

### Validation Errors
- `INVALID_INPUT` - User input validation failed
- `SPORT_NOT_SUPPORTED` - Requested sport unavailable

### External Service Errors
- `ODDS_API_UNAVAILABLE` - The Odds API is down
- `AI_SERVICE_ERROR` - AI model error

### Generic
- `UNKNOWN_ERROR` - Unexpected error with generic guidance

## Error Properties

Each error includes:

```typescript
interface AppError {
  code: string;                    // Error code (e.g., 'API_RATE_LIMIT')
  message: string;                 // Short technical message
  userMessage: string;             // User-friendly explanation
  severity: ErrorSeverity;         // CRITICAL | ERROR | WARNING | INFO
  category: ErrorCategory;         // network | api | database | etc.
  retryable: boolean;              // Can the operation be retried?
  actions: ErrorAction[];          // Available user actions
  technicalDetails?: string;       // Stack trace or technical info
  troubleshootingSteps?: string[]; // Step-by-step guidance
  docsUrl?: string;                // Link to documentation
}
```

## UI Components

### EnhancedErrorDisplay

Full error display with all features:

```tsx
<EnhancedErrorDisplay 
  error={appError}
  onRetry={() => retryOperation()}
  onDismiss={() => clearError()}
  compact={false}
  retrying={isRetrying}
/>
```

**Props:**
- `error` - AppError object
- `onRetry?` - Retry callback (only shown if error is retryable)
- `onDismiss?` - Dismiss callback
- `compact?` - Compact mode (single line)
- `retrying?` - Show loading state on retry button

### ErrorToast

Compact toast notification:

```tsx
<ErrorToast 
  error={appError}
  onRetry={() => retry()}
  onDismiss={() => clear()}
/>
```

## Custom Hooks

### useEnhancedError

Low-level error handling:

```typescript
const { 
  error,           // Current error or null
  isRetrying,      // Is retry in progress?
  retryCount,      // Number of retries attempted
  canRetry,        // Can retry based on error type and count?
  handleError,     // Convert any error to AppError
  retry,           // Retry with automatic error handling
  clearError,      // Clear current error
  hasError         // Boolean: error exists
} = useEnhancedError({ 
  onError: (err) => console.log(err),
  maxRetries: 3 
});
```

### useApiRequest

High-level API request handling:

```typescript
const { 
  data,            // Response data
  loading,         // Is request in progress?
  error,           // Current error
  isRetrying,      // Is retry in progress?
  canRetry,        // Can retry?
  execute,         // Execute request
  retry,           // Retry last request
  clearError       // Clear error
} = useApiRequest();

// Execute request
await execute(() => fetch('/api/odds'));

// Retry on error
if (canRetry) {
  await retry(() => fetch('/api/odds'));
}
```

## API Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "API_RATE_LIMIT",
    "message": "Rate limit exceeded",
    "userMessage": "You've reached the API rate limit. Please wait a few minutes.",
    "severity": "warning",
    "category": "rate_limit",
    "retryable": true,
    "actions": [
      { "label": "Wait and Retry", "action": "retry" },
      { "label": "Upgrade Plan", "action": "check_docs", "url": "..." }
    ],
    "troubleshootingSteps": [
      "Wait 5-10 minutes before making another request",
      "Consider upgrading to a higher tier plan"
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Best Practices

### 1. Always Use Typed Errors

✅ Good:
```typescript
return createErrorResponse('API_RATE_LIMIT', 429);
```

❌ Bad:
```typescript
return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
```

### 2. Provide Technical Details in Development

```typescript
const error = createError('DATABASE_QUERY_FAILED', 
  process.env.NODE_ENV === 'development' ? error.stack : error.message
);
```

### 3. Always Check Environment Variables

```typescript
const envError = validateEnvVars({
  ODDS_API_KEY: process.env.ODDS_API_KEY,
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL
});

if (envError) {
  return createErrorResponse(envError, 500);
}
```

### 4. Use Retry Logic for Transient Errors

```typescript
import { withRetry } from '@/lib/api-error-handler';

const data = await withRetry(
  () => fetchFromAPI(),
  {
    maxRetries: 3,
    initialDelay: 1000,
    onRetry: (attempt) => console.log(`Retry attempt ${attempt}`)
  }
);
```

### 5. Show Compact Errors in Cards, Full Errors in Pages

```tsx
// In a card component
<EnhancedErrorDisplay error={error} compact />

// In a full page
<EnhancedErrorDisplay error={error} />
```

## Error Severity Guidelines

- **CRITICAL** - Service is completely unavailable (missing API keys, database down)
- **ERROR** - Operation failed but service is partially available (specific query failed)
- **WARNING** - Degraded service, fallback available (rate limited, using cache)
- **INFO** - Informational message (sport not in season, feature unavailable)

## Testing Errors

```typescript
import { createError } from '@/lib/error-types';

// Test component with different error types
const testErrors = [
  createError('API_RATE_LIMIT'),
  createError('NETWORK_TIMEOUT'),
  createError('DATABASE_CONNECTION_FAILED')
];

testErrors.forEach(error => {
  render(<EnhancedErrorDisplay error={error} />);
});
```

## Migration Guide

### From Old Error Handling

Before:
```typescript
catch (error) {
  return NextResponse.json({ 
    error: error.message 
  }, { status: 500 });
}
```

After:
```typescript
import { createErrorResponse, handleFetchError } from '@/lib/api-error-handler';

catch (error) {
  const appError = handleFetchError(error);
  return createErrorResponse(appError, 500);
}
```

## Troubleshooting

### Error Not Showing Retry Button

Check if error is marked as retryable:
```typescript
console.log(error.retryable); // Should be true
console.log(canRetry);         // Should be true if retries remaining
```

### Actions Not Working

Ensure action URLs are absolute or handle in onClick:
```typescript
actions: [
  { label: 'View Docs', action: 'check_docs', url: 'https://...' }
]
```

### Custom Error Not Displaying

Verify error implements AppError interface:
```typescript
import { AppError, ErrorSeverity, ErrorCategory } from '@/lib/error-types';

const error: AppError = { ... };
```

## Support

- **Documentation**: `/docs/ERROR_HANDLING.md`
- **Examples**: `/components/example-error-usage.tsx`
- **Type Definitions**: `/lib/error-types.ts`
- **API Utilities**: `/lib/api-error-handler.ts`
