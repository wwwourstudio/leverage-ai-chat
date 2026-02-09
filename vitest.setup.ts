import { beforeAll, afterEach, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Setup before all tests
beforeAll(() => {
  // Set up test environment variables
  process.env.NODE_ENV = 'test';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  process.env.XAI_API_KEY = 'test-xai-key';
  process.env.ODDS_API_KEY = 'test-odds-key';
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Teardown after all tests
afterAll(() => {
  // Clean up any resources
});
