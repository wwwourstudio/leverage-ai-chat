/**
 * Kalshi API Connectivity Test
 * Tests API endpoints, verifies credentials, and diagnoses connection issues
 */

const KALSHI_BASE_URL = 'https://trading-api.kalshi.com/trade-api/v2';
const DEMO_BASE_URL = 'https://demo-api.kalshi.co/trade-api/v2';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

/**
 * Test 1: Check API connectivity
 */
async function testConnectivity() {
  console.log('\n=== Test 1: API Connectivity ===');
  
  try {
    const response = await fetch(`${KALSHI_BASE_URL}/exchange/status`, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      results.push({
        name: 'API Connectivity',
        status: 'pass',
        message: 'Successfully connected to Kalshi API',
        details: data,
      });
      console.log('✓ API is reachable');
      console.log('Exchange status:', data);
    } else {
      results.push({
        name: 'API Connectivity',
        status: 'fail',
        message: `HTTP ${response.status}: ${response.statusText}`,
      });
      console.log('✗ API returned error:', response.status);
    }
  } catch (error) {
    results.push({
      name: 'API Connectivity',
      status: 'fail',
      message: error instanceof Error ? error.message : String(error),
    });
    console.log('✗ Failed to connect:', error);
  }
}

/**
 * Test 2: Fetch market categories
 */
async function testMarketCategories() {
  console.log('\n=== Test 2: Market Categories ===');
  
  try {
    const response = await fetch(`${KALSHI_BASE_URL}/markets?limit=5&status=open`, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      const categories = new Set(data.markets?.map((m: any) => m.category) || []);
      
      results.push({
        name: 'Market Categories',
        status: 'pass',
        message: `Found ${categories.size} categories`,
        details: Array.from(categories),
      });
      
      console.log(`✓ Available categories:`, Array.from(categories));
    } else {
      results.push({
        name: 'Market Categories',
        status: 'fail',
        message: `HTTP ${response.status}`,
      });
      console.log('✗ Failed to fetch categories');
    }
  } catch (error) {
    results.push({
      name: 'Market Categories',
      status: 'fail',
      message: error instanceof Error ? error.message : String(error),
    });
    console.log('✗ Error:', error);
  }
}

/**
 * Test 3: Test election markets specifically
 */
async function testElectionMarkets() {
  console.log('\n=== Test 3: Election Markets (2026 H2H) ===');
  
  const electionKeywords = ['election', '2026', 'president', 'H2H', 'politics'];
  
  try {
    // Try fetching with various filters
    const testQueries = [
      { series_ticker: 'USPREZ' },
      { series_ticker: 'PRESIDENT' },
      { category: 'Politics' },
      { category: 'Elections' },
    ];
    
    for (const query of testQueries) {
      const params = new URLSearchParams({
        ...query,
        limit: '10',
        status: 'open',
      });
      
      const response = await fetch(`${KALSHI_BASE_URL}/markets?${params}`, {
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const electionMarkets = data.markets?.filter((m: any) => 
          electionKeywords.some(kw => 
            m.title?.toLowerCase().includes(kw) || 
            m.category?.toLowerCase().includes(kw)
          )
        ) || [];
        
        if (electionMarkets.length > 0) {
          results.push({
            name: 'Election Markets',
            status: 'pass',
            message: `Found ${electionMarkets.length} election markets`,
            details: {
              query,
              markets: electionMarkets.slice(0, 3).map((m: any) => ({
                ticker: m.ticker,
                title: m.title,
                category: m.category,
              })),
            },
          });
          
          console.log(`✓ Found ${electionMarkets.length} election markets with query:`, query);
          electionMarkets.slice(0, 3).forEach((m: any) => {
            console.log(`  - ${m.ticker}: ${m.title}`);
          });
          return; // Success, exit early
        }
      }
    }
    
    // If we get here, no election markets found
    results.push({
      name: 'Election Markets',
      status: 'warning',
      message: 'No 2026 election markets found with standard queries',
      details: 'Market may not be available yet or requires different query parameters',
    });
    console.log('⚠ No 2026 election markets found');
    
  } catch (error) {
    results.push({
      name: 'Election Markets',
      status: 'fail',
      message: error instanceof Error ? error.message : String(error),
    });
    console.log('✗ Error fetching election markets:', error);
  }
}

/**
 * Test 4: Check for authentication requirements
 */
async function testAuthentication() {
  console.log('\n=== Test 4: Authentication Check ===');
  
  const apiKey = process.env.KALSHI_API_KEY;
  const apiSecret = process.env.KALSHI_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    results.push({
      name: 'Authentication',
      status: 'warning',
      message: 'No API credentials configured',
      details: 'KALSHI_API_KEY and KALSHI_API_SECRET not set',
    });
    console.log('⚠ No API credentials found');
    console.log('  Public endpoints only - trading features unavailable');
    return;
  }
  
  // Try authenticated request
  try {
    const response = await fetch(`${KALSHI_BASE_URL}/portfolio/balance`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    
    if (response.ok) {
      results.push({
        name: 'Authentication',
        status: 'pass',
        message: 'API credentials valid',
      });
      console.log('✓ Authenticated successfully');
    } else {
      results.push({
        name: 'Authentication',
        status: 'warning',
        message: `Authentication failed: ${response.status}`,
      });
      console.log('⚠ Authentication failed');
    }
  } catch (error) {
    results.push({
      name: 'Authentication',
      status: 'warning',
      message: error instanceof Error ? error.message : String(error),
    });
    console.log('⚠ Authentication error:', error);
  }
}

/**
 * Test 5: Rate limit and performance
 */
async function testPerformance() {
  console.log('\n=== Test 5: Performance & Rate Limits ===');
  
  const startTime = Date.now();
  const requests = 3;
  
  try {
    const promises = Array(requests).fill(null).map(() =>
      fetch(`${KALSHI_BASE_URL}/markets?limit=1&status=open`, {
        headers: { 'Accept': 'application/json' },
      })
    );
    
    const responses = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const successCount = responses.filter(r => r.ok).length;
    
    results.push({
      name: 'Performance',
      status: successCount === requests ? 'pass' : 'warning',
      message: `${successCount}/${requests} requests succeeded in ${duration}ms`,
      details: {
        avgResponseTime: `${(duration / requests).toFixed(0)}ms`,
        rateLimitHeaders: responses[0].headers.get('x-ratelimit-remaining'),
      },
    });
    
    console.log(`✓ ${successCount}/${requests} requests succeeded`);
    console.log(`  Average response time: ${(duration / requests).toFixed(0)}ms`);
    
  } catch (error) {
    results.push({
      name: 'Performance',
      status: 'fail',
      message: error instanceof Error ? error.message : String(error),
    });
    console.log('✗ Performance test failed:', error);
  }
}

/**
 * Print summary report
 */
function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('KALSHI API DIAGNOSTIC SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  
  console.log(`\nResults: ${passed} passed, ${failed} failed, ${warnings} warnings\n`);
  
  results.forEach(result => {
    const icon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '⚠';
    console.log(`${icon} ${result.name}: ${result.message}`);
    if (result.details) {
      console.log(`  Details:`, JSON.stringify(result.details, null, 2).substring(0, 200));
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('RECOMMENDATIONS:');
  console.log('='.repeat(60) + '\n');
  
  if (failed > 0) {
    console.log('1. Check network connectivity to trading-api.kalshi.com');
    console.log('2. Verify API endpoint URLs are correct');
    console.log('3. Check for CORS issues if running from browser');
  }
  
  if (warnings > 0) {
    console.log('1. Add KALSHI_API_KEY and KALSHI_API_SECRET for authenticated features');
    console.log('2. Verify election markets are available for 2026');
    console.log('3. Check Kalshi documentation for updated endpoints');
  }
  
  if (passed === results.length) {
    console.log('✓ All tests passed! Kalshi API integration is working correctly.');
  }
  
  console.log('\n');
}

/**
 * Run all tests
 */
async function runDiagnostics() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║        KALSHI API CONNECTIVITY DIAGNOSTIC TOOL          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\nTesting connection to: ${KALSHI_BASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);
  
  await testConnectivity();
  await testMarketCategories();
  await testElectionMarkets();
  await testAuthentication();
  await testPerformance();
  
  printSummary();
  
  // Exit with appropriate code
  const failed = results.filter(r => r.status === 'fail').length;
  process.exit(failed > 0 ? 1 : 0);
}

// Run diagnostics
runDiagnostics().catch(error => {
  console.error('Fatal error running diagnostics:', error);
  process.exit(1);
});
