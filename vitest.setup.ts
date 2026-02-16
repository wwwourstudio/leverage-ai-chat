import { beforeAll, afterEach, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Setup before all tests
beforeAll(() => {
  // Set up test environment variables
  Object.assign(process.env, {
    NODE_ENV: 'test',
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    XAI_API_KEY: 'test-xai-key',
    ODDS_API_KEY: 'test-odds-key'
  });
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Teardown after all tests
afterAll(() => {
  // Clean up any resources
});
