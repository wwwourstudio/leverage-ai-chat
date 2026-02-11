import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';

/**
 * Admin API: Run Database Migration
 * Executes the complete database setup SQL script
 * ⚠️ This should be protected in production with authentication
 */
export async function POST(req: Request) {
  console.log('[v0] [Migration] Starting database migration...');
  
  const diagnostics = {
    timestamp: new Date().toISOString(),
    status: 'running',
    steps: [] as Array<{ step: string; status: string; message?: string }>,
    tablesCreated: [] as string[],
    error: null as string | null
  };

  try {
    // Step 1: Validate environment
    const addStep = (step: string, status: string, message?: string) => {
      diagnostics.steps.push({ step, status, message });
      console.log(`[v0] [Migration] ${status.toUpperCase()}: ${step}${message ? ` - ${message}` : ''}`);
    };

    addStep('Validating environment', 'running');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      addStep('Validating environment', 'error', 'Missing environment variables');
      diagnostics.status = 'failed';
      diagnostics.error = 'Required environment variables not set';
      return NextResponse.json(diagnostics, { status: 400 });
    }
    addStep('Validating environment', 'success');

    // Step 2: Load migration SQL
    addStep('Loading migration script', 'running');
    const migrationPath = join(process.cwd(), 'scripts', 'setup-database.sql');
    let migrationSQL: string;
    
    try {
      migrationSQL = readFileSync(migrationPath, 'utf-8');
      addStep('Loading migration script', 'success', `${migrationSQL.length} characters loaded`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addStep('Loading migration script', 'error', errorMsg);
      diagnostics.status = 'failed';
      diagnostics.error = `Failed to load migration file: ${errorMsg}`;
      return NextResponse.json(diagnostics, { status: 500 });
    }

    // Step 3: Connect to database
    addStep('Connecting to database', 'running');
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: connectionTest } = await supabase.from('information_schema.tables').select('table_name').limit(1);
    if (connectionTest) {
      addStep('Connecting to database', 'error', connectionTest.message);
      diagnostics.status = 'failed';
      diagnostics.error = `Connection failed: ${connectionTest.message}`;
      return NextResponse.json(diagnostics, { status: 500 });
    }
    addStep('Connecting to database', 'success');

    // Step 4: Execute migration
    addStep('Executing migration SQL', 'running');
    
    // Execute the full SQL script using Supabase's direct SQL execution
    // We need to use the REST API directly since the client doesn't support raw SQL
    const { error: sqlError } = await supabase.rpc('exec', { 
      query: migrationSQL 
    }).single();

    // If exec RPC doesn't exist, we need to inform user to run SQL manually
    if (sqlError && sqlError.message?.includes('function')) {
      addStep('Executing migration SQL', 'error', 'Direct SQL execution not available via API');
      diagnostics.status = 'manual_required';
      diagnostics.error = 'Please run the migration SQL manually in Supabase SQL Editor. The SQL is available at /scripts/setup-database.sql';
      
      // Provide instructions
      diagnostics.steps.push({
        step: 'Manual Migration Required',
        status: 'info',
        message: 'Go to Supabase Dashboard → SQL Editor → Run the contents of scripts/setup-database.sql'
      });
      
      return NextResponse.json(diagnostics, { status: 200 });
    } else if (sqlError) {
      addStep('Executing migration SQL', 'error', sqlError.message);
      diagnostics.status = 'failed';
      diagnostics.error = sqlError.message;
      return NextResponse.json(diagnostics, { status: 500 });
    }

    addStep('Executing migration SQL', 'success', 'All SQL statements executed');

    // Step 5: Verify tables created
    addStep('Verifying tables', 'running');
    const requiredTables = [
      'ai_response_trust',
      'ai_audit_log',
      'odds_benford_baselines',
      'validation_thresholds',
      'live_odds_cache',
      'app_config',
      'user_profiles'
    ];

    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    if (tablesError) {
      addStep('Verifying tables', 'warning', 'Could not verify tables');
    } else {
      const tableNames = tables?.map((t: any) => t.table_name) || [];
      diagnostics.tablesCreated = requiredTables.filter(t => tableNames.includes(t));
      const missing = requiredTables.filter(t => !tableNames.includes(t));
      
      if (missing.length === 0) {
        addStep('Verifying tables', 'success', `All ${requiredTables.length} tables created`);
        diagnostics.status = 'success';
      } else {
        addStep('Verifying tables', 'warning', `${missing.length} tables missing: ${missing.join(', ')}`);
        diagnostics.status = 'partial';
      }
    }

    console.log('[v0] [Migration] Migration process completed');
    return NextResponse.json(diagnostics, { status: 200 });

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[v0] [Migration] Fatal error:', errorMessage);
    
    diagnostics.status = 'failed';
    diagnostics.error = errorMessage;
    diagnostics.steps.push({ step: 'Migration', status: 'error', message: errorMessage });
    
    return NextResponse.json(diagnostics, { status: 500 });
  }
}
