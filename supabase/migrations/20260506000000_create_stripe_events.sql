-- =============================================================================
-- Migration: Create stripe_events idempotency table
-- Generated: 2026-05-06
-- Project:   Leverage2 (xvhdomnjhlbxzocayocg)
-- =============================================================================
--
-- BACKGROUND
-- Stripe webhooks deliver events at-least-once. The same event.id can arrive
-- multiple times when the network drops or our handler returns non-2xx. Without
-- idempotency tracking, repeated `checkout.session.completed` events for a
-- credits purchase would call increment_user_credits() twice, double-crediting
-- the user. This table records each processed event_id so the webhook handler
-- can short-circuit duplicates.
-- =============================================================================

CREATE TABLE IF NOT EXISTS api.stripe_events (
  event_id      text        PRIMARY KEY,
  event_type    text        NOT NULL,
  processed_at  timestamptz NOT NULL DEFAULT now(),
  payload_hash  text
);

-- Optional retention: events older than 90 days can be pruned by a cron, but
-- the PK alone is enough for idempotency. No index needed beyond the PK.
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed_at
  ON api.stripe_events(processed_at);

ALTER TABLE api.stripe_events ENABLE ROW LEVEL SECURITY;

-- Service role only — webhook handler is the only writer/reader
CREATE POLICY stripe_events_service_only ON api.stripe_events
  USING (false)
  WITH CHECK (false);
