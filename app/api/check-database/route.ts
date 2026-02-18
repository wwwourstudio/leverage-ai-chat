import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const REQUIRED_TABLES = [
  'live_odds_cache',
  'mlb_odds',
  'nfl_odds',
  'nba_odds',
  'nhl_odds',
  'line_movement',
  'player_props_markets',
  'arbitrage_opportunities',
  'kalshi_markets',
  'ai_response_trust',
  'capital_state',
  'bet_allocations',
  'historical_games'
];

const REQUIRED_COLUMNS = [
  { table: 'live_odds_cache', column: 'sport_key' },
  { table: 'ai_response_trust', column: 'consensus_score' }
];

export async function GET() {
  try {
    const supabase = await createClient();
    const results = {
      timestamp: new Date().toISOString(),
      connection: false,
      tables: {} as Record<string, boolean>,
      columns: {} as Record<string, boolean>,
      missingTables: [] as string[],
      missingColumns: [] as string[],
      errors: [] as string[]
    };

    // Test connection
    try {
      const { error: connError } = await supabase.from('live_odds_cache').select('id').limit(1);
      if (!connError || connError.code === 'PGRST116') {
        results.connection = true;
      }
    } catch (e) {
      results.errors.push('Connection failed');
    }

    // Check each table
    for (const table of REQUIRED_TABLES) {
      try {
        const { error } = await supabase.from(table).select('*').limit(1);
        
        if (error) {
          if (error.message?.includes('does not exist')) {
            results.tables[table] = false;
            results.missingTables.push(table);
          } else {
            results.tables[table] = false;
            results.errors.push(`${table}: ${error.message}`);
          }
        } else {
          results.tables[table] = true;
        }
      } catch (e) {
        results.tables[table] = false;
        results.errors.push(`${table}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    // Check required columns
    for (const { table, column } of REQUIRED_COLUMNS) {
      const key = `${table}.${column}`;
      try {
        const { error } = await supabase.from(table).select(column).limit(1);
        
        if (error) {
          if (error.message?.includes('does not exist')) {
            results.columns[key] = false;
            results.missingColumns.push(key);
          } else {
            results.columns[key] = false;
            results.errors.push(`${key}: ${error.message}`);
          }
        } else {
          results.columns[key] = true;
        }
      } catch (e) {
        results.columns[key] = false;
        results.errors.push(`${key}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    const allTablesExist = results.missingTables.length === 0;
    const allColumnsExist = results.missingColumns.length === 0;
    const healthy = results.connection && allTablesExist && allColumnsExist;

    return NextResponse.json({
      healthy,
      ...results,
      summary: {
        tablesFound: Object.values(results.tables).filter(Boolean).length,
        tablesRequired: REQUIRED_TABLES.length,
        columnsFound: Object.values(results.columns).filter(Boolean).length,
        columnsRequired: REQUIRED_COLUMNS.length
      },
      action: healthy ? 
        'Database is ready' : 
        'Execute scripts/master-schema.sql in Supabase SQL Editor'
    });

  } catch (error) {
    return NextResponse.json({
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      action: 'Check Supabase connection and environment variables'
    }, { status: 500 });
  }
}
