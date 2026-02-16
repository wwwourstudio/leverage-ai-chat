/**
 * Example: How to use Enhanced Error Handling
 * 
 * This component demonstrates best practices for:
 * - Using the useApiRequest hook
 * - Displaying enhanced errors with actionable guidance
 * - Implementing retry mechanisms
 * - Handling different error types
 */

'use client';

// This component is an example and requires useApiRequest and EnhancedErrorDisplay
// to be implemented. Commenting out for now to avoid build errors.
/*
import { useApiRequest } from '@/hooks/use-enhanced-error';
import { EnhancedErrorDisplay } from './enhanced-error-display';
*/

export function ExampleErrorUsage() {
  // Temporarily disabled - requires implementation of useApiRequest and EnhancedErrorDisplay
  return null;
  /*
  const { data, loading, error, canRetry, execute, retry } = useApiRequest();

  const fetchOdds = async () => {
    return execute(async () => {
      const response = await fetch('/api/odds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport: 'basketball_nba' })
      });
      return response;
    });
  };

  const handleRetry = async () => {
    await retry(fetchOdds);
  };

  return (
    <div className="space-y-4">
      <button
        onClick={fetchOdds}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2"
      >
        {loading ? 'Loading...' : 'Fetch Odds'}
      </button>

      {/* Display error with enhanced UI */}
      {error && (
        <EnhancedErrorDisplay 
          error={error} 
          onRetry={canRetry ? handleRetry : undefined}
        />
      )}

      {/* Display data when successful */}
      {data && !error && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
          <p className="text-green-400">Success! Received {data.events?.length || 0} events</p>
        </div>
      )}
    </div>
  );
  */
}

/**
 * Example: Using enhanced errors in API routes
 * 
 * // In your API route (e.g., app/api/example/route.ts):
 * 
 * import { createErrorResponse, createSuccessResponse, validateEnvVars } from '@/lib/api-error-handler';
 * import { createError } from '@/lib/error-types';
 * 
 * export async function GET(request: Request) {
 *   // Validate environment variables
 *   const envError = validateEnvVars({
 *     ODDS_API_KEY: process.env.ODDS_API_KEY
 *   });
 * 
 *   if (envError) {
 *     return createErrorResponse(envError, 500);
 *   }
 * 
 *   try {
 *     // Your API logic here
 *     const data = await fetchData();
 *     return createSuccessResponse(data);
 *   } catch (error) {
 *     // Handle specific errors
 *     if (error.message.includes('rate limit')) {
 *       return createErrorResponse('API_RATE_LIMIT', 429, error.message);
 *     }
 * 
 *     // Generic error
 *     return createErrorResponse('UNKNOWN_ERROR', 500, error.message);
 *   }
 * }
 */

/**
 * Example: Creating custom errors
 * 
 * import { createError, ERROR_TYPES } from '@/lib/error-types';
 * 
 * // Use predefined error type
 * const error1 = createError('API_RATE_LIMIT', 'Exceeded 500 requests/hour');
 * 
 * // Use HTTP status to auto-detect error type
 * import { mapHttpStatusToError } from '@/lib/error-types';
 * const error2 = mapHttpStatusToError(429, 'Rate limited');
 * 
 * // Create fully custom error
 * const error3: AppError = {
 *   code: 'CUSTOM_ERROR',
 *   message: 'Custom error occurred',
 *   userMessage: 'Something specific happened that you need to know about',
 *   severity: ErrorSeverity.WARNING,
 *   category: ErrorCategory.VALIDATION,
 *   retryable: false,
 *   actions: [
 *     { label: 'Learn More', action: 'check_docs', url: '/docs/errors' }
 *   ],
 *   troubleshootingSteps: [
 *     'Step 1: Do this',
 *     'Step 2: Do that'
 *   ]
 * };
 */
