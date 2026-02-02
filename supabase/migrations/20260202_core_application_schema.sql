-- =====================================================
-- Migration: Core Application Schema
-- Description: Users, chats, messages, credits ledger
-- Date: 2026-02-02
-- =====================================================

-- =====================================================
-- 1. USERS TABLE (extends auth.users)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  credits_balance INTEGER NOT NULL DEFAULT 100,
  total_credits_purchased INTEGER NOT NULL DEFAULT 0,
  total_credits_spent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  preferences JSONB DEFAULT '{
    "notifications": true,
    "default_category": "betting",
    "theme": "dark"
  }'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at DESC);

-- =====================================================
-- 2. CHATS TABLE (conversations)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  category TEXT NOT NULL CHECK (category IN ('betting', 'fantasy', 'dfs', 'kalshi', 'general')),
  is_starred BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  message_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON public.chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_category ON public.chats(category);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON public.chats(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_user_category ON public.chats(user_id, category);
CREATE INDEX IF NOT EXISTS idx_chats_starred ON public.chats(user_id, is_starred) WHERE is_starred = TRUE;

-- =====================================================
-- 3. MESSAGES TABLE (chat history)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- AI-specific fields
  model TEXT,
  tokens_used INTEGER,
  credits_charged INTEGER DEFAULT 0,
  
  -- Trust & validation
  trust_score NUMERIC(5, 4),
  confidence_level TEXT CHECK (confidence_level IN ('very_high', 'high', 'medium', 'low', 'very_low')),
  validation_status TEXT CHECK (validation_status IN ('pending', 'validated', 'flagged', 'failed')),
  validation_details JSONB,
  
  -- Attachments & context
  attachments JSONB DEFAULT '[]'::jsonb,
  context_data JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON public.messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_role ON public.messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_trust_score ON public.messages(trust_score DESC NULLS LAST);

-- GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_messages_context_data ON public.messages USING GIN(context_data);
CREATE INDEX IF NOT EXISTS idx_messages_validation_details ON public.messages USING GIN(validation_details);

-- =====================================================
-- 4. CREDITS_LEDGER TABLE (transaction log)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.credits_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Positive for credit, negative for debit
  balance_after INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'purchase',
    'grant',
    'refund',
    'message_charge',
    'bonus',
    'deduction'
  )),
  description TEXT NOT NULL,
  
  -- Related entities
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  chat_id UUID REFERENCES public.chats(id) ON DELETE SET NULL,
  
  -- Transaction metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for ledger queries
CREATE INDEX IF NOT EXISTS idx_credits_ledger_user_id ON public.credits_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_ledger_created_at ON public.credits_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credits_ledger_user_created ON public.credits_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credits_ledger_transaction_type ON public.credits_ledger(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credits_ledger_message_id ON public.credits_ledger(message_id) WHERE message_id IS NOT NULL;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE public.users IS 'User profiles extending auth.users with credits and preferences';
COMMENT ON TABLE public.chats IS 'Chat conversations categorized by betting/fantasy/DFS/Kalshi';
COMMENT ON TABLE public.messages IS 'Chat messages with AI trust scores and validation';
COMMENT ON TABLE public.credits_ledger IS 'Immutable transaction log for credits with running balance';

COMMENT ON COLUMN public.messages.trust_score IS 'Overall trust score (0.0000 to 1.0000)';
COMMENT ON COLUMN public.messages.confidence_level IS 'Human-readable confidence level';
COMMENT ON COLUMN public.messages.validation_status IS 'Validation state from edge function';
COMMENT ON COLUMN public.credits_ledger.amount IS 'Positive = credit added, Negative = credit spent';
COMMENT ON COLUMN public.credits_ledger.balance_after IS 'Snapshot of balance after this transaction';
