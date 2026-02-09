/**
 * LeveragedAI - AI-Enhanced Supabase Integration
 * Combines Supabase database operations with Grok AI intelligence
 * for smarter data retrieval, processing, and insights generation
 */

import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { xai } from '@ai-sdk/xai';
import { ENV_KEYS, LOG_PREFIXES, AI_CONFIG } from '@/lib/constants';
import { safeQuery, validateDataSchema, APP_TABLES } from '@/lib/supabase-validator';

interface AIEnhancedQueryOptions {
  enableAIProcessing?: boolean;
  aiContext?: string;
  enrichWithInsights?: boolean;
  summarize?: boolean;
  timeout?: number;
}

interface AIEnhancedResult<T> {
  success: boolean;
  data: T[];
  aiInsights?: string;
  aiSummary?: string;
  enrichedData?: any[];
  source: 'database' | 'cache' | 'fallback';
  processingTime: number;
  error?: string;
}

/**
 * LeveragedAI Client - AI-enhanced database operations
 */
export class LeveragedAI {
  private supabase: SupabaseClient | null = null;
  private aiEnabled: boolean = false;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initialize();
  }

  /**
   * Ensure initialization is complete before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }
  }

  /**
   * Initialize Supabase and check AI availability
   */
  private async initialize(): Promise<void> {
    // Initialize Supabase using proper server client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    console.log(`${LOG_PREFIXES.DATABASE} LeveragedAI init - URL: ${supabaseUrl ? 'SET' : 'MISSING'}, Key: ${supabaseKey ? 'SET' : 'MISSING'}`);
    
    if (supabaseUrl && supabaseKey) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
          global: {
            fetch: fetch.bind(globalThis)
          }
        });
        console.log(`${LOG_PREFIXES.DATABASE} LeveragedAI: Supabase client initialized successfully`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`${LOG_PREFIXES.DATABASE} LeveragedAI: Failed to create Supabase client:`, errorMsg);
        this.supabase = null;
      }
    } else {
      console.log(`${LOG_PREFIXES.DATABASE} LeveragedAI: Supabase not configured`);
    }

    // Check if AI is available (AI Gateway handles auth automatically)
    const xaiApiKey = process.env.XAI_API_KEY;
    if (xaiApiKey) {
      this.aiEnabled = true;
      console.log(`${LOG_PREFIXES.DATABASE} LeveragedAI: Grok AI available via AI Gateway`);
    } else {
      console.log(`${LOG_PREFIXES.DATABASE} LeveragedAI: Grok AI not configured`);
    }

    this.isInitialized = !!(this.supabase && this.aiEnabled);
  }

  /**
   * Check if LeveragedAI is fully initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * AI-enhanced query: Fetch data and optionally process with AI
   */
  async queryWithAI<T>(
    tableName: string,
    queryBuilder: (builder: any) => any,
    options: AIEnhancedQueryOptions = {}
  ): Promise<AIEnhancedResult<T>> {
    const startTime = Date.now();
    const {
      enableAIProcessing = false,
      aiContext = '',
      enrichWithInsights = false,
      summarize = false,
      timeout = 5000
    } = options;

    // Ensure initialization is complete
    await this.ensureInitialized();

    // Ensure database is available
    if (!this.supabase) {
      return {
        success: false,
        data: [],
        source: 'fallback',
        processingTime: Date.now() - startTime,
        error: 'Database not initialized'
      };
    }

    try {
      // Execute database query with timeout
      const queryPromise = safeQuery<T>(
        this.supabase,
        tableName,
        queryBuilder,
        {
          defaultValue: [],
          logErrors: true
        }
      );

      const queryResult = await Promise.race([
        queryPromise,
        new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), timeout)
        )
      ]);

      if (!queryResult.success) {
        return {
          success: false,
          data: [],
          source: 'fallback',
          processingTime: Date.now() - startTime,
          error: queryResult.error || 'Query failed'
        };
      }

      const data = queryResult.data;

      // If AI processing is not enabled or AI is not available, return data as-is
      if (!enableAIProcessing || !this.aiEnabled || !data || data.length === 0) {
        return {
          success: true,
          data,
          source: 'database',
          processingTime: Date.now() - startTime
        };
      }

      // AI Enhancement: Generate insights from the data
      const aiResult = await this.generateAIInsights(data, tableName, aiContext, {
        enrichWithInsights,
        summarize
      });

      return {
        success: true,
        data,
        aiInsights: aiResult.insights,
        aiSummary: aiResult.summary,
        enrichedData: aiResult.enrichedData,
        source: 'database',
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`${LOG_PREFIXES.DATABASE} LeveragedAI query error:`, errorMessage);
      
      return {
        success: false,
        data: [],
        source: 'fallback',
        processingTime: Date.now() - startTime,
        error: errorMessage
      };
    }
  }

  /**
   * Generate AI insights from retrieved data
   */
  private async generateAIInsights(
    data: any[],
    tableName: string,
    context: string,
    options: { enrichWithInsights: boolean; summarize: boolean }
  ): Promise<{
    insights?: string;
    summary?: string;
    enrichedData?: any[];
  }> {
    if (!this.aiEnabled) {
      return {};
    }

    try {
      const dataPreview = JSON.stringify(data.slice(0, 3), null, 2);
      const prompt = `
Analyze this database query result from table "${tableName}":

Data sample (${data.length} total records):
${dataPreview}

${context ? `Context: ${context}` : ''}

${options.enrichWithInsights ? 'Provide key insights and patterns from this data.' : ''}
${options.summarize ? 'Provide a concise summary of the data trends and important metrics.' : ''}

Be concise and focus on actionable insights.
      `.trim();

      // Use xAI provider with proper typing and explicit API key
      const result = await generateText({
        model: xai('grok-4', {
          apiKey: process.env.XAI_API_KEY,
        }) as any,
        prompt,
        temperature: 0.7,
        maxOutputTokens: 500,
      });

      return {
        insights: options.enrichWithInsights ? result.text : undefined,
        summary: options.summarize ? result.text : undefined,
      };
    } catch (error) {
      console.error(`${LOG_PREFIXES.DATABASE} AI insights generation failed:`, error);
      return {};
    }
  }

  /**
   * AI-powered data enrichment: Add AI-generated fields to records
   */
  async enrichRecordsWithAI<T extends Record<string, any>>(
    records: T[],
    enrichmentPrompt: (record: T) => string,
    enrichmentField: string = 'aiEnrichment'
  ): Promise<T[]> {
    await this.ensureInitialized();

    if (!this.aiEnabled || !records || records.length === 0) {
      return records;
    }

    try {
      const enrichedRecords = await Promise.all(
        records.map(async (record) => {
  try {
    const prompt = enrichmentPrompt(record);
    const result = await generateText({
      model: xai('grok-4', {
        apiKey: process.env.XAI_API_KEY,
      }) as any,
      prompt,
      temperature: 0.7,
      maxOutputTokens: 200,
    });

            return {
              ...record,
              [enrichmentField]: result.text
            };
          } catch (error) {
            console.error(`${LOG_PREFIXES.DATABASE} Failed to enrich record:`, error);
            return record;
          }
        })
      );

      return enrichedRecords;
    } catch (error) {
      console.error(`${LOG_PREFIXES.DATABASE} Batch enrichment failed:`, error);
      return records;
    }
  }

  /**
   * AI-assisted data insertion with validation
   */
  async insertWithAIValidation<T extends Record<string, any>>(
    tableName: string,
    data: T | T[],
    validationContext?: string
  ): Promise<{ success: boolean; data?: T[]; error?: string; aiValidation?: string }> {
    await this.ensureInitialized();

    if (!this.supabase) {
      return { success: false, error: 'Database not initialized' };
    }

    const records = Array.isArray(data) ? data : [data];

    // Optional: AI validation before insertion
    if (this.aiEnabled && validationContext) {
      const validation = await this.validateDataWithAI(records, validationContext);
      if (!validation.isValid) {
        return {
          success: false,
          error: 'AI validation failed',
          aiValidation: validation.reason
        };
      }
    }

    try {
      const { data: insertedData, error } = await this.supabase
        .from(tableName)
        .insert(records)
        .select();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: insertedData || undefined };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Use AI to validate data quality before operations
   */
  private async validateDataWithAI(
    data: any[],
    context: string
  ): Promise<{ isValid: boolean; reason?: string }> {
    if (!this.aiEnabled) {
      return { isValid: true };
    }

    try {
      const prompt = `
Validate this data for quality and consistency:

Context: ${context}
Data: ${JSON.stringify(data.slice(0, 2), null, 2)}

Check for:
1. Missing required fields
2. Invalid data types
3. Logical inconsistencies
4. Potential errors

Respond with "VALID" if okay, or "INVALID: [reason]" if there are issues.
  `.trim();
  
  const result = await generateText({
    model: xai('grok-4', {
      apiKey: process.env.XAI_API_KEY,
    }) as any,
    prompt,
    temperature: 0.3,
    maxOutputTokens: 100,
  });

      const response = result.text.trim();
      if (response.startsWith('INVALID')) {
        return {
          isValid: false,
          reason: response.replace('INVALID:', '').trim()
        };
      }

      return { isValid: true };
    } catch (error) {
      console.error(`${LOG_PREFIXES.DATABASE} AI validation error:`, error);
      return { isValid: true }; // Default to valid on error
    }
  }

  /**
   * Get Supabase client directly (for advanced operations)
   */
  getSupabaseClient(): SupabaseClient | null {
    return this.supabase;
  }
}

// Singleton instance
let leveragedAIInstance: LeveragedAI | null = null;

/**
 * Get or create LeveragedAI instance
 */
export function getLeveragedAI(): LeveragedAI {
  if (!leveragedAIInstance) {
    leveragedAIInstance = new LeveragedAI();
  }
  return leveragedAIInstance;
}

/**
 * Convenience function: AI-enhanced query
 */
export async function queryWithAI<T>(
  tableName: string,
  queryBuilder: (builder: any) => any,
  options?: AIEnhancedQueryOptions
): Promise<AIEnhancedResult<T>> {
  const ai = getLeveragedAI();
  return ai.queryWithAI<T>(tableName, queryBuilder, options);
}

/**
 * Convenience function: Enrich records with AI
 */
export async function enrichWithAI<T extends Record<string, any>>(
  records: T[],
  enrichmentPrompt: (record: T) => string,
  enrichmentField?: string
): Promise<T[]> {
  const ai = getLeveragedAI();
  return ai.enrichRecordsWithAI(records, enrichmentPrompt, enrichmentField);
}
