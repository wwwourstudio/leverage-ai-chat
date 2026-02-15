// End-to-End Test: Unified Service → Cards Generator → User Display
// Run with: npx tsx scripts/test-end-to-end.ts

import { generateInsightCards } from '../lib/cards-generator';

async function testEndToEnd() {
  console.log('=== END-TO-END DATA FLOW TEST ===\n');
  
  // Test 1: Betting category with NHL
  console.log('TEST 1: Betting Category - NHL');
  console.log('User query: "Show me NHL betting opportunities"');
  console.log('Expected: 3 cards with real odds, all markets (h2h, spreads, totals)\n');
  
  try {
    const cards = await generateInsightCards('nhl', 'betting', 3);
    
    console.log(`✓ Generated ${cards.length} cards`);
    
    if (cards.length > 0) {
      const firstCard = cards[0];
      console.log(`\nFirst card details:`);
      console.log(`- Title: ${firstCard.title}`);
      console.log(`- Type: ${firstCard.type}`);
      console.log(`- Has real data: ${firstCard.metadata?.realData || false}`);
      console.log(`- Data source: ${firstCard.metadata?.dataSource || 'unknown'}`);
      
      if (firstCard.data) {
        console.log(`- Matchup: ${firstCard.data.matchup || 'N/A'}`);
        console.log(`- Has spreads: ${!!firstCard.data.spread}`);
        console.log(`- Has totals: ${!!firstCard.data.total}`);
        console.log(`- Has moneyline: ${!!firstCard.data.homeOdds}`);
      }
    }
    
    console.log('');
  } catch (error) {
    console.error('❌ FAILED:', error);
    console.log('');
  }
  
  // Test 2: Arbitrage category
  console.log('TEST 2: Arbitrage Category');
  console.log('User query: "Show me arbitrage opportunities"');
  console.log('Expected: Cards from arbitrage_opportunities table\n');
  
  try {
    const cards = await generateInsightCards('', 'arbitrage', 3);
    
    console.log(`✓ Generated ${cards.length} cards`);
    
    if (cards.length > 0) {
      const arbCard = cards[0];
      console.log(`\nArbitrage card:`);
      console.log(`- Title: ${arbCard.title}`);
      console.log(`- Profit margin: ${arbCard.data?.profitMargin || 'N/A'}`);
      console.log(`- Status: ${arbCard.data?.status || 'unknown'}`);
    }
    
    console.log('');
  } catch (error) {
    console.error('❌ FAILED:', error);
    console.log('');
  }
  
  // Test 3: Line movement category
  console.log('TEST 3: Line Movement Category');
  console.log('User query: "Show me recent line movements"');
  console.log('Expected: Cards from line_movement table\n');
  
  try {
    const cards = await generateInsightCards('', 'lines', 3);
    
    console.log(`✓ Generated ${cards.length} cards`);
    
    if (cards.length > 0) {
      const lineCard = cards[0];
      console.log(`\nLine movement card:`);
      console.log(`- Title: ${lineCard.title}`);
      console.log(`- Line change: ${lineCard.data?.lineChange || 'N/A'}`);
      console.log(`- Is steam: ${lineCard.data?.isSteamMove || false}`);
    }
    
    console.log('');
  } catch (error) {
    console.error('❌ FAILED:', error);
    console.log('');
  }
  
  // Test 4: Portfolio category
  console.log('TEST 4: Portfolio Category');
  console.log('User query: "Show me my portfolio and Kelly sizing"');
  console.log('Expected: Portfolio overview from capital_state\n');
  
  try {
    const cards = await generateInsightCards('', 'portfolio', 3);
    
    console.log(`✓ Generated ${cards.length} cards`);
    
    if (cards.length > 0) {
      const portfolioCard = cards[0];
      console.log(`\nPortfolio card:`);
      console.log(`- Title: ${portfolioCard.title}`);
      console.log(`- Bankroll: ${portfolioCard.data?.totalBankroll || 'N/A'}`);
      console.log(`- Utilization: ${portfolioCard.data?.utilizationRate || 'N/A'}`);
    }
    
    console.log('');
  } catch (error) {
    console.error('❌ FAILED:', error);
    console.log('');
  }
  
  // Test 5: Player props category
  console.log('TEST 5: Player Props Category');
  console.log('User query: "Show me NBA player props"');
  console.log('Expected: Player prop markets\n');
  
  try {
    const cards = await generateInsightCards('nba', 'props', 3);
    
    console.log(`✓ Generated ${cards.length} cards`);
    
    if (cards.length > 0) {
      const propCard = cards[0];
      console.log(`\nPlayer prop card:`);
      console.log(`- Title: ${propCard.title}`);
      console.log(`- Category: ${propCard.category}`);
    }
    
    console.log('');
  } catch (error) {
    console.error('❌ FAILED:', error);
    console.log('');
  }
  
  console.log('=== TEST COMPLETE ===');
  console.log('\nSummary:');
  console.log('- All card categories tested');
  console.log('- Check logs above for any failures');
  console.log('- Verify real data is being fetched from APIs and Supabase');
  console.log('- Confirm all markets (h2h, spreads, totals) are present');
}

testEndToEnd().catch(console.error);
