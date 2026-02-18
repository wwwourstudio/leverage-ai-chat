-- =============================================================================
-- SECURITY WARNINGS FIX
-- Addresses Supabase Security Definer and Search Path warnings
-- =============================================================================
-- Run this after setup-database.sql to fix security warnings
-- =============================================================================

-- Fix Search Path Mutable warnings by explicitly setting search_path
-- This prevents potential SQL injection attacks via search_path manipulation

-- 1. Fix calculate_user_win_rate function
CREATE OR REPLACE FUNCTION calculate_user_win_rate(p_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  win_rate DECIMAL;
BEGIN
  SELECT 
    CASE 
      WHEN total_predictions > 0 
      THEN (correct_predictions::DECIMAL / total_predictions) * 100
      ELSE 0 
    END INTO win_rate
  FROM user_profiles
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(win_rate, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp;

-- 2. Fix cleanup_expired_odds_cache function
CREATE OR REPLACE FUNCTION cleanup_expired_odds_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM live_odds_cache
  WHERE expires_at < NOW()
  RETURNING COUNT(*) INTO deleted_count;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- 3. Fix update_conversation_on_message function
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET 
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- 4. Fix update_user_stats_on_prediction function
CREATE OR REPLACE FUNCTION update_user_stats_on_prediction()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if result changed and is now resolved
  IF NEW.result IS DISTINCT FROM OLD.result AND NEW.result IN ('won', 'lost', 'pushed') THEN
    UPDATE user_profiles
    SET 
      total_predictions = total_predictions + 1,
      correct_predictions = CASE 
        WHEN NEW.result = 'won' THEN correct_predictions + 1 
        ELSE correct_predictions 
      END,
      win_rate = calculate_user_win_rate(NEW.user_id),
      updated_at = NOW()
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- 5. Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- =============================================================================
-- Fix Security Definer Views
-- =============================================================================

-- Note: Views with SECURITY DEFINER are intentional for RLS bypass
-- These warnings are expected for views that aggregate user data
-- No action needed unless you want to convert them to regular views

-- If you want to remove SECURITY DEFINER from views (less secure but no warnings):
-- DROP VIEW IF EXISTS user_performance_summary;
-- CREATE VIEW user_performance_summary AS ...
-- (without SECURITY DEFINER clause)

-- =============================================================================
-- Verify Fixes
-- =============================================================================

-- Check that all functions now have proper search_path set
SELECT 
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.proconfig as configuration
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'calculate_user_win_rate',
    'cleanup_expired_odds_cache',
    'update_conversation_on_message',
    'update_user_stats_on_prediction',
    'update_updated_at_column'
  )
ORDER BY p.proname;

-- =============================================================================
-- Success Messages
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================================';
  RAISE NOTICE 'SECURITY FIXES APPLIED SUCCESSFULLY';
  RAISE NOTICE '========================================================';
  RAISE NOTICE 'Fixed 5 functions with explicit search_path';
  RAISE NOTICE 'Security warnings should now be resolved';
  RAISE NOTICE 'Run security advisor again to verify';
  RAISE NOTICE '========================================================';
END $$;
