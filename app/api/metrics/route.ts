import { NextResponse } from 'next/server';
import { logger, LogCategory } from '@/lib/logger';
import { getProcessInfo, getRuntimeEnvironment } from '@/lib/process-utils';

export const runtime = 'edge';

/**
 * Real-Time System Metrics API
 * Provides operational metrics for monitoring dashboards
 */
export async function GET() {
  const startTime = Date.now();
  
  try {
    logger.info(LogCategory.API, 'Fetching system metrics');

    // Cache statistics placeholder - orchestrator not available
    const cacheStats = {
      cacheSize: 0,
      totalHits: 0,
      popularQueries: []
    };

    // Get safe process information
    const processInfo = getProcessInfo();
    const runtimeEnv = getRuntimeEnvironment();

    // Collect metrics
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: processInfo.uptime,
        runtime: runtimeEnv,
        region: process.env.VERCEL_REGION || 'unknown',
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
        nodeVersion: processInfo.nodeVersion || 'unavailable',
        platform: processInfo.platform,
        arch: processInfo.arch,
        memory: processInfo.memoryUsage ? {
          heapUsed: Math.round((processInfo.memoryUsage.heapUsed || 0) / 1024 / 1024),
          heapTotal: Math.round((processInfo.memoryUsage.heapTotal || 0) / 1024 / 1024),
          rss: Math.round((processInfo.memoryUsage.rss || 0) / 1024 / 1024)
        } : null
      },
      cache: {
        size: cacheStats.cacheSize,
        totalHits: cacheStats.totalHits,
        hitRate: cacheStats.totalHits > 0 
          ? ((cacheStats.totalHits / (cacheStats.totalHits + cacheStats.cacheSize)) * 100).toFixed(2) + '%'
          : '0%',
        popularQueries: cacheStats.popularQueries.slice(0, 5)
      },
      performance: {
        responseTime: Date.now() - startTime
      },
      integrations: {
        database: {
          configured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
          status: 'unknown'
        },
        oddsAPI: {
          configured: !!process.env.ODDS_API_KEY,
          status: process.env.ODDS_API_KEY ? 'configured' : 'not_configured'
        },
        aiGateway: {
          configured: !!process.env.XAI_API_KEY,
          model: 'xai/grok-4-fast',
          status: process.env.XAI_API_KEY ? 'configured' : 'not_configured'
        }
      },
      health: {
        overall: 'healthy',
        checks: {
          database: 'unknown',
          api: 'healthy',
          cache: 'healthy'
        }
      }
    };

    // Quick database health check (non-blocking)
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      
      const { error } = await supabase
        .from('app_config')
        .select('id')
        .limit(1);
      
      metrics.integrations.database.status = error ? 'error' : 'healthy';
      metrics.health.checks.database = error ? 'error' : 'healthy';
    } catch (dbError) {
      metrics.integrations.database.status = 'error';
      metrics.health.checks.database = 'error';
      logger.warn(LogCategory.DATABASE, 'Database health check failed in metrics endpoint', {
        error: dbError instanceof Error ? dbError.message : String(dbError)
      });
    }

    // Determine overall health
    const hasErrors = Object.values(metrics.health.checks).some(status => status === 'error');
    metrics.health.overall = hasErrors ? 'degraded' : 'healthy';

    logger.info(LogCategory.API, 'Metrics retrieved successfully', {
      duration: Date.now() - startTime,
      cacheSize: metrics.cache.size
    });

    return NextResponse.json(metrics);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error(LogCategory.API, 'Failed to retrieve metrics', {
      duration: Date.now() - startTime,
      error: errorMessage
    });

    return NextResponse.json(
      {
        error: 'Failed to retrieve system metrics',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
