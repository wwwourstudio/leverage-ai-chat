-- Force PostgREST schema cache reload by triggering a schema notification
-- This is needed after ALTER TABLE operations to ensure new columns are visible

-- Method 1: Explicit schema reload notification
NOTIFY pgrst, 'reload schema';

-- Method 2: Touch the table's privileges which forces PostgREST to detect schema changes
GRANT ALL ON api.user_preferences TO authenticated;
GRANT ALL ON api.user_preferences TO anon;

-- Verify the columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'api' 
  AND table_name = 'user_preferences'
  AND column_name IN ('line_movement_alerts', 'odds_alerts', 'preferred_books', 'risk_tolerance')
ORDER BY column_name;
