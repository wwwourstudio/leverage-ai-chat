-- =====================================================
-- Migration: Functions & Triggers
-- Description: Automated triggers for credits, timestamps, cleanup
-- Date: 2026-02-04
-- =====================================================

-- =====================================================
-- 1. UPDATE TIMESTAMP TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_chats_updated_at
  BEFORE UPDATE ON public.chats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_portfolios_updated_at
  BEFORE UPDATE ON public.user_portfolios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- 2. DEDUCT CREDITS ON MESSAGE INSERT
-- =====================================================
CREATE OR REPLACE FUNCTION public.deduct_credits_on_message()
RETURNS TRIGGER AS $$
DECLARE
  v_credits_cost INTEGER;
  v_user_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Only charge for assistant messages with tokens
  IF NEW.role = 'assistant' AND NEW.credits_charged > 0 THEN
    v_credits_cost := NEW.credits_charged;
    
    -- Get current user balance
    SELECT credits_balance INTO v_user_balance
    FROM public.users
    WHERE id = NEW.user_id;
    
    -- Check sufficient balance
    IF v_user_balance < v_credits_cost THEN
      RAISE EXCEPTION 'Insufficient credits. Balance: %, Required: %', v_user_balance, v_credits_cost;
    END IF;
    
    -- Deduct credits
    v_new_balance := v_user_balance - v_credits_cost;
    
    UPDATE public.users
    SET 
      credits_balance = v_new_balance,
      total_credits_spent = total_credits_spent + v_credits_cost
    WHERE id = NEW.user_id;
    
    -- Log transaction in ledger
    INSERT INTO public.credits_ledger (
      user_id,
      amount,
      balance_after,
      transaction_type,
      description,
      message_id,
      chat_id,
      metadata
    ) VALUES (
      NEW.user_id,
      -v_credits_cost, -- Negative for debit
      v_new_balance,
      'message_charge',
      format('AI response charged %s credits (%s tokens)', v_credits_cost, NEW.tokens_used),
      NEW.id,
      NEW.chat_id,
      jsonb_build_object(
        'model', NEW.model,
        'tokens_used', NEW.tokens_used,
        'credits_charged', v_credits_cost
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deduct_credits_on_message_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_credits_on_message();

-- =====================================================
-- 3. UPDATE CHAT METADATA ON MESSAGE INSERT
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_chat_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chats
  SET 
    last_message_at = NEW.created_at,
    message_count = message_count + 1,
    -- Auto-generate title from first user message
    title = CASE 
      WHEN message_count = 0 AND NEW.role = 'user' THEN 
        LEFT(NEW.content, 50) || CASE WHEN LENGTH(NEW.content) > 50 THEN '...' ELSE '' END
      ELSE title
    END
  WHERE id = NEW.chat_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chat_on_message_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_chat_on_message();

-- =====================================================
-- 4. CREATE USER PROFILE ON AUTH SIGNUP
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    full_name,
    avatar_url,
    credits_balance,
    created_at
  ) VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    100, -- Initial free credits
    NOW()
  );
  
  -- Log initial credit grant
  INSERT INTO public.credits_ledger (
    user_id,
    amount,
    balance_after,
    transaction_type,
    description
  ) VALUES (
    NEW.id,
    100,
    100,
    'grant',
    'Welcome bonus - 100 free credits'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 5. PORTFOLIO VALUE UPDATE LOGGING
-- =====================================================
CREATE OR REPLACE FUNCTION public.log_portfolio_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if value changed
  IF OLD.current_value != NEW.current_value THEN
    INSERT INTO public.portfolio_updates (
      portfolio_id,
      value,
      pnl,
      pnl_percentage,
      change_reason,
      metadata
    ) VALUES (
      NEW.id,
      NEW.current_value,
      NEW.pnl,
      NEW.pnl_percentage,
      'value_update',
      jsonb_build_object(
        'old_value', OLD.current_value,
        'new_value', NEW.current_value,
        'change', NEW.current_value - OLD.current_value
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_portfolio_value_changes
  AFTER UPDATE ON public.user_portfolios
  FOR EACH ROW
  EXECUTE FUNCTION public.log_portfolio_update();

-- =====================================================
-- 6. CLEANUP EXPIRED ODDS FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_odds()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.odds_cache
  WHERE expires_at < NOW() - INTERVAL '1 hour'; -- Keep 1 hour buffer
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. CALCULATE USER STATISTICS FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_statistics(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_chats', COUNT(DISTINCT c.id),
    'total_messages', COUNT(m.id),
    'total_credits_spent', u.total_credits_spent,
    'total_credits_purchased', u.total_credits_purchased,
    'current_balance', u.credits_balance,
    'open_positions', (
      SELECT COUNT(*) 
      FROM public.user_portfolios 
      WHERE user_id = p_user_id AND status = 'open'
    ),
    'total_pnl', (
      SELECT COALESCE(SUM(pnl), 0)
      FROM public.user_portfolios
      WHERE user_id = p_user_id AND status = 'closed'
    ),
    'avg_trust_score', (
      SELECT COALESCE(AVG(trust_score), 0)
      FROM public.messages
      WHERE user_id = p_user_id AND role = 'assistant' AND trust_score IS NOT NULL
    )
  ) INTO v_stats
  FROM public.users u
  LEFT JOIN public.chats c ON c.user_id = u.id
  LEFT JOIN public.messages m ON m.user_id = u.id
  WHERE u.id = p_user_id
  GROUP BY u.id, u.total_credits_spent, u.total_credits_purchased, u.credits_balance;
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON FUNCTION public.deduct_credits_on_message IS 'Automatically deduct credits when AI responds and log to ledger';
COMMENT ON FUNCTION public.update_chat_on_message IS 'Update chat metadata (last_message_at, message_count, auto-title)';
COMMENT ON FUNCTION public.handle_new_user IS 'Create user profile with 100 free credits on signup';
COMMENT ON FUNCTION public.cleanup_expired_odds IS 'Remove expired odds cache entries (run via pg_cron or edge function)';
COMMENT ON FUNCTION public.get_user_statistics IS 'Compute user statistics for dashboard display';
