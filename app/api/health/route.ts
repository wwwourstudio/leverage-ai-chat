import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceStatus, formatServiceStatus } from '@/lib/config-status';
import {
  HEALTH_STATUS,
  AI_CONFIG,
  LOG_PREFIXES,
  HTTP_STATUS,
  ERROR_MESSAGES,
  ENV_KEYS,
} from '@/lib/constants';
import { APP_TABLES } from '@/lib/supabase-validator';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * Health Check API Route
 * 
 * Returns the status of all integrations, environment variables, and database tables
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
      database: {
        connected: false,
        tables: {} as Record<string, boolean>,
        allTablesExist: false,
        message: 'Not checked'
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

    // Check database tables if Supabase is configured
    if (serviceStatus.supabase.configured) {
      try {
        const supabaseUrl = process.env[ENV_KEYS.SUPABASE_URL];
        const supabaseAnonKey = process.env[ENV_KEYS.SUPABASE_ANON_KEY];
        
        if (supabaseUrl && supabaseAnonKey) {
          const supabase = createClient(supabaseUrl, supabaseAnonKey);
          health.database.connected = true;

          // Check critical tables with simple query
          const tablesToCheck = [
            APP_TABLES.AI_PREDICTIONS,
          ];

          let allTablesExist = true;
          
          for (const table of tablesToCheck) {
            try {
              const { error } = await supabase.from(table).select('id').limit(1);
              const exists = !error || !error.message.includes('does not exist');
              health.database.tables[table] = exists;
              if (!exists) {
                allTablesExist = false;
              }
            } catch (error) {
              health.database.tables[table] = false;
              allTablesExist = false;
            }
          }

          health.database.allTablesExist = allTablesExist;
          
          if (allTablesExist) {
            health.database.message = 'All required tables exist';
          } else {
            health.database.message = 'Some tables missing - run database migration at supabase/migrations/20260201_trust_integrity_system.sql';
            health.status = HEALTH_STATUS.DEGRADED;
            health.summary.warnings++;
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        health.database.message = `Database check failed: ${errorMessage}`;
        health.status = HEALTH_STATUS.DEGRADED;
        console.log(`${LOG_PREFIXES.HEALTH} Database check error:`, errorMessage);
      }
    } else {
      health.database.message = 'Supabase not configured - app will use fallback data';
    }

    // Log detailed status to server console for debugging
    if (!serviceStatus.overall.ready || !health.database.allTablesExist) {
      console.log(formatServiceStatus(serviceStatus));
      console.log(`${LOG_PREFIXES.HEALTH} Database Status:`, health.database);
    }
    
    return NextResponse.json(health);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`${LOG_PREFIXES.HEALTH} Error checking service status:`, errorMessage);
    
    return NextResponse.json(
      {
        status: HEALTH_STATUS.UNHEALTHY,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        troubleshooting: {
          commonCauses: [
            'Missing environment variables',
            'Database tables not created',
            'Supabase connection issues',
            'Edge runtime limitations'
          ],
          nextSteps: [
            'Check environment variables in Vercel dashboard',
            'Run database migration in Supabase SQL editor',
            'Review INITIALIZATION_FIX_PLAN.md for detailed fixes'
          ]
        }
      },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
