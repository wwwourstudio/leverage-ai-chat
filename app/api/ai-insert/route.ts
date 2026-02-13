/**
 * AI-Validated Insert API Endpoint
 * Demonstrates AI-powered data validation and enrichment before insertion
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAIOrchestrator, ValidationRule } from '@/lib/ai-database-orchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface InsertRequest {
  table: string;
  data: Record<string, any> | Record<string, any>[];
  options?: {
    validateWithAI?: boolean;
    enrichBeforeInsert?: boolean;
    onValidationFail?: 'reject' | 'warn' | 'proceed';
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: InsertRequest = await request.json();
    const { table, data, options = {} } = body;

    if (!table) {
      return NextResponse.json(
        { error: 'Table name is required' },
        { status: 400 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Data is required' },
        { status: 400 }
      );
    }

    console.log(`[v0] AI Insert API called for table: ${table}`);

    const orchestrator = getAIOrchestrator();

    // Define validation rules based on table
    const validationRules: ValidationRule[] = getValidationRulesForTable(table);

    const result = await orchestrator.insert(
      table,
      data,
      {
        validateWithAI: options.validateWithAI ?? true,
        enrichBeforeInsert: options.enrichBeforeInsert ?? false,
        validationRules,
        onValidationFail: options.onValidationFail || 'reject',
      }
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Insert failed',
          validation: result.validationResults,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      validation: result.validationResults,
      enrichedFields: result.enrichedFields,
      metadata: {
        insertTime: result.insertTime,
        recordsInserted: result.data?.length || 0,
      },
    });
  } catch (error) {
    console.error('[v0] AI Insert API error:', error);
    
    return NextResponse.json(
      {
        error: 'Insert failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Get table-specific validation rules
 */
function getValidationRulesForTable(tableName: string): ValidationRule[] {
  const commonRules: ValidationRule[] = [
    {
      field: 'created_at',
      validator: (value) => {
        if (!value) return true; // Allow auto-generation
        return !isNaN(Date.parse(value));
      },
      message: 'created_at must be a valid date',
      severity: 'warning',
    },
  ];

  const tableSpecificRules: Record<string, ValidationRule[]> = {
    ai_response_trust: [
      {
        field: 'model_id',
        validator: (value) => typeof value === 'string' && value.length > 0,
        message: 'model_id is required',
        severity: 'error',
      },
      {
        field: 'response_id',
        validator: (value) => typeof value === 'string' && value.length > 0,
        message: 'response_id is required',
        severity: 'error',
      },
      {
        field: 'final_confidence',
        validator: (value) => 
          typeof value === 'number' && value >= 0 && value <= 100,
        message: 'final_confidence must be between 0 and 100',
        severity: 'error',
      },
    ],
    predictions: [
      {
        field: 'confidence',
        validator: (value) =>
          typeof value === 'number' && value >= 0 && value <= 100,
        message: 'confidence must be between 0 and 100',
        severity: 'error',
      },
      {
        field: 'sport',
        validator: (value) => typeof value === 'string' && value.length > 0,
        message: 'sport is required',
        severity: 'error',
      },
    ],
    bets: [
      {
        field: 'amount',
        validator: (value) => typeof value === 'number' && value > 0,
        message: 'bet amount must be positive',
        severity: 'error',
      },
      {
        field: 'odds',
        validator: (value) => typeof value === 'number',
        message: 'odds must be a number',
        severity: 'error',
      },
    ],
  };

  return [
    ...commonRules,
    ...(tableSpecificRules[tableName] || []),
  ];
}
