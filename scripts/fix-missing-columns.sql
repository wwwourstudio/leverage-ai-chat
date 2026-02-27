-- Fix Missing Columns Migration
-- Execute this in Supabase SQL Editor to add missing columns to existing tables

-- ==========================================
-- Fix live_odds_cache table
-- ==========================================

-- Add sport_key column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'live_odds_cache' 
        AND column_name = 'sport_key'
    ) THEN
        ALTER TABLE public.live_odds_cache 
        ADD COLUMN sport_key VARCHAR(100);
        
        -- Copy data from sport column if it exists
        UPDATE public.live_odds_cache 
        SET sport_key = sport 
        WHERE sport_key IS NULL;
        
        -- Make it NOT NULL after populating
        ALTER TABLE public.live_odds_cache 
        ALTER COLUMN sport_key SET NOT NULL;
        
        -- Create index
        CREATE INDEX IF NOT EXISTS idx_live_odds_sport_key 
        ON public.live_odds_cache(sport_key);
        
        RAISE NOTICE 'Added sport_key column to live_odds_cache';
    ELSE
        RAISE NOTICE 'sport_key column already exists in live_odds_cache';
    END IF;
END $$;

-- ==========================================
-- Fix ai_response_trust table
-- ==========================================

-- Add consensus_score column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'ai_response_trust' 
        AND column_name = 'consensus_score'
    ) THEN
        ALTER TABLE public.ai_response_trust 
        ADD COLUMN consensus_score NUMERIC(5,2) CHECK (consensus_score >= 0 AND consensus_score <= 100);
        
        -- Set default value for existing rows
        UPDATE public.ai_response_trust 
        SET consensus_score = 50.0 
        WHERE consensus_score IS NULL;
        
        RAISE NOTICE 'Added consensus_score column to ai_response_trust';
    ELSE
        RAISE NOTICE 'consensus_score column already exists in ai_response_trust';
    END IF;
END $$;

-- ==========================================
-- Verify Changes
-- ==========================================

-- Check if sport_key exists
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✓ sport_key column exists in live_odds_cache'
        ELSE '✗ sport_key column MISSING in live_odds_cache'
    END AS status
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'live_odds_cache' 
AND column_name = 'sport_key';

-- Check if consensus_score exists
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✓ consensus_score column exists in ai_response_trust'
        ELSE '✗ consensus_score column MISSING in ai_response_trust'
    END AS status
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'ai_response_trust' 
AND column_name = 'consensus_score';

-- Show all columns in live_odds_cache for verification
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'live_odds_cache'
ORDER BY ordinal_position;

-- ==========================================
-- Fix user_preferences table
-- ==========================================
-- Add custom_instructions column if it doesn't exist
-- (Required by /api/user/instructions route)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'api'
        AND table_name = 'user_preferences'
        AND column_name = 'custom_instructions'
    ) THEN
        ALTER TABLE api.user_preferences
        ADD COLUMN custom_instructions TEXT DEFAULT '';

        RAISE NOTICE 'Added custom_instructions column to api.user_preferences';
    ELSE
        RAISE NOTICE 'custom_instructions column already exists in api.user_preferences';
    END IF;

    -- Also ensure updated_at column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'api'
        AND table_name = 'user_preferences'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE api.user_preferences
        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to api.user_preferences';
    END IF;
END $$;
