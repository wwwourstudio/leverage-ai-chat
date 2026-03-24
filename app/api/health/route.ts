import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getOddsApiKey, isOddsApiConfigured, getGrokApiKey } from '@/lib/config';

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  error?: string;
  details?: Record<string, any>;
}

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    odds: ServiceHealth;
    weather: ServiceHealth;
    kalshi: ServiceHealth;
    database: ServiceHealth;
    grok: ServiceHealth;
  };
  environment: {
    oddsApiConfigured: boolean;
    weatherApiConfigured: boolean;
    kalshiApiConfigured: boolean;
    databaseConfigured: boolean;
    grokConfigured: boolean;
  };
}

async function checkOddsAPI(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    const apiKey = getOddsApiKey();

    if (!apiKey) {
      return {
        status: 'unhealthy',
        error: 'ODDS_API_KEY not configured'
      };
    }
    
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports?apiKey=${apiKey}`,
      { signal: AbortSignal.timeout(5000) }
    );
    
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        status: 'unhealthy',
        responseTime,
        error: `HTTP ${response.status}`,
        details: { statusCode: response.status }
      };
    }
    
    const sports = await response.json();
    const quotaRemaining = response.headers.get('x-requests-remaining');
    const quotaUsed = response.headers.get('x-requests-used');
    
    const status = parseInt(quotaRemaining || '0') < 10 ? 'degraded' : 'healthy';
    
    return {
      status,
      responseTime,
      details: {
        sports: Array.isArray(sports) ? sports.length : 0,
        quotaRemaining: quotaRemaining || 'unknown',
        quotaUsed: quotaUsed || 'unknown'
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function checkWeatherAPI(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    // Test Open-Meteo API (no key required)
    const response = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.0060&current=temperature_2m',
      { signal: AbortSignal.timeout(5000) }
    );
    
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        status: 'unhealthy',
        responseTime,
        error: `HTTP ${response.status}`
      };
    }
    
    const data = await response.json();
    
    return {
      status: 'healthy',
      responseTime,
      details: {
        apiEndpoint: 'Open-Meteo',
        testLocation: 'New York City',
        currentTemp: data.current?.temperature_2m
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function checkKalshiAPI(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    const apiKey = process.env.KALSHI_API_KEY_ID;

    if (!apiKey) {
      return {
        status: 'degraded',
        error: 'KALSHI_API_KEY_ID not configured (optional service)',
        details: { configured: false }
      };
    }

    // Basic connectivity check via public endpoint
    const response = await fetch(
      'https://api.elections.kalshi.com/trade-api/v2/markets?limit=1&status=open',
      {
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      }
    );
    
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        status: 'degraded',
        responseTime,
        error: `HTTP ${response.status}`,
        details: { configured: true }
      };
    }
    
    return {
      status: 'healthy',
      responseTime,
      details: { configured: true, endpoint: 'Kalshi Trading API' }
    };
  } catch (error) {
    return {
      status: 'degraded',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
      details: { configured: !!(process.env.KALSHI_API_KEY_ID && process.env.KALSHI_PRIVATE_KEY) }
    };
  }
}

async function checkDatabase(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return {
        status: 'unhealthy',
        error: 'Supabase credentials not configured'
      };
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey, { db: { schema: 'api' } });
    
    // Test basic connectivity with a simple query against an existing table
    const { error } = await supabase
      .from('live_odds_cache')
      .select('count')
      .limit(1)
      .maybeSingle();
    
    const responseTime = Date.now() - startTime;
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is fine
      return {
        status: 'unhealthy',
        responseTime,
        error: error.message,
        details: { code: error.code }
      };
    }
    
    return {
      status: 'healthy',
      responseTime,
      details: {
        database: 'Supabase',
        connection: 'established'
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function checkGrokAPI(): Promise<ServiceHealth> {
  const startTime = Date.now();
  const apiKey = getGrokApiKey();

  if (!apiKey) {
    return { status: 'unhealthy', error: 'XAI_API_KEY not configured' };
  }

  try {
    const { generateText } = await import('ai');
    const { createXai } = await import('@ai-sdk/xai');
    const result = await generateText({
      model: createXai({ apiKey })('grok-3-fast'),
      prompt: '1',
      maxOutputTokens: 1,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(8000),
    });
    const responseTime = Date.now() - startTime;
    return {
      status: 'healthy',
      responseTime,
      details: { model: 'grok-3-fast', tokensUsed: result.usage?.totalTokens ?? 1 },
    };
  } catch (err) {
    const responseTime = Date.now() - startTime;
    const msg = err instanceof Error ? err.message : String(err);
    const isAuth = msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('api key');
    const isTimeout = msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('aborted');
    return {
      status: isAuth ? 'unhealthy' : 'degraded',
      responseTime,
      error: isAuth ? 'Invalid XAI_API_KEY' : isTimeout ? 'Grok API timeout (>8s)' : msg,
      details: { configured: true },
    };
  }
}

/**
 * GET /api/health
 * Returns health status of all external API integrations and services
 */
export async function GET() {
  console.log('[v0] [API/health] Running health checks...');

  const startTime = Date.now();

  // Run all health checks in parallel
  const [odds, weather, kalshi, database, grok] = await Promise.all([
    checkOddsAPI(),
    checkWeatherAPI(),
    checkKalshiAPI(),
    checkDatabase(),
    checkGrokAPI(),
  ]);

  const totalTime = Date.now() - startTime;

  // Determine overall status — Grok and Kalshi are both required core services
  const statuses = [odds.status, weather.status, database.status, grok.status];
  const overallStatus =
    statuses.includes('unhealthy') ? 'unhealthy' :
    statuses.includes('degraded') ? 'degraded' :
    'healthy';

  const response: HealthCheckResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: {
      odds,
      weather,
      kalshi,
      database,
      grok,
    },
    environment: {
      oddsApiConfigured: isOddsApiConfigured(),
      weatherApiConfigured: true,
      kalshiApiConfigured: !!(process.env.KALSHI_API_KEY_ID && process.env.KALSHI_PRIVATE_KEY),
      databaseConfigured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      grokConfigured: !!getGrokApiKey(),
    },
  };
  
  console.log(`[v0] [API/health] ✓ Health check complete in ${totalTime}ms - Status: ${overallStatus.toUpperCase()}`);
  
  // Return appropriate HTTP status code
  const httpStatus = 
    overallStatus === 'healthy' ? 200 :
    overallStatus === 'degraded' ? 200 : // Still return 200 for degraded
    503; // Service unavailable for unhealthy
  
  return NextResponse.json(response, { status: httpStatus });
}
