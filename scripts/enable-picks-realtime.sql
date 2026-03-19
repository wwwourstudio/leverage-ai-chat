-- Enable Supabase Realtime for daily_picks so usePicksAlerts hook works.
-- Safe to re-run (EXCEPTION guard swallows duplicate_object errors).
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE api.daily_picks;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
