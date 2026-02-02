import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Deno } from 'https://deno.land/std@0.168.0/io/mod.ts' // Declaring Deno variable

interface TrustMetrics {
  benfordIntegrity: number
  oddsAlignment: number
  marketConsensus: number
  historicalAccuracy: number
  finalConfidence: number
  trustLevel: 'high' | 'medium' | 'low'
  flags?: Array<{
    type: string
    message: string
    severity: 'info' | 'warning' | 'error'
  }>
  riskLevel: 'low' | 'medium' | 'high'
  adjustedTone?: string
}

interface ValidationRequest {
  responseId: string
  modelId: string
  rawOutput: string
  sport: string
  marketType: string
  aiProbability?: number
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { responseId, modelId, rawOutput, sport, marketType, aiProbability } = await req.json() as ValidationRequest

    // 1. Fetch live odds from Sports Odds API
    const liveOdds = await fetchLiveOdds(sport, marketType)
    
    // 2. Build/refresh Benford baselines
    const benfordBaseline = await getBenfordBaseline(supabase, sport, marketType)
    
    // 3. Run Benford Market Integrity check
    const benfordIntegrity = calculateBenfordIntegrity(rawOutput, benfordBaseline, liveOdds)
    
    // 4. Calculate Odds Alignment
    const oddsAlignment = calculateOddsAlignment(aiProbability, liveOdds, sport, marketType)
    
    // 5. Calculate Market Consensus Delta
    const marketConsensus = await calculateMarketConsensus(supabase, aiProbability, sport, marketType)
    
    // 6. Get Historical AI Accuracy
    const historicalAccuracy = await getHistoricalAccuracy(supabase, modelId, sport, marketType)
    
    // 7. Compute Final Confidence Score
    const finalConfidence = Math.round(
      benfordIntegrity * 0.20 +
      oddsAlignment * 0.30 +
      marketConsensus * 0.30 +
      historicalAccuracy * 0.20
    )
    
    const trustLevel: 'high' | 'medium' | 'low' = 
      finalConfidence >= 80 ? 'high' : 
      finalConfidence >= 60 ? 'medium' : 'low'
    
    const riskLevel: 'low' | 'medium' | 'high' = 
      finalConfidence >= 80 ? 'low' : 
      finalConfidence >= 60 ? 'medium' : 'high'
    
    // 8. Generate flags
    const flags = generateFlags(benfordIntegrity, oddsAlignment, marketConsensus)
    
    // 9. Adjust tone based on trust level
    const adjustedTone = trustLevel === 'high' ? 'Strong signal' : 
                        trustLevel === 'medium' ? 'Moderate edge' : 
                        'High uncertainty'
    
    const trustMetrics: TrustMetrics = {
      benfordIntegrity,
      oddsAlignment,
      marketConsensus,
      historicalAccuracy,
      finalConfidence,
      trustLevel,
      flags: flags.length > 0 ? flags : undefined,
      riskLevel,
      adjustedTone
    }
    
    // 10. Store in database
    await supabase.from('ai_response_trust').insert({
      response_id: responseId,
      model_id: modelId,
      sport,
      market_type: marketType,
      benford_score: benfordIntegrity,
      odds_alignment_score: oddsAlignment,
      consensus_score: marketConsensus,
      historical_accuracy_score: historicalAccuracy,
      final_confidence: finalConfidence,
      flags: flags,
      created_at: new Date().toISOString()
    })
    
    // 11. Audit log
    await supabase.from('ai_audit_log').insert({
      response_id: responseId,
      model_id: modelId,
      raw_output: rawOutput,
      trust_breakdown: JSON.stringify(trustMetrics),
      thresholds_used: JSON.stringify(getThresholds(sport, marketType)),
      throttle_state: adjustedTone,
      final_user_output: rawOutput,
      created_at: new Date().toISOString()
    })
    
    return new Response(
      JSON.stringify({ success: true, trustMetrics }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

// Helper functions

async function fetchLiveOdds(sport: string, marketType: string) {
  // Retrieve ODDS_API_KEY securely from environment variables
  const oddsApiKey = Deno.env.get('ODDS_API_KEY');
  
  if (!oddsApiKey) {
    console.warn('[Supabase Function] ODDS_API_KEY not configured, using fallback data');
    return {
      impliedProbability: 0.50 + (Math.random() * 0.30),
      decimalOdds: 2.0,
      samples: []
    };
  }
  
  try {
    // Map sport to The Odds API sport key
    const sportKey = mapSportToApiKey(sport);
    const market = marketType === 'main' ? 'h2h' : marketType;
    
    const apiUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${oddsApiKey}&regions=us&markets=${market}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error('[Supabase Function] Odds API error:', response.status);
      throw new Error(`Odds API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract and calculate average implied probability from bookmakers
    if (Array.isArray(data) && data.length > 0 && data[0].bookmakers) {
      const event = data[0];
      const bookmakers = event.bookmakers;
      
      if (bookmakers.length > 0 && bookmakers[0].markets && bookmakers[0].markets.length > 0) {
        const outcomes = bookmakers[0].markets[0].outcomes;
        
        // Calculate average implied probability
        const impliedProbs = outcomes.map((outcome: any) => {
          const price = outcome.price;
          // Convert to implied probability
          if (price > 0) {
            return 100 / (price + 100);
          } else {
            return Math.abs(price) / (Math.abs(price) + 100);
          }
        });
        
        const avgImpliedProb = impliedProbs.reduce((sum: number, p: number) => sum + p, 0) / impliedProbs.length;
        const decimalOdds = outcomes[0].price > 0 
          ? (outcomes[0].price / 100) + 1 
          : (100 / Math.abs(outcomes[0].price)) + 1;
        
        return {
          impliedProbability: avgImpliedProb,
          decimalOdds: decimalOdds,
          samples: outcomes
        };
      }
    }
    
    // Fallback if no data available
    return {
      impliedProbability: 0.50,
      decimalOdds: 2.0,
      samples: []
    };
  } catch (error) {
    console.error('[Supabase Function] Error fetching live odds:', error);
    // Return fallback data on error
    return {
      impliedProbability: 0.50 + (Math.random() * 0.30),
      decimalOdds: 2.0,
      samples: []
    };
  }
}

function mapSportToApiKey(sport: string): string {
  const sportMap: Record<string, string> = {
    'nfl': 'americanfootball_nfl',
    'nba': 'basketball_nba',
    'mlb': 'baseball_mlb',
    'nhl': 'icehockey_nhl',
    'ncaaf': 'americanfootball_ncaaf',
    'ncaab': 'basketball_ncaab',
  };
  
  return sportMap[sport.toLowerCase()] || 'upcoming';
}

async function getBenfordBaseline(supabase: any, sport: string, marketType: string) {
  const { data } = await supabase
    .from('odds_benford_baselines')
    .select('*')
    .eq('sport', sport)
    .eq('market_type', marketType)
    .single()
  
  if (data && data.sample_size >= getMinimumSampleSize(marketType)) {
    return data.digit_distribution
  }
  
  // If no baseline exists or insufficient samples, return null
  return null
}

function calculateBenfordIntegrity(rawOutput: string, baseline: any, liveOdds: any): number {
  // Extract numeric values from AI output
  const numbers = extractNumbers(rawOutput)
  
  if (!baseline || numbers.length < 10) {
    return 75 // Default score if insufficient data
  }
  
  // Calculate digit distribution from AI outputs
  const aiDistribution = calculateDigitDistribution(numbers)
  
  // Compare to market baseline (not theoretical Benford)
  const deviation = calculateDistributionDeviation(aiDistribution, baseline)
  
  // Convert deviation to 0-100 score (lower deviation = higher score)
  return Math.max(0, Math.min(100, 100 - (deviation * 100)))
}

function calculateOddsAlignment(aiProbability: number | undefined, liveOdds: any, sport: string, marketType: string): number {
  if (!aiProbability) return 85 // Default if no probability provided
  
  const thresholds = getThresholds(sport, marketType)
  const deviation = Math.abs(aiProbability - liveOdds.impliedProbability)
  
  if (deviation <= thresholds.oddsDeviation.low) return 100
  if (deviation <= thresholds.oddsDeviation.medium) return 80
  if (deviation <= thresholds.oddsDeviation.high) return 60
  return 30
}

async function calculateMarketConsensus(supabase: any, aiProbability: number | undefined, sport: string, marketType: string): number {
  if (!aiProbability) return 80
  
  // TODO: Aggregate consensus from multiple sources
  const consensusProbability = 0.52 // Mock
  const thresholds = getThresholds(sport, marketType)
  const delta = Math.abs(aiProbability - consensusProbability)
  
  if (delta <= thresholds.consensusDelta.low) return 100
  if (delta <= thresholds.consensusDelta.medium) return 75
  if (delta <= thresholds.consensusDelta.high) return 50
  return 25
}

async function getHistoricalAccuracy(supabase: any, modelId: string, sport: string, marketType: string): number {
  const { data } = await supabase
    .from('ai_response_trust')
    .select('final_confidence')
    .eq('model_id', modelId)
    .eq('sport', sport)
    .eq('market_type', marketType)
    .order('created_at', { ascending: false })
    .limit(30)
  
  if (!data || data.length === 0) return 85 // Default for new models
  
  const avgConfidence = data.reduce((sum, row) => sum + row.final_confidence, 0) / data.length
  return Math.round(avgConfidence)
}

function generateFlags(benfordIntegrity: number, oddsAlignment: number, marketConsensus: number) {
  const flags: Array<{ type: string; message: string; severity: 'info' | 'warning' | 'error' }> = []
  
  if (benfordIntegrity < 70) {
    flags.push({
      type: 'benford',
      message: 'AI numeric outputs show deviation from market odds distribution',
      severity: 'warning'
    })
  }
  
  if (oddsAlignment < 85) {
    flags.push({
      type: 'odds',
      message: `AI recommendation differs from live market by ${((100 - oddsAlignment) / 10).toFixed(1)}%`,
      severity: oddsAlignment < 70 ? 'error' : 'warning'
    })
  }
  
  if (marketConsensus < 70) {
    flags.push({
      type: 'consensus',
      message: 'Significant divergence from market consensus detected',
      severity: 'warning'
    })
  }
  
  return flags
}

function getThresholds(sport: string, marketType: string) {
  // Sport-specific threshold tuning
  const thresholds: Record<string, any> = {
    'nfl-main': {
      oddsDeviation: { low: 0.02, medium: 0.05, high: 0.10 },
      consensusDelta: { low: 0.03, medium: 0.07, high: 0.12 }
    },
    'nba-main': {
      oddsDeviation: { low: 0.02, medium: 0.05, high: 0.10 },
      consensusDelta: { low: 0.03, medium: 0.07, high: 0.12 }
    },
    'player-props': {
      oddsDeviation: { low: 0.05, medium: 0.07, high: 0.12 },
      consensusDelta: { low: 0.07, medium: 0.10, high: 0.15 }
    },
    'futures': {
      oddsDeviation: { low: 0.08, medium: 0.12, high: 0.18 },
      consensusDelta: { low: 0.10, medium: 0.15, high: 0.20 }
    }
  }
  
  const key = `${sport}-${marketType}`
  return thresholds[key] || thresholds['nfl-main'] // Default to NFL main
}

function getMinimumSampleSize(marketType: string): number {
  const sizes: Record<string, number> = {
    'main': 50,
    'props': 100,
    'futures': 300
  }
  return sizes[marketType] || 100
}

function extractNumbers(text: string): number[] {
  const regex = /\b\d+\.?\d*\b/g
  const matches = text.match(regex)
  return matches ? matches.map(m => parseFloat(m)) : []
}

function calculateDigitDistribution(numbers: number[]): number[] {
  const distribution = new Array(10).fill(0)
  
  for (const num of numbers) {
    const firstDigit = parseInt(num.toString()[0])
    if (firstDigit >= 1 && firstDigit <= 9) {
      distribution[firstDigit]++
    }
  }
  
  // Normalize to percentages
  const total = distribution.reduce((sum, count) => sum + count, 0)
  return distribution.map(count => total > 0 ? count / total : 0)
}

function calculateDistributionDeviation(dist1: number[], dist2: number[]): number {
  let sumSquaredDiff = 0
  for (let i = 0; i < Math.min(dist1.length, dist2.length); i++) {
    sumSquaredDiff += Math.pow(dist1[i] - dist2[i], 2)
  }
  return Math.sqrt(sumSquaredDiff / Math.min(dist1.length, dist2.length))
}
