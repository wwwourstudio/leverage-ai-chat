import { NextResponse } from 'next/server';

/**
 * End-to-end test: Simulate user query → AI response → cards generation
 * Call: GET /api/test-e2e?query=show+me+nhl+games
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || 'show me NHL games';
  
  try {
    console.log('[v0] [TEST-E2E] Testing end-to-end flow for query:', query);
    const testResults: any[] = [];
    
    // Step 1: Parse query intent (simplified - real app uses AI)
    testResults.push({
      step: 1,
      name: 'Query Intent Detection',
      query: query,
      detected: {
        sport: query.toLowerCase().includes('nhl') ? 'NHL' : 
               query.toLowerCase().includes('nba') ? 'NBA' :
               query.toLowerCase().includes('nfl') ? 'NFL' : 'GENERAL',
        category: query.toLowerCase().includes('arbitrage') ? 'arbitrage' :
                 query.toLowerCase().includes('line') ? 'lines' :
                 query.toLowerCase().includes('props') ? 'props' : 'betting'
      },
      success: true
    });
    
    // Step 2: Generate cards based on detected intent
    const { generateContextualCards } = await import('@/lib/cards-generator');
    const detectedSport = testResults[0].detected.sport === 'NHL' ? 'icehockey_nhl' :
                         testResults[0].detected.sport === 'NBA' ? 'basketball_nba' :
                         testResults[0].detected.sport === 'NFL' ? 'americanfootball_nfl' : 'icehockey_nhl';
    
    const cards = await generateContextualCards({
      category: testResults[0].detected.category as any,
      sport: detectedSport,
      count: 3,
      multiSport: false
    });
    
    testResults.push({
      step: 2,
      name: 'Cards Generation',
      cardsGenerated: cards.length,
      cardTypes: cards.map(c => c.type),
      success: cards.length > 0
    });
    
    // Step 3: Simulate AI response generation
    const aiResponse = cards.length > 0
      ? `Found ${cards.length} live games with real odds from sportsbooks. ${cards[0].data?.matchup || 'Game data available'}.`
      : 'No games currently available for this sport.';
    
    testResults.push({
      step: 3,
      name: 'AI Response Generation',
      response: aiResponse,
      success: true
    });
    
    // Step 4: Verify card data integrity
    const cardDataIntegrity = cards.every(card => 
      card.type && card.title && card.category && card.data
    );
    
    testResults.push({
      step: 4,
      name: 'Card Data Integrity',
      allCardsValid: cardDataIntegrity,
      sampleCard: cards[0] ? {
        type: cards[0].type,
        title: cards[0].title,
        hasData: !!cards[0].data,
        dataKeys: cards[0].data ? Object.keys(cards[0].data) : []
      } : null,
      success: cardDataIntegrity
    });
    
    const allStepsSuccessful = testResults.every(r => r.success);
    
    return NextResponse.json({
      success: allStepsSuccessful,
      query: query,
      steps: testResults,
      summary: {
        totalSteps: testResults.length,
        passed: testResults.filter(r => r.success).length,
        failed: testResults.filter(r => !r.success).length
      },
      result: {
        aiResponse,
        cardsGenerated: cards.length,
        cards: cards.map(c => ({
          type: c.type,
          title: c.title,
          category: c.category
        }))
      },
      message: allStepsSuccessful 
        ? 'End-to-end flow working correctly'
        : 'Some steps failed - check step details'
    });
    
  } catch (error) {
    console.error('[v0] [TEST-E2E] Fatal error:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
      message: 'End-to-end test failed'
    }, { status: 500 });
  }
}
