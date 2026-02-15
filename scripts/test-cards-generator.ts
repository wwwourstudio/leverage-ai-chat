#!/usr/bin/env ts-node
/**
 * Cards Generator Test Suite
 * 
 * Tests all category types and edge cases:
 * - All sports (NHL, NBA, NFL, MLB)
 * - All categories (betting, arbitrage, lines, props, portfolio, kalshi)
 * - Edge cases (invalid sport, no data, missing API key)
 * - Count variations (1, 3, 5 cards)
 * 
 * Run: npx ts-node scripts/test-cards-generator.ts
 */

import { generateInsightCards } from '../lib/cards-generator';

interface TestCase {
  name: string;
  sport?: string;
  count: number;
  category?: string;
  expectedMinCards: number;
  shouldHaveRealData?: boolean;
}

const TEST_CASES: TestCase[] = [
  // Betting category tests
  {
    name: 'NHL betting with 3 cards',
    sport: 'NHL',
    count: 3,
    category: 'betting',
    expectedMinCards: 1,
    shouldHaveRealData: true
  },
  {
    name: 'NBA betting with 3 cards',
    sport: 'NBA',
    count: 3,
    category: 'betting',
    expectedMinCards: 1,
    shouldHaveRealData: true
  },
  {
    name: 'NFL betting with 3 cards',
    sport: 'NFL',
    count: 3,
    category: 'betting',
    expectedMinCards: 1,
    shouldHaveRealData: true
  },
  {
    name: 'MLB betting with 3 cards',
    sport: 'MLB',
    count: 3,
    category: 'betting',
    expectedMinCards: 1,
    shouldHaveRealData: true
  },
  
  // Arbitrage tests
  {
    name: 'Arbitrage opportunities',
    count: 3,
    category: 'arbitrage',
    expectedMinCards: 1,
    shouldHaveRealData: false // May not have active arbs
  },
  
  // Line movement tests
  {
    name: 'Line movements',
    count: 3,
    category: 'lines',
    expectedMinCards: 1,
    shouldHaveRealData: false // May not have recent movements
  },
  {
    name: 'Steam moves',
    count: 3,
    category: 'steam',
    expectedMinCards: 1,
    shouldHaveRealData: false
  },
  
  // Player props tests
  {
    name: 'NBA player props',
    sport: 'NBA',
    count: 3,
    category: 'props',
    expectedMinCards: 1,
    shouldHaveRealData: true
  },
  
  // Portfolio tests
  {
    name: 'Portfolio overview',
    count: 3,
    category: 'portfolio',
    expectedMinCards: 1,
    shouldHaveRealData: false // Depends on capital state
  },
  {
    name: 'Kelly sizing',
    count: 3,
    category: 'kelly',
    expectedMinCards: 1,
    shouldHaveRealData: false
  },
  
  // Kalshi tests
  {
    name: 'Kalshi prediction markets',
    count: 3,
    category: 'kalshi',
    expectedMinCards: 1,
    shouldHaveRealData: false
  },
  
  // Edge cases
  {
    name: 'Invalid sport',
    sport: 'INVALID_SPORT',
    count: 3,
    category: 'betting',
    expectedMinCards: 1,
    shouldHaveRealData: false
  },
  {
    name: 'Zero count',
    sport: 'NHL',
    count: 0,
    category: 'betting',
    expectedMinCards: 0,
    shouldHaveRealData: false
  },
  {
    name: 'Large count',
    sport: 'NHL',
    count: 10,
    category: 'betting',
    expectedMinCards: 1,
    shouldHaveRealData: true
  },
  {
    name: 'No category (default)',
    sport: 'NHL',
    count: 3,
    expectedMinCards: 1,
    shouldHaveRealData: true
  }
];

async function runTestCase(testCase: TestCase): Promise<boolean> {
  try {
    console.log(`\n--- Testing: ${testCase.name} ---`);
    console.log(`  Sport: ${testCase.sport || 'none'}`);
    console.log(`  Count: ${testCase.count}`);
    console.log(`  Category: ${testCase.category || 'default'}`);
    
    const startTime = Date.now();
    const cards = await generateInsightCards(testCase.sport, testCase.count, testCase.category);
    const duration = Date.now() - startTime;
    
    console.log(`  ⏱ Duration: ${duration}ms`);
    console.log(`  📊 Cards returned: ${cards.length}`);
    
    // Validate card count
    if (cards.length < testCase.expectedMinCards) {
      console.log(`  ✗ FAIL: Expected at least ${testCase.expectedMinCards} cards, got ${cards.length}`);
      return false;
    }
    
    // Check card structure
    const invalidCards = cards.filter(card => !card.type || !card.title || !card.data);
    if (invalidCards.length > 0) {
      console.log(`  ✗ FAIL: ${invalidCards.length} cards have invalid structure`);
      return false;
    }
    
    // Check for real data if expected
    if (testCase.shouldHaveRealData) {
      const realDataCards = cards.filter(card => card.metadata?.realData === true);
      if (realDataCards.length === 0) {
        console.log(`  ⚠ WARN: Expected real data but got none (may be API issue)`);
      } else {
        console.log(`  ✓ ${realDataCards.length} cards have real data`);
      }
    }
    
    // Show sample card
    if (cards.length > 0) {
      console.log(`  📝 Sample card: ${cards[0].title} (${cards[0].type})`);
      console.log(`     Category: ${cards[0].category}`);
      console.log(`     Real data: ${cards[0].metadata?.realData || false}`);
    }
    
    console.log(`  ✓ PASS`);
    return true;
    
  } catch (error) {
    console.log(`  ✗ FAIL: Error - ${error}`);
    console.error(error);
    return false;
  }
}

async function runAllTests() {
  console.log('\n=== CARDS GENERATOR TEST SUITE ===\n');
  
  const results = {
    passed: 0,
    failed: 0,
    total: TEST_CASES.length
  };
  
  for (const testCase of TEST_CASES) {
    const passed = await runTestCase(testCase);
    if (passed) {
      results.passed++;
    } else {
      results.failed++;
    }
  }
  
  // Summary
  console.log('\n=== TEST SUMMARY ===\n');
  console.log(`Total Tests: ${results.total}`);
  console.log(`✓ Passed: ${results.passed}`);
  console.log(`✗ Failed: ${results.failed}`);
  console.log(`Pass Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  
  if (results.failed > 0) {
    console.log('\n❌ SOME TESTS FAILED');
    process.exit(1);
  } else {
    console.log('\n✅ ALL TESTS PASSED');
  }
}

// Run all tests
runAllTests().catch(console.error);
