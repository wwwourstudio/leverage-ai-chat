/**
 * AI-Enhanced Query API Endpoint
 * Demonstrates the AI Database Orchestrator capabilities
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAIOrchestrator } from '@/lib/ai-database-orchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface QueryRequest {
  table: string;
  filters?: Record<string, any>;
  options?: {
    enableAI?: boolean;
    generateInsights?: boolean;
    enrichData?: boolean;
    useCache?: boolean;
    limit?: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: QueryRequest = await request.json();
    const { table, filters = {}, options = {} } = body;

    if (!table) {
      return NextResponse.json(
        { error: 'Table name is required' },
        { status: 400 }
      );
    }

    console.log(`[v0] AI Query API called for table: ${table}`);

    const orchestrator = getAIOrchestrator();

    // Build query with filters
    const result = await orchestrator.query(
      table,
      (builder: any) => {
        let query = builder.select('*');

        // Apply filters
        for (const [key, value] of Object.entries(filters)) {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        }

        // Apply limit
        if (options.limit) {
          query = query.limit(options.limit);
        }

        return query;
      },
      {
        enableAI: options.enableAI ?? true,
        generateInsights: options.generateInsights ?? true,
        enrichData: options.enrichData ?? false,
        useCache: options.useCache ?? true,
        timeout: 15000,
        fallbackData: [],
      }
    );

    return NextResponse.json({
      success: result.success,
      data: result.data,
      insights: result.insights,
      enrichedFields: result.enrichedFields,
      metadata: {
        source: result.source,
        cacheHit: result.cacheHit,
        queryTime: result.queryTime,
        aiProcessingTime: result.aiProcessingTime,
        recordCount: result.data.length,
      },
      cacheStats: orchestrator.getCacheStats(),
    });
  } catch (error) {
    console.error('[v0] AI Query API error:', error);
    
    return NextResponse.json(
      {
        error: 'Query failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// GET endpoint for simple queries
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const table = searchParams.get('table');
  const enableAI = searchParams.get('enableAI') !== 'false';
  const insights = searchParams.get('insights') === 'true';
  const limit = parseInt(searchParams.get('limit') || '10');

  if (!table) {
    return NextResponse.json(
      { error: 'Table parameter is required' },
      { status: 400 }
    );
  }

  try {
    const orchestrator = getAIOrchestrator();

    const result = await orchestrator.query(
      table,
      (builder: any) => builder.select('*').limit(limit),
      {
        enableAI,
        generateInsights: insights,
        enrichData: false,
        useCache: true,
      }
    );

    return NextResponse.json({
      success: result.success,
      data: result.data,
      insights: result.insights,
      metadata: {
        source: result.source,
        cacheHit: result.cacheHit,
        queryTime: result.queryTime,
        recordCount: result.data.length,
      },
    });
  } catch (error) {
    console.error('[v0] AI Query GET error:', error);
    
    return NextResponse.json(
      {
        error: 'Query failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
