import { NextResponse } from 'next/server';
import {  getOddsApiKey, isOddsApiConfigured } from '@/lib/config';
import { ENV_KEYS, LOG_PREFIXES } from '@/lib/constants';

export const runtime = 'edge';

/**
 * Comprehensive System Health Check
 * Returns overall system status, integration health, and service availability
 */
export async function GET() {
  const startTime = Date.now();
  
  const healthCheck = {
    status: 'healthy' as 'healthy' | 'degraded' | 'down',
    timestamp: new Date().toISOString(),
    uptime: typeof process.uptime === 'function' ? Math.floor(process.uptime()) : undefined,
    services: {
      database: { status: 'unknown' as string, message: '', latency: 0 },
      oddsAPI: { status: 'unknown' as string, message: '', configured: false },
      aiGateway: { status: 'unknown' as string, message: '', configured: false },
      weatherAPI: { status: 'unknown' as string, message: '', configured: false }
    },
    environment: {
      runtime: 'edge',
      region: process.env.VERCEL_REGION || 'unknown',
      deployment: process.env.VERCEL_ENV || 'development'
    },
    metrics: {
      responseTime: 0,
      checksPerformed: 0,
      checksPassed: 0
    }
  };

  let checksPerformed = 0;
  let checksPassed = 0;

  // Check 1: Database Health
  try {
    checksPerformed++;
    const dbStartTime = Date.now();
    
    const dbHealthResponse = await fetch(
      new URL('/api/health/database', new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')).toString(),
      { 
        method: 'GET',
        headers: { 'x-health-check': 'true' }
      }
    );
    
    const dbLatency = Date.now() - dbStartTime;
    const dbHealth = await dbHealthResponse.json();
    
    healthCheck.services.database.latency = dbLatency;
    healthCheck.services.database.status = dbHealth.status || 'unknown';
    healthCheck.services.database.message = dbHealth.status === 'healthy' 
      ? 'Connected and operational'
      : dbHealth.recommendations?.[0] || 'Check database health endpoint for details';
    
    if (dbHealth.status === 'healthy') {
      checksPassed++;
    }
  } catch (error) {
    healthCheck.services.database.status = 'error';
    healthCheck.services.database.message = 'Unable to reach database health check';
    console.error(`${LOG_PREFIXES.API} Database health check failed:`, error);
  }

  // Check 2: Odds API Configuration
  try {
    checksPerformed++;
    const oddsConfigured = isOddsApiConfigured();
    const oddsKey = getOddsApiKey();
    
    healthCheck.services.oddsAPI.configured = oddsConfigured;
    
    if (oddsConfigured && oddsKey) {
      healthCheck.services.oddsAPI.status = 'configured';
      healthCheck.services.oddsAPI.message = `API key configured (${oddsKey.substring(0, 8)}...)`;
      checksPassed++;
    } else {
      healthCheck.services.oddsAPI.status = 'not_configured';
      healthCheck.services.oddsAPI.message = 'ODDS_API_KEY not set in environment variables';
    }
  } catch (error) {
    healthCheck.services.oddsAPI.status = 'error';
    healthCheck.services.oddsAPI.message = 'Configuration check failed';
  }

  // Check 3: AI Gateway (Grok xAI)
  try {
    checksPerformed++;
    const xaiKey = process.env[ENV_KEYS.XAI_API_KEY];
    
    healthCheck.services.aiGateway.configured = !!xaiKey;
    
    if (xaiKey) {
      healthCheck.services.aiGateway.status = 'configured';
      healthCheck.services.aiGateway.message = `Grok API key configured (${xaiKey.substring(0, 8)}...)`;
      checksPassed++;
    } else {
      healthCheck.services.aiGateway.status = 'not_configured';
      healthCheck.services.aiGateway.message = 'XAI_API_KEY not set - AI analysis unavailable';
    }
  } catch (error) {
    healthCheck.services.aiGateway.status = 'error';
    healthCheck.services.aiGateway.message = 'AI Gateway check failed';
  }

  // Check 4: Weather API Configuration (optional)
  try {
    checksPerformed++;
    const weatherKey = process.env.OPENWEATHER_API_KEY || process.env.WEATHER_API_KEY;
    
    healthCheck.services.weatherAPI.configured = !!weatherKey;
    
    if (weatherKey) {
      healthCheck.services.weatherAPI.status = 'configured';
      healthCheck.services.weatherAPI.message = 'Weather API configured';
      checksPassed++;
    } else {
      healthCheck.services.weatherAPI.status = 'not_configured';
      healthCheck.services.weatherAPI.message = 'Weather API not configured (optional feature)';
      // Don't fail health check for optional weather API
      checksPassed++;
    }
  } catch (error) {
    healthCheck.services.weatherAPI.status = 'error';
    healthCheck.services.weatherAPI.message = 'Weather API check failed';
  }

  // Calculate overall status
  const passRate = checksPassed / checksPerformed;
  
  if (passRate >= 0.75) {
    healthCheck.status = 'healthy';
  } else if (passRate >= 0.5) {
    healthCheck.status = 'degraded';
  } else {
    healthCheck.status = 'down';
  }

  // Update metrics
  healthCheck.metrics = {
    responseTime: Date.now() - startTime,
    checksPerformed,
    checksPassed
  };

  // Determine HTTP status code
  const httpStatus = healthCheck.status === 'healthy' ? 200 
    : healthCheck.status === 'degraded' ? 200 
    : 503;

  console.log(`${LOG_PREFIXES.API} System health: ${healthCheck.status} (${checksPassed}/${checksPerformed} checks passed)`);

  return NextResponse.json(healthCheck, { status: httpStatus });
}
