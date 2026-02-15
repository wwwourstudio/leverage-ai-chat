/**
 * Integration Testing Script
 * Tests all API endpoints and integrations
 * Run with: npx tsx scripts/test-integration.ts
 */

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

class APITester {
  private baseUrl: string;
  private results: TestResult[] = [];

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  private async runTest(
    name: string,
    testFn: () => Promise<void>
  ): Promise<void> {
    const startTime = Date.now();
    console.log(`\n🧪 Testing: ${name}`);

    try {
      await testFn();
      const duration = Date.now() - startTime;
      this.results.push({ name, passed: true, duration });
      console.log(`✅ PASSED (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.results.push({ name, passed: false, duration, error: errorMessage });
      console.log(`❌ FAILED (${duration}ms): ${errorMessage}`);
    }
  }

  async testHealthEndpoint(): Promise<void> {
    await this.runTest('Health Check API', async () => {
      const response = await fetch(`${this.baseUrl}/api/health`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (!data.status) {
        throw new Error('Invalid response format');
      }
      console.log(`   Status: ${data.status}`);
      console.log(`   Services: ${Object.keys(data.services || {}).join(', ')}`);
    });
  }

  async testOddsAPI(): Promise<void> {
    await this.runTest('Odds API - NBA', async () => {
      const response = await fetch(`${this.baseUrl}/api/odds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport: 'nba', marketType: 'h2h' }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log(`   Events: ${data.events?.length || 0}`);
      console.log(`   Sport: ${data.sport}`);
    });
  }

  async testWeatherAPI(): Promise<void> {
    await this.runTest('Weather API', async () => {
      const response = await fetch(`${this.baseUrl}/api/weather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeTeam: 'Buffalo Bills',
          awayTeam: 'Kansas City Chiefs',
          gameTime: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }
      console.log(`   Location: ${data.card?.data?.location || 'N/A'}`);
      console.log(`   Temperature: ${data.card?.data?.temperature || 'N/A'}`);
    });
  }

  async testCardsAPI(): Promise<void> {
    await this.runTest('Cards API - Betting', async () => {
      const response = await fetch(`${this.baseUrl}/api/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'betting',
          sport: 'nba',
          limit: 3,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }
      console.log(`   Cards: ${data.cards?.length || 0}`);
      console.log(`   Sources: ${data.dataSources?.join(', ') || 'N/A'}`);
    });
  }

  async testSupabaseConnection(): Promise<void> {
    await this.runTest('Supabase Connection', async () => {
      // Test via admin stats endpoint
      const response = await fetch(`${this.baseUrl}/api/admin/stats`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Database connection failed');
      }

      const stats = data.oddsStats || {};
      const totalRecords = Object.values(stats).reduce(
        (sum: number, stat: any) => sum + (stat.totalRecords || 0),
        0
      );

      console.log(`   Total records: ${totalRecords}`);
      console.log(`   Sports tracked: ${Object.keys(stats).length}`);
    });
  }

  async testOddsAPIAllSports(): Promise<void> {
    const sports = ['nba', 'nfl', 'nhl', 'mlb'];

    for (const sport of sports) {
      await this.runTest(`Odds API - ${sport.toUpperCase()}`, async () => {
        const response = await fetch(`${this.baseUrl}/api/odds`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sport, marketType: 'h2h' }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log(`   Events: ${data.events?.length || 0}`);
      });
    }
  }

  printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));

    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;
    const total = this.results.length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`\nTotal Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);

    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`   - ${r.name}: ${r.error}`);
        });
    }

    console.log('\n' + '='.repeat(60));

    if (failed === 0) {
      console.log('✨ All tests passed!');
    } else {
      console.log(`⚠️  ${failed} test(s) failed`);
      process.exit(1);
    }
  }

  async runAll(): Promise<void> {
    console.log('🚀 Starting Integration Tests...');
    console.log(`Base URL: ${this.baseUrl}\n`);

    await this.testHealthEndpoint();
    await this.testSupabaseConnection();
    await this.testOddsAPI();
    await this.testWeatherAPI();
    await this.testCardsAPI();
    await this.testOddsAPIAllSports();

    this.printSummary();
  }
}

// Run tests
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const tester = new APITester(baseUrl);

tester.runAll().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
