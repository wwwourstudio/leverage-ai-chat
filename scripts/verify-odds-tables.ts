/**
 * Verify Odds Tables Script
 * Checks if all required odds tables exist in the database
 */

import { createClient } from '@supabase/supabase-js';

const REQUIRED_TABLES = [
  'nba_odds',
  'nfl_odds',
  'mlb_odds',
  'nhl_odds',
  'ncaab_odds',
  'ncaaf_odds',
  'college_baseball_odds'
];

async function verifyOddsTables() {
  console.log('Verifying odds tables in Supabase...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing Supabase credentials');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  console.log('Checking tables...\n');

  const results: Array<{ table: string; exists: boolean; error?: string }> = [];

  for (const tableName of REQUIRED_TABLES) {
    try {
      // Try to query the table
      const { data, error } = await supabase
        .from(tableName)
        .select('id')
        .limit(1);

      if (error) {
        // Check if it's a "table does not exist" error
        if (error.message.includes('does not exist') || error.code === '42P01') {
          results.push({ table: tableName, exists: false, error: 'Table does not exist' });
        } else {
          results.push({ table: tableName, exists: true, error: error.message });
        }
      } else {
        results.push({ table: tableName, exists: true });
      }
    } catch (err: any) {
      results.push({ table: tableName, exists: false, error: err.message });
    }
  }

  // Print results
  console.log('=== ODDS TABLES STATUS ===\n');
  
  let existingCount = 0;
  let missingCount = 0;

  for (const result of results) {
    if (result.exists) {
      console.log(`✅ ${result.table}`);
      existingCount++;
    } else {
      console.log(`❌ ${result.table} - ${result.error}`);
      missingCount++;
    }
  }

  console.log(`\nSummary: ${existingCount}/${REQUIRED_TABLES.length} tables exist`);

  if (missingCount > 0) {
    console.log('\n⚠️  Missing tables detected!');
    console.log('Run the migration: scripts/odds-storage-by-sport.sql');
    console.log('Or use the Supabase dashboard SQL editor');
    process.exit(1);
  } else {
    console.log('\n✅ All odds tables are configured correctly!');
    process.exit(0);
  }
}

verifyOddsTables().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
