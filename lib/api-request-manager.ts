/**
 * API Request Manager
 * Centralized rate limiting, throttling, and request queue management
 * for external API calls
 */

interface RequestQueueItem {
  id: string;
  execute: () => Promise<any>;
  priority: number;
  createdAt: number;
}

interface RateLimitConfig {
  requestsPerSecond: number;
  burstSize?: number;
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
class RequestQueue {
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

    try {
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

        // Execute request without blocking queue processing.
        // .catch() suppresses the re-throw from inside execute() — the error is
        // already forwarded to the caller via reject(), so leaving it unhandled
        // here causes a spurious unhandled-rejection crash in Node 15+.
        item.execute().catch(() => { /* handled via reject() */ }).finally(() => {
          this.activeRequests--;
        });
      }
    } finally {
      // Reset flag BEFORE checking for remaining items so any items enqueued
      // during the await above are not orphaned.
      this.processing = false;
      // If items arrived between the last loop check and the flag reset, process them now.
      if (this.queue.length > 0) {
        void this.processQueue();
      }
    }
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

export const oddsApiQueue = new RequestQueue(
  {
    requestsPerSecond: 2, // Conservative limit for free tier (avoid 429s)
    burstSize: 4, // Small burst to prevent thundering herd
  },
  2 // Max 2 concurrent requests — prevents rate-limit cascading
);

export const playerPropsQueue = new RequestQueue(
  {
    requestsPerSecond: 2, // Even more conservative for props
    burstSize: 5,
  },
  3 // Max 3 concurrent requests
);

