/**
 * Test Helpers for Real Data Integration
 * 
 * Utilities for testing and debugging the API integrations
 */

export interface TestResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  duration?: number;
}

/**
 * Test The Odds API integration
 */
export async function testOddsAPI(): Promise<TestResult> {
  const start = Date.now();
  
  try {
    console.log('[Test] Testing Odds API integration...');
    
    const response = await fetch('/api/odds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sport: 'nba',
        marketType: 'h2h'
      })
    });
    
    const data = await response.json();
    const duration = Date.now() - start;
    
    if (!response.ok) {
      return {
        success: false,
        message: 'Odds API request failed',
        error: data.error || response.statusText,
        duration
      };
    }
    
    if (data.success && data.data && data.data.length > 0) {
      return {
        success: true,
        message: `Odds API working! Fetched ${data.data.length} events`,
        data: {
          eventsCount: data.data.length,
          sample: data.data[0],
          cached: data.cached
        },
        duration
      };
    }
    
    return {
      success: false,
      message: 'Odds API returned no data',
      error: 'No events found for NBA',
      duration
    };
    
  } catch (error) {
    return {
      success: false,
      message: 'Odds API test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start
    };
  }
}

/**
 * Test Grok AI integration
 */
export async function testGrokAI(): Promise<TestResult> {
  const start = Date.now();
  
  try {
    console.log('[Test] Testing Grok AI integration...');
    
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMessage: 'Should I bet on the Lakers tonight?',
        context: {
          sport: 'nba',
          marketType: 'h2h',
          platform: null,
          previousMessages: []
        }
      })
    });
    
    const data = await response.json();
    const duration = Date.now() - start;
    
    if (!response.ok) {
      return {
        success: false,
        message: 'Grok AI request failed',
        error: data.error || response.statusText,
        duration
      };
    }
    
    if (data.success && data.text) {
      return {
        success: true,
        message: 'Grok AI working! Generated analysis',
        data: {
          textLength: data.text.length,
          confidence: data.confidence,
          trustMetrics: data.trustMetrics,
          model: data.model
        },
        duration
      };
    }
    
    return {
      success: false,
      message: 'Grok AI returned no analysis',
      error: 'No text generated',
      duration
    };
    
  } catch (error) {
    return {
      success: false,
      message: 'Grok AI test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start
    };
  }
}

/**
 * Test Supabase integration
 */
export async function testSupabase(): Promise<TestResult> {
  const start = Date.now();
  
  try {
    console.log('[Test] Testing Supabase integration...');
    
    // Test by attempting to read from ai_responses table
    const response = await fetch('/api/test-supabase', {
      method: 'GET'
    });
    
    const data = await response.json();
    const duration = Date.now() - start;
    
    if (!response.ok) {
      return {
        success: false,
        message: 'Supabase connection failed',
        error: data.error || response.statusText,
        duration
      };
    }
    
    return {
      success: true,
      message: 'Supabase working! Database accessible',
      data: {
        tablesAccessible: data.tablesAccessible || true,
        rowsCount: data.rowsCount || 0
      },
      duration
    };
    
  } catch (error) {
    return {
      success: false,
      message: 'Supabase test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start
    };
  }
}

/**
 * Run all integration tests
 */
export async function runAllTests(): Promise<{
  oddsAPI: TestResult;
  grokAI: TestResult;
  supabase: TestResult;
  overall: boolean;
}> {
  console.log('[Test Suite] Running all integration tests...\n');
  
  const oddsAPI = await testOddsAPI();
  console.log(`[Odds API] ${oddsAPI.success ? '✓' : '✗'} ${oddsAPI.message}`, oddsAPI.duration + 'ms');
  if (oddsAPI.error) console.error('[Odds API Error]', oddsAPI.error);
  console.log('');
  
  const grokAI = await testGrokAI();
  console.log(`[Grok AI] ${grokAI.success ? '✓' : '✗'} ${grokAI.message}`, grokAI.duration + 'ms');
  if (grokAI.error) console.error('[Grok AI Error]', grokAI.error);
  console.log('');
  
  const supabase = await testSupabase();
  console.log(`[Supabase] ${supabase.success ? '✓' : '✗'} ${supabase.message}`, supabase.duration + 'ms');
  if (supabase.error) console.error('[Supabase Error]', supabase.error);
  console.log('');
  
  const overall = oddsAPI.success && grokAI.success && supabase.success;
  console.log(`[Test Suite] ${overall ? '✓ All tests passed!' : '✗ Some tests failed'}`);
  
  return {
    oddsAPI,
    grokAI,
    supabase,
    overall
  };
}

/**
 * Sample test queries for manual testing
 */
export const testQueries = {
  betting: [
    'Should I bet on the Lakers -4.5?',
    'What are the best NBA bets tonight?',
    'Lakers vs Warriors spread analysis',
    'Show me value bets for NFL this week'
  ],
  dfs: [
    'Build me a DraftKings NFL lineup',
    'Who are the best value plays for tonight?',
    'Optimal DFS lineup for NBA tonight',
    'FanDuel showdown strategy'
  ],
  fantasy: [
    'Best draft strategy for NFBC?',
    'Should I draft running backs early?',
    'Trade value for Josh Allen',
    'Waiver wire pickups this week'
  ],
  kalshi: [
    'Kalshi election market analysis',
    'Best weather markets to trade',
    'Prediction market opportunities',
    'Kalshi vs sportsbook arbitrage'
  ],
  general: [
    'What are my best opportunities today?',
    'Analyze all sports markets',
    'Cross-platform value plays',
    'Where should I invest my bankroll?'
  ]
};

/**
 * Debug helper: Log all API calls
 */
export function enableAPIDebugLogging() {
  if (typeof window === 'undefined') return;
  
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const [url, options] = args;
    console.log('[API Call]', {
      url,
      method: options?.method || 'GET',
      timestamp: new Date().toISOString()
    });
    
    const start = Date.now();
    try {
      const response = await originalFetch(...args);
      const duration = Date.now() - start;
      console.log('[API Response]', {
        url,
        status: response.status,
        ok: response.ok,
        duration: duration + 'ms'
      });
      return response;
    } catch (error) {
      const duration = Date.now() - start;
      console.error('[API Error]', {
        url,
        error: error instanceof Error ? error.message : 'Unknown',
        duration: duration + 'ms'
      });
      throw error;
    }
  };
  
  console.log('[Debug] API logging enabled');
}

/**
 * Check if all required environment variables are set
 */
export async function checkEnvironmentVariables(): Promise<{
  configured: boolean;
  missing: string[];
  recommendations: string[];
}> {
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    
    const required = ['ODDS_API_KEY', 'XAI_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
    const missing: string[] = [];
    const recommendations: string[] = [];
    
    required.forEach(key => {
      if (!data.env?.[key]) {
        missing.push(key);
        
        if (key === 'ODDS_API_KEY') {
          recommendations.push('Get ODDS_API_KEY from https://the-odds-api.com');
        } else if (key === 'XAI_API_KEY') {
          recommendations.push('Get XAI_API_KEY from https://x.ai/api');
        } else if (key.includes('SUPABASE')) {
          recommendations.push('Configure Supabase from https://supabase.com/dashboard');
        }
      }
    });
    
    return {
      configured: missing.length === 0,
      missing,
      recommendations
    };
  } catch (error) {
    return {
      configured: false,
      missing: ['Unable to check environment variables'],
      recommendations: ['Ensure /api/health endpoint exists']
    };
  }
}

/**
 * Performance benchmarking utility
 */
export async function benchmarkAPIs(iterations: number = 5): Promise<{
  oddsAPI: { avg: number; min: number; max: number };
  grokAI: { avg: number; min: number; max: number };
}> {
  console.log(`[Benchmark] Running ${iterations} iterations...\n`);
  
  const oddsTimes: number[] = [];
  const grokTimes: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    console.log(`[Benchmark] Iteration ${i + 1}/${iterations}`);
    
    const oddsStart = Date.now();
    await fetch('/api/odds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sport: 'nba', marketType: 'h2h' })
    });
    oddsTimes.push(Date.now() - oddsStart);
    
    const grokStart = Date.now();
    await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMessage: 'Test query',
        context: { sport: 'nba' }
      })
    });
    grokTimes.push(Date.now() - grokStart);
  }
  
  const avgOdds = oddsTimes.reduce((a, b) => a + b) / oddsTimes.length;
  const avgGrok = grokTimes.reduce((a, b) => a + b) / grokTimes.length;
  
  const results = {
    oddsAPI: {
      avg: Math.round(avgOdds),
      min: Math.min(...oddsTimes),
      max: Math.max(...oddsTimes)
    },
    grokAI: {
      avg: Math.round(avgGrok),
      min: Math.min(...grokTimes),
      max: Math.max(...grokTimes)
    }
  };
  
  console.log('\n[Benchmark Results]');
  console.log('Odds API:', results.oddsAPI);
  console.log('Grok AI:', results.grokAI);
  
  return results;
}

/**
 * Cache statistics
 */
export function getCacheStats(): {
  enabled: boolean;
  hitRate?: number;
  size?: number;
} {
  // This would connect to your actual cache implementation
  // For now, return placeholder
  return {
    enabled: true,
    hitRate: 0.65,
    size: 42
  };
}
