/**
 * Comprehensive Error Handling Utilities
 * Provides consistent error handling across all API routes
 */

import { NextResponse } from 'next/server';
import { HTTP_STATUS, ERROR_MESSAGES, LOG_PREFIXES } from './constants';
import { HTTPError, getErrorMessage, getErrorStatus } from './types';

// ============================================
// Custom Error Classes
// ============================================

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = HTTP_STATUS.INTERNAL_ERROR,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class ValidationError extends APIError {
  constructor(message: string, public fields?: Record<string, string>) {
    super(message, HTTP_STATUS.BAD_REQUEST, 'VALIDATION_ERROR', fields);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends APIError {
  constructor(message: string = 'Authentication required') {
    super(message, HTTP_STATUS.UNAUTHORIZED, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends APIError {
  constructor(resource: string) {
    super(`${resource} not found`, HTTP_STATUS.NOT_FOUND, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends APIError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, HTTP_STATUS.TOO_MANY_REQUESTS, 'RATE_LIMIT');
    this.name = 'RateLimitError';
  }
}

export class ServiceUnavailableError extends APIError {
  constructor(service: string) {
    super(
      `${service} is currently unavailable`,
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      'SERVICE_UNAVAILABLE'
    );
    this.name = 'ServiceUnavailableError';
  }
}

// ============================================
// Error Response Builders
// ============================================

interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
  timestamp: string;
  requestId?: string;
}

/**
 * Build standardized error response
 */
export function buildErrorResponse(
  error: unknown,
  requestId?: string
): ErrorResponse {
  const timestamp = new Date().toISOString();

  // Handle APIError instances
  if (error instanceof APIError) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      details: error.details,
      timestamp,
      requestId,
    };
  }

  // Handle HTTPError instances
  if (error instanceof HTTPError) {
    return {
      success: false,
      error: error.message,
      details: error.details,
      timestamp,
      requestId,
    };
  }

  // Handle standard errors
  if (error instanceof Error) {
    return {
      success: false,
      error: error.message,
      timestamp,
      requestId,
    };
  }

  // Unknown error type
  return {
    success: false,
    error: ERROR_MESSAGES.INTERNAL_ERROR,
    details: String(error),
    timestamp,
    requestId,
  };
}

/**
 * Create NextResponse with error
 */
export function errorResponse(
  error: unknown,
  statusCode?: number,
  requestId?: string
): NextResponse {
  const errorData = buildErrorResponse(error, requestId);
  const status = statusCode ?? getErrorStatus(error) ?? HTTP_STATUS.INTERNAL_ERROR;

  // Log error for monitoring
  console.error(`${LOG_PREFIXES.API} Error Response:`, {
    status,
    error: errorData.error,
    code: errorData.code,
    requestId,
  });

  return NextResponse.json(errorData, { status });
}

// ============================================
// Validation Utilities
// ============================================

export interface ValidationRule<T = unknown> {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: T[];
  custom?: (value: T) => boolean | string;
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Validate request body against schema
 */
export function validateRequest(
  data: Record<string, unknown>,
  schema: ValidationSchema
): ValidationResult {
  const errors: Record<string, string> = {};

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    // Required check
    if (rules.required && (value === undefined || value === null)) {
      errors[field] = `${field} is required`;
      continue;
    }

    // Skip validation if not required and no value
    if (!rules.required && (value === undefined || value === null)) {
      continue;
    }

    // Type check
    if (rules.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rules.type) {
        errors[field] = `${field} must be a ${rules.type}`;
        continue;
      }
    }

    // Number validations
    if (typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors[field] = `${field} must be at least ${rules.min}`;
      }
      if (rules.max !== undefined && value > rules.max) {
        errors[field] = `${field} must be at most ${rules.max}`;
      }
    }

    // String validations
    if (typeof value === 'string') {
      if (rules.min !== undefined && value.length < rules.min) {
        errors[field] = `${field} must be at least ${rules.min} characters`;
      }
      if (rules.max !== undefined && value.length > rules.max) {
        errors[field] = `${field} must be at most ${rules.max} characters`;
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors[field] = `${field} has invalid format`;
      }
    }

    // Enum check
    if (rules.enum && !rules.enum.includes(value as never)) {
      errors[field] = `${field} must be one of: ${rules.enum.join(', ')}`;
    }

    // Custom validation
    if (rules.custom) {
      const result = rules.custom(value as never);
      if (typeof result === 'string') {
        errors[field] = result;
      } else if (result === false) {
        errors[field] = `${field} failed validation`;
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Throw ValidationError if invalid
 */
export function assertValid(
  data: Record<string, unknown>,
  schema: ValidationSchema
): void {
  const result = validateRequest(data, schema);
  if (!result.valid) {
    throw new ValidationError('Validation failed', result.errors);
  }
}

// ============================================
// Async Error Wrapper
// ============================================

/**
 * Wrap async handler with error handling
 */
export function withErrorHandler<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
): (...args: T) => Promise<NextResponse> {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

// ============================================
// Retry Logic
// ============================================

interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Retry async operation with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    maxRetries,
    initialDelay,
    maxDelay = 30000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  let lastError: Error = new Error('Max retries exceeded');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );

      console.log(
        `${LOG_PREFIXES.API} Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`
      );

      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ============================================
// Circuit Breaker Pattern
// ============================================

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  onStateChange?: (state: CircuitState) => void;
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime?: number;

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      const timeSinceLastFailure = now - (this.lastFailureTime || 0);

      if (timeSinceLastFailure >= this.options.resetTimeout) {
        this.setState(CircuitState.HALF_OPEN);
      } else {
        throw new ServiceUnavailableError('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.setState(CircuitState.CLOSED);
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.failureThreshold) {
      this.setState(CircuitState.OPEN);
    }
  }

  private setState(newState: CircuitState): void {
    if (this.state !== newState) {
      console.log(`${LOG_PREFIXES.API} Circuit breaker: ${this.state} → ${newState}`);
      this.state = newState;
      if (this.options.onStateChange) {
        this.options.onStateChange(newState);
      }
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.failureCount = 0;
    this.setState(CircuitState.CLOSED);
  }
}
