-- =====================================================
-- TEST QUERIES FOR DATABASE VALIDATION
-- Run these after migrations to verify everything works
-- =====================================================

-- =====================================================
-- 1. VERIFY TABLES EXIST
-- =====================================================

-- Should return 12 tables
SELECT COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema = 'public';

-- List all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- =====================================================
-- 2. VERIFY INDEXES CREATED
-- =====================================================

-- Should return 40+ indexes
SELECT COUNT(*) as index_count
FROM pg_indexes 
WHERE schemaname = 'public';

-- List indexes by table
SELECT tablename, COUNT(*) as index_count
FROM pg_indexes 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY index_count DESC;

-- =====================================================
-- 3. VERIFY RLS ENABLED
-- =====================================================

-- Should show RLS enabled for user-specific tables
SELECT tablename, rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- =====================================================
-- 4. TEST USER CREATION
-- =====================================================

-- First, get your auth user ID
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- Create a test user (replace 'YOUR_AUTH_USER_ID' with actual ID)
INSERT INTO public.users (id, email, full_name, credits_balance)
VALUES (
  'YOUR_AUTH_USER_ID',  -- Replace with actual auth.users ID
  'test@example.com',
  'Test User',
  100
)
ON CONFLICT (id) DO UPDATE 
SET credits_balance = 100
RETURNING *;

-- Verify user was created
SELECT * FROM public.users;

-- =====================================================
-- 5. TEST CHAT CREATION
-- =====================================================

-- Create a test chat
INSERT INTO public.chats (user_id, title, category)
VALUES (
  'YOUR_AUTH_USER_ID',  -- Replace with actual user ID
  'Test Chat - NBA Betting',
  'betting'
)
RETURNING *;

-- Get user's chats
SELECT * FROM public.chats 
WHERE user_id = 'YOUR_AUTH_USER_ID'
ORDER BY created_at DESC;

-- =====================================================
-- 6. TEST MESSAGE CREATION
-- =====================================================

-- Get chat ID from previous query, then:
INSERT INTO public.messages (
  chat_id, 
  user_id, 
  role, 
  content,
  credits_charged
)
VALUES (
  'YOUR_CHAT_ID',       -- Replace with actual chat ID
  'YOUR_AUTH_USER_ID',  -- Replace with actual user ID
  'user',
  'What are the odds for tonight''s games?',
  0
)
RETURNING *;

-- Add AI response
INSERT INTO public.messages (
  chat_id, 
  user_id, 
  role, 
  content,
  model,
  tokens_used,
  credits_charged,
  trust_score,
  confidence_level
)
VALUES (
  'YOUR_CHAT_ID',       -- Replace with actual chat ID
  'YOUR_AUTH_USER_ID',  -- Replace with actual user ID
  'assistant',
  'Here are tonight''s NBA odds...',
  'grok-beta',
  150,
  5,
  0.8750,
  'high'
)
RETURNING *;

-- Get chat messages
SELECT * FROM public.messages 
WHERE chat_id = 'YOUR_CHAT_ID'
ORDER BY created_at ASC;

-- =====================================================
-- 7. TEST CREDITS SYSTEM
-- =====================================================

-- Check user balance
SELECT id, email, credits_balance, total_credits_spent
FROM public.users 
WHERE id = 'YOUR_AUTH_USER_ID';

-- Manually deduct credits (usually done by trigger)
UPDATE public.users 
SET 
  credits_balance = credits_balance - 5,
  total_credits_spent = total_credits_spent + 5
WHERE id = 'YOUR_AUTH_USER_ID'
RETURNING credits_balance;

-- Log the transaction
INSERT INTO public.credits_ledger (
  user_id,
  amount,
  balance_after,
  transaction_type,
  description
)
VALUES (
  'YOUR_AUTH_USER_ID',
  -5,
  (SELECT credits_balance FROM public.users WHERE id = 'YOUR_AUTH_USER_ID'),
  'message_charge',
  'AI response - Test message'
)
RETURNING *;

-- View credits history
SELECT 
  amount,
  balance_after,
  transaction_type,
  description,
  created_at
FROM public.credits_ledger 
WHERE user_id = 'YOUR_AUTH_USER_ID'
ORDER BY created_at DESC;

-- =====================================================
-- 8. TEST ODDS CACHE
-- =====================================================

-- Insert sample odds
INSERT INTO public.odds_cache (
  sport,
  league,
  event_id,
  event_name,
  commence_time,
  bookmaker,
  market,
  odds_data,
  expires_at
)
VALUES (
  'basketball_nba',
  'NBA',
  'test_event_12345',
  'Lakers @ Warriors',
  NOW() + INTERVAL '2 hours',
  'draftkings',
  'h2h',
  '{"outcomes": [{"name": "Lakers", "price": 150}, {"name": "Warriors", "price": -170}], "last_update": "2026-02-01T22:00:00Z"}'::jsonb,
  NOW() + INTERVAL '5 minutes'
)
RETURNING *;

-- Query cached odds
SELECT 
  event_name,
  bookmaker,
  market,
  odds_data,
  expires_at
FROM public.odds_cache 
WHERE expires_at > NOW()
ORDER BY commence_time ASC;

-- =====================================================
-- 9. TEST PORTFOLIO TRACKING
-- =====================================================

-- Create a test bet position
INSERT INTO public.user_portfolios (
  user_id,
  category,
  position_type,
  event_name,
  entry_details,
  stake_amount,
  potential_return,
  current_value,
  status
)
VALUES (
  'YOUR_AUTH_USER_ID',
  'betting',
  'moneyline',
  'Lakers @ Warriors',
  '{"team": "Lakers", "odds": 150, "bookmaker": "DraftKings"}'::jsonb,
  100.00,
  250.00,
  100.00,
  'active'
)
RETURNING *;

-- View user portfolio
SELECT 
  category,
  position_type,
  event_name,
  stake_amount,
  potential_return,
  current_value,
  status,
  created_at
FROM public.user_portfolios 
WHERE user_id = 'YOUR_AUTH_USER_ID'
ORDER BY created_at DESC;

-- =====================================================
-- 10. TEST FUNCTIONS & TRIGGERS
-- =====================================================

-- Test the deduct_credits function (usually automatic)
SELECT deduct_credits(
  'YOUR_AUTH_USER_ID',
  'YOUR_CHAT_ID',
  5,
  'Test function call'
);

-- Verify balance decreased and ledger was updated
SELECT credits_balance FROM public.users WHERE id = 'YOUR_AUTH_USER_ID';
SELECT * FROM public.credits_ledger WHERE user_id = 'YOUR_AUTH_USER_ID' ORDER BY created_at DESC LIMIT 1;

-- =====================================================
-- 11. CLEANUP TEST DATA (OPTIONAL)
-- =====================================================

-- Remove test odds
DELETE FROM public.odds_cache WHERE event_id = 'test_event_12345';

-- Remove test portfolio entries
-- DELETE FROM public.user_portfolios WHERE user_id = 'YOUR_AUTH_USER_ID';

-- Remove test messages
-- DELETE FROM public.messages WHERE chat_id = 'YOUR_CHAT_ID';

-- Remove test chats
-- DELETE FROM public.chats WHERE user_id = 'YOUR_AUTH_USER_ID';

-- Reset user credits to 100
-- UPDATE public.users SET credits_balance = 100, total_credits_spent = 0 WHERE id = 'YOUR_AUTH_USER_ID';

-- =====================================================
-- 12. PERFORMANCE CHECKS
-- =====================================================

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- =====================================================
-- 13. MONITORING QUERIES
-- =====================================================

-- Active users count
SELECT COUNT(DISTINCT user_id) as active_users
FROM public.chats
WHERE created_at > NOW() - INTERVAL '7 days';

-- Messages per day
SELECT 
  DATE(created_at) as date,
  COUNT(*) as message_count,
  COUNT(DISTINCT user_id) as unique_users
FROM public.messages
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Credits usage stats
SELECT 
  user_id,
  SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as credits_added,
  SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as credits_spent,
  COUNT(*) as total_transactions
FROM public.credits_ledger
GROUP BY user_id;

-- Odds API cache hit rate (estimate)
SELECT 
  sport,
  COUNT(*) as cached_events,
  COUNT(DISTINCT event_id) as unique_events,
  MIN(created_at) as first_cached,
  MAX(created_at) as last_cached
FROM public.odds_cache
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY sport;

-- Portfolio performance
SELECT 
  category,
  COUNT(*) as total_positions,
  SUM(stake_amount) as total_stake,
  SUM(current_value) as current_value,
  SUM(current_value - stake_amount) as net_pl
FROM public.user_portfolios
WHERE user_id = 'YOUR_AUTH_USER_ID'
GROUP BY category;

-- =====================================================
-- NOTES
-- =====================================================

-- Remember to replace:
-- - 'YOUR_AUTH_USER_ID' with your actual auth.users ID
-- - 'YOUR_CHAT_ID' with actual chat ID from inserts
-- 
-- To find your auth user ID:
-- SELECT id FROM auth.users WHERE email = 'your-email@example.com';
--
-- All queries are safe to run multiple times
-- Queries with INSERT use ON CONFLICT for idempotency
