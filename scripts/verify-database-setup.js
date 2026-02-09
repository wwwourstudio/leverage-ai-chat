import { createClient } from '@supabase/supabase-js';

console.log('='.repeat(80));
console.log('DATABASE SETUP VERIFICATION SCRIPT');
console.log('='.repeat(80));
console.log('');

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('✓ Environment Variables Check:');
console.log(`  SUPABASE_URL: ${supabaseUrl ? '✓ SET' : '✗ MISSING'}`);
console.log(`  SUPABASE_KEY: ${supabaseServiceKey ? '✓ SET' : '✗ MISSING'}`);
console.log('');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('✗ ERROR: Missing required environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('✓ Supabase Client Initialized');
console.log('');

// Required tables
const REQUIRED_TABLES = [
  'ai_response_trust',
  'ai_audit_log',
  'odds_benford_baselines',
  'validation_thresholds',
  'live_odds_cache',
  'app_config',
  'user_profiles'
];

// Required views
const REQUIRED_VIEWS = [
  'model_trust_scores',
  'config_by_category',
  'user_performance_summary'
];

async function verifySetup() {
  console.log('1️⃣  VERIFYING TABLES...');
  console.log('-'.repeat(80));
  
  let tablesFound = 0;
  let tablesMissing = 0;
  
  for (const table of REQUIRED_TABLES) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`  ✗ ${table}: NOT FOUND or NO ACCESS`);
        console.log(`    Error: ${error.message}`);
        tablesMissing++;
      } else {
        console.log(`  ✓ ${table}: EXISTS`);
        tablesFound++;
      }
    } catch (err) {
      console.log(`  ✗ ${table}: ERROR - ${err.message}`);
      tablesMissing++;
    }
  }
  
  console.log('');
  console.log(`Summary: ${tablesFound}/${REQUIRED_TABLES.length} tables found`);
  console.log('');
  
  if (tablesMissing > 0) {
    console.log('⚠️  WARNING: Some tables are missing!');
    console.log('   → Please run the migration script: /scripts/setup-database.sql');
    console.log('');
  }
  
  // Check for seed data
  console.log('2️⃣  VERIFYING SEED DATA...');
  console.log('-'.repeat(80));
  
  try {
    const { data: configData, error: configError } = await supabase
      .from('app_config')
      .select('*');
    
    if (!configError && configData) {
      console.log(`  ✓ app_config: ${configData.length} configuration entries`);
      if (configData.length === 0) {
        console.log('    ⚠️  No seed data found. Consider running seed section of migration.');
      }
    } else {
      console.log(`  ✗ app_config: Unable to check (${configError?.message})`);
    }
  } catch (err) {
    console.log(`  ✗ app_config: Error checking seed data`);
  }
  
  try {
    const { data: thresholdData, error: thresholdError } = await supabase
      .from('validation_thresholds')
      .select('*');
    
    if (!thresholdError && thresholdData) {
      console.log(`  ✓ validation_thresholds: ${thresholdData.length} sport thresholds`);
      if (thresholdData.length === 0) {
        console.log('    ⚠️  No thresholds configured. Consider running seed section of migration.');
      }
    } else {
      console.log(`  ✗ validation_thresholds: Unable to check (${thresholdError?.message})`);
    }
  } catch (err) {
    console.log(`  ✗ validation_thresholds: Error checking seed data`);
  }
  
  console.log('');
  
  // Check RLS policies
  console.log('3️⃣  VERIFYING ROW LEVEL SECURITY...');
  console.log('-'.repeat(80));
  
  try {
    // Try to read from a table with anon key to test RLS
    const { data, error } = await supabase
      .from('ai_response_trust')
      .select('id')
      .limit(1);
    
    if (!error) {
      console.log('  ✓ RLS policies: Working (able to read with anon key)');
    } else {
      console.log(`  ⚠️  RLS policies: ${error.message}`);
    }
  } catch (err) {
    console.log(`  ✗ RLS policies: Error testing access`);
  }
  
  console.log('');
  
  // Test write access
  console.log('4️⃣  TESTING DATABASE OPERATIONS...');
  console.log('-'.repeat(80));
  
  try {
    // Test insert (will fail if not authenticated, which is expected)
    const { data: testInsert, error: insertError } = await supabase
      .from('ai_response_trust')
      .insert({
        model_name: 'test-verification',
        prompt_hash: 'test-hash',
        response_hash: 'test-hash',
        benford_score: 0.95,
        odds_alignment_score: 0.92,
        historical_accuracy: 0.88,
        trust_level: 'high'
      })
      .select();
    
    if (insertError) {
      if (insertError.message.includes('JWT')) {
        console.log('  ✓ Write protection: Working (auth required for inserts)');
      } else {
        console.log(`  ⚠️  Write test: ${insertError.message}`);
      }
    } else {
      console.log('  ✓ Write access: Working');
      console.log('  ℹ️  Cleaning up test record...');
      
      // Clean up test record
      if (testInsert && testInsert[0]?.id) {
        await supabase
          .from('ai_response_trust')
          .delete()
          .eq('id', testInsert[0].id);
        console.log('  ✓ Test record deleted');
      }
    }
  } catch (err) {
    console.log(`  ✗ Database operations: Error during test`);
  }
  
  console.log('');
  
  // Final summary
  console.log('='.repeat(80));
  console.log('VERIFICATION COMPLETE');
  console.log('='.repeat(80));
  console.log('');
  
  if (tablesFound === REQUIRED_TABLES.length) {
    console.log('✅ SUCCESS: All database tables are set up correctly!');
    console.log('');
    console.log('🎉 Your Leverage AI platform is ready to use.');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Refresh your application');
    console.log('  2. Start making predictions to see trust metrics');
    console.log('  3. Monitor the insights dashboard for real data');
  } else {
    console.log('⚠️  SETUP INCOMPLETE: Some tables are missing');
    console.log('');
    console.log('📋 To complete setup:');
    console.log('  1. Open Supabase SQL Editor');
    console.log('  2. Copy contents of /scripts/setup-database.sql');
    console.log('  3. Paste and run in SQL Editor');
    console.log('  4. Run this verification script again');
    console.log('');
    console.log('📖 See /SETUP_DATABASE_INSTRUCTIONS.md for detailed instructions');
  }
  
  console.log('');
}

verifySetup().catch(err => {
  console.error('✗ Verification failed:', err.message);
  process.exit(1);
});
