-- =====================================================
-- Migration: Portfolio & Odds Schema
-- Description: Odds cache, user portfolios, bet tracking
-- Date: 2026-02-03
-- =====================================================

-- =====================================================
-- 1. ODDS_CACHE TABLE (external API caching)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.odds_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event identification
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  
  -- Odds data
  bookmaker TEXT NOT NULL,
  market_type TEXT NOT NULL, -- 'h2h', 'spreads', 'totals', etc.
  odds_data JSONB NOT NULL,
  
  -- Cache management
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_live BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Metadata
  source TEXT NOT NULL DEFAULT 'the-odds-api',
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Composite unique constraint
  UNIQUE(event_id, bookmaker, market_type, fetched_at)
);

-- Indexes for odds queries
CREATE INDEX IF NOT EXISTS idx_odds_cache_event_id ON public.odds_cache(event_id);
CREATE INDEX IF NOT EXISTS idx_odds_cache_sport ON public.odds_cache(sport);
CREATE INDEX IF NOT EXISTS idx_odds_cache_event_date ON public.odds_cache(event_date);
CREATE INDEX IF NOT EXISTS idx_odds_cache_expires_at ON public.odds_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_odds_cache_is_live ON public.odds_cache(is_live) WHERE is_live = TRUE;
CREATE INDEX IF NOT EXISTS idx_odds_cache_bookmaker ON public.odds_cache(bookmaker);

-- GIN index for odds_data JSONB queries
CREATE INDEX IF NOT EXISTS idx_odds_cache_odds_data ON public.odds_cache USING GIN(odds_data);

-- Partial index for active odds only
CREATE INDEX IF NOT EXISTS idx_odds_cache_active ON public.odds_cache(event_id, bookmaker, market_type) 
  WHERE expires_at > NOW();

-- =====================================================
-- 2. USER_PORTFOLIOS TABLE (bet/position tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Portfolio type
  category TEXT NOT NULL CHECK (category IN ('betting', 'fantasy', 'dfs', 'kalshi')),
  
  -- Position details
  title TEXT NOT NULL,
  description TEXT,
  
  -- Financial tracking
  entry_amount NUMERIC(10, 2) NOT NULL,
  current_value NUMERIC(10, 2) NOT NULL,
  pnl NUMERIC(10, 2) GENERATED ALWAYS AS (current_value - entry_amount) STORED,
  pnl_percentage NUMERIC(6, 2) GENERATED ALWAYS AS (
    CASE 
      WHEN entry_amount > 0 THEN ((current_value - entry_amount) / entry_amount * 100)
      ELSE 0
    END
  ) STORED,
  
  -- Status tracking
  status TEXT NOT NULL CHECK (status IN ('open', 'closed', 'pending', 'cancelled')) DEFAULT 'open',
  
  -- Related entities
  event_id TEXT,
  bookmaker TEXT,
  market_type TEXT,
  odds_at_entry NUMERIC(8, 3),
  
  -- Position data
  position_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for portfolio queries
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON public.user_portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_category ON public.user_portfolios(category);
CREATE INDEX IF NOT EXISTS idx_portfolios_status ON public.user_portfolios(status);
CREATE INDEX IF NOT EXISTS idx_portfolios_user_category ON public.user_portfolios(user_id, category);
CREATE INDEX IF NOT EXISTS idx_portfolios_user_status ON public.user_portfolios(user_id, status);
CREATE INDEX IF NOT EXISTS idx_portfolios_created_at ON public.user_portfolios(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portfolios_event_id ON public.user_portfolios(event_id) WHERE event_id IS NOT NULL;

-- GIN index for position_data
CREATE INDEX IF NOT EXISTS idx_portfolios_position_data ON public.user_portfolios USING GIN(position_data);

-- =====================================================
-- 3. PORTFOLIO_UPDATES TABLE (value changes over time)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.portfolio_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.user_portfolios(id) ON DELETE CASCADE,
  
  -- Value snapshot
  value NUMERIC(10, 2) NOT NULL,
  pnl NUMERIC(10, 2) NOT NULL,
  pnl_percentage NUMERIC(6, 2) NOT NULL,
  
  -- Change tracking
  change_reason TEXT, -- 'odds_update', 'manual_update', 'settlement', etc.
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for portfolio update queries
CREATE INDEX IF NOT EXISTS idx_portfolio_updates_portfolio_id ON public.portfolio_updates(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_updates_created_at ON public.portfolio_updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_updates_portfolio_created ON public.portfolio_updates(portfolio_id, created_at DESC);

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE public.odds_cache IS 'Cached odds from The Odds API with TTL expiration';
COMMENT ON TABLE public.user_portfolios IS 'User bet positions and fantasy lineups with P&L tracking';
COMMENT ON TABLE public.portfolio_updates IS 'Time-series snapshots of portfolio value changes';

COMMENT ON COLUMN public.odds_cache.expires_at IS 'TTL expiration - cleanup after this time';
COMMENT ON COLUMN public.odds_cache.is_live IS 'TRUE for in-play/live betting odds';
COMMENT ON COLUMN public.user_portfolios.pnl IS 'Profit/Loss (current_value - entry_amount) - computed column';
COMMENT ON COLUMN public.user_portfolios.pnl_percentage IS 'P&L as percentage - computed column';
