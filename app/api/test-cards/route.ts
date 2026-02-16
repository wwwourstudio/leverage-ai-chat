import { NextResponse } from 'next/server';

/**
 * Test endpoint to verify all card categories work correctly
 * Call: GET /api/test-cards?category=arbitrage (or lines, portfolio, props, kalshi, betting)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || 'all';
  
  try {
    console.log(`[v0] [TEST-CARDS] Testing category: ${category}`);
    
    const { generateContextualCards } = await import('@/lib/cards-generator');
    const results: Record<string, any> = {};
    
    // Test categories to verify
    const categoriesToTest = category === 'all' 
      ? ['betting', 'arbitrage', 'lines', 'portfolio', 'props', 'kalshi']
      : [category];
    
    for (const cat of categoriesToTest) {
      console.log(`[v0] [TEST-CARDS] Testing ${cat} category...`);
      
      try {
        const cards = await generateContextualCards({
          category: cat as any,
          sport: cat === 'betting' ? 'icehockey_nhl' : undefined,
          count: 3,
          multiSport: false
        });
        
        results[cat] = {
          success: true,
          cardsGenerated: cards.length,
          cardTypes: cards.map((c: any) => c.type),
          sampleCard: cards[0] ? {
            type: cards[0].type,
            title: cards[0].title,
            category: cards[0].category,
            hasData: !!cards[0].data
          } : null
        };
        
        console.log(`[v0] [TEST-CARDS] ✓ ${cat}: ${cards.length} cards`);
      } catch (error) {
        results[cat] = {
          success: false,
          error: String(error)
        };
        console.error(`[v0] [TEST-CARDS] ✗ ${cat}:`, error);
      }
    }
    
    const allSuccess = Object.values(results).every((r: any) => r.success);
    
    return NextResponse.json({
      success: allSuccess,
      testedCategories: categoriesToTest,
      results,
      summary: {
        total: categoriesToTest.length,
        passed: Object.values(results).filter((r: any) => r.success).length,
        failed: Object.values(results).filter((r: any) => !r.success).length
      }
    });
    
  } catch (error) {
    console.error('[v0] [TEST-CARDS] Fatal error:', error);
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
}
