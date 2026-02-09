import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const days = parseInt(searchParams.get('days') || '30');
  const modelId = searchParams.get('modelId');

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = supabase
      .from('ai_response_trust')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (modelId) {
      query = query.eq('model_id', modelId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const metrics = calculateHistoricalMetrics(data || []);

    return NextResponse.json({
      success: true,
      metrics,
      period: { days, startDate, endDate: new Date() },
      sampleSize: data?.length || 0
    });
  } catch (error: any) {
    console.error('[v0] Historical metrics error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      metrics: getDefaultHistoricalMetrics()
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const { data, error } = await supabase
      .from('ai_response_trust')
      .insert({
        model_id: body.modelId,
        prompt_hash: body.promptHash,
        benford_integrity: body.benford_integrity,
        odds_alignment: body.odds_alignment,
        market_consensus: body.market_consensus,
        historical_accuracy: body.historical_accuracy,
        final_confidence: body.final_confidence,
        response_text: body.response_text,
        metadata: body.metadata || {}
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      record: data
    });
  } catch (error: any) {
    console.error('[v0] Trust metric insert error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

function calculateHistoricalMetrics(records: any[]) {
  if (records.length === 0) return getDefaultHistoricalMetrics();

  const totalConfidence = records.reduce((sum, r) => sum + (r.final_confidence || 0), 0);
  const avgConfidence = totalConfidence / records.length;

  const totalBenford = records.reduce((sum, r) => sum + (r.benford_integrity || 0), 0);
  const avgBenford = totalBenford / records.length;

  const totalOdds = records.reduce((sum, r) => sum + (r.odds_alignment || 0), 0);
  const avgOdds = totalOdds / records.length;

  const totalConsensus = records.reduce((sum, r) => sum + (r.market_consensus || 0), 0);
  const avgConsensus = totalConsensus / records.length;

  const highConfidenceCount = records.filter(r => (r.final_confidence || 0) >= 80).length;
  const highConfidenceRate = (highConfidenceCount / records.length) * 100;

  const recentRecords = records.slice(0, 7);
  const recentAvgConfidence = recentRecords.reduce((sum, r) => sum + (r.final_confidence || 0), 0) / recentRecords.length;
  const trend = recentAvgConfidence > avgConfidence ? 'improving' : 'declining';

  return {
    avgConfidence: parseFloat(avgConfidence.toFixed(2)),
    avgBenford: parseFloat(avgBenford.toFixed(2)),
    avgOdds: parseFloat(avgOdds.toFixed(2)),
    avgConsensus: parseFloat(avgConsensus.toFixed(2)),
    highConfidenceRate: parseFloat(highConfidenceRate.toFixed(2)),
    totalPredictions: records.length,
    trend,
    recentAvg: parseFloat(recentAvgConfidence.toFixed(2))
  };
}

function getDefaultHistoricalMetrics() {
  return {
    avgConfidence: 0,
    avgBenford: 0,
    avgOdds: 0,
    avgConsensus: 0,
    highConfidenceRate: 0,
    totalPredictions: 0,
    trend: 'stable' as const,
    recentAvg: 0
  };
}
