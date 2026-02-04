# Verification Checklist - API Fixes

Use this checklist to verify that all fixes are working correctly.

## ✅ Model Update Verification

### 1. Check All Model References

Run this command to verify no `grok-beta` references remain in code:

```bash
grep -r "grok-beta" --include="*.ts" --include="*.tsx" app/ lib/
```

**Expected Result**: Only documentation files should appear (not code files)

### 2. Verify API Route Configuration

Check that the analyze route uses the correct model:

```bash
grep -n "model:" app/api/analyze/route.ts
```

**Expected Output**:
```
88:        model: 'grok-3',
142:          model_id: 'grok-3',
167:      model: 'grok-3',
```

## ✅ Error Handling Verification

### 1. Check Console Logging

Verify safe error logging (should use console.log, not console.error for JSON-safe logging):

```bash
grep -n "console.error" app/api/
```

**Expected Result**: No results (all should be console.log)

### 2. Test Error Message Extraction

Look for safe error handling pattern:

```bash
grep -A 1 "instanceof Error" app/api/
```

**Expected Pattern**:
```typescript
const errorMessage = error instanceof Error ? error.message : String(error);
console.log('[API] Error:', errorMessage);
```

## ✅ Environment Configuration

### 1. Check Environment Variables

Verify required variables are documented:

```bash
cat ENV_CONFIGURATION.md | grep -E "(XAI_API_KEY|ODDS_API_KEY|SUPABASE)"
```

**Expected**: All three variables should be listed with setup instructions

### 2. Test Health Endpoint

```bash
# Local development
curl http://localhost:3000/api/health | jq

# Production
curl https://your-domain.vercel.app/api/health | jq
```

**Expected Response Structure**:
```json
{
  "status": "healthy" or "degraded",
  "ready": true or false,
  "integrations": {
    "oddsAPI": { "configured": true, ... },
    "grokAI": { "configured": true, "model": "grok-3" },
    "supabase": { "configured": true, ... }
  }
}
```

## ✅ API Integration Tests

### 1. Test Grok AI Analyze Endpoint

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Analyze the Lakers spread tonight",
    "context": {
      "sport": "nba",
      "marketType": "spreads"
    }
  }' | jq
```

**Expected Fields**:
- `success`: true
- `model`: "grok-3"
- `trustMetrics`: object with finalConfidence
- `text`: string with analysis

### 2. Test Odds API Endpoint

```bash
curl -X POST http://localhost:3000/api/odds \
  -H "Content-Type: application/json" \
  -d '{
    "sport": "nfl",
    "marketType": "h2h"
  }' | jq
```

**Expected Fields**:
- `sport`: "nfl"
- `marketType`: "h2h"
- `events`: array
- `timestamp`: ISO date string

### 3. Test Insights Endpoint

```bash
curl http://localhost:3000/api/insights | jq
```

**Expected Fields**:
- `success`: true
- `insights`: object
- `dataSource`: "supabase", "default", or "fallback"

## ✅ Error Handling Tests

### 1. Test Missing API Key

Temporarily remove XAI_API_KEY and test:

```bash
# Should return graceful error, not crash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}' | jq
```

**Expected Response**:
```json
{
  "success": false,
  "error": "AI service not configured",
  "useFallback": true,
  "message": "Please configure XAI_API_KEY..."
}
```

### 2. Test Invalid JSON

```bash
# Should handle gracefully
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d 'invalid json' | jq
```

**Expected**: Valid JSON error response (not crash)

### 3. Test Malformed Request

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

**Expected**: Valid error response about missing query

## ✅ Database Integration

### 1. Check Supabase Connection

If Supabase is configured:

```bash
# Should not error, should return data or graceful fallback
curl http://localhost:3000/api/insights | jq '.dataSource'
```

**Expected**: "supabase", "default", or "fallback" (not error)

### 2. Verify Trust Metrics Storage

Check that analyze endpoint stores metrics:

1. Make successful analysis request
2. Check Supabase `ai_response_trust` table
3. Verify `model_id` = 'grok-3'

## ✅ Documentation

### 1. Verify All Docs Updated

```bash
ls -1 *.md
```

**Expected Files**:
- README.md
- ENV_CONFIGURATION.md
- TROUBLESHOOTING.md
- API_FIX_SUMMARY.md
- FIXES_APPLIED.md
- INTEGRATION_SETUP.md
- VERIFICATION_CHECKLIST.md

### 2. Check Documentation Links

```bash
grep -o "\[.*\](\..*\.md)" README.md
```

**Expected**: All documentation files should be linked

## ✅ Production Deployment

### 1. Environment Variables Set

In Vercel dashboard, verify:
- ✅ XAI_API_KEY is set
- ✅ ODDS_API_KEY is set
- ✅ NEXT_PUBLIC_SUPABASE_URL is set
- ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY is set

### 2. Build Success

Check Vercel deployment logs:
- ✅ Build completed successfully
- ✅ No TypeScript errors
- ✅ All routes compiled

### 3. Production Health Check

```bash
curl https://your-domain.vercel.app/api/health | jq
```

**Expected**: All integrations marked as configured

## ✅ Performance Verification

### 1. Response Times

Test analyze endpoint response time:

```bash
time curl -X POST https://your-domain.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}' > /dev/null
```

**Expected**: < 2 seconds

### 2. Check Error Rate

Monitor for 24 hours:
- ✅ 5xx errors < 0.5%
- ✅ 4xx errors < 5%
- ✅ Average response time < 1.5s

## 📋 Quick Checklist

Copy this for manual verification:

```
Model Updates:
[ ] All code uses 'grok-3' (not 'grok-beta')
[ ] Database queries filter by 'grok-3'
[ ] Documentation updated
[ ] No deprecated model references

Error Handling:
[ ] Safe error message extraction
[ ] No console.error with objects
[ ] Content-Type validation
[ ] JSON parsing validation
[ ] Proper error response format

API Integration:
[ ] /api/analyze returns 200 with valid data
[ ] /api/odds returns 200 with valid data
[ ] /api/insights returns 200 with valid data
[ ] /api/health returns correct status
[ ] Error responses are graceful (not crashes)

Environment:
[ ] All required env vars documented
[ ] Health endpoint shows configuration
[ ] Missing keys handled gracefully
[ ] Sensitive data not logged

Documentation:
[ ] README updated
[ ] ENV_CONFIGURATION.md complete
[ ] TROUBLESHOOTING.md helpful
[ ] API_FIX_SUMMARY.md accurate
[ ] All docs linked in README

Production:
[ ] Deployed to Vercel successfully
[ ] Environment variables set
[ ] Health check passes
[ ] No errors in logs
[ ] Response times acceptable
```

## 🚨 Rollback Procedure

If critical issues are found:

1. **Emergency Rollback**:
   ```bash
   # In Vercel dashboard
   # Go to Deployments → Select previous working deployment → Promote to Production
   ```

2. **Code Rollback**:
   ```bash
   git revert HEAD
   git push origin main
   ```

3. **Notify Team**:
   - Document the issue
   - Create incident report
   - Plan fix for next deployment

## ✅ Final Sign-Off

Once all items are verified:

- [ ] All automated tests pass
- [ ] Manual testing complete
- [ ] Performance acceptable
- [ ] Documentation accurate
- [ ] Team notified of changes
- [ ] Monitoring configured
- [ ] Rollback plan documented

**Verified By**: _____________  
**Date**: _____________  
**Version**: 1.0  

---

*This checklist should be completed before marking the deployment as production-ready.*
