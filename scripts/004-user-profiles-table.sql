-- ============================================================
-- Migration 004: Create user_profiles and user_preferences tables
-- Run in Supabase SQL Editor to fix 404 errors on user profile queries
-- ============================================================

-- ============================================================
-- 1. user_profiles table
--    Stores per-user profile data referenced throughout the app UI
-- ============================================================
CREATE TABLE IF NOT EXISTS api.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,  -- auth.users.id
  email text,
  display_name text,
  credits_remaining integer DEFAULT 50,
  total_predictions integer DEFAULT 0,
  correct_predictions integer DEFAULT 0,
  win_rate numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- 2. user_preferences table
--    Stores per-user preferences (notifications, sports, theme)
-- ============================================================
CREATE TABLE IF NOT EXISTS api.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,  -- auth.users.id
  email_notifications boolean DEFAULT true,
  push_notifications boolean DEFAULT false,
  tracked_sports text[] DEFAULT ARRAY['NBA', 'NFL'],
  theme text DEFAULT 'dark',
  default_sport text DEFAULT 'NBA',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- 3. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON api.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON api.user_preferences(user_id);

-- ============================================================
-- 4. RLS (Row Level Security)
-- ============================================================
ALTER TABLE api.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read and update only their own profile
CREATE POLICY "Users read own profile"
  ON api.user_profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users update own profile"
  ON api.user_profiles FOR UPDATE
  USING (user_id = auth.uid());

-- Service role can insert (on signup)
CREATE POLICY "Service inserts profiles"
  ON api.user_profiles FOR INSERT
  WITH CHECK (true);

-- Users can read and update only their own preferences
CREATE POLICY "Users read own preferences"
  ON api.user_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users upsert own preferences"
  ON api.user_preferences FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role can insert (on signup)
CREATE POLICY "Service inserts preferences"
  ON api.user_preferences FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 5. Auto-create user_profiles row on auth signup
-- ============================================================
CREATE OR REPLACE FUNCTION api.handle_new_user_profile()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach the trigger (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_profile'
  ) THEN
    CREATE TRIGGER on_auth_user_created_profile
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION api.handle_new_user_profile();
  END IF;
END;
$$;

-- ============================================================
-- 6. Backfill: create user_profiles rows for existing auth users
--    (safe to run multiple times due to ON CONFLICT DO NOTHING)
-- ============================================================
INSERT INTO api.user_profiles (user_id, email, display_name, credits_remaining)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  50
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- 7. Grant access
-- ============================================================
GRANT ALL ON api.user_profiles TO anon, authenticated;
GRANT ALL ON api.user_preferences TO anon, authenticated;
