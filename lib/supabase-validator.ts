/**
 * Supabase Validator Utility
 * Validates table existence and data integrity before queries
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { LOG_PREFIXES, EXTERNAL_APIS } from '@/lib/constants';

// Cache for table existence checks (valid for 5 minutes)
const tableExistenceCache = new Map<string, { exists: boolean; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
 * Safely extract error message from any error type
 * Ensures the result is always a valid string that can be safely logged or serialized
 */
function extractErrorMessage(error: any): string {
  if (!error) return 'Unknown error';
  
  try {
    // Handle Error objects
    if (error instanceof Error) {
      // Return just the message, avoid serializing the entire Error object
      return error.message || 'Error with no message';
    }
    
    // Handle Supabase error objects
    if (error && typeof error === 'object') {
      // Check for standard error properties in order of preference
      if (error.message && typeof error.message === 'string') {
        return error.message;
      }
      if (error.error && typeof error.error === 'string') {
        return error.error;
      }
      if (error.details && typeof error.details === 'string') {
        return error.details;
      }
      if (error.hint && typeof error.hint === 'string') {
        return `${error.message || 'Database error'}: ${error.hint}`;
      }
      
      // For Supabase PostgrestError, extract relevant info
      if (error.code) {
        return `Database error (${error.code}): ${error.message || 'No details'}`;
      }
      
      // Try to create a readable error message from the object properties
      try {
        const keys = Object.keys(error);
        if (keys.length === 0) {
          return 'Empty error object';
        }
        
        // Build a human-readable error message instead of JSON
        const parts: string[] = [];
        for (const key of keys) {
          const value = error[key];
          // Only include primitive values to avoid circular references
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            parts.push(`${key}: ${value}`);
          }
        }
        
        // Return a plain string, NOT JSON
        return parts.length > 0 ? parts.join(', ') : 'Error object with no serializable properties';
      } catch {
        return 'Complex error object - unable to serialize';
      }
    }
    
    // Handle primitive types
    if (typeof error === 'string') {
      return error;
    }
    
    if (typeof error === 'number' || typeof error === 'boolean') {
      return String(error);
    }
    
    // Fallback to string conversion
    return String(error);
  } catch (conversionError) {
    // If all else fails, return a safe default
    console.error('Critical error in extractErrorMessage:', conversionError);
    return 'Unable to extract error message safely';
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
    // Extract error message safely - ALWAYS returns a plain string, never JSON
    const errorMessage = extractErrorMessage(error);
    
    // Log for debugging (safe string, never JSON)
    console.log(`${LOG_PREFIXES.DATABASE} Query validation failed for '${tableName}':`, errorMessage);
    
    // Check if it's a "table doesn't exist" error
    if (errorMessage.includes('does not exist') || (errorMessage.includes('relation') && errorMessage.includes('does not exist'))) {
      return {
        isValid: false,
        data: null,
        error: `Table '${tableName}' does not exist. Run database migrations first.`,
        isEmpty: true
      };
    }
    
    // Check if it's a permission error
    if (errorMessage.includes('permission denied') || errorMessage.includes('RLS') || errorMessage.includes('policy')) {
      return {
        isValid: false,
        data: null,
        error: `Permission denied for table '${tableName}'. Check Row Level Security policies.`,
        isEmpty: true
      };
    }
    
    // Check for connection errors
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return {
        isValid: false,
        data: null,
        error: `Database connection failed. Check network and credentials.`,
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
    return {
      isValid: false,
      data: null,
      error: 'Invalid data format: expected array',
      isEmpty: true
    };
  }

  return {
    isValid: true,
    data: data as T[],
    error: null,
    isEmpty: data.length === 0
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

    // Execute the query with error boundary
    let data: any;
    let error: any;
    
    try {
      const builder = supabase.from(tableName);
      const result = await queryBuilder(builder);
      data = result.data;
      error = result.error;
    } catch (queryError) {
      // Catch any errors during query execution
      const errorMsg = extractErrorMessage(queryError);
      if (logErrors) {
        console.log(`${LOG_PREFIXES.DATABASE} Query execution error for '${tableName}':`, errorMsg);
      }
      return {
        success: false,
        data: defaultValue,
        error: errorMsg,
        source: 'error'
      };
    }

    // Validate the response
    const validation = validateQueryResponse<T>(data, error, tableName);

    if (!validation.isValid) {
      if (logErrors) {
        // Log the error message safely - avoid potential JSON parsing issues
        const safeError = validation.error || 'Unknown validation error';
        console.log(`${LOG_PREFIXES.DATABASE} Query validation failed for '${tableName}':`, safeError);
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (logErrors) {
      console.log(`${LOG_PREFIXES.DATABASE} Exception during query to '${tableName}':`, errorMessage);
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
 * Sanitize a single record to ensure it's safe for JSON serialization
 */
function sanitizeRecord(record: any): any {
  if (!record || typeof record !== 'object') {
    return record;
  }

  try {
    // Create a clean object with only serializable properties
    const sanitized: Record<string, any> = {};
    
    for (const key in record) {
      if (record.hasOwnProperty(key)) {
        const value = record[key];
        
        // Handle different value types
        if (value === null || value === undefined) {
          sanitized[key] = value;
        } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          sanitized[key] = value;
        } else if (value instanceof Date) {
          sanitized[key] = value.toISOString();
        } else if (Array.isArray(value)) {
          sanitized[key] = value.map(item => sanitizeRecord(item));
        } else if (typeof value === 'object') {
          // Recursively sanitize nested objects
          sanitized[key] = sanitizeRecord(value);
        }
        // Skip functions, symbols, and other non-serializable types
      }
    }
    
    return sanitized;
  } catch (error) {
    console.log(`${LOG_PREFIXES.DATABASE} Error sanitizing record:`, extractErrorMessage(error));
    return null;
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

    // Sanitize the record first to ensure it's serializable
    const sanitized = sanitizeRecord(record);
    if (!sanitized) {
      invalidCount++;
      continue;
    }

    // Check if all required fields are present
    const hasAllFields = requiredFields.every(field => {
      const hasField = field in sanitized;
      if (!hasField) {
        missingFieldsSet.add(String(field));
      }
      return hasField;
    });

    if (hasAllFields) {
      validRecords.push(sanitized as T);
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
