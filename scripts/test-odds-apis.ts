/**
 * Comprehensive Odds API Testing Script
 * Tests all sport APIs, database connectivity, and data persistence
 */

import { createClient } from '@supabase/supabase-js';

interface TestResult {
  sport: string;
  apiKey: string;
  apiTest: 'pass' | 'fail' | 'no_games';
  dbTest: 'pass' | 'fail' | 'skip';
  eventCount: number;
  error?: string;
  dbError?: string;
}

const SPORTS_TO_TEST = [
  { name: 'NBA', key: 'basketball_nba', table: 'nba_odds' },
  { name: 'NFL', key: 'americanfootball_nfl', table: 'nfl_odds' },
  { name: 'MLB', key: 'baseball_mlb', table: 'mlb_odds' },
  { name: 'NHL', key: 'icehockey_nhl', table: 'nhl_odds' },
  { name: 'NCAAB', key: 'basketball_ncaab', table: 'ncaab_odds' },
  { name: 'NCAAF', key: 'americanfootball_ncaaf', table: 'ncaaf_odds' },
];

async function testOddsAPIs() {
  console.log('='.repeat(60));
  console.log('COMPREHENSIVE ODDS API TESTING SUITE');
  console.log('='.repeat(60));
  console.log();

  // Check environment
  const oddsApiKey = process.env.ODDS_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('1. ENVIRONMENT CHECK');
  console.log('-'.repeat(60));
  console.log(`ODDS_API_KEY: ${oddsApiKey ? '✅ Configured' : '❌ Missing'}`);
  console.log(`SUPABASE_URL: ${supabaseUrl ? '✅ Configured' : '❌ Missing'}`);
  console.log(`SUPABASE_SERVICE_KEY: ${supabaseKey ? '✅ Configured' : '❌ Missing'}`);
  console.log();

  if (!oddsApiKey) {
    console.error('❌ ODDS_API_KEY is required. Exiting.');
    process.exit(1);
  }

  const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

  // Test each sport
  const results: TestResult[] = [];

  console.log('2. TESTING SPORT APIs');
  console.log('-'.repeat(60));

  for (const sport of SPORTS_TO_TEST) {
    const result: TestResult = {
      sport: sport.name,
      apiKey: sport.key,
      apiTest: 'fail',
      dbTest: 'skip',
      eventCount: 0,
    };

    // Test API
    try {
      const apiUrl = `https://api.the-odds-api.com/v4/sports/${sport.key}/odds?apiKey=${oddsApiKey}&regions=us&markets=h2h`;
      
      console.log(`Testing ${sport.name} (${sport.key})...`);
      
      const response = await fetch(apiUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        const data = await response.json();
        const eventCount = Array.isArray(data) ? data.length : 0;
        
        result.eventCount = eventCount;
        result.apiTest = eventCount > 0 ? 'pass' : 'no_games';
        
        console.log(`  API: ${result.apiTest === 'pass' ? '✅ PASS' : '⚠️  NO GAMES'} (${eventCount} events)`);

        // Test database storage if we have data
        if (supabase && eventCount > 0) {
          try {
            // Try to insert a test record
            const testRecord = {
              event_id: `test_${Date.now()}`,
              event_name: 'Test Event',
              home_team: 'Test Home',
              away_team: 'Test Away',
              commence_time: new Date().toISOString(),
              market_type: 'h2h',
              sportsbook: 'test',
              raw_odds_data: { test: true },
              source: 'test-script',
              fetched_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 60000).toISOString(),
            };

            const { error } = await supabase
              .from(sport.table)
              .insert([testRecord]);

            if (error) {
              result.dbTest = 'fail';
              result.dbError = error.message;
              console.log(`  DB:  ❌ FAIL (${error.message.substring(0, 50)})`);
            } else {
              result.dbTest = 'pass';
              console.log(`  DB:  ✅ PASS`);
              
              // Clean up test record
              await supabase
                .from(sport.table)
                .delete()
                .eq('event_id', testRecord.event_id);
            }
          } catch (dbError: any) {
            result.dbTest = 'fail';
            result.dbError = dbError.message;
            console.log(`  DB:  ❌ FAIL (${dbError.message.substring(0, 50)})`);
          }
        } else if (!supabase) {
          result.dbTest = 'skip';
          console.log(`  DB:  ⊘ SKIP (No Supabase configured)`);
        } else {
          result.dbTest = 'skip';
          console.log(`  DB:  ⊘ SKIP (No events to test)`);
        }
      } else {
        const errorText = await response.text();
        result.apiTest = 'fail';
        result.error = `HTTP ${response.status}: ${errorText.substring(0, 100)}`;
        console.log(`  API: ❌ FAIL (${result.error})`);
        console.log(`  DB:  ⊘ SKIP`);
      }
    } catch (error: any) {
      result.apiTest = 'fail';
      result.error = error.message;
      console.log(`  API: ❌ FAIL (${error.message})`);
      console.log(`  DB:  ⊘ SKIP`);
    }

    results.push(result);
    console.log();
  }

  // Summary
  console.log('3. TEST SUMMARY');
  console.log('-'.repeat(60));

  const apiPass = results.filter(r => r.apiTest === 'pass').length;
  const apiNoGames = results.filter(r => r.apiTest === 'no_games').length;
  const apiFail = results.filter(r => r.apiTest === 'fail').length;
  
  const dbPass = results.filter(r => r.dbTest === 'pass').length;
  const dbFail = results.filter(r => r.dbTest === 'fail').length;
  const dbSkip = results.filter(r => r.dbTest === 'skip').length;

  console.log(`API Tests:`);
  console.log(`  ✅ Pass: ${apiPass}/${SPORTS_TO_TEST.length}`);
  console.log(`  ⚠️  No Games: ${apiNoGames}/${SPORTS_TO_TEST.length}`);
  console.log(`  ❌ Fail: ${apiFail}/${SPORTS_TO_TEST.length}`);
  console.log();
  console.log(`Database Tests:`);
  console.log(`  ✅ Pass: ${dbPass}/${SPORTS_TO_TEST.length}`);
  console.log(`  ❌ Fail: ${dbFail}/${SPORTS_TO_TEST.length}`);
  console.log(`  ⊘ Skip: ${dbSkip}/${SPORTS_TO_TEST.length}`);
  console.log();

  // Recommendations
  console.log('4. RECOMMENDATIONS');
  console.log('-'.repeat(60));

  if (apiFail === SPORTS_TO_TEST.length) {
    console.log('❌ All API tests failed - Check ODDS_API_KEY validity');
    console.log('   Visit: https://the-odds-api.com/account/');
  } else if (apiFail > 0) {
    console.log(`⚠️  ${apiFail} sport(s) failed API tests - Check sport keys`);
    results.filter(r => r.apiTest === 'fail').forEach(r => {
      console.log(`   - ${r.sport}: ${r.error}`);
    });
  }

  if (apiNoGames > 0 && apiPass === 0) {
    console.log(`⚠️  No games found for any sport (off-season likely)`);
    console.log('   This is normal - games appear 24-48 hours before start');
  } else if (apiNoGames > 0) {
    console.log(`ℹ️  ${apiNoGames} sport(s) currently off-season:`);
    results.filter(r => r.apiTest === 'no_games').forEach(r => {
      console.log(`   - ${r.sport}`);
    });
  }

  if (dbFail > 0) {
    console.log(`❌ ${dbFail} database table(s) failed - Run migration script`);
    console.log('   Execute: scripts/odds-storage-by-sport.sql');
    results.filter(r => r.dbTest === 'fail').forEach(r => {
      console.log(`   - ${r.sport}: ${r.dbError}`);
    });
  }

  if (apiPass > 0 && dbPass > 0) {
    console.log(`✅ System is operational for ${apiPass} sport(s) with live games`);
  }

  console.log();
  console.log('='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));

  // Exit code
  if (apiFail > 0 || dbFail > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Run tests
testOddsAPIs().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
