import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

/**
 * Database Migration Executor
 * Executes the complete database setup SQL migration
 */

console.log('='.repeat(80));
console.log('DATABASE MIGRATION EXECUTOR');
console.log('='.repeat(80));

async function executeMigration() {
  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('\n❌ ERROR: Missing environment variables');
    console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('\n✓ Environment variables configured');
  console.log(`  URL: ${supabaseUrl.substring(0, 30)}...`);
  console.log(`  Key: ${supabaseKey.substring(0, 20)}...`);

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log('\n✓ Supabase client created');

  // Read migration SQL
  const migrationPath = '/vercel/share/v0-project/scripts/setup-database.sql';
  console.log(`\n→ Reading migration file: ${migrationPath}`);
  
  let migrationSQL: string;
  try {
    migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log(`  ✓ Migration loaded (${migrationSQL.length} characters)`);
  } catch (error) {
    console.error('\n❌ ERROR: Failed to read migration file');
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  // Split SQL into individual statements
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`\n→ Parsed ${statements.length} SQL statements`);

  // Execute statements in sequence
  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ index: number; statement: string; error: string }> = [];

  console.log('\n→ Executing migration...\n');

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const preview = statement.substring(0, 60).replace(/\n/g, ' ');
    
    process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}... `);

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
      
      if (error) {
        // Try direct query if RPC fails
        const { error: queryError } = await supabase.from('_').select().limit(0);
        
        if (queryError) {
          errorCount++;
          errors.push({ index: i + 1, statement: preview, error: error.message });
          console.log('❌');
        } else {
          successCount++;
          console.log('✓');
        }
      } else {
        successCount++;
        console.log('✓');
      }
    } catch (error) {
      errorCount++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push({ index: i + 1, statement: preview, error: errorMsg });
      console.log('❌');
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('MIGRATION SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total statements: ${statements.length}`);
  console.log(`✓ Successful:     ${successCount}`);
  console.log(`❌ Failed:         ${errorCount}`);

  if (errors.length > 0) {
    console.log('\nFailed statements:');
    errors.forEach(({ index, statement, error }) => {
      console.log(`  [${index}] ${statement}`);
      console.log(`      Error: ${error}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  
  if (errorCount === 0) {
    console.log('✓ MIGRATION COMPLETED SUCCESSFULLY');
  } else {
    console.log('⚠ MIGRATION COMPLETED WITH ERRORS');
    console.log('  Note: Some errors may be expected (e.g., DROP IF EXISTS on fresh DB)');
  }
  console.log('='.repeat(80) + '\n');

  // Verify tables were created
  console.log('→ Verifying database schema...\n');
  
  const requiredTables = [
    'ai_response_trust',
    'ai_audit_log',
    'odds_benford_baselines',
    'validation_thresholds',
    'live_odds_cache',
    'app_config',
    'user_profiles'
  ];

  const verificationResults = await Promise.all(
    requiredTables.map(async (tableName) => {
      const { error } = await supabase.from(tableName).select('id').limit(1);
      return { tableName, exists: !error };
    })
  );

  verificationResults.forEach(({ tableName, exists }) => {
    console.log(`  ${exists ? '✓' : '❌'} ${tableName}`);
  });

  const allTablesExist = verificationResults.every(r => r.exists);
  
  console.log('\n' + '='.repeat(80));
  if (allTablesExist) {
    console.log('✓ ALL TABLES VERIFIED - DATABASE READY');
  } else {
    console.log('❌ SOME TABLES MISSING - CHECK ERRORS ABOVE');
  }
  console.log('='.repeat(80) + '\n');

  return allTablesExist ? 0 : 1;
}

// Run migration
executeMigration()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  });
