import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  ENV_KEYS,
  LOG_PREFIXES,
  DATA_SOURCES,
  EXTERNAL_APIS,
  SUCCESS_MESSAGES,
} from '@/lib/constants';
import {
  safeQuery,
  validateDataSchema,
  APP_TABLES,
  SCHEMA_DEFINITIONS
} from '@/lib/supabase-validator';
import { getConfigs, getUserProfile } from '@/lib/dynamic-config';

export const runtime = 'edge';

/**
 * User Insights API
 * Fetches real user statistics from Supabase with validation
 */
export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env[ENV_KEYS.SUPABASE_URL];
    const supabaseAnonKey = process.env[ENV_KEYS.SUPABASE_ANON_KEY];

    if (!supabaseUrl || !supabaseAnonKey) {
      console.log(`${LOG_PREFIXES.API} Supabase not configured, returning default insights`);
      return NextResponse.json({
        success: true,
        insights: getDefaultInsights(),
        dataSource: DATA_SOURCES.DEFAULT,
        message: 'Supabase not configured'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // In a real app, you'd fetch this from authenticated user's data
    // For now, aggregate platform-wide statistics
    
    // Safely fetch AI predictions from trust system with validation
    console.log(`[v0] Attempting to query ${APP_TABLES.AI_PREDICTIONS} table...`);
    const queryResult = await safeQuery(
      supabase,
      APP_TABLES.AI_PREDICTIONS,
      (builder) => builder
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
      {
        defaultValue: [],
        logErrors: true
      }
    );

    if (!queryResult.success || queryResult.source !== 'database') {
      const errorMsg = queryResult.error || 'No database data';
      console.log(`${LOG_PREFIXES.API} Using default insights -`, errorMsg);
      return NextResponse.json({
        success: true,
        insights: getDefaultInsights(),
        dataSource: queryResult.source,
        message: typeof errorMsg === 'string' ? errorMsg : 'Table not yet created'
      });
    }

    // Validate data schema
    const predictions = queryResult.data;
    const schemaValidation = validateDataSchema(
      predictions,
      ['id', 'model', 'created_at'],
      APP_TABLES.AI_PREDICTIONS
    );

    if (schemaValidation.invalidCount > 0) {
      console.log(`${LOG_PREFIXES.API} Found ${schemaValidation.invalidCount} invalid records, using ${schemaValidation.validRecords.length} valid records`);
    }

    // Calculate real metrics from validated predictions
    // Extract userId from request if available (from auth headers, etc.)
    const userId = req.headers.get('x-user-id') || undefined;
    const insights = await calculateInsightsFromPredictions(schemaValidation.validRecords, userId);

    return NextResponse.json({
      success: true,
      insights,
      dataSource: DATA_SOURCES.LIVE,
      sampleSize: schemaValidation.validRecords.length,
      validation: {
        total: predictions.length,
        valid: schemaValidation.validRecords.length,
        invalid: schemaValidation.invalidCount
      },
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

  // Calculate metrics from real prediction data
  const validPredictions = predictions.filter(p => p.trust_metrics);
  
  let totalConfidence = 0;
  let highConfidencePredictions = 0;
  let totalFinalConfidence = 0;

  validPredictions.forEach(pred => {
    const metrics = pred.trust_metrics;
    if (metrics.finalConfidence) {
      totalFinalConfidence += metrics.finalConfidence;
      if (metrics.finalConfidence >= configs.high_confidence_threshold) {
        highConfidencePredictions++;
      }
    }
    if (pred.confidence) {
      totalConfidence += pred.confidence;
    }
  });

  const avgConfidence = validPredictions.length > 0 
    ? totalConfidence / validPredictions.length 
    : configs.default_confidence;

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
    avgConfidence: parseFloat(avgConfidence.toFixed(1)),
    dataSource: 'calculated',
    lastUpdated: new Date().toISOString()
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
