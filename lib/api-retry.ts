/**
 * API Retry Utility with Exponential Backoff
 * Production-grade retry logic for external API calls
 */

export interface RetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryOnStatus?: number[];
  timeoutMs?: number;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
  totalTime: number;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryOnStatus: [408, 429, 500, 502, 503, 504],
  timeoutMs: 10000,
};

/**
 * Sleep utility for async delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, config: Required<RetryConfig>): number {
  const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  
  // Add jitter (±20% randomness) to prevent thundering herd
  const jitter = cappedDelay * 0.2 * (Math.random() - 0.5);
  return Math.floor(cappedDelay + jitter);
}

/**
 * Retry a fetch request with exponential backoff
 */
export async function retryFetch<T = any>(
  url: string,
  options: RequestInit = {},
  config: RetryConfig = {}
): Promise<RetryResult<T>> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  let lastError: string | undefined;
  
  for (let attempt = 1; attempt <= mergedConfig.maxRetries; attempt++) {
    try {
      console.log(`[RetryFetch] Attempt ${attempt}/${mergedConfig.maxRetries} for ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), mergedConfig.timeoutMs);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Success case
      if (response.ok) {
        const data = await response.json();
        const totalTime = Date.now() - startTime;
        
        console.log(`[RetryFetch] Success on attempt ${attempt} (${totalTime}ms)`);
        
        return {
          success: true,
          data,
          attempts: attempt,
          totalTime,
        };
      }
      
      // Check if status is retryable
      if (!mergedConfig.retryOnStatus.includes(response.status)) {
        const errorText = await response.text();
        lastError = `HTTP ${response.status}: ${errorText.substring(0, 100)}`;
        
        console.error(`[RetryFetch] Non-retryable error: ${lastError}`);
        
        return {
          success: false,
          error: lastError,
          attempts: attempt,
          totalTime: Date.now() - startTime,
        };
      }
      
      // Retryable error
      lastError = `HTTP ${response.status}`;
      console.warn(`[RetryFetch] Retryable error on attempt ${attempt}: ${lastError}`);
      
      // Don't sleep after last attempt
      if (attempt < mergedConfig.maxRetries) {
        const delayMs = calculateDelay(attempt, mergedConfig);
        console.log(`[RetryFetch] Waiting ${delayMs}ms before retry...`);
        await sleep(delayMs);
      }
      
    } catch (error: any) {
      lastError = error.message || String(error);
      console.error(`[RetryFetch] Exception on attempt ${attempt}:`, lastError);
      
      // Timeout or network error - always retry
      if (attempt < mergedConfig.maxRetries) {
        const delayMs = calculateDelay(attempt, mergedConfig);
        console.log(`[RetryFetch] Waiting ${delayMs}ms before retry...`);
        await sleep(delayMs);
      }
    }
  }
  
  // All retries exhausted
  const totalTime = Date.now() - startTime;
  console.error(`[RetryFetch] All ${mergedConfig.maxRetries} retries failed (${totalTime}ms)`);
  
  return {
    success: false,
    error: lastError || 'All retries failed',
    attempts: mergedConfig.maxRetries,
    totalTime,
  };
}

/**
 * Retry any async function with exponential backoff
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<RetryResult<T>> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  let lastError: string | undefined;
  
  for (let attempt = 1; attempt <= mergedConfig.maxRetries; attempt++) {
    try {
      console.log(`[RetryAsync] Attempt ${attempt}/${mergedConfig.maxRetries}`);
      
      const data = await fn();
      const totalTime = Date.now() - startTime;
      
      console.log(`[RetryAsync] Success on attempt ${attempt} (${totalTime}ms)`);
      
      return {
        success: true,
        data,
        attempts: attempt,
        totalTime,
      };
    } catch (error: any) {
      lastError = error.message || String(error);
      console.error(`[RetryAsync] Error on attempt ${attempt}:`, lastError);
      
      if (attempt < mergedConfig.maxRetries) {
        const delayMs = calculateDelay(attempt, mergedConfig);
        console.log(`[RetryAsync] Waiting ${delayMs}ms before retry...`);
        await sleep(delayMs);
      }
    }
  }
  
  const totalTime = Date.now() - startTime;
  console.error(`[RetryAsync] All ${mergedConfig.maxRetries} retries failed (${totalTime}ms)`);
  
  return {
    success: false,
    error: lastError || 'All retries failed',
    attempts: mergedConfig.maxRetries,
    totalTime,
  };
}

/**
 * Retry with circuit breaker pattern
 * Opens circuit after too many failures, preventing wasteful retries
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private failureThreshold = 5,
    private resetTimeoutMs = 60000 // 1 minute
  ) {}
  
  async execute<T>(
    fn: () => Promise<T>,
    config: RetryConfig = {}
  ): Promise<RetryResult<T>> {
    // Check circuit state
    if (this.state === 'open') {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      
      if (timeSinceFailure < this.resetTimeoutMs) {
        console.warn(`[CircuitBreaker] Circuit is OPEN - rejecting request`);
        return {
          success: false,
          error: 'Circuit breaker is open',
          attempts: 0,
          totalTime: 0,
        };
      }
      
      // Try to close circuit
      console.log(`[CircuitBreaker] Attempting to close circuit (half-open state)`);
      this.state = 'half-open';
    }
    
    const result = await retryAsync(fn, config);
    
    if (result.success) {
      this.onSuccess();
    } else {
      this.onFailure();
    }
    
    return result;
  }
  
  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
    console.log(`[CircuitBreaker] Circuit is CLOSED`);
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      console.error(
        `[CircuitBreaker] Circuit is OPEN after ${this.failures} failures`
      );
    }
  }
  
  getState(): string {
    return this.state;
  }
  
  getFailures(): number {
    return this.failures;
  }
  
  reset(): void {
    this.failures = 0;
    this.state = 'closed';
    console.log(`[CircuitBreaker] Circuit manually reset`);
  }
}

/**
 * Global circuit breakers for different services
 */
export const oddsApiCircuitBreaker = new CircuitBreaker(5, 60000);
export const kalshiApiCircuitBreaker = new CircuitBreaker(5, 60000);
