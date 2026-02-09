/**
 * Centralized Error Handling System
 * Provides consistent error messages and user-friendly feedback
 */

export type ErrorSeverity = 'warning' | 'error' | 'critical';

export interface AppError {
  code: string;
  message: string;
  userMessage: string;
  severity: ErrorSeverity;
  retryable: boolean;
  troubleshootingSteps?: string[];
  technicalDetails?: string;
}

export const ERROR_CODES = {
  // AI/Model Errors
  AI_GATEWAY_ERROR: 'AI_GATEWAY_ERROR',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_RATE_LIMIT: 'AI_RATE_LIMIT',
  AI_INVALID_RESPONSE: 'AI_INVALID_RESPONSE',
  
  // Database Errors
  DB_CONNECTION_ERROR: 'DB_CONNECTION_ERROR',
  DB_QUERY_ERROR: 'DB_QUERY_ERROR',
  DB_VALIDATION_ERROR: 'DB_VALIDATION_ERROR',
  
  // API Errors
  ODDS_API_ERROR: 'ODDS_API_ERROR',
  ODDS_API_RATE_LIMIT: 'ODDS_API_RATE_LIMIT',
  ODDS_API_NO_DATA: 'ODDS_API_NO_DATA',
  
  // Network Errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  
  // Validation Errors
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Generic
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export class ApplicationError extends Error implements AppError {
  code: string;
  userMessage: string;
  severity: ErrorSeverity;
  retryable: boolean;
  troubleshootingSteps?: string[];
  technicalDetails?: string;

  constructor(config: AppError) {
    super(config.message);
    this.name = 'ApplicationError';
    this.code = config.code;
    this.userMessage = config.userMessage;
    this.severity = config.severity;
    this.retryable = config.retryable;
    this.troubleshootingSteps = config.troubleshootingSteps;
    this.technicalDetails = config.technicalDetails;
  }
}

/**
 * Error definitions with user-friendly messages and troubleshooting steps
 */
export const ERROR_DEFINITIONS: Record<string, Omit<AppError, 'technicalDetails'>> = {
  [ERROR_CODES.AI_GATEWAY_ERROR]: {
    code: ERROR_CODES.AI_GATEWAY_ERROR,
    message: 'AI Gateway error',
    userMessage: 'AI service is temporarily unavailable. Please try again in a moment.',
    severity: 'error',
    retryable: true,
    troubleshootingSteps: [
      'Wait 30 seconds and try again',
      'Check your internet connection',
      'If problem persists, contact support'
    ]
  },
  
  [ERROR_CODES.AI_TIMEOUT]: {
    code: ERROR_CODES.AI_TIMEOUT,
    message: 'AI request timeout',
    userMessage: 'AI analysis is taking longer than expected. Please try a simpler query.',
    severity: 'warning',
    retryable: true,
    troubleshootingSteps: [
      'Try breaking down your query into smaller parts',
      'Remove complex attachments',
      'Retry with a more specific question'
    ]
  },
  
  [ERROR_CODES.AI_RATE_LIMIT]: {
    code: ERROR_CODES.AI_RATE_LIMIT,
    message: 'AI rate limit exceeded',
    userMessage: 'Too many requests. Please wait a moment before trying again.',
    severity: 'warning',
    retryable: true,
    troubleshootingSteps: [
      'Wait 60 seconds before next request',
      'Consider upgrading your plan for higher limits'
    ]
  },
  
  [ERROR_CODES.ODDS_API_ERROR]: {
    code: ERROR_CODES.ODDS_API_ERROR,
    message: 'Odds API error',
    userMessage: 'Unable to fetch live odds data. Showing cached data if available.',
    severity: 'warning',
    retryable: true,
    troubleshootingSteps: [
      'Odds data updates every 5 minutes',
      'Check if your Odds API key is configured',
      'Verify Odds API service status'
    ]
  },
  
  [ERROR_CODES.ODDS_API_NO_DATA]: {
    code: ERROR_CODES.ODDS_API_NO_DATA,
    message: 'No odds data available',
    userMessage: 'No games found for the selected sport. Try a different sport or time period.',
    severity: 'warning',
    retryable: false,
    troubleshootingSteps: [
      'Check if games are scheduled for this sport',
      'Try selecting "All Sports" to see available games',
      'Odds may not be available during off-season'
    ]
  },
  
  [ERROR_CODES.DB_CONNECTION_ERROR]: {
    code: ERROR_CODES.DB_CONNECTION_ERROR,
    message: 'Database connection error',
    userMessage: 'Unable to connect to database. Your analysis will proceed without saving.',
    severity: 'error',
    retryable: true,
    troubleshootingSteps: [
      'Check Supabase connection status',
      'Verify environment variables are set',
      'Contact administrator if problem persists'
    ]
  },
  
  [ERROR_CODES.NETWORK_ERROR]: {
    code: ERROR_CODES.NETWORK_ERROR,
    message: 'Network connection error',
    userMessage: 'Network connection lost. Please check your internet connection.',
    severity: 'error',
    retryable: true,
    troubleshootingSteps: [
      'Check your internet connection',
      'Disable VPN if active',
      'Try refreshing the page'
    ]
  },
  
  [ERROR_CODES.INVALID_INPUT]: {
    code: ERROR_CODES.INVALID_INPUT,
    message: 'Invalid input provided',
    userMessage: 'Invalid input. Please check your query and try again.',
    severity: 'warning',
    retryable: false,
    troubleshootingSteps: [
      'Check for special characters or formatting issues',
      'Ensure all required fields are filled',
      'Try simplifying your query'
    ]
  },
  
  [ERROR_CODES.UNKNOWN_ERROR]: {
    code: ERROR_CODES.UNKNOWN_ERROR,
    message: 'Unknown error occurred',
    userMessage: 'An unexpected error occurred. Please try again.',
    severity: 'error',
    retryable: true,
    troubleshootingSteps: [
      'Try refreshing the page',
      'Clear browser cache',
      'Contact support if error persists'
    ]
  }
};

/**
 * Create an ApplicationError from an error code
 */
export function createError(
  errorCode: string,
  technicalDetails?: string
): ApplicationError {
  const definition = ERROR_DEFINITIONS[errorCode] || ERROR_DEFINITIONS[ERROR_CODES.UNKNOWN_ERROR];
  
  return new ApplicationError({
    ...definition,
    technicalDetails
  });
}

/**
 * Parse and classify errors from various sources
 */
export function classifyError(error: unknown): ApplicationError {
  // Handle ApplicationError instances
  if (error instanceof ApplicationError) {
    return error;
  }
  
  // Handle standard Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // AI Gateway errors
    if (message.includes('bad gateway') || message.includes('502')) {
      return createError(ERROR_CODES.AI_GATEWAY_ERROR, error.message);
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return createError(ERROR_CODES.AI_TIMEOUT, error.message);
    }
    if (message.includes('rate limit')) {
      return createError(ERROR_CODES.AI_RATE_LIMIT, error.message);
    }
    
    // Database errors
    if (message.includes('database') || message.includes('supabase')) {
      return createError(ERROR_CODES.DB_CONNECTION_ERROR, error.message);
    }
    if (message.includes('uuid') || message.includes('validation')) {
      return createError(ERROR_CODES.DB_VALIDATION_ERROR, error.message);
    }
    
    // Network errors
    if (message.includes('network') || message.includes('fetch failed')) {
      return createError(ERROR_CODES.NETWORK_ERROR, error.message);
    }
    
    // Default to unknown error
    return createError(ERROR_CODES.UNKNOWN_ERROR, error.message);
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return createError(ERROR_CODES.UNKNOWN_ERROR, error);
  }
  
  // Handle unknown error types
  return createError(ERROR_CODES.UNKNOWN_ERROR, String(error));
}

/**
 * Format error for logging
 */
export function formatErrorForLog(error: ApplicationError): string {
  return `[${error.severity.toUpperCase()}] ${error.code}: ${error.message}${
    error.technicalDetails ? ` (${error.technicalDetails})` : ''
  }`;
}

/**
 * Get user-friendly error message with optional troubleshooting
 */
export function getUserErrorMessage(
  error: ApplicationError,
  includeTroubleshooting = true
): string {
  let message = error.userMessage;
  
  if (includeTroubleshooting && error.troubleshootingSteps && error.troubleshootingSteps.length > 0) {
    message += '\n\nTroubleshooting:\n';
    message += error.troubleshootingSteps.map((step, i) => `${i + 1}. ${step}`).join('\n');
  }
  
  return message;
}
