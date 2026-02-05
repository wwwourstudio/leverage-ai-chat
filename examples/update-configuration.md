# Configuration Update Examples

This guide shows you how to update dynamic configuration values in your Supabase database to change application behavior without code deployment.

## Via Supabase Dashboard

### 1. Navigate to SQL Editor

Go to your Supabase project → SQL Editor

### 2. Update Configuration Values

#### Change Message Limit

```sql
-- Increase daily message limit from 15 to 25
UPDATE app_config 
SET value = '25'::jsonb 
WHERE key = 'message_limit' 
AND category = 'rate_limits';
```

#### Update Investment Default

```sql
-- Change default portfolio value from $2,500 to $5,000
UPDATE app_config 
SET value = '5000'::jsonb 
WHERE key = 'default_invested_amount' 
AND category = 'insights';
```

#### Modify Confidence Threshold

```sql
-- Raise high confidence threshold from 80 to 85
UPDATE app_config 
SET value = '85'::jsonb 
WHERE key = 'high_confidence_threshold' 
AND category = 'insights';
```

#### Change Welcome Message

```sql
-- Update betting welcome message
UPDATE app_config 
SET value = '"Welcome to **Pro Betting Analysis** powered by Grok-3!\n\nFind sharp edges with:\n✓ Live odds\n✓ Value detection\n✓ Sharp money tracking\n\n**What should we analyze?**"'::jsonb 
WHERE key = 'betting' 
AND category = 'welcome_messages';
```

### 3. Insert New Configuration

```sql
-- Add a new feature flag
INSERT INTO app_config (key, value, category, description)
VALUES (
  'enable_advanced_analytics',
  'true'::jsonb,
  'features',
  'Enable advanced analytics features'
);
```

### 4. View All Configurations

```sql
-- See all current configs
SELECT key, value, category, description, updated_at
FROM app_config
ORDER BY category, key;
```

## Via Application API

### Clear Cache After Updates

After making database changes, clear the cache so the application fetches fresh values:

```bash
curl -X POST "https://your-app.com/api/config" \
  -H "Content-Type: application/json" \
  -d '{"action": "clear_cache"}'
```

### Verify New Values

```bash
# Check single config
curl "https://your-app.com/api/config?key=message_limit&category=rate_limits"

# Expected response:
{
  "success": true,
  "key": "message_limit",
  "value": 25,
  "category": "rate_limits",
  "timestamp": "2026-02-04T..."
}
```

## User Profile Management

### Create User Profile

```sql
-- Create a profile for a specific user
INSERT INTO user_profiles (user_id, total_invested, win_rate, roi, active_contests, preferences)
VALUES (
  'user_123',
  5000.00,
  68.5,
  12.3,
  5,
  '{"notifications": true, "theme": "dark"}'::jsonb
);
```

### Update User Profile

```sql
-- Update user's investment data
UPDATE user_profiles
SET 
  total_invested = 7500.00,
  win_rate = 72.1,
  roi = 15.8,
  active_contests = 8
WHERE user_id = 'user_123';
```

### View User Profiles

```sql
-- See all user profiles
SELECT user_id, total_invested, win_rate, roi, active_contests
FROM user_profiles
ORDER BY total_invested DESC;
```

## Common Configuration Changes

### A/B Testing Different Limits

```sql
-- Test Period 1: Lower limits
UPDATE app_config SET value = '10'::jsonb WHERE key = 'message_limit';
UPDATE app_config SET value = '5'::jsonb WHERE key = 'chat_limit';

-- Monitor metrics...

-- Test Period 2: Higher limits
UPDATE app_config SET value = '20'::jsonb WHERE key = 'message_limit';
UPDATE app_config SET value = '15'::jsonb WHERE key = 'chat_limit';
```

### Seasonal Adjustments

```sql
-- Tournament season: increase limits
UPDATE app_config SET value = '30'::jsonb WHERE key = 'message_limit';
UPDATE app_config SET value = '5000'::jsonb WHERE key = 'default_invested_amount';

-- Off-season: normal limits
UPDATE app_config SET value = '15'::jsonb WHERE key = 'message_limit';
UPDATE app_config SET value = '2500'::jsonb WHERE key = 'default_invested_amount';
```

### Feature Rollout

```sql
-- Phase 1: Enable for testing
UPDATE app_config SET value = 'true'::jsonb WHERE key = 'enable_advanced_analytics';

-- If issues: Quick disable
UPDATE app_config SET value = 'false'::jsonb WHERE key = 'enable_advanced_analytics';

-- Phase 2: Re-enable after fixes
UPDATE app_config SET value = 'true'::jsonb WHERE key = 'enable_advanced_analytics';
```

## Bulk Updates

```sql
-- Update multiple rate limits at once
UPDATE app_config
SET value = CASE key
  WHEN 'message_limit' THEN '20'::jsonb
  WHEN 'chat_limit' THEN '12'::jsonb
  WHEN 'limit_duration_hours' THEN '12'::jsonb
  ELSE value
END
WHERE category = 'rate_limits'
AND key IN ('message_limit', 'chat_limit', 'limit_duration_hours');
```

## Configuration Audit

### View Change History

```sql
-- See recently updated configs
SELECT key, category, value, updated_at
FROM app_config
WHERE updated_at >= NOW() - INTERVAL '7 days'
ORDER BY updated_at DESC;
```

### Compare Values

```sql
-- Compare current vs default insights settings
SELECT 
  key,
  value as current_value,
  description
FROM app_config
WHERE category = 'insights'
ORDER BY key;
```

## Best Practices

### 1. Test in Staging First

Always test configuration changes in a staging environment before production.

### 2. Document Changes

Add notes when making significant changes:

```sql
UPDATE app_config 
SET 
  value = '25'::jsonb,
  description = description || ' (Increased for Q1 2026 promotion)'
WHERE key = 'message_limit';
```

### 3. Monitor Impact

After changes, monitor:
- User engagement metrics
- Error rates
- Performance metrics
- User feedback

### 4. Keep Backups

Before bulk changes, save current state:

```sql
-- Create backup
CREATE TABLE app_config_backup_20260204 AS
SELECT * FROM app_config;
```

### 5. Gradual Rollouts

For major changes, update incrementally:

```sql
-- Week 1: Small increase
UPDATE app_config SET value = '18'::jsonb WHERE key = 'message_limit';

-- Week 2: Monitor and adjust
UPDATE app_config SET value = '22'::jsonb WHERE key = 'message_limit';

-- Week 3: Final target
UPDATE app_config SET value = '25'::jsonb WHERE key = 'message_limit';
```

## Emergency Rollback

If a configuration change causes issues:

```sql
-- Quick rollback to known good values
UPDATE app_config
SET value = CASE key
  WHEN 'message_limit' THEN '15'::jsonb
  WHEN 'chat_limit' THEN '10'::jsonb
  WHEN 'default_invested_amount' THEN '2500'::jsonb
  ELSE value
END
WHERE key IN ('message_limit', 'chat_limit', 'default_invested_amount');

-- Clear cache immediately
-- Then run: POST /api/config with action: "clear_cache"
```

## Advanced: Configuration Scheduling

To schedule configuration changes, create a function:

```sql
-- Create scheduled config update function
CREATE OR REPLACE FUNCTION apply_scheduled_config()
RETURNS void AS $$
BEGIN
  -- Check if it's tournament season (example: March-April)
  IF EXTRACT(MONTH FROM NOW()) IN (3, 4) THEN
    UPDATE app_config SET value = '30'::jsonb WHERE key = 'message_limit';
    UPDATE app_config SET value = '5000'::jsonb WHERE key = 'default_invested_amount';
  ELSE
    UPDATE app_config SET value = '15'::jsonb WHERE key = 'message_limit';
    UPDATE app_config SET value = '2500'::jsonb WHERE key = 'default_invested_amount';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron or external scheduler
-- Or call manually: SELECT apply_scheduled_config();
```

## Summary

Dynamic configuration allows you to:
- ✅ Change behavior without deployment
- ✅ A/B test different values
- ✅ Respond quickly to issues
- ✅ Personalize per user
- ✅ Schedule seasonal changes

Always clear the cache after updates for immediate effect!
