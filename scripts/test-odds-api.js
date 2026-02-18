#!/usr/bin/env node

/**
 * Test script to directly call The Odds API and debug issues
 * Run with: node scripts/test-odds-api.js
 */

const ODDS_API_KEY = process.env.ODDS_API_KEY || '';

if (!ODDS_API_KEY) {
  console.error('❌ ODDS_API_KEY environment variable not set');
  process.exit(1);
}

console.log('✓ ODDS_API_KEY found');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

async function testSportsEndpoint() {
  console.log('\n📋 TEST 1: List available sports');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const url = `https://api.the-odds-api.com/v4/sports?apiKey=${ODDS_API_KEY}`;
    console.log('URL:', url.replace(ODDS_API_KEY, 'REDACTED'));
    
    const response = await fetch(url);
    console.log('Status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('ERROR:', errorText);
      return;
    }
    
    const sports = await response.json();
    console.log(`\n✓ Found ${sports.length} available sports`);
    
    // Filter to major US sports
    const majorSports = sports.filter(s => 
      ['americanfootball_nfl', 'basketball_nba', 'baseball_mlb', 'icehockey_nhl'].includes(s.key)
    );
    
    console.log('\n📊 Major US Sports Status:');
    majorSports.forEach(sport => {
      console.log(`  ${sport.title} (${sport.key})`);
      console.log(`    Active: ${sport.active}`);
      console.log(`    Has Outrights: ${sport.has_outrights}`);
    });
    
    return majorSports;
  } catch (error) {
    console.error('❌ Failed to fetch sports list:', error);
  }
}

async function testOddsEndpoint(sportKey) {
  console.log(`\n🎯 TEST 2: Fetch odds for ${sportKey}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const markets = 'h2h,spreads,totals';
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=${markets}&oddsFormat=american`;
    console.log('URL:', url.replace(ODDS_API_KEY, 'REDACTED'));
    
    const response = await fetch(url);
    console.log('Status:', response.status, response.statusText);
    
    // Log remaining requests quota
    const remaining = response.headers.get('x-requests-remaining');
    const used = response.headers.get('x-requests-used');
    console.log('API Quota - Remaining:', remaining, 'Used:', used);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('ERROR:', errorText);
      return null;
    }
    
    const games = await response.json();
    console.log(`\n✓ Found ${games.length} games for ${sportKey}`);
    
    if (games.length > 0) {
      const game = games[0];
      console.log('\n📍 Sample Game:');
      console.log(`  ${game.away_team} @ ${game.home_team}`);
      console.log(`  Commence Time: ${game.commence_time}`);
      console.log(`  Bookmakers: ${game.bookmakers?.length || 0}`);
      
      if (game.bookmakers && game.bookmakers[0]) {
        const bookmaker = game.bookmakers[0];
        console.log(`  Sample Bookmaker: ${bookmaker.title}`);
        console.log(`  Markets: ${bookmaker.markets?.map(m => m.key).join(', ')}`);
        
        if (bookmaker.markets && bookmaker.markets[0]) {
          const market = bookmaker.markets[0];
          console.log(`\n  ${market.key} odds:`);
          market.outcomes.forEach(outcome => {
            console.log(`    ${outcome.name}: ${outcome.price > 0 ? '+' : ''}${outcome.price}`);
          });
        }
      }
    } else {
      console.log('⚠️  No games found - this sport may be in offseason or no games scheduled today');
    }
    
    return games;
  } catch (error) {
    console.error(`❌ Failed to fetch odds for ${sportKey}:`, error);
    return null;
  }
}

async function main() {
  console.log('🔍 ODDS API DIAGNOSTIC TEST');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Date:', new Date().toISOString());
  
  // Test 1: List sports
  const sports = await testSportsEndpoint();
  
  if (!sports || sports.length === 0) {
    console.error('\n❌ No sports available, stopping tests');
    return;
  }
  
  // Test 2: Fetch odds for each major sport
  for (const sport of sports) {
    await testOddsEndpoint(sport.key);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✓ Test completed');
  console.log('\nNEXT STEPS:');
  console.log('1. If no games found, check that sports are in-season');
  console.log('2. Verify API key has sufficient quota remaining');
  console.log('3. Check if date/time is correct (games are upcoming, not past)');
}

main().catch(console.error);
