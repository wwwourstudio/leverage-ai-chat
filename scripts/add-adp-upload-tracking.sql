-- ============================================================================
-- ADP UPLOAD TRACKING
-- Adds metadata columns to track user-uploaded TSV files for NFBC/NFFC ADP data
-- ============================================================================

SET search_path TO api;

-- Add columns to track upload metadata (if they don't exist)
DO $$ 
BEGIN
  -- Add uploaded_at column to track when data was uploaded by a user
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'api' AND table_name = 'nfbc_adp' AND column_name = 'uploaded_at') THEN
    ALTER TABLE api.nfbc_adp ADD COLUMN uploaded_at TIMESTAMPTZ;
  END IF;
  
  -- Add uploaded_by column to track who uploaded the data (optional user id)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'api' AND table_name = 'nfbc_adp' AND column_name = 'uploaded_by') THEN
    ALTER TABLE api.nfbc_adp ADD COLUMN uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  
  -- Add source column to distinguish between scraped and uploaded data
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'api' AND table_name = 'nfbc_adp' AND column_name = 'source') THEN
    ALTER TABLE api.nfbc_adp ADD COLUMN source TEXT DEFAULT 'scraped' CHECK (source IN ('scraped', 'uploaded', 'fallback'));
  END IF;
END $$;

-- Create a separate table to track upload history and metadata
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                 WHERE table_schema = 'api' AND table_name = 'adp_upload_history') THEN
    CREATE TABLE api.adp_upload_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sport TEXT NOT NULL CHECK (sport IN ('mlb', 'nfl')),
      uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      player_count INTEGER NOT NULL,
      filename TEXT,
      is_active BOOLEAN DEFAULT true,
      notes TEXT
    );
    
    -- Index for fast lookups by sport and active status
    CREATE INDEX idx_adp_upload_history_sport ON api.adp_upload_history (sport, is_active, uploaded_at DESC);
    
    -- RLS for upload history
    ALTER TABLE api.adp_upload_history ENABLE ROW LEVEL SECURITY;
    
    -- Anyone can read upload history (to see last upload date)
    CREATE POLICY "adp_upload_history_read" ON api.adp_upload_history FOR SELECT USING (true);
    
    -- Only service_role can insert/update (server-side API routes)
    CREATE POLICY "adp_upload_history_service_write" ON api.adp_upload_history FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
