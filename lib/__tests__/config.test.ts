/**
 * Unit Tests for Config Module
 * Tests environment configuration and service status checks
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  isSupabaseConfigured,
  isGrokConfigured,
  isOddsApiConfigured,
  getServiceStatus,
  formatServiceStatus
} from '../config';

describe('Config Module', () => {
  describe('isSupabaseConfigured', () => {
    it('should return true when all Supabase env vars are set', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
      
      expect(isSupabaseConfigured()).toBe(true);
    });

  it('should return false when Supabase env vars are missing', () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = undefined;
    
    expect(isSupabaseConfigured()).toBe(false);
    
    // Restore original value
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  });
  });

  describe('isGrokConfigured', () => {
    it('should return true when XAI_API_KEY is set', () => {
      process.env.XAI_API_KEY = 'test-grok-key';
      
      expect(isGrokConfigured()).toBe(true);
    });

  it('should return false when XAI_API_KEY is missing', () => {
    const originalKey = process.env.XAI_API_KEY;
    process.env.XAI_API_KEY = undefined;
    
    expect(isGrokConfigured()).toBe(false);
    
    // Restore original value
    process.env.XAI_API_KEY = originalKey;
  });
  });

  describe('isOddsApiConfigured', () => {
    it('should return true when ODDS_API_KEY is set', () => {
      process.env.ODDS_API_KEY = 'test-odds-key';
      
      expect(isOddsApiConfigured()).toBe(true);
    });

  it('should return false when ODDS_API_KEY is missing', () => {
    const originalKey = process.env.ODDS_API_KEY;
    process.env.ODDS_API_KEY = undefined;
    
    expect(isOddsApiConfigured()).toBe(false);
    
    // Restore original value
    process.env.ODDS_API_KEY = originalKey;
  });
  });

  describe('getServiceStatus', () => {
    beforeEach(() => {
      // Setup complete environment
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
      process.env.XAI_API_KEY = 'test-grok-key';
      process.env.ODDS_API_KEY = 'test-odds-key';
    });

    it('should return status for all services', () => {
      const status = getServiceStatus();
      
      expect(status).toHaveProperty('supabase');
      expect(status).toHaveProperty('grok');
      expect(status).toHaveProperty('oddsApi');
      expect(status).toHaveProperty('allConfigured');
    });

    it('should mark allConfigured as true when all services are ready', () => {
      const status = getServiceStatus();
      
      expect(status.allConfigured).toBe(true);
    });

  it('should mark allConfigured as false when any service is missing', () => {
    const originalKey = process.env.ODDS_API_KEY;
    process.env.ODDS_API_KEY = undefined;
    
    const status = getServiceStatus();
    
    expect(status.allConfigured).toBe(false);
    expect(status.oddsApi.configured).toBe(false);
    
    // Restore original value
    process.env.ODDS_API_KEY = originalKey;
  });
  });

  describe('formatServiceStatus', () => {
    it('should format service status as readable string', () => {
      const status = getServiceStatus();
      const formatted = formatServiceStatus(status);
      
      expect(formatted).toContain('Supabase');
      expect(formatted).toContain('Grok AI');
      expect(formatted).toContain('Odds API');
    });

    it('should indicate configured services correctly', () => {
      process.env.XAI_API_KEY = 'test-key';
      const status = getServiceStatus();
      const formatted = formatServiceStatus(status);
      
      expect(formatted).toMatch(/Grok AI:.*Configured/);
    });
  });
});
