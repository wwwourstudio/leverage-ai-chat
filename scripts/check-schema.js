import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Supabase URL:', url);
console.log('Key present:', !!key);

// Test with default (public) schema
const supabasePublic = createClient(url, key);

// Test with api schema
const supabaseApi = createClient(url, key, {
  db: { schema: 'api' }
});

async function main() {
  console.log('\n--- Test 1: Default (public) schema ---');
  try {
    const { data, error } = await supabasePublic.from('live_odds_cache').select('*').limit(1);
    if (error) {
      console.log('Error on public schema:', error.message, error.hint);
    } else {
      console.log('Public schema works! Data:', data);
    }
  } catch (e) {
    console.log('Exception:', e.message);
  }

  console.log('\n--- Test 2: api schema ---');
  try {
    const { data, error } = await supabaseApi.from('live_odds_cache').select('*').limit(1);
    if (error) {
      console.log('Error on api schema:', error.message, error.hint);
    } else {
      console.log('API schema works! Data:', data);
    }
  } catch (e) {
    console.log('Exception:', e.message);
  }

  // Try listing tables in api schema by querying a known RPC or just trying different table names
  console.log('\n--- Test 3: Check common table names in api schema ---');
  const tableNames = ['users', 'profiles', 'chats', 'messages', 'odds', 'live_odds_cache', 'analysis', 'settings'];
  for (const table of tableNames) {
    const { data, error } = await supabaseApi.from(table).select('*').limit(1);
    if (error) {
      console.log(`  ${table}: ${error.code} - ${error.message}`);
    } else {
      console.log(`  ${table}: EXISTS (${data?.length || 0} rows)`);
    }
  }
}

main().catch(console.error);
