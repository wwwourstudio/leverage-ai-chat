-- Verify that all required columns exist in api.user_preferences
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'api' 
  AND table_name = 'user_preferences'
  AND column_name IN ('line_movement_alerts', 'odds_alerts', 'preferred_books', 'risk_tolerance')
ORDER BY column_name;
