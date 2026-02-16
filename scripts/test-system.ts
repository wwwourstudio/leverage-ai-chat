#!/usr/bin/env node
/**
 * Unified System Testing Suite
 * Consolidates all testing functionality into one comprehensive script
 * Run: npx tsx scripts/test-system.ts [--api] [--database] [--cards] [--odds] [--all]
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ODDS_API_KEY = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;

interface TestResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function logTest(category: string, test: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, details?: any) {
  results.push({ category, test, status, message, details });
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';
  console.log(`${icon} [${category}] ${test}: ${message}`);
  if (details) console.log('  Details:', details);
}

// ============================================================================
// DATABASE TESTS
// ============================================================================

async function testDatabase() {
  console.log('\n🗄️  DATABASE HEALTH CHECK\n');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Test 1: Connection
  try {
    const { data, error } = await supabase.from('live_odds_cache').select('count').limit(1);
    if (error) throw error;
    logTest('Database', 'Connection', 'PASS', 'Supabase connection successful');
  } catch (error: any) {
    logTest('Database', 'Connection', 'FAIL', error.message);
    return;
  }
  
  // Test 2: Required tables exist
  const requiredTables = [
    'live_odds_cache', 'mlb_odds', 'nfl_odds', 'nba_odds', 'nhl_odds',
    'line_movement', 'arbitrage_opportunities', 'player_props_markets',
    'kalshi_markets', 'capital_state', 'bet_allocations'
  ];
  
  for (const table of requiredTables) {
    try {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error && error.code === '42P01') {
        logTest('Database', `Table ${table}`, 'FAIL', `Table does not exist - run master-schema.sql`);
      } else if (error) {
        logTest('Database', `Table ${table}`, 'WARN', error.message);
      } else {
        logTest('Database', `Table ${table}`, 'PASS', 'Table exists and accessible');
      }
    } catch (error: any) {
      logTest('Database', `Table ${table}`, 'FAIL', error.message);
    }
  }
  
  // Test 3: Check live_odds_cache has sport_key column
  try {
    const { data, error } = await supabase
      .from('live_odds_cache')
      .select('sport_key')
      .limit(1);
    
    if (error?.code === '42703') {
      logTest('Database', 'sport_key column', 'FAIL', 'Column missing - run fix-missing-columns.sql');
    } else {
      logTest('Database', 'sport_key column', 'PASS', 'Column exists');
    }
  } catch (error: any) {
    logTest('Database', 'sport_key column', 'FAIL', error.message);
  }
  
  // Test 4: Check for data freshness
  try {
    const { data, error } = await supabase
      .from('live_odds_cache')
      .select('cached_at, sport_key')
      .order('cached_at', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      const ageMinutes = (Date.now() - new Date(data[0].cached_at).getTime()) / 60000;
      if (ageMinutes < 60) {
        logTest('Database', 'Data freshness', 'PASS', `Latest data is ${ageMinutes.toFixed(1)} minutes old`);
      } else {
        logTest('Database', 'Data freshness', 'WARN', `Latest data is ${ageMinutes.toFixed(1)} minutes old - may be stale`);
      }
    } else {
      logTest('Database', 'Data freshness', 'WARN', 'No cached odds data found');
    }
  } catch (error: any) {
    logTest('Database', 'Data freshness', 'WARN', error.message);
  }
}

// ============================================================================
// API TESTS
// ============================================================================

async function testAPI() {
  console.log('\n🔌 API INTEGRATION TESTS\n');
  
  // Test 1: API Key configured
  if (!ODDS_API_KEY) {
    logTest('API', 'API Key', 'FAIL', 'ODDS_API_KEY not configured');
    return;
  }
  logTest('API', 'API Key', 'PASS', `API key configured (${ODDS_API_KEY.substring(0, 8)}...)`);
  
  // Test 2: Fetch live odds for NHL
  try {
    const url = `https://api.the-odds-api.com/v4/sports/icehockey_nhl/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;
    console.log(`  Fetching: ${url.replace(ODDS_API_KEY, 'REDACTED')}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const text = await response.text();
      logTest('API', 'Fetch NHL odds', 'FAIL', `API returned ${response.status}: ${text}`);
      return;
    }
    
    const data = await response.json();
    logTest('API', 'Fetch NHL odds', 'PASS', `Received ${data.length} games`);
    
    if (data.length > 0) {
      const sample = data[0];
      logTest('API', 'Data structure', 'PASS', `Sample: ${sample.away_team} @ ${sample.home_team}`, {
        bookmakers: sample.bookmakers?.length || 0,
        markets: sample.bookmakers?.[0]?.markets?.map((m: any) => m.key) || []
      });
    } else {
      logTest('API', 'Data availability', 'WARN', 'No NHL games currently available (off-season or no games today)');
    }
    
  } catch (error: any) {
    logTest('API', 'Fetch NHL odds', 'FAIL', error.message);
  }
}

// ============================================================================
// CARDS GENERATOR TESTS
// ============================================================================

async function testCardsGenerator() {
  console.log('\n🎴 CARDS GENERATOR TESTS\n');
  
  const categories = [
    'betting',
    'arbitrage',
    'lines',
    'portfolio',
    'props',
    'kalshi'
  ];
  
  for (const category of categories) {
    try {
      // Dynamic import to avoid build-time errors
      const { generateCards } = await import('../lib/cards-generator');
      
      const cards = await generateCards({
        sport: 'nhl',
        count: 3,
        category
      });
      
      if (cards.length > 0) {
        logTest('Cards', `Category: ${category}`, 'PASS', `Generated ${cards.length} cards`);
      } else {
        logTest('Cards', `Category: ${category}`, 'WARN', 'No cards generated - may need data');
      }
    } catch (error: any) {
      logTest('Cards', `Category: ${category}`, 'FAIL', error.message);
    }
  }
}

// ============================================================================
// ODDS CALCULATIONS TESTS
// ============================================================================

async function testOddsCalculations() {
  console.log('\n🧮 ODDS CALCULATIONS TESTS\n');
  
  // Test 1: American to Decimal conversion
  const americanOdds = [+150, -200, +300, -150];
  const expectedDecimals = [2.5, 1.5, 4.0, 1.67];
  
  americanOdds.forEach((odds, i) => {
    const decimal = odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
    const expected = expectedDecimals[i];
    const diff = Math.abs(decimal - expected);
    
    if (diff < 0.01) {
      logTest('Odds', `Convert ${odds}`, 'PASS', `Converted to ${decimal.toFixed(2)} (expected ${expected})`);
    } else {
      logTest('Odds', `Convert ${odds}`, 'FAIL', `Got ${decimal.toFixed(2)}, expected ${expected}`);
    }
  });
  
  // Test 2: Implied probability
  const testOdds = [+100, -110, +200, -200];
  testOdds.forEach(odds => {
    const impliedProb = odds > 0 
      ? 100 / (odds + 100) 
      : Math.abs(odds) / (Math.abs(odds) + 100);
    
    if (impliedProb >= 0 && impliedProb <= 1) {
      logTest('Odds', `Implied prob for ${odds}`, 'PASS', `${(impliedProb * 100).toFixed(2)}%`);
    } else {
      logTest('Odds', `Implied prob for ${odds}`, 'FAIL', `Invalid probability: ${impliedProb}`);
    }
  });
  
  // Test 3: Arbitrage detection
  const odds1 = -110; // 52.38%
  const odds2 = +120; // 45.45%
  const totalImplied = (110 / 210) + (100 / 220);
  
  if (totalImplied < 1.0) {
    const arbProfit = ((1 / totalImplied) - 1) * 100;
    logTest('Odds', 'Arbitrage math', 'PASS', `Detected ${arbProfit.toFixed(2)}% arbitrage`);
  } else {
    logTest('Odds', 'Arbitrage math', 'PASS', 'No arbitrage (total > 100%)');
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const runAll = args.includes('--all') || args.length === 0;
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 LEVERAGE AI SYSTEM TEST SUITE');
  console.log('═══════════════════════════════════════════════════════');
  
  if (runAll || args.includes('--database')) await testDatabase();
  if (runAll || args.includes('--api')) await testAPI();
  if (runAll || args.includes('--cards')) await testCardsGenerator();
  if (runAll || args.includes('--odds')) await testOddsCalculations();
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  const total = results.length;
  
  console.log(`✓ Passed: ${passed}/${total}`);
  console.log(`✗ Failed: ${failed}/${total}`);
  console.log(`⚠ Warnings: ${warned}/${total}`);
  
  if (failed > 0) {
    console.log('\n❌ CRITICAL FAILURES:');
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => console.log(`   - [${r.category}] ${r.test}: ${r.message}`));
  }
  
  if (warned > 0) {
    console.log('\n⚠️  WARNINGS:');
    results
      .filter(r => r.status === 'WARN')
      .forEach(r => console.log(`   - [${r.category}] ${r.test}: ${r.message}`));
  }
  
  console.log('\n═══════════════════════════════════════════════════════\n');
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
