/**
 * Safe Process Information Utilities
 * Provides reliable access to process data in various runtime environments
 * (Node.js, Edge Runtime, Serverless, etc.)
 */

export interface ProcessInfo {
  nodeVersion: string | null;
  platform: string | null;
  arch: string | null;
  uptime: number | null;
  memoryUsage: {
    rss: number | null;
    heapTotal: number | null;
    heapUsed: number | null;
    external: number | null;
  } | null;
  cpuUsage: {
    user: number | null;
    system: number | null;
  } | null;
}

/**
 * Check if we're running in a Node.js environment with full process access
 */
export function isNodeEnvironment(): boolean {
  return (
    typeof process !== 'undefined' &&
    typeof process.version === 'string' &&
    typeof process.platform === 'string'
  );
}

/**
 * Check if we're running in Vercel Edge Runtime
 */
export function isEdgeRuntime(): boolean {
  return (
    typeof EdgeRuntime !== 'undefined' ||
    (typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'edge')
  );
}

/**
 * Safely get Node.js version
 */
export function getNodeVersion(): string | null {
  try {
    if (typeof process !== 'undefined') {
      const version = (process as any)?.version;
      return typeof version === 'string' ? version : null;
    }
  } catch {
    // Silently fail in restricted environments
  }
  return null;
}

/**
 * Safely get platform information
 */
export function getPlatform(): string | null {
  try {
    if (typeof process !== 'undefined') {
      const platform = (process as any)?.platform;
      return typeof platform === 'string' ? platform : null;
    }
  } catch {
    // Silently fail
  }
  return null;
}

/**
 * Safely get architecture information
 */
export function getArchitecture(): string | null {
  try {
    if (typeof process !== 'undefined') {
      const arch = (process as any)?.arch;
      return typeof arch === 'string' ? arch : null;
    }
  } catch {
    // Silently fail
  }
  return null;
}

/**
 * Safely get process uptime in seconds
 */
export function getUptime(): number | null {
  try {
    if (typeof process !== 'undefined' && typeof process.uptime === 'function') {
      return Math.floor(process.uptime());
    }
  } catch {
    // Silently fail
  }
  return null;
}

/**
 * Safely get memory usage
 * Returns null in environments where process.memoryUsage() is unavailable
 */
export function getMemoryUsage(): ProcessInfo['memoryUsage'] {
  try {
    if (typeof process !== 'undefined' && typeof process.memoryUsage === 'function') {
      const mem = process.memoryUsage();
      return {
        rss: mem.rss,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed,
        external: mem.external
      };
    }
  } catch {
    // Silently fail
  }
  return null;
}

/**
 * Safely get CPU usage
 * Returns null in environments where process.cpuUsage() is unavailable
 */
export function getCpuUsage(): ProcessInfo['cpuUsage'] {
  try {
    if (typeof process !== 'undefined' && typeof process.cpuUsage === 'function') {
      const cpu = process.cpuUsage();
      return {
        user: cpu.user,
        system: cpu.system
      };
    }
  } catch {
    // Silently fail
  }
  return null;
}

/**
 * Get all available process information
 * Safe for use in any runtime environment
 */
export function getProcessInfo(): ProcessInfo {
  return {
    nodeVersion: getNodeVersion(),
    platform: getPlatform(),
    arch: getArchitecture(),
    uptime: getUptime(),
    memoryUsage: getMemoryUsage(),
    cpuUsage: getCpuUsage()
  };
}

/**
 * Format process info for logging
 */
export function formatProcessInfo(info: ProcessInfo = getProcessInfo()): string {
  const parts: string[] = [];

  if (info.nodeVersion) {
    parts.push(`Node.js ${info.nodeVersion}`);
  }

  if (info.platform && info.arch) {
    parts.push(`${info.platform}/${info.arch}`);
  }

  if (info.uptime !== null) {
    const hours = Math.floor(info.uptime / 3600);
    const minutes = Math.floor((info.uptime % 3600) / 60);
    parts.push(`uptime: ${hours}h ${minutes}m`);
  }

  if (info.memoryUsage) {
    const heapUsedMB = Math.round(info.memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(info.memoryUsage.heapTotal / 1024 / 1024);
    parts.push(`memory: ${heapUsedMB}/${heapTotalMB} MB`);
  }

  return parts.length > 0 ? parts.join(' | ') : 'Process info unavailable';
}

/**
 * Get runtime environment name
 */
export function getRuntimeEnvironment(): string {
  if (isEdgeRuntime()) {
    return 'edge';
  }
  
  if (typeof process !== 'undefined') {
    // Check for Vercel
    if (process.env.VERCEL) {
      return 'vercel-serverless';
    }
    
    // Check for AWS Lambda
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      return 'aws-lambda';
    }
    
    // Check for Netlify
    if (process.env.NETLIFY) {
      return 'netlify-functions';
    }
    
    // Check for Cloudflare Workers
    if (typeof caches !== 'undefined' && typeof WebSocketPair !== 'undefined') {
      return 'cloudflare-workers';
    }
    
    return 'node';
  }
  
  return 'unknown';
}

/**
 * Check if specific process APIs are available
 */
export function getProcessApiAvailability() {
  return {
    version: typeof process !== 'undefined' && typeof process.version === 'string',
    platform: typeof process !== 'undefined' && typeof process.platform === 'string',
    arch: typeof process !== 'undefined' && typeof process.arch === 'string',
    uptime: typeof process !== 'undefined' && typeof process.uptime === 'function',
    memoryUsage: typeof process !== 'undefined' && typeof process.memoryUsage === 'function',
    cpuUsage: typeof process !== 'undefined' && typeof process.cpuUsage === 'function',
    env: typeof process !== 'undefined' && typeof process.env === 'object'
  };
}
