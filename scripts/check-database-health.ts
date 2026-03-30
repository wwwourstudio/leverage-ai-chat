#!/usr/bin/env ts-node
/**
 * Database Health Checker
 * 
 * Verifies all required tables, columns, and indexes exist
 * Identifies missing schema elements and suggests fixes
 * 
 * Run: npx ts-node scripts/check-database-health.ts
 */

import { createClient } from '@supabase/supabase-js';

const REQUIRED_TABLES = [
  'live_odds_cache',
  'mlb_odds',
  'nfl_odds',
  'nba_odds',
  'nhl_odds',
  'ai_response_trust',
  'line_movement',
  'player_props_markets',
  'historical_games',
  'kalshi_markets',
  'arbitrage_opportunities',
  'capital_state',
  'bet_allocations',
  'projection_priors',
  'bayesian_updates',
  'edge_opportunities'
];

const CRITICAL_COLUMNS = {
  live_odds_cache: ['sport_key', 'game_id_uuid', 'home_team', 'away_team', 'cached_at'],
  ai_response_trust: ['consensus_score', 'trust_score'],
  line_movement: ['game_id_uuid', 'old_line', 'new_line', 'line_change'],
  capital_state: ['total_capital', 'risk_budget', 'kelly_scale', 'active'],
  bet_allocations: ['market_id', 'allocated_capital', 'kelly_fraction', 'status']
};

interface HealthCheck {
  table: string;
  exists: boolean;
  columns?: string[];
  missingColumns?: string[];
  error?: string;
}

async function checkDatabaseHealth() {
  console.log('\n=== DATABASE HEALTH CHECK ===\n');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('✗ Supabase credentials not found in environment');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('✓ Supabase client initialized\n');
  console.log('--- Checking Tables ---\n');
  
  const results: HealthCheck[] = [];
  
  // Check each required table
  for (const table of REQUIRED_TABLES) {
    try {
      // Try to query the table
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`✗ ${table}: MISSING or ERROR - ${error.message}`);
        results.push({
          table,
          exists: false,
          error: error.message
        });
      } else {
        console.log(`✓ ${table}: EXISTS`);
        results.push({
          table,
          exists: true
        });
        
        // Check critical columns for this table
        if (CRITICAL_COLUMNS[table as keyof typeof CRITICAL_COLUMNS]) {
          const requiredCols = CRITICAL_COLUMNS[table as keyof typeof CRITICAL_COLUMNS];
          
          // Get first row to check column existence
          const { data: sampleRow } = await supabase
            .from(table)
            .select('*')
            .limit(1)
            .single();
          
          if (sampleRow) {
            const existingCols = Object.keys(sampleRow);
            const missingCols = requiredCols.filter(col => !existingCols.includes(col));
            
            if (missingCols.length > 0) {
              console.log(`  ⚠ Missing columns in ${table}: ${missingCols.join(', ')}`);
              results[results.length - 1].missingColumns = missingCols;
            } else {
              console.log(`  ✓ All required columns present`);
            }
            
            results[results.length - 1].columns = existingCols;
          }
        }
      }
    } catch (error) {
      console.log(`✗ ${table}: ERROR - ${error}`);
      results.push({
        table,
        exists: false,
        error: String(error)
      });
    }
  }
  
  // Summary
  console.log('\n=== SUMMARY ===\n');
  
  const existingTables = results.filter(r => r.exists);
  const missingTables = results.filter(r => !r.exists);
  const tablesWithMissingCols = results.filter(r => r.missingColumns && r.missingColumns.length > 0);
  
  console.log(`Total Tables Checked: ${REQUIRED_TABLES.length}`);
  console.log(`✓ Existing: ${existingTables.length}`);
  console.log(`✗ Missing: ${missingTables.length}`);
  console.log(`⚠ With Missing Columns: ${tablesWithMissingCols.length}`);
  
  if (missingTables.length > 0) {
    console.log('\n--- MISSING TABLES ---');
    missingTables.forEach(t => {
      console.log(`  • ${t.table}`);
    });
    console.log('\n🔧 FIX: Execute /scripts/DEPLOY_THIS_SCHEMA.sql in Supabase SQL Editor');
  }
  
  if (tablesWithMissingCols.length > 0) {
    console.log('\n--- TABLES WITH MISSING COLUMNS ---');
    tablesWithMissingCols.forEach(t => {
      console.log(`  • ${t.table}: ${t.missingColumns?.join(', ')}`);
    });
    console.log('\n🔧 FIX: Execute /scripts/fix-missing-columns.sql in Supabase SQL Editor');
  }
  
  // Check RLS policies
  console.log('\n--- Checking Row Level Security ---\n');
  
  try {
    // Try inserting test data (will fail if RLS blocks it)
    const { error: rlsError } = await supabase
      .from('live_odds_cache')
      .select('*')
      .limit(1);
    
    if (rlsError && rlsError.message.includes('row-level security')) {
      console.log('⚠ RLS is blocking reads - may need to adjust policies');
      console.log('🔧 FIX: Execute /scripts/rls-policies.sql to enable public read access');
    } else {
      console.log('✓ RLS configured correctly or not blocking reads');
    }
  } catch (error) {
    console.log(`⚠ RLS check inconclusive: ${error}`);
  }
  
  // Final status
  if (missingTables.length > 0 || tablesWithMissingCols.length > 0) {
    console.log('\n❌ DATABASE HEALTH CHECK FAILED');
    console.log('Execute the suggested SQL scripts in Supabase SQL Editor to fix issues');
    process.exit(1);
  } else {
    console.log('\n✅ DATABASE HEALTH CHECK PASSED');
    console.log('All required tables and columns are present');
  }
}

// Run health check
checkDatabaseHealth().catch(console.error);
