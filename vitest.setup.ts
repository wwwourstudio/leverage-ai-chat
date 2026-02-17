import { beforeAll, afterEach } from 'vitest';

// Setup test environment variables before all tests
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  
  // Supabase
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  
  // API Keys
  process.env.XAI_API_KEY = 'test-xai-key';
  process.env.ODDS_API_KEY = 'test-odds-key';
  process.env.WEATHER_API_KEY = 'test-weather-key';
  process.env.KALSHI_API_KEY = 'test-kalshi-key';
  process.env.KALSHI_SECRET = 'test-kalshi-secret';
});

// Clean up after each test
afterEach(() => {
  // Clear any mocks or timers if needed
  vi.clearAllMocks();
});
