import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Deno } from 'https://deno.land/std@0.168.0/node/global.ts'; // Declare Deno variable

interface ValidationRequest {
  responseId: string;
  modelId: string;
  sport: string;
  marketType: string;
  aiOutput: string;
  numericValues: number[];
}

interface TrustMetrics {
  benfordIntegrity: number;
  oddsAlignment: number;
  marketConsensus: number;
  historicalAccuracy: number;
  finalConfidence: number;
  trustLevel: 'high' | 'medium' | 'low';
  riskLevel: 'low' | 'medium' | 'high';
  flags: string[];
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { responseId, modelId, sport, marketType, aiOutput, numericValues }: ValidationRequest = await req.json();

    // 1. Fetch sport-specific validation thresholds
    const { data: thresholds } = await supabase
      .from('sport_validation_thresholds')
      .select('*')
      .eq('sport', sport)
      .eq('market_type', marketType)
      .single();

    const validationThresholds = thresholds || {
      odds_deviation_tolerance: 5.0,
      consensus_delta_tolerance: 7.0,
      min_benford_samples: 100,
      benford_threshold: 80.0
    };

    // 2. Calculate Benford Market Integrity
    const benfordScore = await calculateBenfordIntegrity(
      supabase,
      sport,
      marketType,
      numericValues,
      validationThresholds.min_benford_samples
    );

    // 3. Calculate Odds Alignment
    const oddsScore = await calculateOddsAlignment(
      supabase,
      sport,
      marketType,
      aiOutput,
      validationThresholds.odds_deviation_tolerance
    );

    // 4. Calculate Market Consensus Delta
    const consensusScore = await calculateMarketConsensus(
      supabase,
      sport,
      marketType,
      aiOutput,
      validationThresholds.consensus_delta_tolerance
    );

    // 5. Fetch Historical AI Accuracy
    const { data: modelStats } = await supabase
      .from('model_trust_scores')
      .select('last_30d_accuracy')
      .eq('model_id', modelId)
      .single();

    const historicalAccuracy = modelStats?.last_30d_accuracy || 75;

    // 6. Calculate Final Confidence (weighted average)
    const finalConfidence = Math.round(
      benfordScore * 0.20 +
      oddsScore * 0.30 +
      consensusScore * 0.30 +
      historicalAccuracy * 0.20
    );

    // 7. Determine trust and risk levels
    const trustLevel: 'high' | 'medium' | 'low' = 
      finalConfidence >= 80 ? 'high' : finalConfidence >= 60 ? 'medium' : 'low';
    
    const riskLevel: 'low' | 'medium' | 'high' = 
      finalConfidence >= 80 ? 'low' : finalConfidence >= 60 ? 'medium' : 'high';

    // 8. Generate flags
    const flags: string[] = [];
    if (benfordScore < validationThresholds.benford_threshold) {
      flags.push('Benford validation warning: AI numeric distribution deviates from market baseline');
    }
    if (oddsScore < 70) {
      flags.push('Significant odds deviation detected: AI recommendation differs materially from live odds');
    }
    if (consensusScore < 65) {
      flags.push('Diverges from market consensus: AI output shows high variance from aggregated markets');
    }

    // 9. Store trust metrics
    await supabase.from('ai_response_trust').insert({
      response_id: responseId,
      model_id: modelId,
      sport,
      market_type: marketType,
      benford_score: benfordScore,
      odds_alignment_score: oddsScore,
      consensus_score: consensusScore,
      historical_accuracy_score: historicalAccuracy,
      final_confidence: finalConfidence,
      trust_level: trustLevel,
      risk_level: riskLevel,
      flags: flags.length > 0 ? flags : null
    });

    // 10. Audit log (append-only)
    await supabase.from('ai_audit_log').insert({
      response_id: responseId,
      model_id: modelId,
      raw_output: aiOutput,
      trust_breakdown: {
        benford: benfordScore,
        odds: oddsScore,
        consensus: consensusScore,
        historical: historicalAccuracy
      },
      thresholds_used: validationThresholds,
      throttle_state: trustLevel === 'low' ? 'adjusted' : 'none',
      final_user_output: aiOutput
    });

    // 11. Return trust metrics
    const trustMetrics: TrustMetrics = {
      benfordIntegrity: benfordScore,
      oddsAlignment: oddsScore,
      marketConsensus: consensusScore,
      historicalAccuracy,
      finalConfidence,
      trustLevel,
      riskLevel,
      flags
    };

    return new Response(JSON.stringify(trustMetrics), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Helper: Calculate Benford Integrity against market baseline
async function calculateBenfordIntegrity(
  supabase: any,
  sport: string,
  marketType: string,
  numericValues: number[],
  minSamples: number
): Promise<number> {
  // Fetch market baseline from real odds
  const { data: baseline } = await supabase
    .from('odds_benford_baselines')
    .select('digit_distribution, sample_size')
    .eq('sport', sport)
    .eq('market_type', marketType)
    .single();

  if (!baseline || baseline.sample_size < minSamples) {
    return 50; // Insufficient data
  }

  // Extract first digits from AI numeric values
  const aiDigits = numericValues
    .map(n => Math.abs(n).toString()[0])
    .filter(d => d && d !== '0');

  const aiDistribution = calculateDigitDistribution(aiDigits);
  const marketDistribution = baseline.digit_distribution;

  // Chi-square or KL divergence comparison
  const similarity = compareDistributions(aiDistribution, marketDistribution);
  
  return Math.min(100, Math.max(0, similarity * 100));
}

// Helper: Calculate Odds Alignment
async function calculateOddsAlignment(
  supabase: any,
  sport: string,
  marketType: string,
  aiOutput: string,
  tolerance: number
): Promise<number> {
  // Fetch live odds (mock implementation - integrate real odds API)
  const marketImpliedProb = 0.52; // Example: 52% from odds
  const aiImpliedProb = extractImpliedProbability(aiOutput);

  const deviation = Math.abs(marketImpliedProb - aiImpliedProb) * 100;

  if (deviation <= tolerance) return 100;
  if (deviation <= tolerance * 1.5) return 80;
  if (deviation <= tolerance * 2) return 60;
  return 30;
}

// Helper: Calculate Market Consensus
async function calculateMarketConsensus(
  supabase: any,
  sport: string,
  marketType: string,
  aiOutput: string,
  tolerance: number
): Promise<number> {
  // Aggregate consensus from multiple sportsbooks (mock)
  const consensusProb = 0.54; // Example consensus
  const aiImpliedProb = extractImpliedProbability(aiOutput);

  const delta = Math.abs(consensusProb - aiImpliedProb) * 100;

  if (delta <= tolerance) return 100;
  if (delta <= tolerance * 1.3) return 75;
  if (delta <= tolerance * 1.7) return 50;
  return 25;
}

// Utility: Calculate digit distribution
function calculateDigitDistribution(digits: string[]): Record<string, number> {
  const dist: Record<string, number> = {};
  digits.forEach(d => {
    dist[d] = (dist[d] || 0) + 1;
  });
  const total = digits.length;
  Object.keys(dist).forEach(k => {
    dist[k] = dist[k] / total;
  });
  return dist;
}

// Utility: Compare distributions (simplified)
function compareDistributions(dist1: any, dist2: any): number {
  // Simple similarity metric (1.0 = perfect match)
  let similarity = 0;
  for (let i = 1; i <= 9; i++) {
    const d1 = dist1[i] || 0;
    const d2 = dist2[i] || 0;
    similarity += 1 - Math.abs(d1 - d2);
  }
  return similarity / 9;
}

// Utility: Extract implied probability from AI text (mock)
function extractImpliedProbability(text: string): number {
  // Parse AI output for probability estimates
  // This is a simplified mock - implement proper parsing
  return 0.50 + Math.random() * 0.1;
}
