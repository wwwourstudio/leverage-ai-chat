/**
 * Production-Grade Structured Logger
 * Provides request tracing, performance monitoring, and alerting hooks
 */

import { headers } from 'next/headers';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

export enum LogCategory {
  DATABASE = 'database',
  AI = 'ai',
  API = 'api',
  AUTH = 'auth',
  CACHE = 'cache',
  SYSTEM = 'system',
}

interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  component?: string;
  operation?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

interface PerformanceThreshold {
  warn: number;
  error: number;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  context: LogContext;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

class Logger {
  private static instance: Logger;
  private requestIdCounter = 0;
  
  // Performance thresholds (in ms)
  private performanceThresholds: Record<string, PerformanceThreshold> = {
    'database.query': { warn: 500, error: 2000 },
    'database.insert': { warn: 300, error: 1000 },
    'ai.inference': { warn: 3000, error: 10000 },
    'api.odds': { warn: 1000, error: 3000 },
    'api.request': { warn: 2000, error: 5000 },
  };

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Generate or retrieve request ID for tracing
   */
  private getRequestId(): string {
    try {
      const headersList = headers();
      const existingId = headersList.get('x-request-id') || headersList.get('x-vercel-id');
      if (existingId) return existingId;
    } catch {
      // Headers not available (client-side or non-request context)
    }
    
    return `req_${Date.now()}_${++this.requestIdCounter}`;
  }

  /**
   * Format log entry as structured JSON
   */
  private formatLogEntry(
    level: LogLevel,
    category: LogCategory,
    message: string,
    context: LogContext = {},
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      context: {
        requestId: context.requestId || this.getRequestId(),
        ...context,
      },
    };

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    }

    return entry;
  }

  /**
   * Output log to console with appropriate method
   */
  private output(entry: LogEntry): void {
    const formatted = JSON.stringify(entry);
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.log(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formatted);
        break;
    }

    // Hook for external monitoring (Sentry, Datadog, etc.)
    if (entry.level === LogLevel.ERROR || entry.level === LogLevel.FATAL) {
      this.sendToMonitoring(entry);
    }
  }

  /**
   * Send critical logs to monitoring service
   */
  private sendToMonitoring(entry: LogEntry): void {
    // TODO: Integrate with monitoring service (Sentry, Datadog, Vercel Analytics)
    // Example: Sentry.captureException(entry.error, { extra: entry.context });
    
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'exception', {
        description: entry.message,
        fatal: entry.level === LogLevel.FATAL,
      });
    }
  }

  /**
   * Check performance against thresholds and auto-log warnings
   */
  private checkPerformance(
    operation: string,
    duration: number,
    context: LogContext
  ): void {
    const threshold = this.performanceThresholds[operation];
    if (!threshold) return;

    if (duration >= threshold.error) {
      this.error(
        LogCategory.SYSTEM,
        `Performance critical: ${operation} took ${duration}ms (threshold: ${threshold.error}ms)`,
        { ...context, duration, threshold: threshold.error }
      );
    } else if (duration >= threshold.warn) {
      this.warn(
        LogCategory.SYSTEM,
        `Performance degraded: ${operation} took ${duration}ms (threshold: ${threshold.warn}ms)`,
        { ...context, duration, threshold: threshold.warn }
      );
    }
  }

  // ========================================================================
  // Public Logging Methods
  // ========================================================================

  debug(category: LogCategory, message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'production') return; // Skip debug in production
    const entry = this.formatLogEntry(LogLevel.DEBUG, category, message, context);
    this.output(entry);
  }

  info(category: LogCategory, message: string, context?: LogContext): void {
    const entry = this.formatLogEntry(LogLevel.INFO, category, message, context);
    this.output(entry);
  }

  warn(category: LogCategory, message: string, context?: LogContext): void {
    const entry = this.formatLogEntry(LogLevel.WARN, category, message, context);
    this.output(entry);
  }

  error(
    category: LogCategory,
    message: string,
    contextOrError?: LogContext | Error,
    errorOverride?: Error
  ): void {
    let context: LogContext = {};
    let error: Error | undefined;

    if (contextOrError instanceof Error) {
      error = contextOrError;
    } else {
      context = contextOrError || {};
      error = errorOverride;
    }

    const entry = this.formatLogEntry(LogLevel.ERROR, category, message, context, error);
    this.output(entry);
  }

  fatal(
    category: LogCategory,
    message: string,
    contextOrError?: LogContext | Error,
    errorOverride?: Error
  ): void {
    let context: LogContext = {};
    let error: Error | undefined;

    if (contextOrError instanceof Error) {
      error = contextOrError;
    } else {
      context = contextOrError || {};
      error = errorOverride;
    }

    const entry = this.formatLogEntry(LogLevel.FATAL, category, message, context, error);
    this.output(entry);
  }

  // ========================================================================
  // Specialized Logging Methods
  // ========================================================================

  /**
   * Log database operations with automatic performance tracking
   */
  database(operation: 'query' | 'insert' | 'update' | 'delete', context: LogContext): void {
    const { duration, ...rest } = context;
    
    if (duration !== undefined) {
      this.checkPerformance(`database.${operation}`, duration, rest);
    }

    this.info(LogCategory.DATABASE, `Database ${operation} completed`, context);
  }

  /**
   * Log AI operations with token tracking and latency
   */
  ai(
    operation: string,
    context: LogContext & { model?: string; tokens?: number; cost?: number }
  ): void {
    const { duration, ...rest } = context;
    
    if (duration !== undefined) {
      this.checkPerformance('ai.inference', duration, rest);
    }

    this.info(LogCategory.AI, `AI operation: ${operation}`, context);
  }

  /**
   * Log API requests with status and latency
   */
  api(
    endpoint: string,
    method: string,
    statusCode: number,
    context: LogContext & { statusCode?: number }
  ): void {
    const { duration, ...rest } = context;
    const fullContext = { ...rest, statusCode, method, endpoint };
    
    if (duration !== undefined) {
      this.checkPerformance('api.request', duration, fullContext);
    }

    const level = statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    const entry = this.formatLogEntry(
      level,
      LogCategory.API,
      `API ${method} ${endpoint} → ${statusCode}`,
      fullContext
    );
    this.output(entry);
  }

  /**
   * Log system initialization events
   */
  systemInit(component: string, success: boolean, context?: LogContext): void {
    const message = `${component} initialization ${success ? 'completed' : 'failed'}`;
    
    if (success) {
      this.info(LogCategory.SYSTEM, message, { ...context, component });
    } else {
      this.error(LogCategory.SYSTEM, message, { ...context, component });
    }
  }

  /**
   * Create a performance timer
   */
  startTimer(operation: string, context?: LogContext): () => void {
    const startTime = Date.now();
    const requestId = this.getRequestId();

    return () => {
      const duration = Date.now() - startTime;
      this.info(LogCategory.SYSTEM, `${operation} completed`, {
        ...context,
        requestId,
        operation,
        duration,
      });
      this.checkPerformance(operation, duration, { ...context, requestId, operation });
    };
  }

  /**
   * Log cache operations
   */
  cache(operation: 'hit' | 'miss' | 'set' | 'clear', key: string, context?: LogContext): void {
    this.debug(LogCategory.CACHE, `Cache ${operation}: ${key}`, context);
  }
}

// ========================================================================
// Exports
// ========================================================================

export const logger = Logger.getInstance();

/**
 * Convenience function: Create scoped logger with persistent context
 */
export function createScopedLogger(component: string, persistentContext: LogContext = {}) {
  return {
    debug: (message: string, context?: LogContext) =>
      logger.debug(LogCategory.SYSTEM, message, { ...persistentContext, component, ...context }),
    
    info: (message: string, context?: LogContext) =>
      logger.info(LogCategory.SYSTEM, message, { ...persistentContext, component, ...context }),
    
    warn: (message: string, context?: LogContext) =>
      logger.warn(LogCategory.SYSTEM, message, { ...persistentContext, component, ...context }),
    
    error: (message: string, contextOrError?: LogContext | Error, error?: Error) =>
      logger.error(
        LogCategory.SYSTEM,
        message,
        contextOrError instanceof Error ? { ...persistentContext, component } : { ...persistentContext, component, ...contextOrError },
        contextOrError instanceof Error ? contextOrError : error
      ),
  };
}

/**
 * Decorator: Auto-log function execution with performance tracking
 */
export function logExecution(category: LogCategory, operationName?: string) {
  return function (
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const operation = operationName || propertyKey;

    descriptor.value = async function (...args: any[]) {
      const endTimer = logger.startTimer(operation);
      
      try {
        const result = await originalMethod.apply(this, args);
        endTimer();
        return result;
      } catch (error) {
        endTimer();
        logger.error(
          category,
          `${operation} failed`,
          error instanceof Error ? error : new Error(String(error))
        );
        throw error;
      }
    };

    return descriptor;
  };
}
