-- =====================================================
-- Migration: Row Level Security Policies
-- Description: User data isolation and access control
-- Date: 2026-02-05
-- =====================================================

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odds_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_updates ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 1. USERS TABLE POLICIES
-- =====================================================
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Service role has full access
CREATE POLICY "Service role full access to users"
  ON public.users
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 2. CHATS TABLE POLICIES
-- =====================================================
-- Users can view their own chats
CREATE POLICY "Users can view own chats"
  ON public.chats
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own chats
CREATE POLICY "Users can create own chats"
  ON public.chats
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own chats
CREATE POLICY "Users can update own chats"
  ON public.chats
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own chats
CREATE POLICY "Users can delete own chats"
  ON public.chats
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role full access to chats"
  ON public.chats
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 3. MESSAGES TABLE POLICIES
-- =====================================================
-- Users can view messages from their chats
CREATE POLICY "Users can view own messages"
  ON public.messages
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM public.chats 
      WHERE chats.id = messages.chat_id 
      AND chats.user_id = auth.uid()
    )
  );

-- Users can insert messages in their own chats
CREATE POLICY "Users can insert messages in own chats"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = chat_id
      AND chats.user_id = auth.uid()
    )
  );

-- Service role full access (for AI responses)
CREATE POLICY "Service role full access to messages"
  ON public.messages
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 4. CREDITS_LEDGER TABLE POLICIES
-- =====================================================
-- Users can view their own credit transactions
CREATE POLICY "Users can view own credit transactions"
  ON public.credits_ledger
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert/update ledger
CREATE POLICY "Service role full access to credits_ledger"
  ON public.credits_ledger
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 5. ODDS_CACHE TABLE POLICIES (PUBLIC READ)
-- =====================================================
-- All authenticated users can read odds cache
CREATE POLICY "Authenticated users can view odds cache"
  ON public.odds_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can modify odds cache
CREATE POLICY "Service role full access to odds_cache"
  ON public.odds_cache
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 6. USER_PORTFOLIOS TABLE POLICIES
-- =====================================================
-- Users can view their own portfolios
CREATE POLICY "Users can view own portfolios"
  ON public.user_portfolios
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own portfolios
CREATE POLICY "Users can create own portfolios"
  ON public.user_portfolios
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own portfolios
CREATE POLICY "Users can update own portfolios"
  ON public.user_portfolios
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own portfolios
CREATE POLICY "Users can delete own portfolios"
  ON public.user_portfolios
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role full access to portfolios"
  ON public.user_portfolios
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 7. PORTFOLIO_UPDATES TABLE POLICIES
-- =====================================================
-- Users can view updates for their own portfolios
CREATE POLICY "Users can view own portfolio updates"
  ON public.portfolio_updates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_portfolios
      WHERE user_portfolios.id = portfolio_updates.portfolio_id
      AND user_portfolios.user_id = auth.uid()
    )
  );

-- Only service role and triggers can insert updates
CREATE POLICY "Service role full access to portfolio_updates"
  ON public.portfolio_updates
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Grant sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Grant function execution
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON POLICY "Users can view own profile" ON public.users IS 'Users can only see their own user record';
COMMENT ON POLICY "Users can view own messages" ON public.messages IS 'Users can view messages in their own chats';
COMMENT ON POLICY "Authenticated users can view odds cache" ON public.odds_cache IS 'Odds cache is public read for all authenticated users';
COMMENT ON POLICY "Service role full access to credits_ledger" ON public.credits_ledger IS 'Credits ledger is immutable - only service role can write';
