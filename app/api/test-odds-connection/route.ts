import { NextResponse } from 'next/server';
import { getOddsApiKey } from '@/lib/config';

export const runtime = 'edge';

/**
 * Test Odds API Connection
 * Verifies API key is valid and connection works
 * Based on documentation: https://the-odds-api.com/liveapi/guides/v4/
 */
export async function GET() {
  console.log('[v0] Testing Odds API connection...');

  try {
    // Step 1: Check if API key is configured
    const apiKey = getOddsApiKey();
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'ODDS_API_KEY not configured',
        instructions: [
          '1. Get your API key from https://the-odds-api.com/',
          '2. Add ODDS_API_KEY to your environment variables',
          '3. Restart the application'
        ],
        documentation: 'https://the-odds-api.com/liveapi/guides/v4/'
      }, { status: 503 });
    }

    console.log('[v0] API key found, testing connection...');

    // Step 2: Call the /sports endpoint (free, doesn't count against quota)
    const testUrl = `https://api.the-odds-api.com/v4/sports?apiKey=${apiKey}`;
    const redactedUrl = testUrl.replace(apiKey, 'REDACTED');
    console.log(`[v0] Testing URL: ${redactedUrl}`);

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    console.log(`[v0] Response status: ${response.status}`);

    // Step 3: Check response status
    if (response.status === 401) {
      return NextResponse.json({
        success: false,
        error: 'Invalid API key',
        statusCode: 401,
        instructions: [
          '1. Verify your API key at https://the-odds-api.com/account/',
          '2. Make sure the key is active and not expired',
          '3. Update ODDS_API_KEY in environment variables',
          '4. Check for extra spaces or special characters in the key'
        ],
        apiKeyPrefix: apiKey.substring(0, 8) + '...',
        documentation: 'https://the-odds-api.com/liveapi/guides/v4/'
      }, { status: 401 });
    }

    if (response.status === 429) {
      const remainingRequests = response.headers.get('x-requests-remaining');
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded',
        statusCode: 429,
        remainingRequests,
        instructions: [
          '1. You have exceeded your API quota',
          '2. Wait for quota reset or upgrade your plan',
          '3. Check usage at https://the-odds-api.com/account/'
        ],
        documentation: 'https://the-odds-api.com/liveapi/guides/v4/#rate-limiting-status-code-429'
      }, { status: 429 });
    }

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        success: false,
        error: `API returned status ${response.status}`,
        statusCode: response.status,
        details: errorText,
        instructions: [
          '1. Check API status at https://the-odds-api.com/',
          '2. Review error details above',
          '3. Contact support if issue persists'
        ]
      }, { status: response.status });
    }

    // Step 4: Parse and validate response
    const data = await response.json();
    
    // Extract quota information from headers
    const remainingRequests = response.headers.get('x-requests-remaining');
    const usedRequests = response.headers.get('x-requests-used');
    const lastRequestCost = response.headers.get('x-requests-last');

    // Find active sports
    const activeSports = Array.isArray(data) 
      ? data.filter((sport: any) => sport.active === true)
      : [];

    console.log(`[v0] ✓ Connection successful! Found ${activeSports.length} active sports`);

    return NextResponse.json({
      success: true,
      message: 'Odds API connection successful',
      apiKeyValid: true,
      connection: {
        status: 'connected',
        endpoint: 'https://api.the-odds-api.com/v4',
        testEndpoint: '/sports (free endpoint)'
      },
      quota: {
        remaining: remainingRequests || 'N/A',
        used: usedRequests || 'N/A',
        lastRequestCost: lastRequestCost || '0 (free endpoint)'
      },
      sports: {
        total: Array.isArray(data) ? data.length : 0,
        active: activeSports.length,
        examples: activeSports.slice(0, 5).map((sport: any) => ({
          key: sport.key,
          title: sport.title,
          group: sport.group
        }))
      },
      instructions: {
        nextSteps: [
          'Your API key is working correctly',
          `You have ${remainingRequests || 'unknown'} requests remaining`,
          'Use /api/odds to fetch live odds data'
        ],
        documentation: 'https://the-odds-api.com/liveapi/guides/v4/'
      }
    });

  } catch (error: any) {
    console.error('[v0] Connection test failed:', error);

    return NextResponse.json({
      success: false,
      error: 'Connection test failed',
      details: error.message,
      troubleshooting: [
        'Check your internet connection',
        'Verify firewall settings allow outbound HTTPS',
        'Confirm the-odds-api.com is accessible',
        'Try again in a few minutes'
      ],
      documentation: 'https://the-odds-api.com/liveapi/guides/v4/'
    }, { status: 500 });
  }
}
