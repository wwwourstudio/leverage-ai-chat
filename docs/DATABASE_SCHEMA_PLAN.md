# Comprehensive Database Schema Plan

## Overview
This document outlines the complete database structure for the LeverageAI sports betting and financial intelligence platform. The schema is designed for PostgreSQL/Supabase with Row Level Security (RLS), scalability, and data integrity.

---

## Quick Setup Instructions

Your Supabase connection is active, but the database schema needs to be created. Follow these steps:

### Option 1: Supabase SQL Editor (Recommended - 2 minutes)

1. Open your Supabase project dashboard
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the contents of `/scripts/setup-database.sql`
5. Paste into the SQL Editor
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. Wait for "Success. No rows returned" message
8. Refresh your application - data should now flow

### Option 2: Supabase CLI (Advanced)

```bash
cd /vercel/share/v0-project
supabase db push --file scripts/setup-database.sql
```

### What Gets Created

The migration creates:
- 7 core tables (ai_response_trust, ai_audit_log, odds_benford_baselines, validation_thresholds, live_odds_cache, app_config, user_profiles)
- 23 indexes for query optimization
- 3 views for aggregated metrics
- 4 functions for automation
- Row Level Security policies
- Seed data for configuration

---

## Design Principles

### 1. **Data Normalization**
- 3NF (Third Normal Form) compliance
- Minimal redundancy with strategic denormalization for performance
- Foreign key relationships for referential integrity

### 2. **Scalability Considerations**
- UUID primary keys for distributed systems
- Indexed columns for frequent queries
- Partitioning strategy for time-series data
- Efficient JSONB usage for flexible schemas

### 3. **Security & Privacy**
- Row Level Security (RLS) policies on all tables
- Granular access control per user role
- Audit trails for compliance
- No sensitive data in logs

### 4. **Performance Optimization**
- Strategic indexes on query patterns
- Materialized views for complex aggregations
- Automatic cache expiration
- Efficient JSONB queries

---

## Table Structure

### Core Tables (7 tables)

#### 1. **ai_response_trust**
**Purpose**: Store trust metrics and confidence scores for AI-generated predictions

```sql
PRIMARY KEY: id (UUID)
INDEXES: response_id, model_id, (sport, market_type), created_at DESC
```

**Columns**:
- `id` (UUID) - Primary key
- `response_id` (TEXT) - Unique identifier for each AI response
- `model_id` (TEXT) - AI model identifier (e.g., "grok-beta")
- `sport` (TEXT) - Sport category (nfl, nba, mlb, etc.)
- `market_type` (TEXT) - Betting market type (main, props, futures)
- `benford_score` (INTEGER, 0-100) - Benford's Law validation score
- `odds_alignment_score` (INTEGER, 0-100) - Alignment with market odds
- `consensus_score` (INTEGER, 0-100) - Alignment with consensus picks
- `historical_accuracy_score` (INTEGER, 0-100) - Historical performance
- `final_confidence` (INTEGER, 0-100) - Overall confidence score
- `flags` (JSONB) - Warning flags and metadata
- `created_at` (TIMESTAMPTZ) - Record creation timestamp

**Relationships**: None (fact table)
**Access Pattern**: Read-heavy, append-only
**Estimated Growth**: ~100K records/month
**Retention**: 12 months rolling

---

#### 2. **ai_audit_log**
**Purpose**: Comprehensive audit trail for all AI responses (compliance & debugging)

```sql
PRIMARY KEY: id (UUID)
INDEXES: response_id, model_id, created_at DESC
```

**Columns**:
- `id` (UUID) - Primary key
- `response_id` (TEXT) - Links to ai_response_trust
- `model_id` (TEXT) - AI model used
- `raw_output` (TEXT) - Original AI response
- `trust_breakdown` (JSONB) - Detailed trust calculation
- `thresholds_used` (JSONB) - Validation thresholds applied
- `throttle_state` (TEXT) - Rate limit state at time of response
- `final_user_output` (TEXT) - Final response shown to user
- `created_at` (TIMESTAMPTZ) - Audit timestamp

**Relationships**: Linked to ai_response_trust via response_id
**Access Pattern**: Write-heavy, rarely read (compliance only)
**Estimated Growth**: ~100K records/month
**Retention**: 24 months (compliance requirement)

---

#### 3. **odds_benford_baselines**
**Purpose**: Store sport-specific digit distributions for Benford's Law validation

```sql
PRIMARY KEY: id (UUID)
UNIQUE: (sport, market_type)
INDEXES: (sport, market_type)
```

**Columns**:
- `id` (UUID) - Primary key
- `sport` (TEXT) - Sport category
- `market_type` (TEXT) - Market type
- `digit_distribution` (JSONB) - First-digit frequency distribution
- `sample_size` (INTEGER) - Number of samples analyzed
- `updated_at` (TIMESTAMPTZ) - Last update timestamp
- `created_at` (TIMESTAMPTZ) - Creation timestamp

**Relationships**: Referenced by ai_response_trust
**Access Pattern**: Read-heavy, periodic updates
**Estimated Growth**: ~50 records (stable)
**Retention**: Permanent with versioning

---

#### 4. **validation_thresholds**
**Purpose**: Configurable validation thresholds per sport and market

```sql
PRIMARY KEY: id (UUID)
UNIQUE: (sport, market_type)
```

**Columns**:
- `id` (UUID) - Primary key
- `sport` (TEXT) - Sport category
- `market_type` (TEXT) - Market type
- `odds_deviation_low` (NUMERIC(5,4)) - Low threshold (default: 0.02)
- `odds_deviation_medium` (NUMERIC(5,4)) - Medium threshold (default: 0.05)
- `odds_deviation_high` (NUMERIC(5,4)) - High threshold (default: 0.10)
- `consensus_delta_low` (NUMERIC(5,4)) - Low consensus delta (default: 0.03)
- `consensus_delta_medium` (NUMERIC(5,4)) - Medium delta (default: 0.07)
- `consensus_delta_high` (NUMERIC(5,4)) - High delta (default: 0.12)
- `benford_pass_threshold` (INTEGER) - Minimum passing score (default: 80)
- `minimum_sample_size` (INTEGER) - Minimum samples required (default: 100)
- `updated_at` (TIMESTAMPTZ) - Last modification
- `created_at` (TIMESTAMPTZ) - Creation timestamp

**Relationships**: Referenced by validation logic
**Access Pattern**: Read-heavy, rarely updated
**Estimated Growth**: ~50 records (stable)
**Retention**: Permanent

---

#### 5. **live_odds_cache**
**Purpose**: Cache live odds from external APIs to reduce API calls and costs

```sql
PRIMARY KEY: id (UUID)
UNIQUE: (sport, market_type, event_id, source)
INDEXES: expires_at, (sport, market_type)
```

**Columns**:
- `id` (UUID) - Primary key
- `sport` (TEXT) - Sport category
- `market_type` (TEXT) - Market type
- `event_id` (TEXT) - External event identifier
- `implied_probability` (NUMERIC(5,4)) - Calculated probability
- `decimal_odds` (NUMERIC(6,2)) - Odds in decimal format
- `source` (TEXT) - Data provider (e.g., "the-odds-api")
- `expires_at` (TIMESTAMPTZ) - Cache expiration time
- `created_at` (TIMESTAMPTZ) - Cache creation time

**Relationships**: None (cache table)
**Access Pattern**: Read/write balanced, TTL-based expiration
**Estimated Growth**: ~10K records (stable with auto-cleanup)
**Retention**: 24 hours rolling

---

#### 6. **app_config**
**Purpose**: Dynamic application configuration without code deployments

```sql
PRIMARY KEY: id (UUID)
UNIQUE: (key, category)
INDEXES: key, category
```

**Columns**:
- `id` (UUID) - Primary key
- `key` (TEXT) - Configuration key
- `value` (JSONB) - Configuration value (flexible type)
- `category` (TEXT) - Configuration category (insights, features, rate_limits, etc.)
- `description` (TEXT) - Human-readable description
- `created_at` (TIMESTAMPTZ) - Creation timestamp
- `updated_at` (TIMESTAMPTZ) - Last update timestamp

**Relationships**: None (configuration table)
**Access Pattern**: Read-heavy (cached in application)
**Estimated Growth**: ~100 records (stable)
**Retention**: Permanent

**Default Categories**:
- `insights` - Dashboard metrics configuration
- `welcome_messages` - Dynamic welcome text per category
- `rate_limits` - User rate limiting configuration
- `features` - Feature flags

---

#### 7. **user_profiles**
**Purpose**: User-specific data, preferences, and performance metrics

```sql
PRIMARY KEY: id (UUID)
UNIQUE: user_id
INDEXES: user_id
```

**Columns**:
- `id` (UUID) - Primary key
- `user_id` (TEXT) - External user identifier (from auth system)
- `total_invested` (DECIMAL(10,2)) - Total amount invested
- `win_rate` (DECIMAL(5,2)) - Win rate percentage
- `roi` (DECIMAL(5,2)) - Return on investment percentage
- `active_contests` (INTEGER) - Number of active contests
- `preferences` (JSONB) - User preferences (notifications, themes, etc.)
- `created_at` (TIMESTAMPTZ) - Account creation
- `updated_at` (TIMESTAMPTZ) - Last update

**Relationships**: Links to auth system via user_id
**Access Pattern**: Read/write balanced, user-specific queries
**Estimated Growth**: ~10K users (growing)
**Retention**: Permanent (GDPR deletion on request)

---

## Views & Materialized Views

### 1. **model_trust_scores** (VIEW)
Aggregated rolling trust metrics per model for the last 30 days

```sql
SELECT 
  model_id,
  sport,
  market_type,
  AVG(final_confidence) AS avg_final_confidence,
  AVG(benford_score) AS avg_benford_score,
  COUNT(*) AS total_responses,
  MAX(created_at) AS last_response_at
FROM ai_response_trust
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY model_id, sport, market_type
```

**Usage**: Dashboard analytics, model performance tracking
**Refresh**: Real-time (not materialized)

---

### 2. **config_by_category** (VIEW)
Simplified configuration access grouped by category

```sql
SELECT 
  category,
  jsonb_object_agg(key, value) as settings
FROM app_config
GROUP BY category
```

**Usage**: Application configuration loading
**Refresh**: Real-time (not materialized)

---

## Indexes Strategy

### Primary Indexes (Automatic)
- All primary keys (UUID) are automatically indexed
- Unique constraints create implicit indexes

### Secondary Indexes
1. **ai_response_trust**:
   - `idx_trust_response` on `response_id` - Fast lookup by response
   - `idx_trust_model` on `model_id` - Model-specific queries
   - `idx_trust_sport_market` on `(sport, market_type)` - Filtered queries
   - `idx_trust_created` on `created_at DESC` - Time-series queries

2. **ai_audit_log**:
   - `idx_audit_response` on `response_id` - Audit trail lookup
   - `idx_audit_model` on `model_id` - Model audit queries
   - `idx_audit_created` on `created_at DESC` - Time-based queries

3. **live_odds_cache**:
   - `idx_odds_cache_expiry` on `expires_at` - Cleanup queries
   - `idx_odds_cache_sport_market` on `(sport, market_type)` - Filtered access

4. **app_config**:
   - `idx_app_config_key` on `key` - Direct key lookup
   - `idx_app_config_category` on `category` - Category-based queries

5. **user_profiles**:
   - `idx_user_profiles_user_id` on `user_id` - User lookup

---

## Row Level Security (RLS) Policies

### Public Read Access
- `ai_response_trust` - All users can read trust metrics
- `ai_audit_log` - All users can read audit logs
- `odds_benford_baselines` - All users can read baselines
- `validation_thresholds` - All users can read thresholds
- `live_odds_cache` - All users can read cached odds
- `app_config` - All users can read configuration

### User-Specific Access
- `user_profiles` - Users can only read/write their own profile

### Admin Access (Future)
- Insert/update/delete on all tables requires admin role
- Audit log is append-only for all users

---

## Data Integrity Constraints

### Check Constraints
- Score fields (0-100): `CHECK (score >= 0 AND score <= 100)`
- Positive integers: `CHECK (value >= 0)`
- Valid decimals: Appropriate precision/scale

### Foreign Key Constraints
- Not strictly enforced (soft relationships)
- Application-level referential integrity
- Allows for eventual consistency

### Unique Constraints
- `(sport, market_type)` - Prevents duplicate baselines/thresholds
- `(key, category)` - Prevents duplicate config entries
- `user_id` - One profile per user
- `(sport, market_type, event_id, source)` - Prevents duplicate cache entries

---

## Maintenance & Automation

### Automatic Triggers

#### 1. **update_benford_baseline()**
Automatically updates Benford baselines when new odds are cached
```sql
TRIGGER: trigger_update_benford
FIRES: AFTER INSERT ON live_odds_cache
```

#### 2. **update_updated_at_column()**
Automatically updates `updated_at` timestamp on record modification
```sql
TRIGGERS: 
  - update_app_config_updated_at
  - update_user_profiles_updated_at
```

### Cleanup Functions

#### 1. **cleanup_expired_odds()**
Removes expired odds from cache (should be run via cron)
```sql
DELETE FROM live_odds_cache WHERE expires_at < NOW()
```

**Recommended Schedule**: Every 6 hours

---

## Scalability Considerations

### Horizontal Scaling
- UUID primary keys support distributed inserts
- No auto-increment bottlenecks
- Sharding possible by sport or user_id

### Vertical Scaling
- Indexed queries scale linearly
- JSONB columns use GIN indexes for performance
- Connection pooling via Supabase

### Partitioning Strategy (Future)
- **Time-based**: `ai_response_trust`, `ai_audit_log` by month
- **Category-based**: `live_odds_cache` by sport
- Implement when tables exceed 10M rows

---

## Monitoring & Observability

### Key Metrics to Track
1. **Query Performance**:
   - Avg query time by table
   - Slow query log analysis
   - Index hit rate

2. **Table Growth**:
   - Rows per table
   - Disk space usage
   - Growth rate trends

3. **Cache Performance**:
   - Cache hit rate on `live_odds_cache`
   - Average TTL utilization
   - Cleanup function execution time

4. **Data Quality**:
   - NULL value percentages
   - Constraint violation attempts
   - RLS policy denials

---

## Migration Strategy

### Phase 1: Core Tables (Current)
1. ai_response_trust
2. app_config
3. user_profiles

### Phase 2: Trust System (Next)
1. ai_audit_log
2. odds_benford_baselines
3. validation_thresholds
4. live_odds_cache

### Phase 3: Analytics (Future)
1. Historical predictions table
2. Model performance metrics
3. User interaction logs

---

## Backup & Recovery

### Backup Strategy
- **Supabase automatic backups**: Daily (retained 7 days)
- **Manual snapshots**: Weekly (retained 4 weeks)
- **Critical tables**: Daily exports to cloud storage

### Recovery Plan
1. Point-in-time recovery via Supabase
2. Table-level restoration from exports
3. Rollback procedures for migrations

---

## Security Checklist

✅ Row Level Security enabled on all tables
✅ Granular policies for read/write access
✅ No sensitive data in logs or error messages
✅ UUID-based primary keys (unpredictable)
✅ JSONB validation in application layer
✅ Rate limiting via app_config
✅ Audit trail for compliance
✅ Encrypted at rest (Supabase default)
✅ SSL/TLS for connections (Supabase default)

---

## Next Steps

1. **Run migrations** in Supabase SQL Editor
2. **Verify tables** created successfully
3. **Test RLS policies** with different user roles
4. **Set up monitoring** for query performance
5. **Configure backups** and retention policies
6. **Document API access patterns** for optimization
7. **Plan partitioning strategy** for high-growth tables

---

## References

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Row Level Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
