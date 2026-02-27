/// <reference types="node" />

/**
 * Unified Configuration and Environment Management
 * Consolidates environment variable access, validation, and service status checking
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ConfigStatus {
  configured: boolean;
  missing: string[];
  warnings: string[];
  recommendations: string[];
}

export interface ServiceStatus {
  supabase: ConfigStatus;
  grok: ConfigStatus;
  odds: ConfigStatus;
  oddsApi: ConfigStatus; // Alias for 'odds' for backward compatibility
  allConfigured: boolean;
  overall: {
    ready: boolean;
    criticalMissing: number;
    warningCount: number;
  };
}

// ============================================================================
// ENVIRONMENT VARIABLE UTILITIES
// ============================================================================

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

// ============================================================================
// SERVICE-SPECIFIC GETTERS
// ============================================================================

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

// Stripe
export const getStripeSecretKey = () =>
  getServerEnv('STRIPE_SECRET_KEY', { required: false });

export const getStripeWebhookSecret = () =>
  getServerEnv('STRIPE_WEBHOOK_SECRET', { required: false });

export const getStripeMonthlyPriceId = () =>
  getServerEnv('STRIPE_MONTHLY_PRICE_ID', { required: false });

export const getStripeAnnualPriceId = () =>
  getServerEnv('STRIPE_ANNUAL_PRICE_ID', { required: false });

export const getStripePublishableKey = () =>
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null;

export const isStripeConfigured = () =>
  !!getStripeSecretKey();

// ============================================================================
// SERVICE STATUS CHECKS
// ============================================================================

/**
 * Check if service is configured (simple boolean checks)
 */
export const isSupabaseConfigured = () => 
  !!(getSupabaseUrl() && getSupabaseAnonKey());

export const isGrokConfigured = () => 
  !!getGrokApiKey();

export const isOddsApiConfigured = () => 
  !!getOddsApiKey();

/**
 * Check if Supabase is properly configured (detailed status)
 */
export function checkSupabaseConfig(): ConfigStatus {
  const required = {
    'NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL,
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  const optional = {
    'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'SUPABASE_JWT_SECRET': process.env.SUPABASE_JWT_SECRET,
  };

  const missing: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Check required
  for (const [key, value] of Object.entries(required)) {
    if (!value) {
      missing.push(key);
    }
  }

  // Check optional
  for (const [key, value] of Object.entries(optional)) {
    if (!value) {
      warnings.push(`${key} is not set - some features may be limited`);
    }
  }

  if (missing.length === 0) {
    recommendations.push('Consider running database migrations to set up tables');
  }

  return {
    configured: missing.length === 0,
    missing,
    warnings,
    recommendations,
  };
}

/**
 * Check if Grok AI is properly configured (detailed status)
 */
export function checkGrokConfig(): ConfigStatus {
  const apiKey = getGrokApiKey();
  const missing: string[] = [];
  const recommendations: string[] = [];

  if (!apiKey) {
    missing.push('XAI_API_KEY');
    recommendations.push('Get your API key from https://console.x.ai/');
  } else {
    recommendations.push('Using Grok via Vercel AI Gateway');
  }

  return {
    configured: missing.length === 0,
    missing,
    warnings: [],
    recommendations,
  };
}

/**
 * Check if Odds API is properly configured (detailed status)
 */
export function checkOddsConfig(): ConfigStatus {
  const apiKey = getOddsApiKey();
  const missing: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (!apiKey) {
    missing.push('ODDS_API_KEY');
    recommendations.push('Get your API key from https://the-odds-api.com/');
  } else {
    recommendations.push('Free tier: 500 requests/month');
    warnings.push('Monitor your API usage to avoid exceeding quota');
  }

  return {
    configured: missing.length === 0,
    missing,
    warnings,
    recommendations,
  };
}

/**
 * Get complete service status (detailed)
 */
export function getServiceStatus(): ServiceStatus {
  const supabase = checkSupabaseConfig();
  const grok = checkGrokConfig();
  const odds = checkOddsConfig();

  const criticalMissing = 
    supabase.missing.length +
    grok.missing.length +
    odds.missing.length;

  const warningCount =
    supabase.warnings.length +
    grok.warnings.length +
    odds.warnings.length;

  const allConfigured = criticalMissing === 0;

  return {
    supabase,
    grok,
    odds,
    oddsApi: odds, // Alias for backward compatibility
    allConfigured,
    overall: {
      ready: allConfigured,
      criticalMissing,
      warningCount,
    },
  };
}

/**
 * Get all service configuration status (simple)
 */
export function getConfigStatus() {
  return {
    supabase: isSupabaseConfigured(),
    grok: isGrokConfigured(),
    odds: isOddsApiConfigured(),
    allReady: isSupabaseConfigured() && isGrokConfigured() && isOddsApiConfigured(),
  };
}

// ============================================================================
// FORMATTING AND LOGGING
// ============================================================================

/**
 * Format service status for logging
 */
export function formatServiceStatus(status: ServiceStatus): string {
  let output = '\n=== Service Configuration Status ===\n\n';

  output += `Overall: ${status.overall.ready ? '✅ READY' : '❌ NOT READY'}\n`;
  output += `Critical Issues: ${status.overall.criticalMissing}\n`;
  output += `Warnings: ${status.overall.warningCount}\n\n`;

  // Supabase
  output += `📦 Supabase: ${status.supabase.configured ? '✅' : '❌'}\n`;
  if (status.supabase.missing.length > 0) {
    output += `   Missing: ${status.supabase.missing.join(', ')}\n`;
  }
  if (status.supabase.warnings.length > 0) {
    status.supabase.warnings.forEach(w => output += `   ⚠️  ${w}\n`);
  }

  // Grok
  output += `\n🤖 Grok AI: ${status.grok.configured ? '✅' : '❌'}\n`;
  if (status.grok.missing.length > 0) {
    output += `   Missing: ${status.grok.missing.join(', ')}\n`;
  }

  // Odds
  output += `\n📊 Odds API: ${status.odds.configured ? '✅' : '❌'}\n`;
  if (status.odds.missing.length > 0) {
    output += `   Missing: ${status.odds.missing.join(', ')}\n`;
  }
  if (status.odds.warnings.length > 0) {
    status.odds.warnings.forEach(w => output += `   ⚠️  ${w}\n`);
  }

  output += '\n================================\n';

  return output;
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

// ============================================================================
// ASSERTIONS AND VALIDATION
// ============================================================================

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
 * Client-safe version - only checks public variables
 */
export function checkClientConfig(): {
  supabaseUrl: boolean;
  supabaseKey: boolean;
  ready: boolean;
} {
  const supabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    supabaseUrl,
    supabaseKey,
    ready: supabaseUrl && supabaseKey,
  };
}
