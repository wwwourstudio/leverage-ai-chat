-- =============================================================================
-- Fix: Mutable search_path on 13 functions + pg_net in public schema
-- Supabase lint issues resolved:
--   • "Extension pg_net is installed in the public schema"
--   • "Function X has a role mutable search_path" (×13)
--
-- Root cause: without SET search_path = '', a SECURITY DEFINER function
-- (or any function) inherits the caller's search_path, enabling an
-- attacker to shadow system or schema objects with malicious ones in a
-- schema they control.
--
-- Fix: add SET search_path = '' to every affected function and fully
-- qualify all object references (schema.object_name).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. pg_net — move from public to extensions schema
-- ---------------------------------------------------------------------------
-- ALTER EXTENSION ... SET SCHEMA is not supported for pg_net.
-- Fix: DROP + CREATE in the target schema.
-- All of pg_net's objects live in the hardcoded "net" schema (net.http_get,
-- net.http_post, net._http_response, net.http_request_queue, etc.) — they
-- are unaffected by the extension namespace change. Only the entry in
-- pg_extension.extnamespace moves from public → extensions.
-- Safe to run when net.http_request_queue is empty (no in-flight requests).
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net SCHEMA extensions;


-- ---------------------------------------------------------------------------
-- 2. api.handle_new_user_profile
--    SECURITY DEFINER trigger called on auth.users INSERT
--    All references already qualified (api.user_profiles)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.handle_new_user_profile()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  INSERT INTO api.user_profiles (user_id, email, display_name, credits_remaining)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    50
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------------
-- 3. api.increment_user_credits
--    SECURITY DEFINER helper — all references already qualified (api.user_credits)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.increment_user_credits(p_user_id uuid, p_amount integer)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = ''
AS $$
  INSERT INTO api.user_credits (user_id, balance, updated_at)
  VALUES (p_user_id, p_amount, now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    balance    = api.user_credits.balance + EXCLUDED.balance,
    updated_at = now();
$$;


-- ---------------------------------------------------------------------------
-- 4. api.set_app_settings_updated_at
--    Trigger — no external table references, just NEW record mutation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.set_app_settings_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------------
-- 5. public.calculate_user_win_rate
--    References public.user_profiles (unqualified before fix)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_user_win_rate(p_user_id uuid)
  RETURNS numeric
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
DECLARE
  win_rate DECIMAL;
BEGIN
  SELECT
    CASE
      WHEN total_predictions > 0
      THEN (correct_predictions::DECIMAL / total_predictions) * 100
      ELSE 0
    END INTO win_rate
  FROM public.user_profiles
  WHERE user_id = p_user_id;

  RETURN COALESCE(win_rate, 0);
END;
$$;


-- ---------------------------------------------------------------------------
-- 6. public.cleanup_expired_odds
--    References 7 sport-specific odds tables — all in public schema
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_expired_odds()
  RETURNS void
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.nba_odds          WHERE expires_at < NOW() - INTERVAL '1 hour';
  DELETE FROM public.nfl_odds          WHERE expires_at < NOW() - INTERVAL '1 hour';
  DELETE FROM public.mlb_odds          WHERE expires_at < NOW() - INTERVAL '1 hour';
  DELETE FROM public.nhl_odds          WHERE expires_at < NOW() - INTERVAL '1 hour';
  DELETE FROM public.ncaab_odds        WHERE expires_at < NOW() - INTERVAL '1 hour';
  DELETE FROM public.ncaaf_odds        WHERE expires_at < NOW() - INTERVAL '1 hour';
  DELETE FROM public.college_baseball_odds WHERE expires_at < NOW() - INTERVAL '1 hour';

  RAISE NOTICE 'Expired odds cleaned up successfully';
END;
$$;


-- ---------------------------------------------------------------------------
-- 7. public.cleanup_expired_odds_cache
--    References public.live_odds_cache (unqualified before fix)
--    NOTE: api.live_odds_cache also exists; this public function targets
--    the public copy, preserving original semantics.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_expired_odds_cache()
  RETURNS integer
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.live_odds_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


-- ---------------------------------------------------------------------------
-- 8. public.conversations_broadcast_trigger
--    SECURITY DEFINER — realtime.broadcast_changes already qualified
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.conversations_broadcast_trigger()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'user:' || COALESCE(NEW.user_id, OLD.user_id)::text || ':conversations',
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;


-- ---------------------------------------------------------------------------
-- 9. public.get_current_auth_user
--    SECURITY DEFINER — auth.uid() already qualified
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_auth_user()
  RETURNS uuid
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT auth.uid();
$$;


-- ---------------------------------------------------------------------------
-- 10. public.messages_broadcast_trigger
--     SECURITY DEFINER — realtime.broadcast_changes already qualified
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.messages_broadcast_trigger()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'room:' || COALESCE(NEW.conversation_id, OLD.conversation_id)::text || ':messages',
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;


-- ---------------------------------------------------------------------------
-- 11. public.room_messages_broadcast_trigger
--     SECURITY DEFINER — realtime.broadcast_changes already qualified
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.room_messages_broadcast_trigger()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'conversation:' || COALESCE(NEW.conversation_id, OLD.conversation_id)::text || ':messages',
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;


-- ---------------------------------------------------------------------------
-- 12. public.update_conversation_on_message
--     References public.conversations (unqualified before fix)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  UPDATE public.conversations
  SET
    message_count  = message_count + 1,
    last_message_at = NEW.created_at,
    preview        = LEFT(NEW.content, 100),
    updated_at     = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------------
-- 13. public.update_updated_at_column
--     Generic updated_at trigger — no external table references
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- =============================================================================
-- Verify: confirm search_path is locked on all patched functions
-- =============================================================================
SELECT
  n.nspname  AS schema,
  p.proname  AS function,
  p.prosecdef AS security_definer,
  pg_catalog.array_to_string(p.proconfig, ', ') AS config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE (n.nspname = 'api'    AND p.proname IN ('handle_new_user_profile','increment_user_credits','set_app_settings_updated_at'))
   OR (n.nspname = 'public' AND p.proname IN ('calculate_user_win_rate','cleanup_expired_odds_cache','cleanup_expired_odds','conversations_broadcast_trigger','get_current_auth_user','messages_broadcast_trigger','room_messages_broadcast_trigger','update_conversation_on_message','update_updated_at_column'))
ORDER BY n.nspname, p.proname;
