import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const results = {
    timestamp: new Date().toISOString(),
    integrations: {} as Record<string, { status: string; details?: string }>,
  };

  // Check Supabase
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('live_odds_cache').select('id').limit(1);
    
    if (error) {
      results.integrations.supabase = {
        status: 'error',
        details: `Database query failed: ${error.message}`,
      };
    } else {
      results.integrations.supabase = {
        status: 'connected',
        details: 'Database accessible',
      };
    }
  } catch (error) {
    results.integrations.supabase = {
      status: 'error',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Check Odds API
  const oddsApiKey = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
  if (oddsApiKey) {
    try {
      const response = await fetch(
        `https://api.the-odds-api.com/v4/sports/icehockey_nhl/odds/?apiKey=${oddsApiKey}&regions=us&markets=h2h`,
        { signal: AbortSignal.timeout(5000) }
      );
      
      if (response.ok) {
        const data = await response.json();
        results.integrations.oddsApi = {
          status: 'connected',
          details: `Fetched ${data.length} games`,
        };
      } else {
        results.integrations.oddsApi = {
          status: 'error',
          details: `API returned ${response.status}`,
        };
      }
    } catch (error) {
      results.integrations.oddsApi = {
        status: 'error',
        details: error instanceof Error ? error.message : 'Request failed',
      };
    }
  } else {
    results.integrations.oddsApi = {
      status: 'missing',
      details: 'ODDS_API_KEY not set',
    };
  }

  // Check Kalshi API
  const kalshiApiKey = process.env.KALSHI_API_KEY;
  if (kalshiApiKey) {
    results.integrations.kalshi = {
      status: 'configured',
      details: 'API key present',
    };
  } else {
    results.integrations.kalshi = {
      status: 'optional',
      details: 'Not configured (optional)',
    };
  }

  // Overall status
  const hasErrors = Object.values(results.integrations).some(
    (int) => int.status === 'error' || int.status === 'missing'
  );

  return NextResponse.json({
    ...results,
    overallStatus: hasErrors ? 'degraded' : 'healthy',
  });
}
