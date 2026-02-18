import { NextRequest, NextResponse } from 'next/server';
import {
  ENV_KEYS,
  LOG_PREFIXES,
  DATA_SOURCES,
  EXTERNAL_APIS,
  SUCCESS_MESSAGES,
} from '@/lib/constants';
import {
  validateDataSchema,
  APP_TABLES,
  SCHEMA_DEFINITIONS
} from '@/lib/supabase-validator';
import { getConfigs, getUserProfile } from '@/lib/dynamic-config';
import { queryWithAI } from '@/lib/leveraged-ai';

export const runtime = 'edge';

/**
 * User Insights API
 * Fetches real user statistics from Supabase with validation
 */
export async function GET(req: NextRequest) {
  try {
    // Extract userId from request headers if available
    const userId = req.headers.get('x-user-id') || undefined;

    // Use LeveragedAI for AI-enhanced database query
    console.log(`${LOG_PREFIXES.API} Fetching insights using LeveragedAI...`);
    
    const queryResult = await queryWithAI<any>(
      APP_TABLES.AI_RESPONSE_TRUST,
      (builder) => builder
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
      {
        enableAIProcessing: true,
        aiContext: 'Analyzing betting prediction performance metrics to generate user insights',
        summarize: true,
        timeout: 2000
      }
    );

    if (!queryResult.success || queryResult.data.length === 0) {
      const errorMsg = queryResult.error || 'No database data available';
      const isTableMissing = typeof errorMsg === 'string' && (
        errorMsg.includes('Could not find the table') || 
        errorMsg.includes('relation') && errorMsg.includes('does not exist')
      );
      
      console.log(`${LOG_PREFIXES.API} Using default insights -`, errorMsg);
      
      return NextResponse.json({
        success: true,
        insights: getDefaultInsights(),
        dataSource: DATA_SOURCES.DEFAULT,
        message: isTableMissing 
          ? 'Database tables not created yet. See SUPABASE_SETUP.md in project root for setup instructions.' 
          : queryResult.data.length === 0
          ? 'No predictions yet. Start chatting to generate insights!'
          : typeof errorMsg === 'string' ? errorMsg : 'Unable to fetch data',
        aiSummary: queryResult.aiSummary,
        setupRequired: isTableMissing,
        setupGuideUrl: isTableMissing ? '/SUPABASE_SETUP.md' : undefined
      });
    }

    // Validate data schema
    const predictions = queryResult.data;
    const schemaValidation = validateDataSchema(
      predictions,
      ['id', 'model_id', 'created_at', 'final_confidence'],
      APP_TABLES.AI_RESPONSE_TRUST
    );

    // Try to fetch AI predictions from trust system.
    // Wrapped in its own try/catch because the Supabase client can throw
    // a SyntaxError when the project URL is invalid or returns non-JSON.
    let predictions: any[] = [];
    try {
      const { data, error } = await supabase
        .from('ai_predictions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('[API] Supabase query error:', error.message || error);
        return NextResponse.json({
          success: true,
          insights: getDefaultInsights(),
          dataSource: 'default'
        });
      }

      predictions = data || [];
    } catch (dbError: any) {
      console.error('[API] Supabase connection failed:', dbError.message || dbError);
      return NextResponse.json({
        success: true,
        insights: getDefaultInsights(),
        dataSource: 'default'
      });
    }

    // Calculate real metrics from predictions
    const insights = calculateInsightsFromPredictions(predictions);

    return NextResponse.json({
      success: true,
      insights,
      trustMetrics,
      dataSource: DATA_SOURCES.LIVE,
      sampleSize: schemaValidation.validRecords.length,
      validation: {
        total: predictions.length,
        valid: schemaValidation.validRecords.length,
        invalid: schemaValidation.invalidCount
      },
      aiSummary: queryResult.aiSummary,
      aiInsights: queryResult.aiInsights,
      processingTime: queryResult.processingTime,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    // Safely extract error message to avoid JSON serialization issues
    let errorMessage = 'Unknown error occurred';
    try {
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        // Extract only serializable properties
        errorMessage = error.message || error.error || error.toString();
      }
    } catch (extractError) {
      errorMessage = 'Failed to extract error details';
    }
    
    console.log(`${LOG_PREFIXES.API} Error in insights route:`, errorMessage);
    
    // Return a safe, fully serializable response
    return NextResponse.json({
      success: true,
      insights: getDefaultInsights(),
      dataSource: DATA_SOURCES.FALLBACK,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
}

async function calculateInsightsFromPredictions(predictions: any[], userId?: string) {
  if (predictions.length === 0) {
    return getDefaultInsights();
  }

  // Fetch dynamic configuration values
  const configs = await getConfigs([
    { key: 'default_invested_amount', defaultValue: 2500, category: 'insights' },
    { key: 'high_confidence_threshold', defaultValue: 80, category: 'insights' },
    { key: 'roi_scale_factor', defaultValue: 20, category: 'insights' },
    { key: 'default_confidence', defaultValue: 75, category: 'insights' },
    { key: 'default_win_rate', defaultValue: 65, category: 'insights' },
  ]);

  // Try to get user profile for actual investment data
  let totalInvested = configs.default_invested_amount;
  if (userId) {
    const userProfile = await getUserProfile(userId);
    if (userProfile && userProfile.total_invested) {
      totalInvested = userProfile.total_invested;
      console.log(`${LOG_PREFIXES.API} Using user's actual investment: $${totalInvested}`);
    }
  }

  // Calculate metrics from real prediction data (ai_response_trust table)
  const validPredictions = predictions.filter(p => p.final_confidence !== null && p.final_confidence !== undefined);
  
  let totalFinalConfidence = 0;
  let highConfidencePredictions = 0;

  validPredictions.forEach(pred => {
    const finalConf = pred.final_confidence;
    totalFinalConfidence += finalConf;
    if (finalConf >= configs.high_confidence_threshold) {
      highConfidencePredictions++;
    }
  });

  const avgFinalConfidence = validPredictions.length > 0
    ? totalFinalConfidence / validPredictions.length
    : configs.default_confidence;

  // Calculate ROI simulation based on confidence levels
  // Higher confidence predictions would yield better ROI in theory
  const simulatedROI = ((avgFinalConfidence - 50) / 50) * configs.roi_scale_factor;

  // Win rate correlates with high-confidence predictions
  const winRate = validPredictions.length > 0
    ? (highConfidencePredictions / validPredictions.length) * 100
    : configs.default_win_rate;

  const totalValue = totalInvested + (simulatedROI * totalInvested / 100);

  return {
    totalValue: parseFloat(totalValue.toFixed(2)),
    winRate: parseFloat(winRate.toFixed(1)),
    roi: parseFloat(simulatedROI.toFixed(1)),
    activeContests: predictions.length,
    totalInvested: totalInvested,
    avgConfidence: parseFloat(avgFinalConfidence.toFixed(1)),
    dataSource: 'calculated',
    lastUpdated: new Date().toISOString()
  };
}

function calculateTrustMetrics(records: any[]) {
  if (records.length === 0) {
    return {
      benfordIntegrity: 0,
      oddsAlignment: 0,
      marketConsensus: 0,
      historicalAccuracy: 0,
      finalConfidence: 0,
      trustLevel: 'low' as const,
      flags: [],
      riskLevel: 'high' as const
    };
  }

  const avgBenford = records.reduce((sum, r) => sum + (r.benford_integrity || 0), 0) / records.length;
  const avgOdds = records.reduce((sum, r) => sum + (r.odds_alignment || 0), 0) / records.length;
  const avgConsensus = records.reduce((sum, r) => sum + (r.market_consensus || 0), 0) / records.length;
  const avgAccuracy = records.reduce((sum, r) => sum + (r.historical_accuracy || 0), 0) / records.length;
  const avgConfidence = records.reduce((sum, r) => sum + (r.final_confidence || 0), 0) / records.length;

  const trustLevel = avgConfidence >= 80 ? 'high' : avgConfidence >= 60 ? 'medium' : 'low';
  const riskLevel = avgConfidence >= 80 ? 'low' : avgConfidence >= 60 ? 'medium' : 'high';

  return {
    benfordIntegrity: parseFloat(avgBenford.toFixed(2)),
    oddsAlignment: parseFloat(avgOdds.toFixed(2)),
    marketConsensus: parseFloat(avgConsensus.toFixed(2)),
    historicalAccuracy: parseFloat(avgAccuracy.toFixed(2)),
    finalConfidence: parseFloat(avgConfidence.toFixed(2)),
    trustLevel,
    flags: [],
    riskLevel
  };
}

function getDefaultInsights() {
  return {
    totalValue: 0,
    winRate: 0,
    roi: 0,
    activeContests: 0,
    totalInvested: 0,
    avgConfidence: 0,
    dataSource: DATA_SOURCES.DEFAULT,
    message: 'Start making predictions to see your insights'
  };
}
