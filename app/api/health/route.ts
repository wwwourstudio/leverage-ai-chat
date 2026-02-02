import { NextResponse } from 'next/server';

/**
 * Health Check API Route
 * 
 * Returns the status of all integrations and environment variables
 */
export async function GET() {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      integrations: {
        oddsAPI: !!process.env.ODDS_API_KEY,
        grokAI: !!process.env.XAI_API_KEY,
        supabase: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      },
      env: {
        ODDS_API_KEY: !!process.env.ODDS_API_KEY,
        XAI_API_KEY: !!process.env.XAI_API_KEY,
        NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      },
      version: '1.0.0'
    };

    // Check if all required integrations are configured
    const allConfigured = Object.values(health.integrations).every(v => v === true);
    
    return NextResponse.json({
      ...health,
      ready: allConfigured
    });
    
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
