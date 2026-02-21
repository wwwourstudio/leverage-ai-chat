/**
 * Environment Variable Validator
 * 
 * Validates that all required environment variables are configured.
 * Provides clear error messages for missing or misconfigured variables.
 * 
 * @module lib/env-validator
 */

export interface EnvValidationResult {
  isValid: boolean;
  missing: string[];
  warnings: string[];
  errors: string[];
}

const REQUIRED_ENV_VARS = {
  // Supabase (required for authentication and database)
  NEXT_PUBLIC_SUPABASE_URL: 'Supabase project URL',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'Supabase anonymous key',
  SUPABASE_SERVICE_ROLE_KEY: 'Supabase service role key (server-side only)',
  
  // AI/ML APIs
  XAI_API_KEY: 'xAI Grok API key for AI responses',
  
  // Sports Data APIs
  ODDS_API_KEY: 'The Odds API key for sports betting data',
} as const;

const OPTIONAL_ENV_VARS = {
  NEXT_PUBLIC_SITE_URL: 'Site URL for absolute links',
  WEATHER_API_KEY: 'Weather API key for outdoor sports',
  STRIPE_SECRET_KEY: 'Stripe secret key for payments',
  STRIPE_PUBLISHABLE_KEY: 'Stripe publishable key for payments',
  KALSHI_API_KEY: 'Kalshi API key for prediction markets',
} as const;

/**
 * Validate environment variables on server-side
 */
export function validateServerEnv(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check required variables
  for (const [key, description] of Object.entries(REQUIRED_ENV_VARS)) {
    const value = process.env[key];
    
    if (!value || value.trim() === '') {
      missing.push(`${key} (${description})`);
      errors.push(`Missing required environment variable: ${key}`);
    } else if (key.includes('KEY') && value.length < 20) {
      warnings.push(`${key} looks suspiciously short - verify it's correct`);
    }
  }

  // Check optional variables
  for (const [key, description] of Object.entries(OPTIONAL_ENV_VARS)) {
    const value = process.env[key];
    if (!value) {
      warnings.push(`Optional: ${key} (${description}) not configured`);
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
    errors,
  };
}

/**
 * Validate public environment variables on client-side
 */
export function validateClientEnv(): EnvValidationResult {
  if (typeof window === 'undefined') {
    return { isValid: true, missing: [], warnings: [], errors: [] };
  }

  const missing: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check only public variables accessible on client
  const publicVars = {
    NEXT_PUBLIC_SUPABASE_URL: REQUIRED_ENV_VARS.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: REQUIRED_ENV_VARS.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  for (const [key, description] of Object.entries(publicVars)) {
    const value = process.env[key];
    
    if (!value || value.trim() === '') {
      missing.push(`${key} (${description})`);
      errors.push(`Missing required public environment variable: ${key}`);
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
    errors,
  };
}

/**
 * Log environment validation results
 */
let envLogged = false;

export function logEnvValidation(result: EnvValidationResult, context: 'server' | 'client') {
  // Errors always log (required vars missing = broken app)
  if (result.missing.length > 0) {
    console.error(`[v0] ${context.toUpperCase()}: Missing required env vars:`, result.missing);
  }
  if (result.errors.length > 0) {
    console.error(`[v0] ${context.toUpperCase()}: Environment errors:`, result.errors);
  }

  // Warnings (optional vars) only log once per process to avoid per-request spam
  if (!envLogged) {
    envLogged = true;
    console.log(`[v0] ${context.toUpperCase()}: Environment validation ${result.isValid ? '✓ PASSED' : '✗ FAILED'}`);
    if (result.warnings.length > 0) {
      console.warn(`[v0] Environment warnings (will not repeat):`, result.warnings);
    }
  }
}

/**
 * Get missing API keys for display purposes
 */
export function getMissingAPIKeys(): string[] {
  const missing: string[] = [];
  
  const apiKeys = [
    'XAI_API_KEY',
    'ODDS_API_KEY',
    'KALSHI_API_KEY',
  ];

  for (const key of apiKeys) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  return missing;
}
