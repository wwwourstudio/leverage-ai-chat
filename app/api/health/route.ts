import { NextResponse } from 'next/server';
import { getServiceStatus, formatServiceStatus } from '@/lib/config-status';
import {
  HEALTH_STATUS,
  AI_CONFIG,
  LOG_PREFIXES,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from '@/lib/constants';

/**
 * Health Check API Route
 * 
 * Returns the status of all integrations and environment variables
 */
export async function GET() {
  try {
    const serviceStatus = getServiceStatus();
    
    const health = {
      status: serviceStatus.overall.ready ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.DEGRADED,
      timestamp: new Date().toISOString(),
      ready: serviceStatus.overall.ready,
      integrations: {
        oddsAPI: {
          configured: serviceStatus.odds.configured,
          missing: serviceStatus.odds.missing,
          warnings: serviceStatus.odds.warnings,
        },
        grokAI: {
          configured: serviceStatus.grok.configured,
          missing: serviceStatus.grok.missing,
          model: AI_CONFIG.MODEL_NAME,
        },
        supabase: {
          configured: serviceStatus.supabase.configured,
          missing: serviceStatus.supabase.missing,
          warnings: serviceStatus.supabase.warnings,
        }
      },
      summary: {
        criticalIssues: serviceStatus.overall.criticalMissing,
        warnings: serviceStatus.overall.warningCount,
        message: serviceStatus.overall.ready 
          ? 'All services configured correctly' 
          : 'Some services need configuration',
      },
      version: '1.0.0'
    };

    // Log detailed status to server console for debugging
    if (!serviceStatus.overall.ready) {
      console.log(formatServiceStatus(serviceStatus));
    }
    
    return NextResponse.json(health);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`${LOG_PREFIXES.HEALTH} Error checking service status:`, errorMessage);
    
    return NextResponse.json(
      {
        status: HEALTH_STATUS.UNHEALTHY,
        error: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
