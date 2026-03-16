import { NextRequest, NextResponse } from 'next/server';
import { loadADPFromSupabase } from '@/lib/adp-data.server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const sport = req.nextUrl.searchParams.get('sport') ?? 'mlb';
    const allowStale = req.nextUrl.searchParams.get('allowStale') === 'true';
    
    const data = await loadADPFromSupabase(sport, allowStale);
    
    return NextResponse.json({ 
      success: true, 
      data,
      count: data?.length ?? 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[v0] [ADP] Load failed:', msg);
    return NextResponse.json({ success: false, error: msg, data: null }, { status: 500 });
  }
}
