import { NextRequest, NextResponse } from 'next/server';
import { collectAndValidate, logAlert } from '@/lib/statistical-monitor';

export async function POST(req: NextRequest) {
  try {
    const { values, datasetId, marketOdds } = await req.json();
    
    if (!values || !Array.isArray(values)) {
      return NextResponse.json({ error: 'Invalid values array' }, { status: 400 });
    }
    
    if (!datasetId) {
      return NextResponse.json({ error: 'datasetId required' }, { status: 400 });
    }
    
    console.log(`[v0] [Stats API] Monitoring ${values.length} values for dataset: ${datasetId}`);
    
    // Collect and validate
    const { snapshot, alerts } = await collectAndValidate(values, datasetId, marketOdds);
    
    // Log all alerts
    for (const alert of alerts) {
      await logAlert(alert);
    }
    
    return NextResponse.json({
      success: true,
      snapshot: {
        ...snapshot,
        timestamp: snapshot.timestamp.toISOString(),
        values: undefined // Don't send full values array back
      },
      alerts,
      summary: {
        benfordScore: snapshot.benfordScore,
        oddsAlignmentScore: snapshot.oddsAlignmentScore,
        confidence: snapshot.confidence,
        anomalyCount: alerts.length,
        criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
        warningAlerts: alerts.filter(a => a.severity === 'warning').length
      }
    });
    
  } catch (error) {
    console.error('[v0] [Stats API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // Return system health and recent statistics
  return NextResponse.json({
    status: 'operational',
    message: 'Statistical monitoring system active',
    features: [
      'Benford\'s Law validation',
      'Odds alignment checking',
      'Outlier detection',
      'Real-time alerting'
    ]
  });
}
