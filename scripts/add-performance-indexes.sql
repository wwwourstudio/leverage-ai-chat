-- Performance Optimization: Add Database Indexes
-- Run this script in Supabase SQL Editor to dramatically improve query performance
-- Expected improvement: 50-90% faster queries on indexed columns

-- ============================================
-- TRUST METRICS OPTIMIZATION
-- ============================================

-- Index for query hash lookups (most common trust metric query)
CREATE INDEX IF NOT EXISTS idx_ai_response_trust_query_hash 
  ON ai_response_trust(query_hash);

-- Index for sport-based filtering
CREATE INDEX IF NOT EXISTS idx_ai_response_trust_sport 
  ON ai_response_trust(sport);

-- Index for time-based queries (recent trust scores)
CREATE INDEX IF NOT EXISTS idx_ai_response_trust_created_at 
  ON ai_response_trust(created_at DESC);

-- Composite index for common trust metric queries
CREATE INDEX IF NOT EXISTS idx_ai_response_trust_composite 
  ON ai_response_trust(sport, created_at DESC, confidence_score);

-- Index for confidence score filtering
CREATE INDEX IF NOT EXISTS idx_ai_response_trust_confidence 
  ON ai_response_trust(confidence_score DESC);

-- ============================================
-- AUDIT LOG OPTIMIZATION
-- ============================================

-- Index for response ID lookups
CREATE INDEX IF NOT EXISTS idx_ai_audit_log_response_id 
  ON ai_audit_log(response_id);

-- Index for time-based audit queries
CREATE INDEX IF NOT EXISTS idx_ai_audit_log_created_at 
  ON ai_audit_log(created_at DESC);

-- Index for event type filtering
CREATE INDEX IF NOT EXISTS idx_ai_audit_log_event_type 
  ON ai_audit_log(event_type);

-- ============================================
-- ODDS CACHE OPTIMIZATION
-- ============================================

-- Index for sport key lookups (most frequent cache query)
CREATE INDEX IF NOT EXISTS idx_live_odds_cache_sport_key 
  ON live_odds_cache(sport_key);

-- Index for cache expiration checks
CREATE INDEX IF NOT EXISTS idx_live_odds_cache_updated_at 
  ON live_odds_cache(updated_at DESC);

-- Composite index for sport + freshness queries
CREATE INDEX IF NOT EXISTS idx_live_odds_cache_composite 
  ON live_odds_cache(sport_key, updated_at DESC);

-- ============================================
-- USER PROFILES OPTIMIZATION
-- ============================================

-- Index for user ID lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id 
  ON user_profiles(user_id);

-- Index for email lookups (if used for authentication)
CREATE INDEX IF NOT EXISTS idx_user_profiles_email 
  ON user_profiles(email);

-- ============================================
-- APP CONFIG OPTIMIZATION
-- ============================================

-- Index for config key lookups
CREATE INDEX IF NOT EXISTS idx_app_config_config_key 
  ON app_config(config_key);

-- ============================================
-- VALIDATION THRESHOLDS OPTIMIZATION
-- ============================================

-- Index for metric name lookups
CREATE INDEX IF NOT EXISTS idx_validation_thresholds_metric_name 
  ON validation_thresholds(metric_name);

-- ============================================
-- VERIFY INDEX CREATION
-- ============================================

-- Query to verify all indexes were created successfully
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Performance tips:
-- 1. Run ANALYZE after creating indexes to update query planner statistics
ANALYZE ai_response_trust;
ANALYZE ai_audit_log;
ANALYZE live_odds_cache;
ANALYZE user_profiles;
ANALYZE app_config;
ANALYZE validation_thresholds;

-- 2. Check index usage after deployment
-- SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';

-- 3. Monitor query performance improvements
-- Use EXPLAIN ANALYZE before and after to measure improvement
