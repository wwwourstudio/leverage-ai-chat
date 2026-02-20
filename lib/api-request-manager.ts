/**
 * API Request Manager
 * Centralized rate limiting, throttling, and request queue management
 * for external API calls
 */

export interface RequestQueueItem {
  id: string;
  execute: () => Promise<any>;
  priority: number;
  createdAt: number;
}

export interface RateLimitConfig {
  requestsPerSecond: number;
  burstSize?: number;
  retryAfterMs?: number;
}

/**
 * Token Bucket Rate Limiter
 * Allows burst requests up to bucket capacity while maintaining average rate
 */
class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefillTime: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per millisecond

  constructor(requestsPerSecond: number, burstSize?: number) {
    this.maxTokens = burstSize || requestsPerSecond;
    this.tokens = this.maxTokens;
    this.refillRate = requestsPerSecond / 1000;
    this.lastRefillTime = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefillTime;
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }

  async acquire(tokens: number = 1): Promise<void> {
    while (true) {
      this.refill();
      
      if (this.tokens >= tokens) {
        this.tokens -= tokens;
        return;
      }
      
      // Calculate wait time
      const tokensNeeded = tokens - this.tokens;
      const waitTimeMs = tokensNeeded / this.refillRate;
      
      await new Promise(resolve => setTimeout(resolve, Math.min(waitTimeMs, 1000)));
    }
  }

  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

/**
 * Priority Request Queue with Rate Limiting
 */
export class RequestQueue {
  private queue: RequestQueueItem[] = [];
  private processing = false;
  private rateLimiter: TokenBucketRateLimiter;
  private activeRequests = 0;
  private readonly maxConcurrent: number;

  constructor(config: RateLimitConfig, maxConcurrent: number = 5) {
    this.rateLimiter = new TokenBucketRateLimiter(
      config.requestsPerSecond,
      config.burstSize
    );
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Add request to queue
   * @param request Function that executes the request
   * @param priority Higher priority = executed first (default: 0)
   */
  async enqueue<T>(
    request: () => Promise<T>,
    priority: number = 0
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const item: RequestQueueItem = {
        id: `req-${Date.now()}-${Math.random()}`,
        execute: async () => {
          try {
            const result = await request();
            resolve(result);
            return result;
          } catch (error) {
            reject(error);
            throw error;
          }
        },
        priority,
        createdAt: Date.now(),
      };

      this.queue.push(item);
      this.queue.sort((a, b) => {
        // Sort by priority (descending), then by creation time (ascending)
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.createdAt - b.createdAt;
      });

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      // Wait if we've hit concurrent limit
      while (this.activeRequests >= this.maxConcurrent) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const item = this.queue.shift();
      if (!item) break;

      // Acquire rate limit token
      await this.rateLimiter.acquire();

      this.activeRequests++;
      
      // Execute request without blocking queue processing
      item.execute().finally(() => {
        this.activeRequests--;
      });
    }

    this.processing = false;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getActiveRequests(): number {
    return this.activeRequests;
  }

  getAvailableCapacity(): number {
    return this.rateLimiter.getAvailableTokens();
  }
}

/**
 * Exponential Backoff with Jitter
 */
export async function exponentialBackoff(
  attempt: number,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 30000
): Promise<void> {
  const exponentialDelay = Math.min(
    baseDelayMs * Math.pow(2, attempt),
    maxDelayMs
  );
  
  // Add random jitter (0-25% of delay)
  const jitter = exponentialDelay * 0.25 * Math.random();
  const finalDelay = exponentialDelay + jitter;
  
  console.log(`[API] Backing off for ${Math.round(finalDelay)}ms (attempt ${attempt + 1})`);
  
  await new Promise(resolve => setTimeout(resolve, finalDelay));
}

/**
 * Retry with exponential backoff
 */
export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (error: any) => boolean;
    onRetry?: (attempt: number, error: any) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    shouldRetry = (error: any) => {
      const status = error?.status || error?.response?.status;
      // Retry on network errors, 5xx errors, and 429 (rate limit)
      return !status || status === 429 || status >= 500;
    },
    onRetry,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries - 1 || !shouldRetry(error)) {
        throw error;
      }

      if (onRetry) {
        onRetry(attempt, error);
      }

      await exponentialBackoff(attempt, baseDelayMs, maxDelayMs);
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Batch requests with automatic splitting
 */
export async function batchRequests<T, R>(
  items: T[],
  requestFn: (item: T) => Promise<R>,
  options: {
    batchSize?: number;
    delayBetweenBatchesMs?: number;
    queue?: RequestQueue;
  } = {}
): Promise<R[]> {
  const {
    batchSize = 5,
    delayBetweenBatchesMs = 1000,
  } = options;

  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    console.log(`[API] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`);
    
    const batchResults = await Promise.all(
      batch.map(item => requestFn(item))
    );
    
    results.push(...batchResults);
    
    // Delay between batches (except for last batch)
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatchesMs));
    }
  }
  
  return results;
}

/**
 * Global request queue instances for different services
 */
export const oddsApiQueue = new RequestQueue(
  {
    requestsPerSecond: 4, // Conservative limit for free tier
    burstSize: 10, // Allow small bursts
  },
  5 // Max 5 concurrent requests
);

export const playerPropsQueue = new RequestQueue(
  {
    requestsPerSecond: 2, // Even more conservative for props
    burstSize: 5,
  },
  3 // Max 3 concurrent requests
);

export const weatherApiQueue = new RequestQueue(
  {
    requestsPerSecond: 10, // Weather APIs typically have higher limits
    burstSize: 20,
  },
  10
);
