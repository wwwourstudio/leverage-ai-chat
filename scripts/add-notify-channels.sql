-- Migration: Add notify_channels column to user_alerts
-- Run in Supabase SQL Editor (uses the 'api' schema)
--
-- This enables multi-channel alert delivery:
--   in_app  → In-app toast notifications (always supported)
--   email   → Email delivery (requires Sendgrid/SMTP configuration)
--   sms     → SMS delivery (requires Twilio configuration)
--   push    → Web push notifications (requires push service configuration)
--   webhook → HTTP POST to a user-provided URL (fully supported)

ALTER TABLE api.user_alerts
  ADD COLUMN IF NOT EXISTS notify_channels JSONB NOT NULL DEFAULT '["in_app"]'::jsonb;

-- Optional: backfill existing alerts to have the in_app channel
UPDATE api.user_alerts
SET notify_channels = '["in_app"]'::jsonb
WHERE notify_channels IS NULL OR notify_channels = 'null'::jsonb;
