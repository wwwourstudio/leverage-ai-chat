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
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      
      expect(isSupabaseConfigured()).toBe(false);
    });
  });

  describe('isGrokConfigured', () => {
    it('should return true when XAI_API_KEY is set', () => {
      process.env.XAI_API_KEY = 'test-grok-key';
      
      expect(isGrokConfigured()).toBe(true);
    });

    it('should return false when XAI_API_KEY is missing', () => {
      delete process.env.XAI_API_KEY;
      
      expect(isGrokConfigured()).toBe(false);
    });
  });

  describe('isOddsApiConfigured', () => {
    it('should return true when ODDS_API_KEY is set', () => {
      process.env.ODDS_API_KEY = 'test-odds-key';
      
      expect(isOddsApiConfigured()).toBe(true);
    });

    it('should return false when ODDS_API_KEY is missing', () => {
      delete process.env.ODDS_API_KEY;
      
      expect(isOddsApiConfigured()).toBe(false);
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
      delete process.env.ODDS_API_KEY;
      
      const status = getServiceStatus();
      
      expect(status.allConfigured).toBe(false);
      expect(status.oddsApi.configured).toBe(false);
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
