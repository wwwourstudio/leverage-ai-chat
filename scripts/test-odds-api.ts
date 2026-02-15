// Test Odds API Integration
// Run with: npx tsx scripts/test-odds-api.ts

import { fetchLiveOdds } from '../lib/odds-api-client';
import { getOddsWithCache } from '../lib/unified-odds-fetcher';

async function testOddsAPI() {
  console.log('=== TESTING ODDS API INTEGRATION ===\n');
  
  const apiKey = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
  
  if (!apiKey) {
    console.error('❌ ERROR: ODDS_API_KEY not found in environment');
    console.log('Set it in .env.local: ODDS_API_KEY=your_key_here\n');
    return;
  }
  
  console.log('✓ API Key found\n');
  
  // Test 1: Direct API call
  console.log('TEST 1: Direct API Call (fetchLiveOdds)');
  console.log('Fetching NHL odds with all markets...');
  try {
    const directOdds = await fetchLiveOdds('icehockey_nhl', {
      markets: ['h2h', 'spreads', 'totals'],
      regions: ['us'],
      oddsFormat: 'american',
      apiKey,
      skipCache: true
    });
    
    console.log(`✓ SUCCESS: Fetched ${directOdds.length} games`);
    if (directOdds.length > 0) {
      const game = directOdds[0];
      console.log(`Sample game: ${game.away_team} @ ${game.home_team}`);
      console.log(`Bookmakers: ${game.bookmakers?.length || 0}`);
      console.log(`Markets available: ${game.bookmakers?.[0]?.markets?.map((m: any) => m.key).join(', ') || 'none'}\n`);
    } else {
      console.log('⚠ WARNING: No games returned from API\n');
    }
  } catch (error) {
    console.error('❌ FAILED:', error);
    console.log('');
  }
  
  // Test 2: Unified service with Supabase
  console.log('TEST 2: Unified Service (getOddsWithCache)');
  console.log('Fetching NBA odds with Supabase caching...');
  try {
    const unifiedOdds = await getOddsWithCache('basketball_nba', {
      useCache: false,
      storeResults: true
    });
    
    console.log(`✓ SUCCESS: Fetched ${unifiedOdds.length} games via unified service`);
    if (unifiedOdds.length > 0) {
      console.log(`Sample game: ${unifiedOdds[0].away_team} @ ${unifiedOdds[0].home_team}`);
      console.log('Data should now be stored in Supabase\n');
    }
  } catch (error) {
    console.error('❌ FAILED:', error);
    console.log('');
  }
  
  // Test 3: Check cache effectiveness
  console.log('TEST 3: Cache Effectiveness Test');
  console.log('Fetching same sport with cache enabled...');
  try {
    const start = Date.now();
    const cachedOdds = await getOddsWithCache('basketball_nba', {
      useCache: true,
      storeResults: false
    });
    const duration = Date.now() - start;
    
    console.log(`✓ SUCCESS: Fetched ${cachedOdds.length} games in ${duration}ms`);
    if (duration < 500) {
      console.log('✓ Cache is working (fast response)\n');
    } else {
      console.log('⚠ Cache may not be working (slow response)\n');
    }
  } catch (error) {
    console.error('❌ FAILED:', error);
    console.log('');
  }
  
  // Test 4: Verify all markets
  console.log('TEST 4: Market Coverage Test');
  console.log('Verifying h2h, spreads, and totals are all fetched...');
  try {
    const allMarkets = await fetchLiveOdds('americanfootball_nfl', {
      markets: ['h2h', 'spreads', 'totals'],
      regions: ['us'],
      oddsFormat: 'american',
      apiKey,
      skipCache: true
    });
    
    if (allMarkets.length > 0) {
      const game = allMarkets[0];
      const markets = game.bookmakers?.[0]?.markets || [];
      const marketTypes = markets.map((m: any) => m.key);
      
      const hasH2H = marketTypes.includes('h2h');
      const hasSpreads = marketTypes.includes('spreads');
      const hasTotals = marketTypes.includes('totals');
      
      console.log(`h2h: ${hasH2H ? '✓' : '✗'}`);
      console.log(`spreads: ${hasSpreads ? '✓' : '✗'}`);
      console.log(`totals: ${hasTotals ? '✓' : '✗'}`);
      
      if (hasH2H && hasSpreads && hasTotals) {
        console.log('✓ All markets are being fetched correctly\n');
      } else {
        console.log('⚠ Some markets are missing\n');
      }
    }
  } catch (error) {
    console.error('❌ FAILED:', error);
    console.log('');
  }
  
  console.log('=== TEST COMPLETE ===');
}

testOddsAPI().catch(console.error);
