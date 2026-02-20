import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

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
  };
  environment: {
    oddsApiConfigured: boolean;
    weatherApiConfigured: boolean;
    kalshiApiConfigured: boolean;
    databaseConfigured: boolean;
  };
}

async function checkOddsAPI(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    const apiKey = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
    
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
    const apiKey = process.env.KALSHI_API_KEY;
    
    if (!apiKey) {
      return {
        status: 'degraded',
        error: 'KALSHI_API_KEY not configured (optional service)',
        details: { configured: false }
      };
    }
    
    // Basic connectivity check via public endpoint
    const response = await fetch(
      'https://trading-api.kalshi.com/trade-api/v2/markets?limit=1&status=open',
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
      details: { configured: !!process.env.KALSHI_API_KEY }
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
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test basic connectivity with a simple query
    const { data, error } = await supabase
      .from('ai_predictions')
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

/**
 * GET /api/health
 * Returns health status of all external API integrations and services
 */
export async function GET() {
  console.log('[v0] [API/health] Running health checks...');
  
  const startTime = Date.now();
  
  // Run all health checks in parallel
  const [odds, weather, kalshi, database] = await Promise.all([
    checkOddsAPI(),
    checkWeatherAPI(),
    checkKalshiAPI(),
    checkDatabase()
  ]);
  
  const totalTime = Date.now() - startTime;
  
  // Determine overall status
  const statuses = [odds.status, weather.status, database.status]; // Kalshi is optional
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
      database
    },
    environment: {
      oddsApiConfigured: !!(process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY),
      weatherApiConfigured: true, // Open-Meteo doesn't require API key
      kalshiApiConfigured: !!process.env.KALSHI_API_KEY,
      databaseConfigured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    }
  };
  
  console.log(`[v0] [API/health] ✓ Health check complete in ${totalTime}ms - Status: ${overallStatus.toUpperCase()}`);
  
  // Return appropriate HTTP status code
  const httpStatus = 
    overallStatus === 'healthy' ? 200 :
    overallStatus === 'degraded' ? 200 : // Still return 200 for degraded
    503; // Service unavailable for unhealthy
  
  return NextResponse.json(response, { status: httpStatus });
}
