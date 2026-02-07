/// <reference types="node" />

/**
 * Dynamic Configuration System
 * Fetches configuration values from Supabase instead of hardcoding
 */

import { createClient } from '@supabase/supabase-js';
import { ENV_KEYS, LOG_PREFIXES } from '@/lib/constants';
import { safeQuery, APP_TABLES } from '@/lib/supabase-validator';

// Cache for configuration to avoid excessive database queries
const configCache = new Map<string, { value: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface AppConfig {
  key: string;
  value: any;
  category: string;
  description?: string;
  updated_at?: string;
}

interface UserProfile {
  user_id: string;
  total_invested?: number;
  win_rate?: number;
  roi?: number;
  active_contests?: number;
  preferences?: Record<string, any>;
}

/**
 * Get Supabase client
 */
function getSupabaseClient() {
  const supabaseUrl = process.env[ENV_KEYS.SUPABASE_URL];
  const supabaseKey = process.env[ENV_KEYS.SUPABASE_ANON_KEY];
  
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Fetch configuration value from database
 */
export async function getConfig(
  key: string,
  defaultValue: any,
  category: string = 'general'
): Promise<any> {
  // Check cache first
  const cached = configCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log(`${LOG_PREFIXES.CONFIG} Supabase not configured, using default for ${key}`);
    return defaultValue;
  }

  try {
    const queryResult = await safeQuery<AppConfig>(
      supabase,
      'app_config',
      (builder) => builder
        .select('*')
        .eq('key', key)
        .eq('category', category)
        .single(),
      {
        defaultValue: undefined,
        logErrors: false
      }
    );

    if (queryResult.success && queryResult.data) {
      const value = queryResult.data.value;
      configCache.set(key, { value, timestamp: Date.now() });
      console.log(`${LOG_PREFIXES.CONFIG} Loaded config ${key}:`, value);
      return value;
    }

    // Fall back to default
    console.log(`${LOG_PREFIXES.CONFIG} Config ${key} not found, using default:`, defaultValue);
    return defaultValue;
  } catch (error) {
    console.log(`${LOG_PREFIXES.CONFIG} Error fetching config ${key}:`, error);
    return defaultValue;
  }
}

/**
 * Fetch multiple configuration values at once
 */
export async function getConfigs(
  keys: Array<{ key: string; defaultValue: any; category?: string }>
): Promise<Record<string, any>> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const result: Record<string, any> = {};
    keys.forEach(({ key, defaultValue }) => {
      result[key] = defaultValue;
    });
    return result;
  }

  try {
    const allKeys = keys.map(k => k.key);
    const queryResult = await safeQuery<AppConfig>(
      supabase,
      'app_config',
      (builder) => builder
        .select('*')
        .in('key', allKeys),
      {
        defaultValue: [],
        logErrors: false
      }
    );

    const result: Record<string, any> = {};
    
    keys.forEach(({ key, defaultValue }) => {
      const configData = Array.isArray(queryResult.data) 
        ? queryResult.data.find((c: AppConfig) => c.key === key)
        : undefined;
      result[key] = configData ? configData.value : defaultValue;
      
      // Cache it
      if (configData) {
        configCache.set(key, { value: configData.value, timestamp: Date.now() });
      }
    });

    return result;
  } catch (error) {
    console.log(`${LOG_PREFIXES.CONFIG} Error fetching configs:`, error);
    const result: Record<string, any> = {};
    keys.forEach(({ key, defaultValue }) => {
      result[key] = defaultValue;
    });
    return result;
  }
}

/**
 * Fetch user profile data
 */
export async function getUserProfile(
  userId: string
): Promise<UserProfile | null> {
  const supabase = getSupabaseClient();
  if (!supabase || !userId) {
    return null;
  }

  try {
    const queryResult = await safeQuery<UserProfile>(
      supabase,
      'user_profiles',
      (builder) => builder
        .select('*')
        .eq('user_id', userId)
        .single(),
      {
        defaultValue: undefined,
        logErrors: false
      }
    );

    if (queryResult.success && queryResult.data) {
      return queryResult.data;
    }

    return null;
  } catch (error) {
    console.log(`${LOG_PREFIXES.CONFIG} Error fetching user profile:`, error);
    return null;
  }
}

/**
 * Fetch dynamic welcome messages from database
 */
export async function getWelcomeMessages(): Promise<Record<string, string>> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {};
  }

  try {
    const queryResult = await safeQuery<AppConfig>(
      supabase,
      'app_config',
      (builder) => builder
        .select('*')
        .eq('category', 'welcome_messages'),
      {
        defaultValue: [],
        logErrors: false
      }
    );

    if (queryResult.success && Array.isArray(queryResult.data)) {
      const messages: Record<string, string> = {};
      queryResult.data.forEach((config: AppConfig) => {
        messages[config.key] = config.value;
      });
      return messages;
    }

    return {};
  } catch (error) {
    console.log(`${LOG_PREFIXES.CONFIG} Error fetching welcome messages:`, error);
    return {};
  }
}

/**
 * Clear configuration cache (useful for testing or after updates)
 */
export function clearConfigCache() {
  configCache.clear();
  console.log(`${LOG_PREFIXES.CONFIG} Configuration cache cleared`);
}
