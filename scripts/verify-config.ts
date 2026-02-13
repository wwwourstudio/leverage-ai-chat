/**
 * Configuration Verification Script
 * Run this to verify all APIs are properly configured
 */

console.log('\n🔍 Verifying Leverage AI Configuration...\n');

// Check Grok 4 Fast (xAI)
const xaiKey = process.env.XAI_API_KEY;
console.log(`🤖 Grok 4 Fast (xAI): ${xaiKey ? '✅ Configured' : '❌ Missing XAI_API_KEY'}`);
if (!xaiKey) {
  console.log('   ℹ️  Get your API key from: https://console.x.ai/');
}

// Check The Odds API
const oddsKey = process.env.ODDS_API_KEY;
console.log(`📊 The Odds API: ${oddsKey ? '✅ Configured' : '❌ Missing ODDS_API_KEY'}`);
if (!oddsKey) {
  console.log('   ℹ️  Get your API key from: https://the-odds-api.com/');
}

// Check Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
console.log(`📦 Supabase: ${supabaseUrl && supabaseKey ? '✅ Configured' : '❌ Missing credentials'}`);
if (!supabaseUrl || !supabaseKey) {
  console.log('   ℹ️  Set up Supabase integration in Vercel dashboard');
}

// Check Weather API (Open-Meteo - no key required)
console.log(`🌤️  Weather API: ✅ Open-Meteo (no key required)`);

// Overall status
const allConfigured = xaiKey && oddsKey && supabaseUrl && supabaseKey;
console.log(`\n${'='.repeat(50)}`);
if (allConfigured) {
  console.log('✅ All services configured correctly!');
  console.log('🚀 Your app is ready for production use.');
} else {
  console.log('⚠️  Some services need configuration.');
  console.log('📝 Add missing environment variables in Vercel dashboard.');
}
console.log(`${'='.repeat(50)}\n`);

export {};
