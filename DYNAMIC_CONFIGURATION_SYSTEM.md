# Dynamic Configuration System

## Overview

The Dynamic Configuration System eliminates hardcoded values by fetching configuration from your connected Supabase database. This makes your application more flexible, maintainable, and allows runtime updates without code changes.

## Architecture

### Components

1. **`/lib/dynamic-config.ts`** - Core configuration fetching utilities
2. **`/app/api/config/route.ts`** - REST API for configuration management
3. **Supabase Tables**:
   - `app_config` - Stores key-value configuration pairs
   - `user_profiles` - Stores user-specific data and preferences

### Benefits

✅ **No More Hardcoded Values** - All configuration comes from the database
✅ **Runtime Updates** - Change settings without deploying new code
✅ **User-Specific Data** - Different values per user based on profiles
✅ **Automatic Caching** - 5-minute cache reduces database load
✅ **Fallback Defaults** - Gracefully handles missing database values

## Database Schema

### `app_config` Table

```sql
CREATE TABLE app_config (
  id UUID PRIMARY KEY,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(key, category)
);
```

**Example Records:**
| key | value | category | description |
|-----|-------|----------|-------------|
| `default_invested_amount` | `2500` | `insights` | Default total invested |
| `high_confidence_threshold` | `80` | `insights` | Threshold for high confidence |
| `message_limit` | `15` | `rate_limits` | Daily message limit |
| `all` | `"Welcome to Leverage AI..."` | `welcome_messages` | Main welcome message |

### `user_profiles` Table

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  total_invested DECIMAL(10, 2) DEFAULT 0,
  win_rate DECIMAL(5, 2),
  roi DECIMAL(5, 2),
  active_contests INTEGER DEFAULT 0,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Usage

### Fetching Configuration

#### Single Value

```typescript
import { getConfig } from '@/lib/dynamic-config';

// Fetch with default fallback
const investAmount = await getConfig('default_invested_amount', 2500, 'insights');
// Returns: 2500 (from DB) or fallback if not found
```

#### Multiple Values

```typescript
import { getConfigs } from '@/lib/dynamic-config';

const configs = await getConfigs([
  { key: 'default_invested_amount', defaultValue: 2500, category: 'insights' },
  { key: 'high_confidence_threshold', defaultValue: 80, category: 'insights' },
  { key: 'message_limit', defaultValue: 15, category: 'rate_limits' },
]);

console.log(configs.default_invested_amount); // 2500
console.log(configs.message_limit); // 15
```

#### User Profile Data

```typescript
import { getUserProfile } from '@/lib/dynamic-config';

const profile = await getUserProfile('user_123');

if (profile) {
  console.log(`User has invested: $${profile.total_invested}`);
  console.log(`Win rate: ${profile.win_rate}%`);
}
```

#### Welcome Messages

```typescript
import { getWelcomeMessages } from '@/lib/dynamic-config';

const messages = await getWelcomeMessages();
console.log(messages.all); // Main welcome message
console.log(messages.betting); // Betting-specific message
```

### API Endpoints

#### GET `/api/config`

Fetch configuration values via REST API.

**Single Config:**
```bash
GET /api/config?key=message_limit&category=rate_limits
```

Response:
```json
{
  "success": true,
  "key": "message_limit",
  "value": 15,
  "category": "rate_limits",
  "timestamp": "2026-02-04T..."
}
```

**Multiple Configs:**
```bash
GET /api/config?type=multiple&keys=message_limit,chat_limit&category=rate_limits
```

**Welcome Messages:**
```bash
GET /api/config?type=welcome_messages
```

Response:
```json
{
  "success": true,
  "data": {
    "all": "Welcome to Leverage AI...",
    "betting": "Welcome to Sports Betting...",
    "fantasy": "Welcome to Fantasy Sports..."
  },
  "source": "database",
  "timestamp": "2026-02-04T..."
}
```

#### POST `/api/config`

Clear the configuration cache (forces fresh database fetch).

```bash
POST /api/config
Content-Type: application/json

{
  "action": "clear_cache"
}
```

## Real-World Example: Insights Calculation

### Before (Hardcoded)

```typescript
function calculateInsights(predictions: any[]) {
  const totalInvested = 2500; // ❌ Hardcoded
  const highConfidenceThreshold = 80; // ❌ Hardcoded
  const roiScaleFactor = 20; // ❌ Hardcoded
  
  // Calculate metrics...
  return {
    totalValue: 2500 + roi,
    totalInvested: 2500 // ❌ Always the same
  };
}
```

### After (Dynamic)

```typescript
async function calculateInsights(predictions: any[], userId?: string) {
  // ✅ Fetch from database
  const configs = await getConfigs([
    { key: 'default_invested_amount', defaultValue: 2500, category: 'insights' },
    { key: 'high_confidence_threshold', defaultValue: 80, category: 'insights' },
    { key: 'roi_scale_factor', defaultValue: 20, category: 'insights' },
  ]);
  
  // ✅ Try to get user's actual data
  let totalInvested = configs.default_invested_amount;
  if (userId) {
    const userProfile = await getUserProfile(userId);
    if (userProfile?.total_invested) {
      totalInvested = userProfile.total_invested; // ✅ User-specific!
    }
  }
  
  // Calculate with dynamic values
  const simulatedROI = ((avgConfidence - 50) / 50) * configs.roi_scale_factor;
  
  return {
    totalValue: totalInvested + (simulatedROI * totalInvested / 100),
    totalInvested // ✅ Different per user
  };
}
```

## Migration

Run the migration to set up the tables:

```bash
# Using Supabase CLI
supabase migration apply 20260204_dynamic_config_system.sql

# Or execute directly in Supabase SQL Editor
```

The migration includes:
- Table creation with indexes
- Default configuration values
- Row Level Security (RLS) policies
- Triggers for `updated_at` fields
- Permissions for public/authenticated access

## Caching Strategy

### Automatic Cache

- **TTL:** 5 minutes (300,000ms)
- **Scope:** Per configuration key
- **Invalidation:** Automatic on TTL expiry or manual via API

### Manual Cache Clear

```typescript
import { clearConfigCache } from '@/lib/dynamic-config';

clearConfigCache(); // Clears all cached configs
```

Or via API:
```bash
POST /api/config
{ "action": "clear_cache" }
```

## Configuration Categories

### `insights`
- `default_invested_amount` - Default portfolio value
- `high_confidence_threshold` - Min confidence for "high" rating
- `roi_scale_factor` - ROI calculation multiplier
- `default_confidence` - Fallback confidence level
- `default_win_rate` - Fallback win rate percentage

### `rate_limits`
- `message_limit` - Daily message limit for free users
- `chat_limit` - Daily chat creation limit
- `limit_duration_hours` - Hours before reset

### `welcome_messages`
- `all` - General welcome message
- `betting` - Sports betting welcome
- `fantasy` - Fantasy sports welcome
- `dfs` - DFS welcome
- `kalshi` - Kalshi markets welcome

### `features`
- `enable_live_odds` - Toggle live odds fetching
- `enable_ai_analysis` - Toggle AI analysis
- `enable_user_profiles` - Toggle user profile tracking

## Updating Configuration

### Via SQL (Supabase Dashboard)

```sql
-- Update a config value
UPDATE app_config 
SET value = '3000'::jsonb 
WHERE key = 'default_invested_amount' 
AND category = 'insights';

-- Insert new config
INSERT INTO app_config (key, value, category, description)
VALUES ('new_feature_flag', 'true'::jsonb, 'features', 'Enable new feature');
```

### Via Application Code

Create an admin API route or use Supabase client:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);

await supabase
  .from('app_config')
  .update({ value: 3000 })
  .eq('key', 'default_invested_amount')
  .eq('category', 'insights');
```

## Benefits Realized

### 1. **Flexibility**
Change welcome messages, thresholds, limits without redeploying code.

### 2. **A/B Testing**
Easily test different values by updating the database.

### 3. **User-Specific Experience**
Different users see different values based on their profile.

### 4. **Multi-Tenant Ready**
Add `tenant_id` column to support multiple organizations.

### 5. **Audit Trail**
`created_at` and `updated_at` track configuration changes.

## Error Handling

The system gracefully handles all error scenarios:

✅ **Database unavailable** - Falls back to default values
✅ **Table doesn't exist** - Returns defaults, logs warning
✅ **Invalid JSON** - Safe parsing prevents crashes
✅ **Missing keys** - Returns specified default value
✅ **Network errors** - Cached values served if available

## Security

### Row Level Security (RLS)

- **`app_config`:** Public read access (all users can read)
- **`user_profiles`:** Users only access their own data

### Policies

```sql
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid()::text = user_id);

-- Public can read app config
CREATE POLICY "Allow public read access to app_config"
  ON app_config FOR SELECT
  USING (true);
```

## Monitoring

### Logs

All configuration operations log to console:

```
[Config] Loaded config default_invested_amount: 2500
[Config] Using user's actual investment: $5000
[Config] Configuration cache cleared
[Config] Config message_limit not found, using default: 15
```

### Metrics to Track

- Cache hit rate
- Database query frequency
- Configuration read patterns
- User profile access patterns

## Best Practices

1. **Always provide defaults** - Never rely solely on database values
2. **Use appropriate categories** - Organize configs logically
3. **Cache aggressively** - 5-minute TTL prevents DB overload
4. **Document config keys** - Add descriptions in migration
5. **Version configurations** - Track changes over time
6. **Test with missing DB** - Ensure fallbacks work

## Future Enhancements

- **Configuration versioning** - Track history of changes
- **Environment-specific configs** - Dev/staging/production values
- **Admin UI** - Web interface for managing configs
- **Config validation** - Schema validation for values
- **Real-time updates** - WebSocket-based config updates
- **Feature flags service** - Advanced A/B testing capabilities

## Summary

The Dynamic Configuration System transforms your application from static to adaptive. All hardcoded values are replaced with database-driven configuration, enabling runtime updates, user-specific experiences, and effortless A/B testing—all while maintaining robust fallbacks and caching for reliability.
