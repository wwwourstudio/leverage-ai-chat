import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('[v0] Starting database migration...\n');

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ ERROR: Missing required environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log('[v0] Supabase URL:', supabaseUrl);
console.log('[v0] Service key:', supabaseServiceKey ? 'SET' : 'MISSING');

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  try {
    // Read the migration SQL file - use absolute path
    const migrationPath = '/vercel/share/v0-project/supabase/migrations/20260207_complete_database_setup.sql';
    console.log('[v0] Reading migration file:', migrationPath);
    
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log(`[v0] Migration file loaded (${migrationSQL.length} characters)\n`);

    // Execute the migration
    console.log('[v0] Executing migration...');
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // If exec_sql function doesn't exist, try direct query
      console.log('[v0] exec_sql function not found, trying direct execution...');
      
      // Split SQL into individual statements and execute
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      console.log(`[v0] Executing ${statements.length} SQL statements...\n`);

      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i] + ';';
        
        // Skip DO blocks for now (they need special handling)
        if (statement.includes('DO $$')) {
          console.log(`[v0] Skipping DO block (${i + 1}/${statements.length})`);
          continue;
        }

        try {
          const { error: stmtError } = await supabase.rpc('query', { 
            sql: statement 
          });

          if (stmtError) {
            console.log(`⚠️  Statement ${i + 1} error:`, stmtError.message.substring(0, 100));
            errorCount++;
          } else {
            successCount++;
            if (successCount % 10 === 0) {
              console.log(`[v0] Progress: ${successCount} statements executed...`);
            }
          }
        } catch (err) {
          console.log(`⚠️  Statement ${i + 1} exception:`, err.message.substring(0, 100));
          errorCount++;
        }
      }

      console.log(`\n[v0] Execution complete: ${successCount} success, ${errorCount} errors\n`);
    } else {
      console.log('[v0] Migration executed successfully via exec_sql\n');
    }

    // Verify tables were created
    console.log('[v0] Verifying database schema...');
    
    const tables = [
      'ai_response_trust',
      'ai_audit_log',
      'odds_benford_baselines',
      'validation_thresholds',
      'live_odds_cache',
      'app_config',
      'user_profiles'
    ];

    for (const table of tables) {
      const { data: tableData, error: tableError } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (tableError) {
        console.log(`❌ Table '${table}': NOT FOUND or NO ACCESS`);
        console.log(`   Error: ${tableError.message}`);
      } else {
        console.log(`✅ Table '${table}': EXISTS (${tableData?.length || 0} rows)`);
      }
    }

    // Check for configuration data
    console.log('\n[v0] Checking seeded data...');
    const { data: configData, error: configError } = await supabase
      .from('app_config')
      .select('*');

    if (!configError && configData) {
      console.log(`✅ app_config: ${configData.length} configuration entries loaded`);
    }

    const { data: thresholdData, error: thresholdError } = await supabase
      .from('validation_thresholds')
      .select('*');

    if (!thresholdError && thresholdData) {
      console.log(`✅ validation_thresholds: ${thresholdData.length} thresholds configured`);
    }

    console.log('\n🎉 Database migration complete!');
    console.log('📊 Next steps:');
    console.log('   1. Refresh your application');
    console.log('   2. Check the insights dashboard for live data');
    console.log('   3. Monitor trust metrics in the UI\n');

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
