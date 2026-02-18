/**
 * Debug Utilities
 * Centralized debugging and diagnostics for troubleshooting data flow
 */

export interface DebugContext {
  component: string;
  operation: string;
  timestamp: string;
  data?: any;
  error?: any;
  metrics?: Record<string, number>;
}

/**
 * Structured debug logging with context
 */
export function debugLog(context: DebugContext): void {
  if (process.env.NODE_ENV === 'development' || process.env.ENABLE_DEBUG_LOGS === 'true') {
    console.log(`[v0] [DEBUG] [${context.component}]`, {
      operation: context.operation,
      timestamp: context.timestamp,
      ...(context.data && { data: context.data }),
      ...(context.error && { error: context.error }),
      ...(context.metrics && { metrics: context.metrics })
    });
  }
}

/**
 * Performance timer for measuring operation duration
 */
export class PerformanceTimer {
  private startTime: number;
  private marks: Map<string, number>;

  constructor() {
    this.startTime = Date.now();
    this.marks = new Map();
  }

  mark(label: string): void {
    this.marks.set(label, Date.now() - this.startTime);
  }

  getElapsed(): number {
    return Date.now() - this.startTime;
  }

  getMarks(): Record<string, number> {
    return Object.fromEntries(this.marks);
  }

  report(component: string, operation: string): void {
    debugLog({
      component,
      operation,
      timestamp: new Date().toISOString(),
      metrics: {
        totalMs: this.getElapsed(),
        ...this.getMarks()
      }
    });
  }
}

/**
 * Data flow tracker for debugging API chains
 */
export class DataFlowTracker {
  private steps: Array<{
    step: string;
    timestamp: string;
    duration: number;
    data?: any;
    error?: any;
  }>;
  private startTime: number;

  constructor(private flowName: string) {
    this.steps = [];
    this.startTime = Date.now();
    this.addStep('flow_started', { flowName });
  }

  addStep(step: string, data?: any, error?: any): void {
    this.steps.push({
      step,
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      data,
      error
    });
  }

  complete(finalData?: any): void {
    this.addStep('flow_completed', finalData);
    this.report();
  }

  fail(error: any): void {
    this.addStep('flow_failed', undefined, error);
    this.report();
  }

  private report(): void {
    console.log(`[v0] [DataService] [DataFlow: ${this.flowName}]`, {
      totalDuration: Date.now() - this.startTime,
      steps: this.steps
    });
  }

  getSteps() {
    return this.steps;
  }
}

/**
 * Database query debugger
 */
export function debugQuery(
  tableName: string,
  queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
  filters?: any,
  result?: { data: any; error: any; count?: number }
): void {
  debugLog({
    component: 'Database',
    operation: `${queryType} ${tableName}`,
    timestamp: new Date().toISOString(),
    data: {
      table: tableName,
      queryType,
      filters,
      resultCount: result?.data?.length || result?.count || 0,
      hasError: !!result?.error
    },
    error: result?.error
  });
}

/**
 * API call debugger
 */
export function debugApiCall(
  endpoint: string,
  method: string,
  requestData?: any,
  response?: { status: number; data?: any; error?: any }
): void {
  debugLog({
    component: 'API',
    operation: `${method} ${endpoint}`,
    timestamp: new Date().toISOString(),
    data: {
      endpoint,
      method,
      requestData,
      responseStatus: response?.status,
      hasData: !!response?.data,
      hasError: !!response?.error
    },
    error: response?.error
  });
}

/**
 * Check if debug mode is enabled
 */
export function isDebugEnabled(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.ENABLE_DEBUG_LOGS === 'true';
}

/**
 * Create a debug snapshot of application state
 */
export interface SystemSnapshot {
  timestamp: string;
  environment: {
    nodeEnv: string;
    debugEnabled: boolean;
    envVars: Record<string, boolean>;
  };
  database: {
    connectionStatus: 'unknown' | 'connected' | 'error';
    lastQuery?: string;
    lastError?: string;
  };
  cache: {
    size: number;
    keys: string[];
  };
  performance: {
    uptime: number;
  };
}

export function createSystemSnapshot(additionalData?: any): SystemSnapshot {
  return {
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV || 'unknown',
      debugEnabled: isDebugEnabled(),
      envVars: {
        SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        XAI_API_KEY: !!process.env.XAI_API_KEY
      }
    },
    database: {
      connectionStatus: 'unknown',
      ...(additionalData?.database || {})
    },
    cache: additionalData?.cache || { size: 0, keys: [] },
    performance: {
      uptime: typeof process !== 'undefined' && typeof process.uptime === 'function' ? process.uptime() : 0
    }
  };
}
