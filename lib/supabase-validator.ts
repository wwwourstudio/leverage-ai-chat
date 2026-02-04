/**
 * Supabase Validator Utility
 * Validates table existence and data integrity before queries
 * Handles malformed JSON responses and parsing errors safely
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { LOG_PREFIXES, EXTERNAL_APIS } from '@/lib/constants';

// Cache for table existence checks (valid for 5 minutes)
const tableExistenceCache = new Map<string, { exists: boolean; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Safely parse JSON with validation
 */
export function safeJsonParse<T = any>(jsonString: string): { success: boolean; data: T | null; error: string | null } {
  if (!jsonString || typeof jsonString !== 'string') {
    return {
      success: false,
      data: null,
      error: 'Invalid input: not a string'
    };
  }

  try {
    const parsed = JSON.parse(jsonString);
    return {
      success: true,
      data: parsed as T,
      error: null
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'JSON parse error';
    return {
      success: false,
      data: null,
      error: `Failed to parse JSON: ${errorMessage}. Input: ${jsonString.substring(0, 100)}...`
    };
  }
}

/**
 * Validate if a value is valid JSON
 */
export function isValidJson(value: any): boolean {
  if (typeof value === 'object' && value !== null) {
    return true; // Already an object
  }
  
  if (typeof value !== 'string') {
    return false;
  }

  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a table exists in Supabase
 */
export async function checkTableExists(
  supabase: SupabaseClient,
  tableName: string
): Promise<boolean> {
  // Check cache first
  const cached = tableExistenceCache.get(tableName);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.exists;
  }

  try {
    // Try to query with limit 0 to check existence without fetching data
    const { error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .limit(0);

    const exists = !error || !error.message.includes('does not exist');
    
    // Cache the result
    tableExistenceCache.set(tableName, { exists, timestamp: Date.now() });
    
    if (!exists) {
      console.log(`${LOG_PREFIXES.DATABASE} Table '${tableName}' does not exist`);
    }
    
    return exists;
  } catch (error) {
    console.log(`${LOG_PREFIXES.DATABASE} Error checking table existence:`, error);
    return false;
  }
}

/**
 * Safely extract error message from various error types
 */
function safeExtractErrorMessage(error: any): string {
  if (!error) return 'Unknown error';
  
  // Handle string errors
  if (typeof error === 'string') return error;
  
  // Handle Error objects
  if (error instanceof Error) return error.message;
  
  // Handle Supabase error objects
  if (error.message) return String(error.message);
  if (error.error) return String(error.error);
  if (error.details) return String(error.details);
  if (error.hint) return String(error.hint);
  
  // Try to stringify, but catch any errors
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Validate and sanitize query response
 */
export function validateQueryResponse<T = any>(
  data: any,
  error: any,
  tableName: string
): {
  isValid: boolean;
  data: T[] | null;
  error: string | null;
  isEmpty: boolean;
} {
  // Check for errors
  if (error) {
    const errorMessage = safeExtractErrorMessage(error);
    
    // Check if it's a "table doesn't exist" error
    if (errorMessage.includes('does not exist') || 
        errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
      return {
        isValid: false,
        data: null,
        error: `Table '${tableName}' does not exist. Run database migrations first.`,
        isEmpty: true
      };
    }
    
    // Check if it's a permission error
    if (errorMessage.includes('permission denied') || 
        errorMessage.includes('RLS') ||
        errorMessage.includes('policy')) {
      return {
        isValid: false,
        data: null,
        error: `Permission denied for table '${tableName}'. Check Row Level Security policies.`,
        isEmpty: true
      };
    }
    
    // Check for connection errors
    if (errorMessage.includes('connection') || 
        errorMessage.includes('network') ||
        errorMessage.includes('timeout')) {
      return {
        isValid: false,
        data: null,
        error: `Database connection error: ${errorMessage}`,
        isEmpty: true
      };
    }
    
    return {
      isValid: false,
      data: null,
      error: errorMessage,
      isEmpty: true
    };
  }

  // Check if data is valid
  if (data === null || data === undefined) {
    return {
      isValid: true,
      data: [],
      error: null,
      isEmpty: true
    };
  }

  // Ensure data is an array
  if (!Array.isArray(data)) {
    console.log(`${LOG_PREFIXES.DATABASE} Invalid data format from '${tableName}': expected array, got ${typeof data}`);
    
    // Try to coerce single objects into arrays
    if (data && typeof data === 'object') {
      console.log(`${LOG_PREFIXES.DATABASE} Converting single object to array for '${tableName}'`);
      return {
        isValid: true,
        data: [data] as T[],
        error: null,
        isEmpty: false
      };
    }
    
    return {
      isValid: false,
      data: null,
      error: 'Invalid data format: expected array',
      isEmpty: true
    };
  }

  // Sanitize the array data - remove null/undefined entries
  const sanitizedData = data.filter(item => item !== null && item !== undefined);
  
  if (sanitizedData.length < data.length) {
    console.log(`${LOG_PREFIXES.DATABASE} Removed ${data.length - sanitizedData.length} null/undefined entries from '${tableName}'`);
  }

  return {
    isValid: true,
    data: sanitizedData as T[],
    error: null,
    isEmpty: sanitizedData.length === 0
  };
}

/**
 * Safe query wrapper with validation
 */
export async function safeQuery<T = any>(
  supabase: SupabaseClient,
  tableName: string,
  queryBuilder: (builder: any) => any,
  options: {
    skipExistenceCheck?: boolean;
    defaultValue?: T[];
    logErrors?: boolean;
  } = {}
): Promise<{
  success: boolean;
  data: T[];
  error: string | null;
  source: 'database' | 'default' | 'error';
}> {
  const {
    skipExistenceCheck = false,
    defaultValue = [],
    logErrors = true
  } = options;

  try {
    // Check if table exists first (unless skipped)
    if (!skipExistenceCheck) {
      const exists = await checkTableExists(supabase, tableName);
      if (!exists) {
        if (logErrors) {
          console.log(`${LOG_PREFIXES.DATABASE} Table '${tableName}' not found, using default data`);
        }
        return {
          success: true,
          data: defaultValue,
          error: `Table '${tableName}' does not exist`,
          source: 'default'
        };
      }
    }

    // Execute the query
    const builder = supabase.from(tableName);
    const { data, error } = await queryBuilder(builder);

    // Validate the response
    const validation = validateQueryResponse<T>(data, error, tableName);

    if (!validation.isValid) {
      if (logErrors) {
        // Safely log the error without risk of JSON parsing issues
        const safeError = validation.error || 'Unknown validation error';
        console.log(`${LOG_PREFIXES.DATABASE} Query validation failed for '${tableName}': ${safeError}`);
      }
      return {
        success: false,
        data: defaultValue,
        error: validation.error,
        source: 'error'
      };
    }

    return {
      success: true,
      data: validation.data || defaultValue,
      error: null,
      source: 'database'
    };
  } catch (error) {
    // Safely extract error message
    const errorMessage = safeExtractErrorMessage(error);
    if (logErrors) {
      console.log(`${LOG_PREFIXES.DATABASE} Exception during query to '${tableName}': ${errorMessage}`);
    }
    return {
      success: false,
      data: defaultValue,
      error: errorMessage,
      source: 'error'
    };
  }
}

/**
 * Validate data schema matches expected structure
 */
export function validateDataSchema<T extends Record<string, any>>(
  data: any[],
  requiredFields: (keyof T)[],
  tableName: string
): {
  isValid: boolean;
  validRecords: T[];
  invalidCount: number;
  missingFields: string[];
} {
  if (!Array.isArray(data) || data.length === 0) {
    return {
      isValid: true,
      validRecords: [],
      invalidCount: 0,
      missingFields: []
    };
  }

  const validRecords: T[] = [];
  let invalidCount = 0;
  const missingFieldsSet = new Set<string>();

  for (const record of data) {
    if (!record || typeof record !== 'object') {
      invalidCount++;
      continue;
    }

    // Check if all required fields are present
    const hasAllFields = requiredFields.every(field => {
      const hasField = field in record;
      if (!hasField) {
        missingFieldsSet.add(String(field));
      }
      return hasField;
    });

    if (hasAllFields) {
      validRecords.push(record as T);
    } else {
      invalidCount++;
    }
  }

  if (invalidCount > 0) {
    console.log(
      `${LOG_PREFIXES.DATABASE} Schema validation for '${tableName}': ${invalidCount} invalid records, ` +
      `missing fields: ${Array.from(missingFieldsSet).join(', ')}`
    );
  }

  return {
    isValid: invalidCount === 0,
    validRecords,
    invalidCount,
    missingFields: Array.from(missingFieldsSet)
  };
}

/**
 * Clear table existence cache (useful after migrations)
 */
export function clearTableCache(tableName?: string): void {
  if (tableName) {
    tableExistenceCache.delete(tableName);
  } else {
    tableExistenceCache.clear();
  }
  console.log(`${LOG_PREFIXES.DATABASE} Table cache cleared${tableName ? ` for '${tableName}'` : ''}`);
}

/**
 * Get table names for the application
 */
export const APP_TABLES = {
  AI_PREDICTIONS: EXTERNAL_APIS.SUPABASE.TABLES.AI_PREDICTIONS,
  AI_RESPONSE_TRUST: EXTERNAL_APIS.SUPABASE.TABLES.AI_RESPONSE_TRUST,
  AI_AUDIT_LOG: 'ai_audit_log',
  ODDS_BENFORD_BASELINES: 'odds_benford_baselines',
  VALIDATION_THRESHOLDS: 'validation_thresholds',
  LIVE_ODDS_CACHE: 'live_odds_cache',
} as const;

/**
 * Expected schema structures for validation
 */
export const SCHEMA_DEFINITIONS = {
  AI_PREDICTIONS: ['id', 'model', 'prediction_data', 'created_at'] as const,
  AI_RESPONSE_TRUST: [
    'id',
    'model_id',
    'sport',
    'market_type',
    'benford_score',
    'odds_alignment_score',
    'consensus_score',
    'historical_accuracy_score',
    'final_confidence',
    'created_at'
  ] as const,
} as const;
