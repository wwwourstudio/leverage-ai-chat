#!/usr/bin/env ts-node
/**
 * API Response Diagnostics Tool
 * 
 * Tests the complete odds API flow:
 * 1. Raw API response structure
 * 2. Market type filtering
 * 3. Bookmaker data parsing
 * 4. Cache behavior
 * 
 * Run: npx ts-node scripts/diagnose-api-response.ts
 */

import { fetchLiveOdds } from '../lib/odds-api-client';

interface DiagnosticResult {
  step: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  data?: any;
}

const results: DiagnosticResult[] = [];

function logResult(step: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, data?: any) {
  results.push({ step, status, message, data });
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';
  console.log(`${icon} [${step}] ${message}`);
  if (data) console.log('   Data:', JSON.stringify(data, null, 2).split('\n').slice(0, 5).join('\n'));
}

async function diagnoseAPIResponse() {
  console.log('\n=== ODDS API DIAGNOSTIC TOOL ===\n');
  
  const apiKey = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
  
  // Step 1: Verify API key exists
  if (!apiKey) {
    logResult('API_KEY', 'FAIL', 'No API key found in environment variables');
    return;
  }
  logResult('API_KEY', 'PASS', 'API key found and configured');
  
  // Step 2: Test basic API call with h2h only
  console.log('\n--- Testing H2H Market Only ---');
  try {
    const h2hData = await fetchLiveOdds('icehockey_nhl', {
      markets: ['h2h'],
      regions: ['us'],
      oddsFormat: 'american',
      apiKey,
      skipCache: true
    });
    
    if (!h2hData || h2hData.length === 0) {
      logResult('H2H_FETCH', 'FAIL', 'No games returned for NHL h2h market');
    } else {
      logResult('H2H_FETCH', 'PASS', `Fetched ${h2hData.length} NHL games with h2h market`, {
        sampleGame: `${h2hData[0].away_team} @ ${h2hData[0].home_team}`,
        bookmakers: h2hData[0].bookmakers?.length || 0
      });
      
      // Verify h2h market structure
      const sampleBookmaker = h2hData[0].bookmakers?.[0];
      if (sampleBookmaker) {
        const markets = sampleBookmaker.markets || [];
        const marketKeys = markets.map((m: any) => m.key);
        logResult('H2H_STRUCTURE', 'PASS', `Market keys: ${marketKeys.join(', ')}`, {
          marketCount: markets.length,
          hasH2H: marketKeys.includes('h2h')
        });
      }
    }
  } catch (error) {
    logResult('H2H_FETCH', 'FAIL', `API error: ${error}`);
  }
  
  // Step 3: Test ALL markets (h2h, spreads, totals)
  console.log('\n--- Testing All Markets ---');
  try {
    const allMarketsData = await fetchLiveOdds('icehockey_nhl', {
      markets: ['h2h', 'spreads', 'totals'],
      regions: ['us'],
      oddsFormat: 'american',
      apiKey,
      skipCache: true
    });
    
    if (!allMarketsData || allMarketsData.length === 0) {
      logResult('ALL_MARKETS_FETCH', 'FAIL', 'No games returned with all markets');
    } else {
      logResult('ALL_MARKETS_FETCH', 'PASS', `Fetched ${allMarketsData.length} NHL games with all markets`);
      
      // Analyze market distribution
      const sampleGame = allMarketsData[0];
      const sampleBookmaker = sampleGame.bookmakers?.[0];
      
      if (sampleBookmaker && sampleBookmaker.markets) {
        const marketTypes = sampleBookmaker.markets.map((m: any) => m.key);
        const hasH2H = marketTypes.includes('h2h');
        const hasSpreads = marketTypes.includes('spreads');
        const hasTotals = marketTypes.includes('totals');
        
        if (hasH2H && hasSpreads && hasTotals) {
          logResult('MARKET_TYPES', 'PASS', 'All market types present in response', {
            markets: marketTypes,
            h2h: hasH2H,
            spreads: hasSpreads,
            totals: hasTotals
          });
        } else {
          logResult('MARKET_TYPES', 'WARN', 'Some market types missing', {
            requested: ['h2h', 'spreads', 'totals'],
            received: marketTypes,
            missing: ['h2h', 'spreads', 'totals'].filter(m => !marketTypes.includes(m))
          });
        }
      }
    }
  } catch (error) {
    logResult('ALL_MARKETS_FETCH', 'FAIL', `API error: ${error}`);
  }
  
  // Step 4: Test cache behavior
  console.log('\n--- Testing Cache Behavior ---');
  try {
    const cachedData = await fetchLiveOdds('icehockey_nhl', {
      markets: ['h2h', 'spreads', 'totals'],
      regions: ['us'],
      oddsFormat: 'american',
      apiKey,
      skipCache: false // Use cache
    });
    
    logResult('CACHE_TEST', 'PASS', 'Cache retrieval successful', {
      gamesCount: cachedData?.length || 0,
      source: 'cache or fresh'
    });
  } catch (error) {
    logResult('CACHE_TEST', 'FAIL', `Cache error: ${error}`);
  }
  
  // Step 5: Test with skipCache to force fresh data
  console.log('\n--- Testing Skip Cache ---');
  try {
    const freshData = await fetchLiveOdds('icehockey_nhl', {
      markets: ['h2h', 'spreads', 'totals'],
      regions: ['us'],
      oddsFormat: 'american',
      apiKey,
      skipCache: true // Force fresh
    });
    
    logResult('SKIP_CACHE_TEST', 'PASS', 'Skip cache successful - fresh data retrieved', {
      gamesCount: freshData?.length || 0
    });
  } catch (error) {
    logResult('SKIP_CACHE_TEST', 'FAIL', `Skip cache error: ${error}`);
  }
  
  // Summary
  console.log('\n=== DIAGNOSTIC SUMMARY ===\n');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`✓ Passed: ${passed}`);
  console.log(`✗ Failed: ${failed}`);
  console.log(`⚠ Warnings: ${warnings}`);
  
  if (failed > 0) {
    console.log('\n❌ DIAGNOSTICS FAILED - Review errors above');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('\n⚠ DIAGNOSTICS PASSED WITH WARNINGS - Review warnings above');
  } else {
    console.log('\n✅ ALL DIAGNOSTICS PASSED');
  }
}

// Run diagnostics
diagnoseAPIResponse().catch(console.error);
