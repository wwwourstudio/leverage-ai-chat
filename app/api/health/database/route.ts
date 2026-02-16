import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

/**
 * Database Health Check API
 * Comprehensive diagnostics for database connection and schema validation
 */
export async function GET() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    status: 'unknown' as 'healthy' | 'degraded' | 'down' | 'setup_required',
    connection: { status: 'unknown', message: '' },
    environment: { status: 'unknown', variables: {} as Record<string, boolean> },
    schema: { status: 'unknown', tables: [] as string[], missingTables: [] as string[] },
    sampleQuery: { status: 'unknown', message: '' },
    recommendations: [] as string[]
  };

  try {
    // Step 1: Check environment variables
    console.log('[v0] [API] [Health Check] Validating environment variables...');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    diagnostics.environment.variables = {
      NEXT_PUBLIC_SUPABASE_URL: !!supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    };

    if (!supabaseUrl || !supabaseKey) {
      diagnostics.environment.status = 'error';
      diagnostics.status = 'down';
      diagnostics.recommendations.push('Configure Supabase environment variables in Vercel project settings');
      
      return NextResponse.json(diagnostics, { status: 503 });
    }

    diagnostics.environment.status = 'ok';
    console.log('[v0] [API] [Health Check] ✓ Environment variables configured');

    // Step 2: Test database connection
    console.log('[v0] [API] [Health Check] Testing database connection...');
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetch.bind(globalThis) }
    });

    // Test connection with a simple query
    const { error: connectionError } = await supabase.rpc('pg_backend_pid').catch(() => ({
      error: null
    }));
    
    // If rpc doesn't work, try a simple table query
    if (connectionError) {
      const { error: fallbackError } = await supabase
        .from('app_config')
        .select('id')
        .limit(1);
      
      if (fallbackError) {
        diagnostics.connection.status = 'error';
        diagnostics.connection.message = fallbackError.message;
        diagnostics.status = 'down';
        diagnostics.recommendations.push('Check Supabase project is active and credentials are correct');
        
        return NextResponse.json(diagnostics, { status: 503 });
      }
    }

    if (connectionError) {
      diagnostics.connection.status = 'error';
      diagnostics.connection.message = connectionError.message;
      diagnostics.status = 'down';
      diagnostics.recommendations.push('Check Supabase project is active and credentials are correct');
      
      return NextResponse.json(diagnostics, { status: 503 });
    }

    diagnostics.connection.status = 'ok';
    diagnostics.connection.message = 'Successfully connected to Supabase';
    console.log('[v0] [API] [Health Check] ✓ Database connection successful');

    // Step 3: Check schema - verify all required tables exist
    console.log('[v0] [API] [Health Check] Validating database schema...');
    const requiredTables = [
      'ai_response_trust',
      'ai_audit_log',
      'odds_benford_baselines',
      'validation_thresholds',
      'live_odds_cache',
      'app_config',
      'user_profiles'
    ];

    // Check each table individually to avoid information_schema RLS issues
    const tableNames: string[] = [];
    for (const tableName of requiredTables) {
      const { error: tableError } = await supabase
        .from(tableName)
        .select('id')
        .limit(1);
      
      // If no error or just an empty table, the table exists
      if (!tableError || tableError.message?.includes('no rows')) {
        tableNames.push(tableName);
      }
    }

    diagnostics.schema.tables = tableNames;
    diagnostics.schema.missingTables = requiredTables.filter(t => !tableNames.includes(t));

    if (diagnostics.schema.missingTables.length > 0) {
      diagnostics.schema.status = 'missing_tables';
      diagnostics.status = 'setup_required';
      diagnostics.recommendations.push(
        `Missing ${diagnostics.schema.missingTables.length} required tables: ${diagnostics.schema.missingTables.join(', ')}`,
        'Run the database migration script: /scripts/setup-database.sql',
        'See SETUP_DATABASE_INSTRUCTIONS.md for step-by-step guide'
      );
      
      console.log('[v0] [API] [Health Check] ⚠ Missing tables:', diagnostics.schema.missingTables);
      return NextResponse.json(diagnostics, { status: 200 });
    }

    diagnostics.schema.status = 'ok';
    console.log(`[v0] [API] [Health Check] ✓ All ${requiredTables.length} required tables exist`);

    // Step 4: Test sample query
    console.log('[v0] [API] [Health Check] Testing sample query...');
    const { data: sampleData, error: queryError } = await supabase
      .from('ai_response_trust')
      .select('id, created_at')
      .limit(1);

    if (queryError) {
      diagnostics.sampleQuery.status = 'error';
      diagnostics.sampleQuery.message = queryError.message;
      diagnostics.status = 'degraded';
      diagnostics.recommendations.push('Table exists but query failed - check RLS policies');
      
      return NextResponse.json(diagnostics, { status: 200 });
    }

    diagnostics.sampleQuery.status = 'ok';
    diagnostics.sampleQuery.message = sampleData && sampleData.length > 0 
      ? `Database contains data (${sampleData.length} record(s) found)`
      : 'Table exists but empty (no predictions yet)';
    
    console.log('[v0] [API] [Health Check] ✓ Sample query successful');

    // Final status
    diagnostics.status = 'healthy';
    diagnostics.recommendations.push('All systems operational');
    
    console.log('[v0] [API] [Health Check] ✓ Database is healthy');
    
    return NextResponse.json(diagnostics, { status: 200 });

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[v0] [API] [Health Check] ✗ Unexpected error:', errorMessage);
    
    diagnostics.status = 'down';
    diagnostics.recommendations.push(
      'Unexpected error during health check',
      errorMessage
    );
    
    return NextResponse.json(diagnostics, { status: 503 });
  }
}
