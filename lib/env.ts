/// <reference types="node" />

/**
 * Environment Variable Utilities
 * Safely access and validate environment variables
 */

/**
 * Get server-side environment variable with validation
 * Throws error if variable is required but missing
 */
export function getServerEnv(
  key: string,
  options: { required?: boolean; defaultValue?: string } = {}
): string | undefined {
  const value = process.env[key];
  
  if (!value && options.required) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
      `Please add ${key} to your environment variables.\n` +
      `See ENV_CONFIGURATION.md for setup instructions.`
    );
  }
  
  return value || options.defaultValue;
}

/**
 * Get client-side environment variable (must be prefixed with NEXT_PUBLIC_)
 */
export function getClientEnv(
  key: string,
  options: { required?: boolean; defaultValue?: string } = {}
): string | undefined {
  if (!key.startsWith('NEXT_PUBLIC_')) {
    console.warn(
      `[ENV] Attempting to access non-public env var '${key}' on client. ` +
      `Client env vars must be prefixed with NEXT_PUBLIC_`
    );
    return undefined;
  }
  
  const value = process.env[key];
  
  if (!value && options.required) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
      `Please add ${key} to your environment variables.`
    );
  }
  
  return value || options.defaultValue;
}

/**
 * Validate all required environment variables are present
 * Returns array of missing variables
 */
export function validateEnv(requiredVars: string[]): {
  valid: boolean;
  missing: string[];
  message: string;
} {
  const missing: string[] = [];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }
  
  const valid = missing.length === 0;
  const message = valid
    ? 'All required environment variables are configured'
    : `Missing required environment variables: ${missing.join(', ')}. See ENV_CONFIGURATION.md for setup.`;
  
  return { valid, missing, message };
}

/**
 * Common environment variable getters with proper defaults
 */

// Supabase
export const getSupabaseUrl = () => 
  getServerEnv('NEXT_PUBLIC_SUPABASE_URL', { required: false });

export const getSupabaseAnonKey = () => 
  getServerEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', { required: false });

export const getSupabaseServiceKey = () => 
  getServerEnv('SUPABASE_SERVICE_ROLE_KEY', { required: false });

// AI Services
export const getGrokApiKey = () => 
  getServerEnv('XAI_API_KEY', { required: false }) || 
  getServerEnv('GROK_API_KEY', { required: false });

// External APIs
export const getOddsApiKey = () => 
  getServerEnv('ODDS_API_KEY', { required: false });

/**
 * Check if service is configured
 */
export const isSupabaseConfigured = () => 
  !!(getSupabaseUrl() && getSupabaseAnonKey());

export const isGrokConfigured = () => 
  !!getGrokApiKey();

export const isOddsApiConfigured = () => 
  !!getOddsApiKey();

/**
 * Get all service configuration status
 */
export function getConfigStatus() {
  return {
    supabase: isSupabaseConfigured(),
    grok: isGrokConfigured(),
    odds: isOddsApiConfigured(),
    allReady: isSupabaseConfigured() && isGrokConfigured() && isOddsApiConfigured(),
  };
}

/**
 * Assert that required services are configured
 * Throws error with helpful message if not
 */
export function assertServicesConfigured(
  services: Array<'supabase' | 'grok' | 'odds'>
): void {
  const status = getConfigStatus();
  const missing: string[] = [];
  
  for (const service of services) {
    if (!status[service]) {
      switch (service) {
        case 'supabase':
          missing.push('Supabase (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)');
          break;
        case 'grok':
          missing.push('Grok AI (XAI_API_KEY)');
          break;
        case 'odds':
          missing.push('Odds API (ODDS_API_KEY)');
          break;
      }
    }
  }
  
  if (missing.length > 0) {
    throw new Error(
      `Required services not configured:\n` +
      missing.map(m => `  - ${m}`).join('\n') +
      `\n\nSee ENV_CONFIGURATION.md for setup instructions.`
    );
  }
}

/**
 * Safe environment variable logger (doesn't expose secrets)
 */
export function logEnvStatus() {
  const status = getConfigStatus();
  console.log('\n[ENV] Configuration Status:');
  console.log(`  Supabase: ${status.supabase ? '✅' : '❌'}`);
  console.log(`  Grok AI:  ${status.grok ? '✅' : '❌'}`);
  console.log(`  Odds API: ${status.odds ? '✅' : '❌'}`);
  console.log(`  All Ready: ${status.allReady ? '✅' : '❌'}\n`);
  
  if (!status.allReady) {
    console.log('[ENV] Some services are not configured. See ENV_CONFIGURATION.md\n');
  }
}
