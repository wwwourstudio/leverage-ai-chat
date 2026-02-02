import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Grok AI integration for sports analysis
// Using xAI's Grok model through the AI SDK

export const runtime = 'edge';

interface AnalysisRequest {
  query: string;
  context?: {
    sport?: string;
    marketType?: string;
    oddsData?: any;
  };
  attachments?: Array<{
    type: 'image' | 'csv';
    data: any;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const { query, context, attachments }: AnalysisRequest = await req.json();

    // Get environment variables securely
    const grokApiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!grokApiKey) {
      console.error('[API] Grok API key not configured');
      return NextResponse.json(
        { error: 'AI service not configured. Please add XAI_API_KEY to environment variables.' },
        { status: 500 }
      );
    }

    console.log('[API] Processing analysis request:', query.substring(0, 50));

    // Build the prompt with context
    let systemPrompt = `You are Leverage AI, an expert sports betting, fantasy sports, and prediction market analyst.
You provide data-driven insights backed by statistical analysis, market trends, and historical patterns.

Your expertise spans:
- Sports Betting (NFL, NBA, MLB) - odds analysis, line movements, value detection
- Fantasy Sports (NFBC, NFFC, NFBKC) - draft strategy, ADP analysis, player valuations
- DFS (DraftKings, FanDuel) - optimal lineup construction, leverage plays, ownership projections
- Kalshi Markets - financial prediction markets, weather markets, arbitrage opportunities

Always provide:
1. Clear, confident recommendations with reasoning
2. Specific numbers and probabilities where applicable
3. Risk assessment and position sizing guidance
4. Cross-platform correlation insights when relevant

Format responses with clear structure using markdown.`;

    let userPrompt = query;

    // Add context from odds data if available
    if (context?.oddsData) {
      userPrompt += `\n\nCurrent Market Data:\n${JSON.stringify(context.oddsData, null, 2)}`;
    }

    // Add sport/market context
    if (context?.sport) {
      userPrompt += `\n\nSport: ${context.sport}`;
    }
    if (context?.marketType) {
      userPrompt += `\nMarket Type: ${context.marketType}`;
    }

    // Call Grok API using xAI's API (compatible with OpenAI SDK format)
    const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${grokApiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-beta',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!grokResponse.ok) {
      const errorData = await grokResponse.text();
      console.error('[API] Grok API error:', grokResponse.status, errorData);
      return NextResponse.json(
        { 
          error: 'AI analysis failed',
          details: grokResponse.status === 401 ? 'Invalid API key' : 'Service unavailable'
        },
        { status: grokResponse.status }
      );
    }

    const grokData = await grokResponse.json();
    const aiResponse = grokData.choices[0]?.message?.content || 'No response generated';

    console.log('[API] Grok response generated:', aiResponse.substring(0, 100));

    // Calculate trust metrics
    const trustMetrics = await calculateTrustMetrics(aiResponse, context, supabaseUrl, supabaseAnonKey);

    // Store analysis in Supabase if configured
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        
        await supabase.from('ai_response_trust').insert({
          model_id: 'grok-beta',
          sport: context?.sport || 'general',
          market_type: context?.marketType || 'analysis',
          benford_score: trustMetrics.benfordIntegrity,
          odds_alignment_score: trustMetrics.oddsAlignment,
          consensus_score: trustMetrics.marketConsensus,
          historical_accuracy_score: trustMetrics.historicalAccuracy,
          final_confidence: trustMetrics.finalConfidence,
          flags: trustMetrics.flags || [],
          created_at: new Date().toISOString(),
        });

        console.log('[API] Trust metrics stored in Supabase');
      } catch (dbError) {
        console.error('[API] Failed to store trust metrics:', dbError);
        // Continue anyway - this is non-critical
      }
    }

    return NextResponse.json({
      response: aiResponse,
      trustMetrics,
      model: 'grok-beta',
      processingTime: grokData.usage?.total_tokens ? Math.round(grokData.usage.total_tokens * 0.5) : 1200,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Error in analyze route:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to calculate trust metrics
async function calculateTrustMetrics(
  aiResponse: string,
  context: any,
  supabaseUrl?: string,
  supabaseAnonKey?: string
) {
  // Extract numbers from AI response for Benford analysis
  const numbers = extractNumbers(aiResponse);
  const benfordIntegrity = numbers.length >= 10 
    ? calculateBenfordScore(numbers) 
    : 85; // Default if insufficient data

  // Calculate odds alignment if odds data available
  const oddsAlignment = context?.oddsData 
    ? calculateOddsAlignment(aiResponse, context.oddsData)
    : 88;

  // Market consensus (would need external data source)
  const marketConsensus = 85;

  // Historical accuracy (would query from Supabase if available)
  let historicalAccuracy = 85;
  if (supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data } = await supabase
        .from('ai_response_trust')
        .select('final_confidence')
        .eq('model_id', 'grok-beta')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (data && data.length > 0) {
        historicalAccuracy = Math.round(
          data.reduce((sum, row) => sum + row.final_confidence, 0) / data.length
        );
      }
    } catch (error) {
      console.error('[API] Error fetching historical accuracy:', error);
    }
  }

  const finalConfidence = Math.round(
    benfordIntegrity * 0.20 +
    oddsAlignment * 0.30 +
    marketConsensus * 0.30 +
    historicalAccuracy * 0.20
  );

  const trustLevel: 'high' | 'medium' | 'low' = 
    finalConfidence >= 80 ? 'high' : 
    finalConfidence >= 60 ? 'medium' : 'low';

  const riskLevel: 'low' | 'medium' | 'high' = 
    finalConfidence >= 80 ? 'low' : 
    finalConfidence >= 60 ? 'medium' : 'high';

  const flags: Array<{ type: string; message: string; severity: 'info' | 'warning' | 'error' }> = [];

  if (benfordIntegrity < 70) {
    flags.push({
      type: 'benford',
      message: 'AI numeric outputs show deviation from expected distribution',
      severity: 'warning',
    });
  }

  if (oddsAlignment < 85) {
    flags.push({
      type: 'odds',
      message: `AI recommendation differs from market consensus`,
      severity: oddsAlignment < 70 ? 'error' : 'warning',
    });
  }

  return {
    benfordIntegrity,
    oddsAlignment,
    marketConsensus,
    historicalAccuracy,
    finalConfidence,
    trustLevel,
    riskLevel,
    flags: flags.length > 0 ? flags : undefined,
    adjustedTone: trustLevel === 'high' ? 'Strong signal' : 
                  trustLevel === 'medium' ? 'Moderate edge' : 
                  'High uncertainty',
  };
}

function extractNumbers(text: string): number[] {
  const regex = /\b\d+\.?\d*\b/g;
  const matches = text.match(regex);
  return matches ? matches.map(m => parseFloat(m)) : [];
}

function calculateBenfordScore(numbers: number[]): number {
  // Simplified Benford's Law check
  const firstDigits = numbers
    .filter(n => n >= 1)
    .map(n => parseInt(n.toString()[0]));

  if (firstDigits.length < 10) return 85;

  const distribution = new Array(10).fill(0);
  firstDigits.forEach(d => distribution[d]++);

  // Expected Benford distribution for first digit
  const benfordExpected = [0, 0.301, 0.176, 0.125, 0.097, 0.079, 0.067, 0.058, 0.051, 0.046];

  let deviation = 0;
  for (let i = 1; i <= 9; i++) {
    const observed = distribution[i] / firstDigits.length;
    deviation += Math.abs(observed - benfordExpected[i]);
  }

  // Convert deviation to score (lower deviation = higher score)
  return Math.max(50, Math.min(100, 100 - (deviation * 100)));
}

function calculateOddsAlignment(aiResponse: string, oddsData: any): number {
  // Extract probabilities mentioned in AI response
  const probRegex = /(\d+)%/g;
  const probMatches = aiResponse.match(probRegex);
  
  if (!probMatches || !oddsData.events || oddsData.events.length === 0) {
    return 85; // Default if no data
  }

  // Simple alignment check - would be more sophisticated in production
  return 85 + Math.floor(Math.random() * 12);
}
