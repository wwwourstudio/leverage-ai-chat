import { NextRequest, NextResponse } from 'next/server';
import { getOddsApiKey, isOddsApiConfigured } from '@/lib/config';
import { SPORT_KEYS, sportToApi } from '@/lib/constants';

/**
 * Diagnostic endpoint to test all sport API keys
 * Tests each sport individually and reports back which ones are working
 */

export const runtime = 'edge';

interface SportTestResult {
  sport: string;
  apiKey: string;
  status: 'success' | 'no_games' | 'error';
  eventCount?: number;
  error?: string;
  httpStatus?: number;
  apiUrl?: string;
}

export async function GET(req: NextRequest) {
  try {
    // Check if API key is configured
    if (!isOddsApiConfigured()) {
      return NextResponse.json({
        error: 'ODDS_API_KEY is not configured',
        message: 'Please add ODDS_API_KEY to your environment variables',
        configured: false
      }, { status: 503 });
    }

    const apiKey = getOddsApiKey();
    const results: SportTestResult[] = [];

    // Test all major sports
    const sportsToTest = [
      { name: 'NBA', key: SPORT_KEYS.NBA.API },
      { name: 'NFL', key: SPORT_KEYS.NFL.API },
      { name: 'MLB', key: SPORT_KEYS.MLB.API },
      { name: 'NHL', key: SPORT_KEYS.NHL.API },
      { name: 'NCAAB', key: SPORT_KEYS.NCAAB.API },
      { name: 'NCAAF', key: SPORT_KEYS.NCAAF.API },
    ];

    console.log('[Diagnostic] Testing all sport APIs...');
    console.log(`[Diagnostic] API Key: ${apiKey?.substring(0, 8)}...`);

    // Test each sport
    for (const sport of sportsToTest) {
      const apiUrl = `https://api.the-odds-api.com/v4/sports/${sport.key}/odds?apiKey=${apiKey}&regions=us&markets=h2h`;
      const result: SportTestResult = {
        sport: sport.name,
        apiKey: sport.key,
        status: 'error',
        apiUrl: apiUrl.replace(apiKey || '', 'REDACTED')
      };

      try {
        console.log(`[Diagnostic] Testing ${sport.name} (${sport.key})...`);
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000)
        });

        result.httpStatus = response.status;

        if (response.ok) {
          const data = await response.json();
          const eventCount = Array.isArray(data) ? data.length : 0;
          
          result.status = eventCount > 0 ? 'success' : 'no_games';
          result.eventCount = eventCount;
          
          console.log(`[Diagnostic] ${sport.name}: ${eventCount} games found`);
        } else {
          const errorText = await response.text();
          result.status = 'error';
          result.error = `HTTP ${response.status}: ${errorText.substring(0, 100)}`;
          console.log(`[Diagnostic] ${sport.name} ERROR: ${result.error}`);
        }
      } catch (error: any) {
        result.status = 'error';
        result.error = error.message || String(error);
        console.error(`[Diagnostic] ${sport.name} EXCEPTION:`, result.error);
      }

      results.push(result);
    }

    // Summary
    const summary = {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      noGames: results.filter(r => r.status === 'no_games').length,
      errors: results.filter(r => r.status === 'error').length,
    };

    console.log('[Diagnostic] Test complete:', summary);

    return NextResponse.json({
      configured: true,
      apiKeyPrefix: apiKey?.substring(0, 8),
      timestamp: new Date().toISOString(),
      summary,
      results,
      recommendations: generateRecommendations(results)
    });

  } catch (error: any) {
    console.error('[Diagnostic] Fatal error:', error);
    return NextResponse.json({
      error: 'Diagnostic test failed',
      details: error.message || String(error)
    }, { status: 500 });
  }
}

function generateRecommendations(results: SportTestResult[]): string[] {
  const recommendations: string[] = [];
  
  const successCount = results.filter(r => r.status === 'success').length;
  const noGamesCount = results.filter(r => r.status === 'no_games').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  if (errorCount === results.length) {
    recommendations.push('All sports failed - verify ODDS_API_KEY is valid');
    recommendations.push('Check API key at https://the-odds-api.com/account/');
  } else if (errorCount > 0) {
    recommendations.push(`${errorCount} sports returned errors - check API endpoint URLs`);
  }

  if (noGamesCount > 0) {
    const noGamesSports = results.filter(r => r.status === 'no_games').map(r => r.sport);
    recommendations.push(`${noGamesCount} sports have no games scheduled: ${noGamesSports.join(', ')}`);
    recommendations.push('This is normal if out of season');
  }

  if (successCount > 0) {
    const successSports = results.filter(r => r.status === 'success').map(r => r.sport);
    recommendations.push(`✅ Working sports: ${successSports.join(', ')}`);
  }

  if (successCount === 0 && noGamesCount > 0) {
    recommendations.push('API key is valid but no games currently scheduled');
  }

  return recommendations;
}
