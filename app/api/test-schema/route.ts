import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Validate Supabase schema matches application requirements
 * Call: GET /api/test-schema
 */
export async function GET() {
  try {
    console.log('[v0] [TEST-SCHEMA] Validating database schema...');
    
    const supabase = await createClient();
    const results: Record<string, any> = {};
    
    // Required tables for the application
    const requiredTables = [
      'live_odds_cache',
      'nhl_odds',
      'nba_odds',
      'nfl_odds',
      'mlb_odds',
      'line_movement',
      'arbitrage_opportunities',
      'player_props',
      'kalshi_markets',
      'capital_state',
      'bet_allocations'
    ];
    
    for (const table of requiredTables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          results[table] = {
            exists: false,
            error: error.message
          };
          console.error(`[v0] [TEST-SCHEMA] ✗ ${table}: ${error.message}`);
        } else {
          results[table] = {
            exists: true,
            canQuery: true
          };
          console.log(`[v0] [TEST-SCHEMA] ✓ ${table}: exists and queryable`);
        }
      } catch (err) {
        results[table] = {
          exists: false,
          error: String(err)
        };
        console.error(`[v0] [TEST-SCHEMA] ✗ ${table}:`, err);
      }
    }
    
    const existingTables = Object.entries(results).filter(([_, v]: any) => v.exists);
    const missingTables = Object.entries(results).filter(([_, v]: any) => !v.exists);
    
    return NextResponse.json({
      success: missingTables.length === 0,
      totalTables: requiredTables.length,
      existingTables: existingTables.length,
      missingTables: missingTables.length,
      results,
      missing: missingTables.map(([name]) => name),
      message: missingTables.length === 0 
        ? 'All required tables exist and are queryable'
        : `Missing ${missingTables.length} tables - run scripts/master-schema.sql in Supabase SQL Editor`,
      instructions: missingTables.length > 0 
        ? 'Execute scripts/master-schema.sql in Supabase SQL Editor to create missing tables'
        : null
    });
    
  } catch (error) {
    console.error('[v0] [TEST-SCHEMA] Fatal error:', error);
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
}
