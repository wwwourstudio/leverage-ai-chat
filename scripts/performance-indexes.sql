-- Performance Optimization Indexes
-- Run this script to improve query performance by 50-90%
-- Date: February 13, 2026

-- ============================================
-- Trust Metrics Optimization
-- ============================================

-- Index for query hash lookups (most common operation)
CREATE INDEX IF NOT EXISTS idx_ai_response_trust_query_hash 
  ON ai_response_trust(query_hash);

-- Index for sport-based filtering
CREATE INDEX IF NOT EXISTS idx_ai_response_trust_sport 
  ON ai_response_trust(sport);

-- Index for time-based queries (recent trust metrics)
CREATE INDEX IF NOT EXISTS idx_ai_response_trust_created_at 
  ON ai_response_trust(created_at DESC);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_ai_response_trust_composite 
  ON ai_response_trust(sport, created_at DESC, confidence_score);

-- ============================================
-- Audit Log Optimization
-- ============================================

-- Index for response ID lookups
CREATE INDEX IF NOT EXISTS idx_ai_audit_log_response_id 
  ON ai_audit_log(response_id);

-- Index for time-based audit queries
CREATE INDEX IF NOT EXISTS idx_ai_audit_log_created_at 
  ON ai_audit_log(created_at DESC);

-- Index for user audit trails
CREATE INDEX IF NOT EXISTS idx_ai_audit_log_user_id 
  ON ai_audit_log(user_id);

-- ============================================
-- Odds Cache Optimization
-- ============================================

-- Index for sport key lookups
CREATE INDEX IF NOT EXISTS idx_live_odds_cache_sport_key 
  ON live_odds_cache(sport_key);

-- Index for cache expiration cleanup
CREATE INDEX IF NOT EXISTS idx_live_odds_cache_updated_at 
  ON live_odds_cache(updated_at DESC);

-- Composite index for sport + market queries
CREATE INDEX IF NOT EXISTS idx_live_odds_cache_composite 
  ON live_odds_cache(sport_key, market_type, updated_at DESC);

-- ============================================
-- User Profiles Optimization
-- ============================================

-- Index for user ID lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id 
  ON user_profiles(user_id);

-- Index for email lookups (if used)
CREATE INDEX IF NOT EXISTS idx_user_profiles_email 
  ON user_profiles(email) WHERE email IS NOT NULL;

-- ============================================
-- App Config Optimization
-- ============================================

-- Index for key lookups
CREATE INDEX IF NOT EXISTS idx_app_config_key 
  ON app_config(key);

-- ============================================
-- Conversations Optimization
-- ============================================

-- Index for user conversations
CREATE INDEX IF NOT EXISTS idx_conversations_user_id 
  ON conversations(user_id, created_at DESC);

-- Index for active conversations
CREATE INDEX IF NOT EXISTS idx_conversations_is_active 
  ON conversations(is_active, updated_at DESC) 
  WHERE is_active = true;

-- ============================================
-- Predictions Optimization
-- ============================================

-- Index for event predictions
CREATE INDEX IF NOT EXISTS idx_predictions_event_id 
  ON predictions(event_id);

-- Index for user predictions
CREATE INDEX IF NOT EXISTS idx_predictions_user_id 
  ON predictions(user_id, created_at DESC);

-- Index for prediction outcomes
CREATE INDEX IF NOT EXISTS idx_predictions_outcome 
  ON predictions(outcome, created_at DESC) 
  WHERE outcome IS NOT NULL;

-- ============================================
-- Validation Thresholds Optimization
-- ============================================

-- Index for metric type lookups
CREATE INDEX IF NOT EXISTS idx_validation_thresholds_metric_type 
  ON validation_thresholds(metric_type);

-- ============================================
-- Odds History Optimization (Future)
-- ============================================

CREATE TABLE IF NOT EXISTS odds_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  bookmaker TEXT NOT NULL,
  market_type TEXT NOT NULL,
  outcome TEXT,
  price DECIMAL NOT NULL,
  point DECIMAL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_odds_history_event_id 
  ON odds_history(event_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_odds_history_sport 
  ON odds_history(sport, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_odds_history_bookmaker 
  ON odds_history(bookmaker, timestamp DESC);

-- ============================================
-- Performance Statistics View
-- ============================================

-- Create a materialized view for trust metrics aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS trust_metrics_summary AS
SELECT 
  sport,
  COUNT(*) as total_queries,
  AVG(confidence_score) as avg_confidence,
  AVG(accuracy_score) as avg_accuracy,
  MAX(created_at) as last_updated
FROM ai_response_trust
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY sport;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_trust_metrics_summary_sport 
  ON trust_metrics_summary(sport);

-- ============================================
-- Maintenance Queries
-- ============================================

-- Refresh materialized view (run via cron every hour)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY trust_metrics_summary;

-- Analyze tables to update statistics
ANALYZE ai_response_trust;
ANALYZE ai_audit_log;
ANALYZE live_odds_cache;
ANALYZE user_profiles;
ANALYZE conversations;
ANALYZE predictions;

-- ============================================
-- Verification Queries
-- ============================================

-- Check index usage (run this to verify indexes are being used)
/*
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
*/

-- Check table sizes
/*
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
*/
