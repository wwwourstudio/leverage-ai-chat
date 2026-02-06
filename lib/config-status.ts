/// <reference types="node" />

/**
 * Configuration Status Checker
 * Verifies that required environment variables are properly configured
 */

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
  overall: {
    ready: boolean;
    criticalMissing: number;
    warningCount: number;
  };
}

/**
 * Check if Supabase is properly configured
 * Server-side only
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
 * Check if Grok AI is properly configured
 * Server-side only
 */
export function checkGrokConfig(): ConfigStatus {
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  const missing: string[] = [];
  const recommendations: string[] = [];

  if (!apiKey) {
    missing.push('XAI_API_KEY');
    recommendations.push('Get your API key from https://console.x.ai/');
  } else {
    recommendations.push('Using Grok-3 model for AI analysis');
  }

  return {
    configured: missing.length === 0,
    missing,
    warnings: [],
    recommendations,
  };
}

/**
 * Check if Odds API is properly configured
 * Server-side only
 */
export function checkOddsConfig(): ConfigStatus {
  const apiKey = process.env.ODDS_API_KEY;
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
 * Get complete service status
 * Server-side only
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

  return {
    supabase,
    grok,
    odds,
    overall: {
      ready: criticalMissing === 0,
      criticalMissing,
      warningCount,
    },
  };
}

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
