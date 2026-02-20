/**
 * Player Props Diagnostic Script
 * Systematically test The-Odds-API to determine player props availability
 * 
 * Run: npx tsx scripts/diagnose-player-props.ts
 */

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const API_KEY = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;

const TEST_SPORTS = [
  { key: 'basketball_nba', name: 'NBA' },
  { key: 'americanfootball_nfl', name: 'NFL' },
  { key: 'baseball_mlb', name: 'MLB' },
  { key: 'icehockey_nhl', name: 'NHL' }
];

const PLAYER_PROP_MARKETS = [
  'player_points',
  'player_rebounds', 
  'player_assists',
  'player_threes',
  'player_pass_tds',
  'player_pass_yds',
  'player_rush_yds',
  'player_receptions',
  'player_home_runs',
  'player_hits',
  'player_strikeouts'
];

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details: string;
  httpStatus?: number;
  data?: any;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testEnvironmentSetup(): Promise<TestResult> {
  if (!API_KEY) {
    return {
      test: 'Environment Setup',
      status: 'FAIL',
      details: 'ODDS_API_KEY not configured in environment variables'
    };
  }
  
  return {
    test: 'Environment Setup',
    status: 'PASS',
    details: `API Key configured: ${API_KEY.substring(0, 8)}...`
  };
}

async function testAPIConnectivity(): Promise<TestResult> {
  try {
    const url = `${ODDS_API_BASE}/sports?apiKey=${API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return {
        test: 'API Connectivity',
        status: 'FAIL',
        details: `Failed to connect: HTTP ${response.status}`,
        httpStatus: response.status
      };
    }
    
    const sports = await response.json();
    const remaining = response.headers.get('x-requests-remaining');
    const used = response.headers.get('x-requests-used');
    
    return {
      test: 'API Connectivity',
      status: 'PASS',
      details: `Connected successfully. ${sports.length} sports available. Quota: ${used || 'N/A'} used, ${remaining || 'N/A'} remaining`,
      data: { sports: sports.length, quotaRemaining: remaining, quotaUsed: used }
    };
  } catch (error) {
    return {
      test: 'API Connectivity',
      status: 'FAIL',
      details: `Connection error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function testStandardOddsEndpoint(sportKey: string, sportName: string): Promise<TestResult> {
  try {
    const url = `${ODDS_API_BASE}/sports/${sportKey}/odds?apiKey=${API_KEY}&regions=us&markets=h2h&oddsFormat=american`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return {
        test: `${sportName} - Standard Odds`,
        status: 'FAIL',
        details: `HTTP ${response.status}`,
        httpStatus: response.status
      };
    }
    
    const events = await response.json();
    
    return {
      test: `${sportName} - Standard Odds`,
      status: 'PASS',
      details: `${Array.isArray(events) ? events.length : 0} events found`,
      data: { eventCount: Array.isArray(events) ? events.length : 0, events }
    };
  } catch (error) {
    return {
      test: `${sportName} - Standard Odds`,
      status: 'FAIL',
      details: `Error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function testPlayerPropsSportEndpoint(sportKey: string, sportName: string, market: string): Promise<TestResult> {
  try {
    const url = `${ODDS_API_BASE}/sports/${sportKey}/odds?apiKey=${API_KEY}&regions=us&markets=${market}&oddsFormat=american`;
    const response = await fetch(url);
    
    if (response.status === 422) {
      const errorBody = await response.text();
      return {
        test: `${sportName} - ${market}`,
        status: 'FAIL',
        details: `HTTP 422 (Unprocessable) - Market not supported`,
        httpStatus: 422,
        data: { errorBody }
      };
    }
    
    if (!response.ok) {
      return {
        test: `${sportName} - ${market}`,
        status: 'FAIL',
        details: `HTTP ${response.status}`,
        httpStatus: response.status
      };
    }
    
    const data = await response.json();
    const propsCount = Array.isArray(data) ? data.reduce((sum, event) => {
      const markets = event.bookmakers?.flatMap((b: any) => b.markets || []) || [];
      return sum + markets.reduce((mSum: number, m: any) => mSum + (m.outcomes?.length || 0), 0);
    }, 0) : 0;
    
    return {
      test: `${sportName} - ${market}`,
      status: 'PASS',
      details: `${propsCount} player props found`,
      data: { propsCount, events: Array.isArray(data) ? data.length : 0 }
    };
  } catch (error) {
    return {
      test: `${sportName} - ${market}`,
      status: 'FAIL',
      details: `Error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function testEventSpecificPropsEndpoint(sportKey: string, sportName: string, eventId: string): Promise<TestResult> {
  try {
    const url = `${ODDS_API_BASE}/sports/${sportKey}/events/${eventId}/odds?apiKey=${API_KEY}&regions=us&markets=player_points&oddsFormat=american`;
    const response = await fetch(url);
    
    if (response.status === 422) {
      return {
        test: `${sportName} - Event-Specific Props`,
        status: 'FAIL',
        details: 'HTTP 422 - Event-specific endpoint also returns unprocessable',
        httpStatus: 422
      };
    }
    
    if (response.status === 404) {
      return {
        test: `${sportName} - Event-Specific Props`,
        status: 'FAIL',
        details: 'HTTP 404 - Event-specific endpoint not found',
        httpStatus: 404
      };
    }
    
    if (!response.ok) {
      return {
        test: `${sportName} - Event-Specific Props`,
        status: 'FAIL',
        details: `HTTP ${response.status}`,
        httpStatus: response.status
      };
    }
    
    const data = await response.json();
    
    return {
      test: `${sportName} - Event-Specific Props`,
      status: 'PASS',
      details: 'Event-specific endpoint works! Player props available per event.',
      data
    };
  } catch (error) {
    return {
      test: `${sportName} - Event-Specific Props`,
      status: 'FAIL',
      details: `Error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function runDiagnostics() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  PLAYER PROPS DIAGNOSTIC REPORT');
  console.log('  The-Odds-API Integration Analysis');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const results: TestResult[] = [];
  
  // Test 1: Environment
  console.log('🔍 Running Pre-Flight Checks...\n');
  const envTest = await testEnvironmentSetup();
  results.push(envTest);
  console.log(`${envTest.status === 'PASS' ? '✅' : '❌'} ${envTest.test}: ${envTest.details}\n`);
  
  if (envTest.status === 'FAIL') {
    console.log('❌ Cannot proceed without API key. Set ODDS_API_KEY environment variable.\n');
    return;
  }
  
  // Test 2: API Connectivity
  const connectTest = await testAPIConnectivity();
  results.push(connectTest);
  console.log(`${connectTest.status === 'PASS' ? '✅' : '❌'} ${connectTest.test}: ${connectTest.details}\n`);
  
  if (connectTest.status === 'FAIL') {
    console.log('❌ Cannot proceed without API connectivity.\n');
    return;
  }
  
  await delay(500);
  
  // Test 3: Standard Odds Endpoints (baseline)
  console.log('🎯 Testing Standard Odds Endpoints (Baseline)...\n');
  const standardTests: TestResult[] = [];
  
  for (const sport of TEST_SPORTS) {
    const result = await testStandardOddsEndpoint(sport.key, sport.name);
    standardTests.push(result);
    results.push(result);
    console.log(`${result.status === 'PASS' ? '✅' : '❌'} ${result.test}: ${result.details}`);
    await delay(300);
  }
  
  console.log('');
  
  // Test 4: Player Props via Sport Endpoint
  console.log('🏀 Testing Player Props via Sport Endpoint...\n');
  const sportPropsTests: TestResult[] = [];
  
  for (const sport of TEST_SPORTS) {
    // Test only relevant markets per sport
    const relevantMarkets = PLAYER_PROP_MARKETS.filter(market => {
      if (sport.key.includes('basketball')) return ['player_points', 'player_rebounds', 'player_assists', 'player_threes'].includes(market);
      if (sport.key.includes('football')) return ['player_pass_tds', 'player_pass_yds', 'player_rush_yds', 'player_receptions'].includes(market);
      if (sport.key.includes('baseball')) return ['player_home_runs', 'player_hits', 'player_strikeouts'].includes(market);
      if (sport.key.includes('hockey')) return ['player_points', 'player_assists'].includes(market);
      return false;
    });
    
    for (const market of relevantMarkets.slice(0, 2)) { // Test only 2 markets per sport to save quota
      const result = await testPlayerPropsSportEndpoint(sport.key, sport.name, market);
      sportPropsTests.push(result);
      results.push(result);
      console.log(`${result.status === 'PASS' ? '✅' : '❌'} ${result.test}: ${result.details}`);
      await delay(300);
    }
  }
  
  console.log('');
  
  // Test 5: Event-Specific Props (if events exist)
  console.log('🎲 Testing Event-Specific Props Endpoint...\n');
  
  for (const sport of TEST_SPORTS) {
    const standardTest = standardTests.find(t => t.test.includes(sport.name));
    
    if (standardTest?.data?.events && standardTest.data.events.length > 0) {
      const eventId = standardTest.data.events[0].id;
      const result = await testEventSpecificPropsEndpoint(sport.key, sport.name, eventId);
      results.push(result);
      console.log(`${result.status === 'PASS' ? '✅' : '❌'} ${result.test}: ${result.details}`);
      await delay(300);
    } else {
      results.push({
        test: `${sport.name} - Event-Specific Props`,
        status: 'SKIP',
        details: 'No events available to test'
      });
      console.log(`⏭️  ${sport.name} - Event-Specific Props: Skipped (no events)`);
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  DIAGNOSTIC SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}\n`);
  
  // Analysis
  const allSportPropsFailed = sportPropsTests.every(t => t.status === 'FAIL' && t.httpStatus === 422);
  const eventPropsWork = results.some(r => r.test.includes('Event-Specific') && r.status === 'PASS');
  
  console.log('📊 ANALYSIS:\n');
  
  if (allSportPropsFailed && !eventPropsWork) {
    console.log('❌ Player props are NOT available via sport-wide endpoints (HTTP 422)');
    console.log('❌ Event-specific props endpoint also unavailable');
    console.log('\n💡 CONCLUSION:');
    console.log('   Player props likely require:');
    console.log('   1. Premium API tier subscription, OR');
    console.log('   2. Different API endpoint not documented in standard API, OR');
    console.log('   3. Feature not yet available for these sports\n');
    console.log('📋 RECOMMENDED ACTION:');
    console.log('   - Contact The-Odds-API support to confirm player props availability');
    console.log('   - Check pricing page for premium tier features');
    console.log('   - Implement graceful degradation (show game odds only)');
  } else if (allSportPropsFailed && eventPropsWork) {
    console.log('❌ Player props NOT available via sport-wide endpoints');
    console.log('✅ BUT event-specific props endpoint works!\n');
    console.log('💡 CONCLUSION:');
    console.log('   Must fetch events first, then request props per event.\n');
    console.log('📋 RECOMMENDED ACTION:');
    console.log('   - Refactor player-props-service.ts to use two-step approach:');
    console.log('     1. Fetch games via /sports/{sport}/odds');
    console.log('     2. For each game, fetch props via /sports/{sport}/events/{eventId}/odds');
  } else if (!allSportPropsFailed) {
    console.log('✅ Player props ARE available!\n');
    console.log('💡 CONCLUSION:');
    console.log('   Current implementation should work. Check for:');
    console.log('   - Correct market identifiers');
    console.log('   - Rate limiting issues');
    console.log('   - Seasonal availability (some markets only during active games)');
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════\n');
  
  // Save results to file for reference
  const reportPath = './scripts/player-props-diagnostic-report.json';
  const fs = await import('fs');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results,
    summary: { passed, failed, skipped },
    analysis: {
      allSportPropsFailed,
      eventPropsWork
    }
  }, null, 2));
  
  console.log(`📄 Full report saved to: ${reportPath}\n`);
}

// Run diagnostics
runDiagnostics().catch(console.error);
