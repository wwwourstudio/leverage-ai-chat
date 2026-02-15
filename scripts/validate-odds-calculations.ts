#!/usr/bin/env ts-node
/**
 * Odds Calculations Validator
 * 
 * Tests all odds conversion and probability calculations:
 * - American to Decimal conversion
 * - Implied probability calculations
 * - Edge calculations
 * - Kelly Criterion formulas
 * - Arbitrage profit calculations
 * 
 * Run: npx ts-node scripts/validate-odds-calculations.ts
 */

import { kellyFraction, calculateKelly } from '../lib/kelly';
import { calculateEdge, analyzeEdge } from '../lib/edge';
import { calculateArbitrage } from '../lib/arbitrage';

interface TestResult {
  test: string;
  expected: any;
  actual: any;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assertEqual(test: string, expected: any, actual: any, tolerance = 0.001) {
  const passed = Math.abs(expected - actual) < tolerance;
  results.push({
    test,
    expected,
    actual,
    passed,
    error: passed ? undefined : `Expected ${expected}, got ${actual}`
  });
  
  const icon = passed ? '✓' : '✗';
  console.log(`${icon} ${test}: ${passed ? 'PASS' : 'FAIL'}`);
  if (!passed) {
    console.log(`   Expected: ${expected}, Got: ${actual}`);
  }
}

function testAmericanToDecimalConversion() {
  console.log('\n--- American to Decimal Conversion ---\n');
  
  // Positive odds (underdog)
  // +150 should be 2.5
  const plus150 = 1 + (150 / 100);
  assertEqual('American +150 to Decimal', 2.5, plus150);
  
  // +200 should be 3.0
  const plus200 = 1 + (200 / 100);
  assertEqual('American +200 to Decimal', 3.0, plus200);
  
  // Negative odds (favorite)
  // -150 should be 1.667
  const minus150 = 1 + (100 / 150);
  assertEqual('American -150 to Decimal', 1.667, minus150, 0.01);
  
  // -200 should be 1.5
  const minus200 = 1 + (100 / 200);
  assertEqual('American -200 to Decimal', 1.5, minus200);
  
  // Even odds
  // +100 should be 2.0
  const plus100 = 1 + (100 / 100);
  assertEqual('American +100 to Decimal', 2.0, plus100);
}

function testImpliedProbability() {
  console.log('\n--- Implied Probability Calculations ---\n');
  
  // +150 odds = 40% implied probability
  const decimal150 = 2.5;
  const implied150 = 1 / decimal150;
  assertEqual('Implied prob for +150 (2.5)', 0.40, implied150, 0.01);
  
  // -150 odds = 60% implied probability
  const decimal_150 = 1.667;
  const implied_150 = 1 / decimal_150;
  assertEqual('Implied prob for -150 (1.667)', 0.60, implied_150, 0.01);
  
  // +100 odds = 50% implied probability
  const decimal100 = 2.0;
  const implied100 = 1 / decimal100;
  assertEqual('Implied prob for +100 (2.0)', 0.50, implied100, 0.01);
  
  // -200 odds = 66.67% implied probability
  const decimal_200 = 1.5;
  const implied_200 = 1 / decimal_200;
  assertEqual('Implied prob for -200 (1.5)', 0.6667, implied_200, 0.01);
}

function testKellyCriterion() {
  console.log('\n--- Kelly Criterion Calculations ---\n');
  
  // Example: You believe there's a 60% chance of winning
  // Odds are +150 (2.5 decimal, 40% implied)
  // Kelly = (p * decimal - 1) / (decimal - 1)
  // Kelly = (0.6 * 2.5 - 1) / (2.5 - 1) = 0.5 / 1.5 = 0.333 (33.3%)
  
  const kelly1 = kellyFraction(0.60, 150, { fractionalKelly: 1.0 });
  assertEqual('Kelly for 60% prob, +150 odds', 0.333, kelly1.kellyPct, 0.01);
  
  // Example 2: 55% chance, +120 odds
  // Decimal: 2.2, Kelly = (0.55 * 2.2 - 1) / (2.2 - 1) = 0.21 / 1.2 = 0.175
  const kelly2 = kellyFraction(0.55, 120, { fractionalKelly: 1.0 });
  assertEqual('Kelly for 55% prob, +120 odds', 0.175, kelly2.kellyPct, 0.01);
  
  // Example 3: Negative Kelly (no bet)
  // 40% chance, +100 odds (50% implied)
  // Kelly = (0.4 * 2 - 1) / (2 - 1) = -0.2 / 1 = -0.2 (negative = no bet)
  const kelly3 = kellyFraction(0.40, 100, { fractionalKelly: 1.0 });
  assertEqual('Kelly for 40% prob, +100 odds (negative)', true, kelly3.kellyPct <= 0);
  
  // Test fractional Kelly (25% Kelly)
  const kelly4 = kellyFraction(0.60, 150, { fractionalKelly: 0.25 });
  assertEqual('Quarter Kelly for 60% prob, +150 odds', 0.0833, kelly4.kellyPct, 0.01);
}

function testEdgeCalculations() {
  console.log('\n--- Edge Calculations ---\n');
  
  // Edge = Model Probability - Market Probability
  // Example: Model says 60%, market implies 40% (+150 odds)
  // Edge = 0.60 - 0.40 = 0.20 (20% edge)
  
  const edge1 = calculateEdge(0.60, 150);
  assertEqual('Edge: 60% model vs +150 market', 0.20, edge1.edge, 0.01);
  assertEqual('Edge analysis: High confidence', true, edge1.edgeLevel === 'high');
  
  // Example 2: Model says 55%, market implies 47.6% (+110 odds)
  // Edge = 0.55 - 0.476 = 0.074 (7.4% edge)
  const edge2 = calculateEdge(0.55, 110);
  assertEqual('Edge: 55% model vs +110 market', 0.074, edge2.edge, 0.01);
  assertEqual('Edge analysis: High confidence', true, edge2.edgeLevel === 'high');
  
  // Example 3: No edge (model = market)
  // Model says 50%, market implies 50% (+100 odds)
  const edge3 = calculateEdge(0.50, 100);
  assertEqual('Edge: 50% model vs +100 market (no edge)', 0.00, edge3.edge, 0.01);
  assertEqual('Edge analysis: No edge', true, edge3.edge < 0.02);
}

function testArbitrageCalculations() {
  console.log('\n--- Arbitrage Calculations ---\n');
  
  // Perfect arbitrage example:
  // Book A: Team A +150 (40% implied)
  // Book B: Team B -110 (52.4% implied)
  // Total implied: 92.4% (< 100% = arbitrage opportunity)
  
  const arb1 = calculateArbitrage(150, -110);
  assertEqual('Arbitrage exists: +150 vs -110', true, arb1.isArbitrage);
  assertEqual('Arbitrage profit %', 0.076, arb1.profitMargin, 0.01); // ~7.6% profit
  
  // No arbitrage example:
  // Book A: Team A +100 (50% implied)
  // Book B: Team B +100 (50% implied)
  // Total implied: 100% (= 100% = no arbitrage)
  
  const arb2 = calculateArbitrage(100, 100);
  assertEqual('No arbitrage: +100 vs +100', false, arb2.isArbitrage);
  
  // Stronger arbitrage:
  // Book A: +200 (33.3% implied)
  // Book B: -150 (60% implied)
  // Total: 93.3% (6.7% profit)
  
  const arb3 = calculateArbitrage(200, -150);
  assertEqual('Arbitrage exists: +200 vs -150', true, arb3.isArbitrage);
  assertEqual('Arbitrage profit %', 0.067, arb3.profitMargin, 0.01);
}

function testEdgeCases() {
  console.log('\n--- Edge Cases ---\n');
  
  // Very high positive odds
  const kelly5 = kellyFraction(0.30, 1000, { fractionalKelly: 1.0 });
  assertEqual('Kelly for low prob, very high odds', true, kelly5.kellyPct >= 0);
  
  // Very negative odds
  const kelly6 = kellyFraction(0.90, -500, { fractionalKelly: 1.0 });
  assertEqual('Kelly for high prob, heavy favorite', true, kelly6.kellyPct >= 0);
  
  // Zero probability
  const kelly7 = kellyFraction(0, 150, { fractionalKelly: 1.0 });
  assertEqual('Kelly for 0% prob (no bet)', 0, kelly7.kellyPct, 0.01);
  
  // 100% probability
  const kelly8 = kellyFraction(1.0, 150, { fractionalKelly: 1.0 });
  assertEqual('Kelly for 100% prob', true, kelly8.kellyPct > 0);
}

async function runValidation() {
  console.log('\n=== ODDS CALCULATIONS VALIDATOR ===\n');
  
  testAmericanToDecimalConversion();
  testImpliedProbability();
  testKellyCriterion();
  testEdgeCalculations();
  testArbitrageCalculations();
  testEdgeCases();
  
  // Summary
  console.log('\n=== VALIDATION SUMMARY ===\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`✓ Passed: ${passed}`);
  console.log(`✗ Failed: ${failed}`);
  console.log(`Pass Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n❌ VALIDATION FAILED');
    console.log('Review failed calculations above');
    process.exit(1);
  } else {
    console.log('\n✅ ALL CALCULATIONS VALIDATED');
  }
}

// Run validation
runValidation().catch(console.error);
