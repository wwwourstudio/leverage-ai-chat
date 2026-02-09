# Insights Dashboard Enhancement Plan

## Executive Summary

This plan outlines comprehensive enhancements to the Insights Dashboard to properly integrate AI trust metrics from the `ai_response_trust` table, implement historical tracking, enable persistent storage for user profiles, and replace hardcoded configurations with dynamic parameters.

## Current State Analysis

### What's Working
- ✅ Supabase connection active (all env vars configured)
- ✅ Grok AI available via AI Gateway
- ✅ Trust metrics UI components built (`TrustMetricsDisplay`, `TrustMetricsBadge`)
- ✅ Database schema designed (7 tables ready in `/scripts/setup-database.sql`)
- ✅ LeveragedAI library with AI-enhanced querying
- ✅ Proper fallback handling for missing data

### Current Issues
- ❌ Database tables not created yet (schema check fails)
- ❌ Insights API returns default/fallback data
- ❌ No historical accuracy tracking
- ❌ Hardcoded configuration values in insights calculation
- ❌ No persistent user profile storage
- ❌ Trust metrics not displayed in dashboard (components exist but not connected)

---

## Enhancement Strategy

### Phase 1: Database Schema Deployment (Foundation)
**Goal:** Establish database infrastructure for all features

#### Step 1.1: Execute Migration
```sql
-- Run /scripts/setup-database.sql in Supabase SQL Editor
-- Creates 7 tables, 23 indexes, 3 views, 4 functions, triggers, RLS policies
```

**Tables Created:**
1. `ai_response_trust` - AI prediction validation metrics
2. `ai_audit_log` - Compliance and audit trail
3. `odds_benford_baselines` - Statistical validation baselines
4. `validation_thresholds` - Configurable validation rules
5. `live_odds_cache` - API cost reduction caching
6. `app_config` - Dynamic configuration storage
7. `user_profiles` - User-specific data and preferences

#### Step 1.2: Verification Script
```bash
# Run verification to confirm setup
node scripts/verify-database-setup.js
```

**Expected Output:**
```
✓ All 7 tables created successfully
✓ 23 indexes created
✓ RLS policies active
✓ Functions operational
✓ Seed data inserted
```

---

### Phase 2: Trust Metrics Integration (Display Layer)
**Goal:** Connect `ai_response_trust` table to dashboard UI

#### Step 2.1: Update Insights API Route
File: `/app/api/insights/route.ts`

**Current Behavior:**
- Queries `ai_response_trust` table
- Falls back to defaults if empty
- Calculates aggregate metrics

**Enhancements:**
```typescript
// Add trust metrics aggregation
const trustAggregates = await queryWithAI(
  APP_TABLES.AI_RESPONSE_TRUST,
  (builder) => builder
    .select('benford_score, odds_alignment_score, historical_accuracy, trust_level')
    .order('created_at', { ascending: false })
    .limit(100)
);

// Calculate average trust scores
const avgTrustMetrics = calculateAverageTrustMetrics(trustAggregates.data);

// Include in response
return NextResponse.json({
  success: true,
  insights: calculateInsightsFromPredictions(data),
  trustMetrics: avgTrustMetrics,  // NEW
  dataSource: DATA_SOURCES.LIVE
});
```

#### Step 2.2: Create Trust Metrics API Endpoint
File: `/app/api/trust-metrics/route.ts`

```typescript
export async function GET(req: NextRequest) {
  // Fetch latest trust metrics from ai_response_trust
  // Return aggregated scores per model
  // Include historical trends
}
```

#### Step 2.3: Dashboard Integration
File: `/app/page.tsx`

**Add Trust Metrics Display:**
```typescript
// Fetch trust metrics on load
const [trustMetrics, setTrustMetrics] = useState<TrustMetrics | null>(null);

useEffect(() => {
  fetchTrustMetrics().then(setTrustMetrics);
}, []);

// Display in dashboard header
<TrustMetricsBadge metrics={trustMetrics} />
```

---

### Phase 3: Historical Accuracy Tracking (Time-Series Data)
**Goal:** Capture and analyze AI performance over time

#### Step 3.1: Create Historical Tracking API
File: `/app/api/historical-accuracy/route.ts`

```typescript
export async function POST(req: NextRequest) {
  const { predictionId, actualOutcome, wasCorrect } = await req.json();
  
  // Update ai_response_trust record
  await supabase
    .from('ai_response_trust')
    .update({ 
      actual_outcome: actualOutcome,
      was_correct: wasCorrect,
      updated_at: new Date()
    })
    .eq('id', predictionId);
  
  // Recalculate historical_accuracy for model
  await updateModelAccuracy(modelName);
}
```

#### Step 3.2: Add Accuracy Tracking View
```sql
CREATE VIEW model_accuracy_over_time AS
SELECT 
  model_name,
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_predictions,
  SUM(CASE WHEN was_correct THEN 1 ELSE 0 END) as correct_predictions,
  AVG(benford_score) as avg_benford_score,
  AVG(odds_alignment_score) as avg_odds_alignment
FROM ai_response_trust
WHERE was_correct IS NOT NULL
GROUP BY model_name, DATE_TRUNC('day', created_at)
ORDER BY date DESC;
```

#### Step 3.3: Historical Chart Component
File: `/components/accuracy-history-chart.tsx`

```typescript
export function AccuracyHistoryChart({ modelName, timeRange }: Props) {
  // Fetch historical data from view
  // Display with recharts line chart
  // Show accuracy trends over time
}
```

---

### Phase 4: Persistent Storage for AI Trust Scores
**Goal:** Reliably store and retrieve trust scores across sessions

#### Step 4.1: Trust Score Insertion on AI Response
File: `/app/api/chat/route.ts`

```typescript
// After generating AI response
const trustMetrics = calculateTrustMetrics(response, odds);

// Store in database
await supabase.from('ai_response_trust').insert({
  model_name: 'grok-4-fast',
  prompt_hash: hashPrompt(userQuery),
  response_hash: hashResponse(response),
  benford_score: trustMetrics.benfordIntegrity / 100,
  odds_alignment_score: trustMetrics.oddsAlignment / 100,
  historical_accuracy: trustMetrics.historicalAccuracy / 100,
  trust_level: trustMetrics.trustLevel
});
```

#### Step 4.2: Trust Score Retrieval
```typescript
// Fetch trust scores for response
const trustScore = await supabase
  .from('ai_response_trust')
  .select('*')
  .eq('response_hash', responseHash)
  .single();

// Attach to message
message.trustMetrics = transformToTrustMetrics(trustScore.data);
```

#### Step 4.3: Add Audit Logging
```typescript
// Log all AI interactions
await supabase.from('ai_audit_log').insert({
  event_type: 'ai_response_generated',
  model_name: 'grok-4-fast',
  user_query: userQuery,
  ai_response: response,
  trust_metrics: trustMetrics,
  flagged: trustMetrics.trustLevel === 'low'
});
```

---

### Phase 5: User Profile Management System
**Goal:** Store user-specific preferences and historical data

#### Step 5.1: User Profile API
File: `/app/api/user/profile/route.ts`

```typescript
// GET - Fetch user profile
export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  
  const profile = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  return NextResponse.json(profile.data);
}

// PATCH - Update user preferences
export async function PATCH(req: NextRequest) {
  const { preferences, settings } = await req.json();
  
  await supabase
    .from('user_profiles')
    .update({ 
      preferences: JSON.stringify(preferences),
      settings: JSON.stringify(settings)
    })
    .eq('user_id', userId);
}
```

#### Step 5.2: User Preferences Component
File: `/components/user-preferences-panel.tsx`

```typescript
export function UserPreferencesPanel() {
  const [preferences, setPreferences] = useState({
    defaultSport: 'nfl',
    riskTolerance: 'medium',
    notificationSettings: {},
    displaySettings: {}
  });
  
  // Save preferences to database
  const savePreferences = async () => {
    await fetch('/api/user/profile', {
      method: 'PATCH',
      body: JSON.stringify({ preferences })
    });
  };
}
```

#### Step 5.3: Track User Performance
```typescript
// Update user stats after each prediction
await supabase
  .from('user_profiles')
  .update({
    predictions_made: sql`predictions_made + 1`,
    predictions_correct: wasCorrect ? sql`predictions_correct + 1` : sql`predictions_correct`,
    total_roi: sql`total_roi + ${roi}`
  })
  .eq('user_id', userId);
```

---

### Phase 6: Dynamic Configuration System
**Goal:** Replace hardcoded values with database-driven configuration

#### Step 6.1: Configuration Management API
File: `/app/api/config/route.ts`

```typescript
// GET - Fetch configuration values
export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category');
  
  const configs = await supabase
    .from('app_config')
    .select('config_key, config_value, category')
    .eq('is_public', true)
    .eq('category', category || undefined);
  
  return NextResponse.json(configs.data);
}

// POST - Update configuration (admin only)
export async function POST(req: NextRequest) {
  const { key, value, category, description } = await req.json();
  
  await supabase
    .from('app_config')
    .upsert({
      config_key: key,
      config_value: value,
      category,
      description,
      updated_at: new Date()
  });
}
```

#### Step 6.2: Update Insights Calculation
File: `/app/api/insights/route.ts`

**Replace Hardcoded Values:**
```typescript
// OLD - Hardcoded
const totalInvested = 2500;
const highConfidenceThreshold = 80;
const roiScaleFactor = 20;

// NEW - Dynamic
const configs = await getConfigs([
  { key: 'default_invested_amount', defaultValue: 2500, category: 'insights' },
  { key: 'high_confidence_threshold', defaultValue: 80, category: 'insights' },
  { key: 'roi_scale_factor', defaultValue: 20, category: 'insights' }
]);

const totalInvested = configs.default_invested_amount;
const highConfidenceThreshold = configs.high_confidence_threshold;
const roiScaleFactor = configs.roi_scale_factor;
```

#### Step 6.3: Admin Configuration Panel
File: `/app/admin/config/page.tsx`

```typescript
export function ConfigurationPanel() {
  const [configs, setConfigs] = useState([]);
  
  // Load configs from database
  // Display in editable table
  // Save changes back to database
  // Real-time updates without deployment
}
```

#### Step 6.4: Seed Default Configurations
```sql
INSERT INTO app_config (config_key, config_value, category, description) VALUES
('default_invested_amount', '2500', 'insights', 'Default investment amount for ROI calculations'),
('high_confidence_threshold', '80', 'insights', 'Minimum confidence for high-confidence predictions'),
('roi_scale_factor', '20', 'insights', 'Scaling factor for ROI simulation'),
('default_confidence', '75', 'insights', 'Default confidence when no data available'),
('default_win_rate', '65', 'insights', 'Default win rate percentage'),
('benford_min_score', '0.85', 'validation', 'Minimum Benford integrity score'),
('odds_alignment_min', '0.90', 'validation', 'Minimum odds alignment score'),
('cache_ttl_odds', '21600', 'caching', 'Odds cache TTL in seconds (6 hours)'),
('cache_ttl_insights', '60', 'caching', 'Insights cache TTL in seconds (1 minute)'),
('rate_limit_free_tier', '100', 'rate_limiting', 'API calls per day for free tier');
```

---

## Implementation Checklist

### Week 1: Foundation
- [ ] Execute database migration (`/scripts/setup-database.sql`)
- [ ] Verify all tables created successfully
- [ ] Run health check API (`/api/health/database`)
- [ ] Confirm RLS policies active
- [ ] Insert seed configuration data

### Week 2: Trust Metrics Integration
- [ ] Create `/app/api/trust-metrics/route.ts`
- [ ] Update insights API to include trust aggregates
- [ ] Connect trust metrics to dashboard UI
- [ ] Add trust badge to message headers
- [ ] Display detailed metrics in expandable section

### Week 3: Historical Tracking
- [ ] Create `/app/api/historical-accuracy/route.ts`
- [ ] Build `AccuracyHistoryChart` component
- [ ] Add outcome tracking for predictions
- [ ] Implement model accuracy recalculation
- [ ] Display accuracy trends in dashboard

### Week 4: Persistent Storage
- [ ] Update chat API to insert trust scores
- [ ] Add audit logging for all AI interactions
- [ ] Implement trust score retrieval
- [ ] Add response hash caching
- [ ] Test data persistence across sessions

### Week 5: User Profiles
- [ ] Create `/app/api/user/profile/route.ts`
- [ ] Build `UserPreferencesPanel` component
- [ ] Implement preference saving/loading
- [ ] Add user performance tracking
- [ ] Display user stats in dashboard

### Week 6: Dynamic Configuration
- [ ] Create `/app/api/config/route.ts`
- [ ] Build admin configuration panel
- [ ] Replace all hardcoded values
- [ ] Test configuration hot-reload
- [ ] Document all configuration options

---

## Testing Strategy

### Unit Tests
```typescript
// Test trust metrics calculation
describe('Trust Metrics', () => {
  it('should calculate correct Benford score', () => {
    const score = calculateBenfordScore(odds);
    expect(score).toBeGreaterThan(0.85);
  });
});
```

### Integration Tests
```typescript
// Test database integration
describe('Insights API', () => {
  it('should fetch trust metrics from database', async () => {
    const response = await fetch('/api/insights');
    const data = await response.json();
    expect(data.trustMetrics).toBeDefined();
  });
});
```

### E2E Tests
```typescript
// Test complete user flow
describe('Dashboard', () => {
  it('should display trust metrics after AI response', async () => {
    await sendMessage('Analyze NFL week 10');
    await waitFor(() => {
      expect(screen.getByText(/HIGH Trust/)).toBeInTheDocument();
    });
  });
});
```

---

## Performance Optimization

### Caching Strategy
```typescript
// Cache trust metrics for 1 minute
const TRUST_METRICS_CACHE_TTL = 60_000;

// Cache user profiles for 5 minutes
const USER_PROFILE_CACHE_TTL = 300_000;

// Cache configuration for 10 minutes
const CONFIG_CACHE_TTL = 600_000;
```

### Database Indexing
```sql
-- Optimize trust metrics queries
CREATE INDEX idx_trust_model_created ON ai_response_trust(model_name, created_at DESC);

-- Optimize user profile lookups
CREATE INDEX idx_user_profiles_lookup ON user_profiles(user_id) 
  INCLUDE (predictions_made, predictions_correct, total_roi);
```

### Query Optimization
```typescript
// Use select() to fetch only needed fields
const { data } = await supabase
  .from('ai_response_trust')
  .select('benford_score, odds_alignment_score, trust_level')
  .order('created_at', { ascending: false })
  .limit(100);
```

---

## Security Considerations

### RLS Policies
```sql
-- User profiles: Users can only access their own profile
CREATE POLICY user_profiles_access ON user_profiles
  FOR ALL USING (auth.uid()::text = user_id);

-- Config: Public configs readable by all
CREATE POLICY config_public_read ON app_config
  FOR SELECT USING (is_public = TRUE);

-- Trust metrics: Read-only for all users
CREATE POLICY trust_metrics_read ON ai_response_trust
  FOR SELECT TO authenticated, anon USING (TRUE);
```

### Data Validation
```typescript
// Validate trust score ranges
if (benfordScore < 0 || benfordScore > 1) {
  throw new Error('Invalid Benford score');
}

// Sanitize user inputs
const sanitizedPreferences = sanitizeUserPreferences(preferences);
```

---

## Monitoring & Observability

### Metrics to Track
- Trust score distribution (high/medium/low)
- Average Benford integrity across all predictions
- Historical accuracy trends per model
- User profile update frequency
- Configuration change frequency
- API response times

### Logging
```typescript
console.log('[v0] Trust Metrics - Avg Benford:', avgBenford);
console.log('[v0] User Profile - Predictions:', predictionsCount);
console.log('[v0] Config - Loaded:', configKeys);
```

### Alerts
- Alert if trust score drops below 50% for 10+ consecutive predictions
- Alert if database connection fails
- Alert if historical accuracy drops below 60%

---

## Migration Plan

### Development Environment
1. Run migration on dev database
2. Test all endpoints with Postman
3. Verify UI displays correctly
4. Check RLS policies work as expected

### Staging Environment
1. Run migration on staging database
2. Load test with realistic traffic
3. Monitor performance metrics
4. Verify caching works correctly

### Production Environment
1. Backup existing database
2. Run migration during low-traffic window
3. Monitor error rates closely
4. Have rollback plan ready
5. Gradually enable features with feature flags

---

## Success Metrics

### Technical KPIs
- **Database Query Performance:** < 100ms p95 latency
- **Trust Metrics Accuracy:** > 90% correlation with actual outcomes
- **User Profile Load Time:** < 50ms
- **Configuration Hot-Reload:** < 1 second propagation
- **Cache Hit Rate:** > 80% for frequently accessed data

### User Experience KPIs
- **Dashboard Load Time:** < 2 seconds
- **Trust Metrics Display:** Visible within 500ms of AI response
- **User Preference Saves:** Instant feedback
- **Historical Chart Render:** < 1 second
- **Zero Hardcoded Values:** 100% dynamic configuration

---

## Rollout Timeline

### Immediate (Week 1)
- Execute database migration
- Verify schema deployment
- Enable basic trust metrics display

### Short-term (Weeks 2-3)
- Full trust metrics integration
- Historical tracking implementation
- User profile system launch

### Mid-term (Weeks 4-6)
- Dynamic configuration system
- Admin panels for configuration
- Performance optimization

### Long-term (Month 2+)
- Advanced analytics dashboard
- Predictive accuracy models
- ML-powered configuration tuning
- Multi-tenant support

---

## Documentation Updates

### User Documentation
- [ ] Update README with new features
- [ ] Create user guide for trust metrics
- [ ] Document user preferences panel
- [ ] Add FAQ section for common questions

### Developer Documentation
- [ ] API endpoint documentation
- [ ] Database schema reference
- [ ] Configuration options guide
- [ ] Testing guidelines
- [ ] Deployment checklist

---

## Conclusion

This comprehensive plan transforms the Insights Dashboard from a static, hardcoded system into a dynamic, database-driven platform with full AI trust validation, user profile management, and real-time configuration. The phased approach ensures stability while delivering incremental value, and the focus on testing and monitoring ensures production readiness.

**Next Action:** Execute database migration to establish foundation for all enhancements.
