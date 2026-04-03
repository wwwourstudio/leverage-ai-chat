/**
 * Unified Utilities
 * Consolidates utils.ts, auth-utils.ts, debug-utils.ts, and process-utils.ts
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// ============================================
// Styling Utilities
// ============================================

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================
// Authentication Utilities
// ============================================

export async function getServerUser() {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: any) {
          try {
            cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: any }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore errors in Server Components
          }
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

export async function requireAuth() {
  const { user, error } = await getServerUser();

  if (error || !user) {
    throw new Error('Unauthorized');
  }

  return user;
}

export async function hasRole(role: string) {
  const { user } = await getServerUser();
  if (!user) return false;

  const userRoles = user.user_metadata?.roles || [];
  return userRoles.includes(role);
}

// ============================================
// Debug Utilities
// ============================================

export interface DebugContext {
  component: string;
  operation: string;
  timestamp: string;
  data?: any;
  error?: any;
  metrics?: Record<string, number>;
}

export function debugLog(context: DebugContext): void {
  if (process.env.NODE_ENV === 'development' || process.env.ENABLE_DEBUG_LOGS === 'true') {
    console.log(`[v0] [DEBUG] [${context.component}]`, {
      operation: context.operation,
      timestamp: context.timestamp,
      ...(context.data && { data: context.data }),
      ...(context.error && { error: context.error }),
      ...(context.metrics && { metrics: context.metrics })
    });
  }
}

export class PerformanceTimer {
  private startTime: number;
  private marks: Map<string, number>;

  constructor() {
    this.startTime = Date.now();
    this.marks = new Map();
  }

  mark(label: string): void {
    this.marks.set(label, Date.now() - this.startTime);
  }

  getElapsed(): number {
    return Date.now() - this.startTime;
  }

  getMarks(): Record<string, number> {
    return Object.fromEntries(this.marks);
  }

  report(component: string, operation: string): void {
    debugLog({
      component,
      operation,
      timestamp: new Date().toISOString(),
      metrics: {
        totalMs: this.getElapsed(),
        ...this.getMarks()
      }
    });
  }
}

export function isDebugEnabled(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.ENABLE_DEBUG_LOGS === 'true';
}

// ============================================
// Process Utilities
// ============================================

export interface ProcessInfo {
  nodeVersion: string | null;
  platform: string | null;
  arch: string | null;
  uptime: number | null;
  memoryUsage: {
    rss: number | null;
    heapTotal: number | null;
    heapUsed: number | null;
  } | null;
}

export function isNodeEnvironment(): boolean {
  return (
    typeof process !== 'undefined' &&
    typeof process.version === 'string' &&
    typeof process.platform === 'string'
  );
}

export function isEdgeRuntime(): boolean {
  return (
    typeof (globalThis as any).EdgeRuntime !== 'undefined' ||
    (typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'edge')
  );
}

export function getProcessInfo(): ProcessInfo {
  return {
    nodeVersion: getNodeVersion(),
    platform: getPlatform(),
    arch: getArchitecture(),
    uptime: getUptime(),
    memoryUsage: getMemoryUsage()
  };
}

function getNodeVersion(): string | null {
  try {
    if (typeof process !== 'undefined') {
      const version = (process as any)?.version;
      return typeof version === 'string' ? version : null;
    }
  } catch {
    // Silently fail
  }
  return null;
}

function getPlatform(): string | null {
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

function getArchitecture(): string | null {
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

function getUptime(): number | null {
  try {
    if (typeof process !== 'undefined' && typeof process.uptime === 'function') {
      return Math.floor(process.uptime());
    }
  } catch {
    // Silently fail
  }
  return null;
}

function getMemoryUsage(): ProcessInfo['memoryUsage'] {
  try {
    if (typeof process !== 'undefined' && typeof process.memoryUsage === 'function') {
      const mem = process.memoryUsage();
      return {
        rss: mem.rss,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed
      };
    }
  } catch {
    // Silently fail
  }
  return null;
}

export function getRuntimeEnvironment(): string {
  if (isEdgeRuntime()) {
    return 'edge';
  }
  
  if (typeof process !== 'undefined') {
    if (process.env.VERCEL) {
      return 'vercel-serverless';
    }
    
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      return 'aws-lambda';
    }
    
    return 'node';
  }

  return 'unknown';
}

// ============================================
// Date / Time Utilities
// ============================================

// Re-export client-safe formatters from lib/utils so server-side callers can also use them
export { formatRelativeTime, fmtVol } from '@/lib/utils';
