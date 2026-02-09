/// <reference types="node" />

/**
 * Grok-Powered Data Analysis Pipeline
 * Leverages Grok AI for pattern matching, data extraction, and intelligent analysis
 * Designed for sports betting intelligence with modularity and reusability
 */

import { ENV_KEYS, LOG_PREFIXES } from '@/lib/constants';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface GrokAnalysisRequest {
  prompt: string;
  context?: Record<string, any>;
  extractionRules?: ExtractionRule[];
  validationRules?: ValidationRule[];
}

export interface ExtractionRule {
  name: string;
  pattern: string;
  type: 'number' | 'percentage' | 'team' | 'player' | 'odds' | 'date' | 'custom';
  required: boolean;
  transform?: (value: string) => any;
}

export interface ValidationRule {
  field: string;
  validate: (value: any) => boolean;
  errorMessage: string;
}

export interface GrokAnalysisResult {
  success: boolean;
  rawResponse: string;
  extractedData: Record<string, any>;
  validationErrors: string[];
  confidence: number;
  processingTime: number;
}

export interface DataPipelineConfig {
  maxRetries: number;
  timeout: number;
  fallbackEnabled: boolean;
  cacheEnabled: boolean;
  cacheTTL: number;
}

// ============================================================================
// GROK PATTERN LIBRARY
// ============================================================================

export const GROK_PATTERNS = {
  // Numeric patterns
  PERCENTAGE: /(\d+(?:\.\d+)?)\s*%/g,
  ODDS: /([+-]\d+)|(\d+\/\d+)|(\d+\.\d+)/g,
  SCORE: /(\d+)\s*[-:]\s*(\d+)/g,
  MONEY: /\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/g,
  
  // Team/Player patterns
  TEAM_NAME: /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
  PLAYER_NAME: /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g,
  
  // Time patterns
  DATE: /\b(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/g,
  TIME: /\b(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)\b/g,
  
  // Betting patterns
  SPREAD: /([+-]?\d+(?:\.\d+)?)\s*(?:point|pts?|spread)/gi,
  OVER_UNDER: /(?:over|under|o\/u)\s*(\d+(?:\.\d+)?)/gi,
  MONEYLINE: /(?:ML|moneyline):\s*([+-]\d+)/gi,
  
  // Confidence patterns
  CONFIDENCE: /\b(\d+)%?\s*(?:confidence|certain|sure|likely)/gi,
  PROBABILITY: /\b(\d+(?:\.\d+)?)\s*(?:probability|chance)/gi,
  
  // Sentiment patterns
  POSITIVE: /\b(strong|excellent|favorable|advantage|edge|value)\b/gi,
  NEGATIVE: /\b(weak|poor|unfavorable|risk|concern|avoid)\b/gi,
  NEUTRAL: /\b(moderate|fair|even|balanced|uncertain)\b/gi,
};

// ============================================================================
// EXTRACTION RULE TEMPLATES
// ============================================================================

export const EXTRACTION_TEMPLATES = {
  BETTING_ANALYSIS: [
    {
      name: 'recommendedBet',
      pattern: '(?:recommend|suggest|bet on)\\s+([\\w\\s]+)',
      type: 'custom' as const,
      required: true,
    },
    {
      name: 'confidence',
      pattern: '(\\d+)%?\\s*confidence',
      type: 'percentage' as const,
      required: true,
      transform: (val: string) => parseInt(val),
    },
    {
      name: 'odds',
      pattern: '([+-]\\d+)',
      type: 'odds' as const,
      required: false,
    },
  ],
  
  GAME_PREDICTION: [
    {
      name: 'winner',
      pattern: '(?:winner|win)\\s*:?\\s*([A-Z][\\w\\s]+)',
      type: 'team' as const,
      required: true,
    },
    {
      name: 'score',
      pattern: '(\\d+)\\s*[-:]\\s*(\\d+)',
      type: 'custom' as const,
      required: false,
    },
    {
      name: 'probability',
      pattern: '(\\d+(?:\\.\\d+)?)\\s*(?:probability|chance)',
      type: 'percentage' as const,
      required: false,
    },
  ],
  
  PLAYER_PROPS: [
    {
      name: 'player',
      pattern: '([A-Z][a-z]+\\s+[A-Z][a-z]+)',
      type: 'player' as const,
      required: true,
    },
    {
      name: 'stat',
      pattern: '(\\d+(?:\\.\\d+)?)\\s*(?:points|rebounds|assists)',
      type: 'number' as const,
      required: true,
    },
    {
      name: 'overUnder',
      pattern: 'over|under',
      type: 'custom' as const,
      required: true,
    },
  ],
};

// ============================================================================
// VALIDATION RULE TEMPLATES
// ============================================================================

export const VALIDATION_TEMPLATES = {
  CONFIDENCE: {
    field: 'confidence',
    validate: (val: any) => typeof val === 'number' && val >= 0 && val <= 100,
    errorMessage: 'Confidence must be between 0 and 100',
  },
  
  ODDS: {
    field: 'odds',
    validate: (val: any) => {
      if (typeof val === 'string') {
        return /^[+-]\d+$/.test(val) || /^\d+\.\d+$/.test(val);
      }
      return typeof val === 'number';
    },
    errorMessage: 'Invalid odds format',
  },
  
  TEAM_NAME: {
    field: 'team',
    validate: (val: any) => typeof val === 'string' && val.length > 2,
    errorMessage: 'Team name must be at least 3 characters',
  },
};

// ============================================================================
// GROK PIPELINE CLASS
// ============================================================================

export class GrokAnalysisPipeline {
  private config: DataPipelineConfig;
  private cache: Map<string, { data: any; timestamp: number }>;
  private apiKey: string;

  constructor(config: Partial<DataPipelineConfig> = {}) {
    this.config = {
      maxRetries: 3,
      timeout: 30000,
      fallbackEnabled: true,
      cacheEnabled: true,
      cacheTTL: 300000, // 5 minutes
      ...config,
    };
    
    this.cache = new Map();
    this.apiKey = process.env[ENV_KEYS.XAI_API_KEY] || '';
    
    console.log(`${LOG_PREFIXES.CONFIG} Grok Pipeline initialized with config:`, this.config);
  }

  /**
   * Main analysis method - processes data through Grok with extraction and validation
   */
  async analyze(request: GrokAnalysisRequest): Promise<GrokAnalysisResult> {
    const startTime = Date.now();
    console.log(`[v0] Starting Grok analysis pipeline`);

    // Check cache if enabled
    if (this.config.cacheEnabled) {
      const cached = this.checkCache(request.prompt);
      if (cached) {
        console.log(`[v0] Cache hit for analysis`);
        return cached;
      }
    }

    // Validate API key
    if (!this.apiKey) {
      console.log(`[v0] No Grok API key - using fallback`);
      return this.generateFallback(request, startTime);
    }

    // Execute with retries
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`[v0] Grok analysis attempt ${attempt}/${this.config.maxRetries}`);
        
        const result = await this.executeGrokAnalysis(request, startTime);
        
        // Cache successful result
        if (this.config.cacheEnabled && result.success) {
          this.cacheResult(request.prompt, result);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        console.log(`[v0] Attempt ${attempt} failed:`, error);
        
        if (attempt < this.config.maxRetries) {
          await this.delay(1000 * attempt); // Exponential backoff
        }
      }
    }

    // All retries failed
    console.log(`[v0] All retry attempts failed, using fallback`);
    return this.generateFallback(request, startTime, lastError);
  }

  /**
   * Execute Grok API call with timeout
   */
  private async executeGrokAnalysis(
    request: GrokAnalysisRequest,
    startTime: number
  ): Promise<GrokAnalysisResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'grok-beta',
          messages: [
            {
              role: 'system',
              content: 'You are a precise data analyst. Extract and analyze information accurately.',
            },
            {
              role: 'user',
              content: this.buildPrompt(request),
            },
          ],
          temperature: 0.3,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Grok API error: ${response.status}`);
      }

      const data = await response.json();
      const rawResponse = data.choices[0]?.message?.content || '';

      console.log(`[v0] Grok response received (${rawResponse.length} chars)`);

      // Extract data using rules
      const extractedData = this.extractData(rawResponse, request.extractionRules || []);
      
      // Validate extracted data
      const validationErrors = this.validateData(extractedData, request.validationRules || []);

      // Calculate confidence
      const confidence = this.calculateConfidence(rawResponse, extractedData, validationErrors);

      const result: GrokAnalysisResult = {
        success: validationErrors.length === 0,
        rawResponse,
        extractedData,
        validationErrors,
        confidence,
        processingTime: Date.now() - startTime,
      };

      console.log(`[v0] Analysis complete - confidence: ${confidence}%, errors: ${validationErrors.length}`);

      return result;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Build enhanced prompt with context and extraction instructions
   */
  private buildPrompt(request: GrokAnalysisRequest): string {
    let prompt = request.prompt;

    // Add context if provided
    if (request.context) {
      prompt += '\n\nContext:\n';
      for (const [key, value] of Object.entries(request.context)) {
        prompt += `- ${key}: ${JSON.stringify(value)}\n`;
      }
    }

    // Add extraction instructions
    if (request.extractionRules && request.extractionRules.length > 0) {
      prompt += '\n\nPlease include in your response:\n';
      request.extractionRules
        .filter(rule => rule.required)
        .forEach(rule => {
          prompt += `- ${rule.name} (${rule.type})\n`;
        });
    }

    return prompt;
  }

  /**
   * Extract structured data from raw response using patterns
   */
  private extractData(
    rawResponse: string,
    rules: ExtractionRule[]
  ): Record<string, any> {
    const extracted: Record<string, any> = {};

    for (const rule of rules) {
      try {
        const regex = new RegExp(rule.pattern, 'gi');
        const matches = rawResponse.match(regex);

        if (matches && matches.length > 0) {
          let value = matches[0];
          
          // Apply transformation if provided
          if (rule.transform) {
            value = rule.transform(value);
          }

          extracted[rule.name] = value;
          console.log(`[v0] Extracted ${rule.name}:`, value);
        } else if (rule.required) {
          console.log(`[v0] Required field ${rule.name} not found`);
        }
      } catch (error) {
        console.log(`[v0] Error extracting ${rule.name}:`, error);
      }
    }

    return extracted;
  }

  /**
   * Validate extracted data against rules
   */
  private validateData(
    data: Record<string, any>,
    rules: ValidationRule[]
  ): string[] {
    const errors: string[] = [];

    for (const rule of rules) {
      if (data[rule.field] !== undefined) {
        try {
          if (!rule.validate(data[rule.field])) {
            errors.push(rule.errorMessage);
            console.log(`[v0] Validation failed for ${rule.field}: ${rule.errorMessage}`);
          }
        } catch (error) {
          errors.push(`Validation error for ${rule.field}`);
        }
      }
    }

    return errors;
  }

  /**
   * Calculate confidence score based on response quality
   */
  private calculateConfidence(
    rawResponse: string,
    extractedData: Record<string, any>,
    validationErrors: string[]
  ): number {
    let confidence = 100;

    // Penalize for validation errors
    confidence -= validationErrors.length * 10;

    // Penalize for missing data
    const dataPoints = Object.keys(extractedData).length;
    if (dataPoints < 3) {
      confidence -= (3 - dataPoints) * 5;
    }

    // Boost for confidence indicators in response
    const confidenceMatches = rawResponse.match(GROK_PATTERNS.CONFIDENCE);
    if (confidenceMatches && confidenceMatches.length > 0) {
      const mentionedConfidence = parseInt(confidenceMatches[0]);
      confidence = (confidence + mentionedConfidence) / 2;
    }

    // Penalize for vague language
    const vagueTerms = ['maybe', 'possibly', 'might', 'could be', 'uncertain'];
    const vagueCount = vagueTerms.filter(term => 
      rawResponse.toLowerCase().includes(term)
    ).length;
    confidence -= vagueCount * 5;

    return Math.max(0, Math.min(100, Math.round(confidence)));
  }

  /**
   * Generate fallback response when Grok is unavailable
   */
  private generateFallback(
    request: GrokAnalysisRequest,
    startTime: number,
    error?: Error | null
  ): GrokAnalysisResult {
    console.log(`[v0] Generating fallback response`);

    return {
      success: false,
      rawResponse: 'Analysis unavailable. Please configure XAI_API_KEY for full functionality.',
      extractedData: {},
      validationErrors: error ? [error.message] : ['API key not configured'],
      confidence: 0,
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Cache management
   */
  private checkCache(key: string): GrokAnalysisResult | null {
    const cached = this.cache.get(key);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < this.config.cacheTTL) {
        return cached.data;
      } else {
        this.cache.delete(key);
      }
    }
    return null;
  }

  private cacheResult(key: string, result: GrokAnalysisResult): void {
    this.cache.set(key, {
      data: result,
      timestamp: Date.now(),
    });
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear cache manually
   */
  public clearCache(): void {
    this.cache.clear();
    console.log(`[v0] Cache cleared`);
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick analysis for betting recommendations
 */
export async function analyzeBettingOpportunity(
  gameData: any,
  userQuery: string
): Promise<GrokAnalysisResult> {
  const pipeline = new GrokAnalysisPipeline();
  
  return pipeline.analyze({
    prompt: `Analyze this betting opportunity: ${userQuery}`,
    context: { gameData },
    extractionRules: EXTRACTION_TEMPLATES.BETTING_ANALYSIS,
    validationRules: [VALIDATION_TEMPLATES.CONFIDENCE, VALIDATION_TEMPLATES.ODDS],
  });
}

/**
 * Predict game outcomes
 */
export async function predictGameOutcome(
  team1: string,
  team2: string,
  stats: any
): Promise<GrokAnalysisResult> {
  const pipeline = new GrokAnalysisPipeline();
  
  return pipeline.analyze({
    prompt: `Predict the outcome of ${team1} vs ${team2}`,
    context: { stats },
    extractionRules: EXTRACTION_TEMPLATES.GAME_PREDICTION,
    validationRules: [VALIDATION_TEMPLATES.CONFIDENCE, VALIDATION_TEMPLATES.TEAM_NAME],
  });
}

/**
 * Analyze player props
 */
export async function analyzePlayerProps(
  playerName: string,
  propDetails: any
): Promise<GrokAnalysisResult> {
  const pipeline = new GrokAnalysisPipeline();
  
  return pipeline.analyze({
    prompt: `Analyze player prop bet for ${playerName}`,
    context: { propDetails },
    extractionRules: EXTRACTION_TEMPLATES.PLAYER_PROPS,
    validationRules: [VALIDATION_TEMPLATES.CONFIDENCE],
  });
}
