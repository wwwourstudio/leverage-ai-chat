import { NextResponse } from 'next/server';
import { getOddsApiKey, isOddsApiConfigured } from '@/lib/config';
import { EXTERNAL_APIS } from '@/lib/constants';
import { VALID_SPORTS } from '@/lib/sports-validator';

export const runtime = 'edge';

/**
 * Odds API Diagnostic Tool
 * Tests connectivity and availability for all major sports
 */
export async function GET() {
  const startTime = Date.now();
  
  try {
    // Check configuration
    if (!isOddsApiConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'ODDS_API_KEY not configured',
        message: 'Please add ODDS_API_KEY to environment variables',
        timestamp: new Date().toISOString()
      }, { status: 503 });
    }

    const oddsApiKey = getOddsApiKey();
    console.log('[v0] Starting comprehensive sports API diagnostics...');
    
    // Test sports to check
    const testSports = [
      { key: 'basketball_nba', name: 'NBA' },
      { key: 'americanfootball_nfl', name: 'NFL' },
      { key: 'baseball_mlb', name: 'MLB' },
      { key: 'icehockey_nhl', name: 'NHL' },
      { key: 'basketball_ncaab', name: 'NCAAB' },
      { key: 'americanfootball_ncaaf', name: 'NCAAF' },
      { key: 'baseball_ncaa', name: 'College Baseball' }
    ];

    const results: any[] = [];
    let totalGames = 0;
    let successfulSports = 0;
    let failedSports = 0;

    // Test each sport
    for (const sport of testSports) {
      const sportStartTime = Date.now();
      
      try {
        const apiUrl = `${EXTERNAL_APIS.ODDS_API.BASE_URL}/sports/${sport.key}/odds?apiKey=${oddsApiKey}&regions=us&markets=h2h`;
        
        console.log(`[v0] Testing ${sport.name} (${sport.key})...`);
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(8000)
        });

        const responseTime = Date.now() - sportStartTime;
        
        if (response.ok) {
          const data = await response.json();
          const gameCount = Array.isArray(data) ? data.length : 0;
          totalGames += gameCount;
          
          if (gameCount > 0) {
            successfulSports++;
            console.log(`[v0] ✅ ${sport.name}: ${gameCount} games found`);
          } else {
            console.log(`[v0] ⚠️ ${sport.name}: API responding but no games available`);
          }
          
          results.push({
            sport: sport.name,
            sportKey: sport.key,
            status: 'success',
            gamesAvailable: gameCount,
            responseTime,
            apiStatus: response.status,
            remainingRequests: response.headers.get('x-requests-remaining'),
            usedRequests: response.headers.get('x-requests-used'),
            sampleGame: gameCount > 0 ? {
              id: data[0].id,
              homeTeam: data[0].home_team,
              awayTeam: data[0].away_team,
              commenceTime: data[0].commence_time
            } : null
          });
        } else {
          failedSports++;
          const errorText = await response.text();
          console.error(`[v0] ❌ ${sport.name}: HTTP ${response.status}`);
          
          results.push({
            sport: sport.name,
            sportKey: sport.key,
            status: 'error',
            gamesAvailable: 0,
            responseTime,
            apiStatus: response.status,
            error: errorText.substring(0, 200)
          });
        }
      } catch (error: any) {
        failedSports++;
        const responseTime = Date.now() - sportStartTime;
        console.error(`[v0] ❌ ${sport.name}: ${error.message}`);
        
        results.push({
          sport: sport.name,
          sportKey: sport.key,
          status: 'error',
          gamesAvailable: 0,
          responseTime,
          error: error.message
        });
      }
    }

    const totalTime = Date.now() - startTime;
    
    // Determine overall health
    const healthStatus = successfulSports === testSports.length ? 'healthy' :
                        successfulSports > testSports.length / 2 ? 'degraded' :
                        'critical';

    const summary = {
      overallHealth: healthStatus,
      totalSportsTested: testSports.length,
      successfulSports,
      failedSports,
      totalGamesAvailable: totalGames,
      totalDiagnosticTime: totalTime,
      timestamp: new Date().toISOString()
    };

    console.log('[v0] Diagnostics complete:', summary);

    return NextResponse.json({
      success: true,
      summary,
      results,
      recommendations: generateRecommendations(results),
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error('[v0] Diagnostic error:', error.message);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      totalTime,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

function generateRecommendations(results: any[]): string[] {
  const recommendations: string[] = [];
  
  const failedSports = results.filter(r => r.status === 'error');
  const sportsWithNoGames = results.filter(r => r.status === 'success' && r.gamesAvailable === 0);
  
  if (failedSports.length > 0) {
    recommendations.push(`${failedSports.length} sport(s) failed to connect: ${failedSports.map(s => s.sport).join(', ')}`);
    recommendations.push('Check ODDS_API_KEY validity and API quota limits');
  }
  
  if (sportsWithNoGames.length > 0) {
    recommendations.push(`${sportsWithNoGames.length} sport(s) have no games currently: ${sportsWithNoGames.map(s => s.sport).join(', ')}`);
    recommendations.push('This is normal during off-season periods');
  }
  
  const workingSports = results.filter(r => r.status === 'success' && r.gamesAvailable > 0);
  if (workingSports.length > 0) {
    recommendations.push(`${workingSports.length} sport(s) are fully operational with live games`);
  }
  
  // Check response times
  const slowResponses = results.filter(r => r.responseTime > 3000);
  if (slowResponses.length > 0) {
    recommendations.push(`${slowResponses.length} sport(s) have slow response times (>3s)`);
  }
  
  return recommendations;
}
