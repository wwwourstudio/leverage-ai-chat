-- User Authentication and Profile Management Migration
-- Created: 2026-02-09
-- Purpose: Set up user authentication, profiles, and session management

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Profiles Table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  
  -- Preferences
  preferred_sports TEXT[] DEFAULT ARRAY['nfl', 'nba']::TEXT[],
  preferred_platforms TEXT[] DEFAULT ARRAY['betting', 'dfs']::TEXT[],
  default_market_type TEXT DEFAULT 'h2h',
  notification_preferences JSONB DEFAULT '{
    "email": true,
    "value_opportunities": true,
    "prediction_results": true
  }'::JSONB,
  
  -- Usage tracking
  total_queries INTEGER DEFAULT 0,
  total_predictions INTEGER DEFAULT 0,
  api_usage_quota INTEGER DEFAULT 1000,
  api_usage_reset_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 month',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session History Table (stores conversation history)
CREATE TABLE IF NOT EXISTS public.session_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  
  -- Session data
  messages JSONB NOT NULL DEFAULT '[]'::JSONB,
  context JSONB DEFAULT '{}'::JSONB,
  analysis_type TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

-- API Usage Tracking Table
CREATE TABLE IF NOT EXISTS public.api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- API call details
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  
  -- Request metadata
  request_body JSONB,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_session_history_user_id ON public.session_history(user_id);
CREATE INDEX IF NOT EXISTS idx_session_history_session_id ON public.session_history(session_id);
CREATE INDEX IF NOT EXISTS idx_session_history_created_at ON public.session_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON public.api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON public.api_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON public.api_usage(endpoint);

-- Row Level Security (RLS) Policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- User Profiles RLS Policies
CREATE POLICY "Users can view their own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Session History RLS Policies
CREATE POLICY "Users can view their own sessions"
  ON public.session_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
  ON public.session_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON public.session_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
  ON public.session_history FOR DELETE
  USING (auth.uid() = user_id);

-- API Usage RLS Policies
CREATE POLICY "Users can view their own API usage"
  ON public.api_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Functions
-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
-- Create profile automatically on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamps
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_session_history_updated_at
  BEFORE UPDATE ON public.session_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Function to clean up old sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM public.session_history
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.session_history TO authenticated;
GRANT ALL ON public.api_usage TO authenticated;
