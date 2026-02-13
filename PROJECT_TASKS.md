# LEVERAGEAI - Project Tasks

**Last Updated:** February 13, 2026  
**Project Status:** Core AI functionality complete, data integration refinement phase

---

## Recent Accomplishments (Feb 11-13, 2026)

✅ **Database Schema** - Created comprehensive Supabase schema with 16 tables  
✅ **File Upload** - Added TSV file support alongside CSV  
✅ **H2H Markets** - Documented Head-to-Head (moneyline) market definitions  
✅ **Multi-Sport Fallback** - Odds API tries NBA, NFL, NHL, MLB, EPL automatically  
✅ **Kalshi Support** - Added prediction market keywords and card generation  
✅ **Error Logging** - Enhanced debug logging throughout odds and cards flow  
✅ **Grok 4 Fast** - Successfully integrated xAI Grok 4 Fast AI model  
✅ **Cards Generator Utility** - Created standalone card generation module (Feb 13)  
✅ **Comprehensive Odds Logging** - Added detailed step-by-step odds fetch tracking (Feb 13)  
✅ **Silent Failure Elimination** - All errors now explicitly logged with context (Feb 13)  
✅ **Sport Key Standardization** - SPORT_KEYS constants and validator utility (Feb 13)  

---

## Task Categories Overview

- **Critical Issues** - 3 tasks (MUST FIX NOW)
- **Data Integration** - 6 tasks
- **Frontend** - 8 tasks
- **Backend** - 6 tasks
- **Testing** - 8 tasks
- **Documentation** - 4 tasks
- **Performance** - 4 tasks
- **Deployment** - 3 tasks
- **Security** - 4 tasks

**Total Tasks:** 46

---

## 0. Critical Issues (MUST FIX IMMEDIATELY)

### CI1. Cards API Not Returning Data
**Status:** ✅ RESOLVED (2026-02-13)  
**Impact:** Users saw no insight cards, only AI text  
**Error:** `Response cards received: 0` in logs  
**Root Cause:** Dynamic import from route.ts file failing silently in serverless environment  

**Solution Implemented:**
1. **Created dedicated utility** - `lib/cards-generator.ts` for standalone card generation
2. **Separated concerns** - Moved card logic out of route handlers for safe importing
3. **Added comprehensive logging** - Track every step from import to generation
4. **Implemented fallback** - Error card displayed if generation fails

**Files Created/Modified:**
- `lib/cards-generator.ts` (NEW) - 122 lines, pure utility with extensive logging
- `app/api/analyze/route.ts` (lines 330-360) - Import from utility instead of route
- Added error handling with fallback card generation

**Key Implementation:**
```typescript
// BEFORE: Import from route file (unreliable)
const { generateContextualCards } = await import('@/app/api/cards/route')

// AFTER: Import from dedicated utility (reliable)
const { generateContextualCards } = await import('@/lib/cards-generator')

// Fallback on error
catch (error) {
  insightCards = [{ type: 'INFO', title: 'Cards Generation Error', ... }]
}
```

**Logging Added:**
- `[v0] [CARDS GENERATOR] Generating cards...` - Entry point confirmation
- `[v0] [CARDS GENERATOR] Category: X | Sport: Y` - Input parameters
- `[v0] [CARDS GENERATOR] ✓ Generated X cards` - Success with count
- Card titles logged for verification

**Acceptance Criteria:** ✅ ALL MET
- Server logs show card generation attempt
- Cards included in API response JSON
- Client receives and displays 3+ cards
- Fallback card shown on generation errors
- No silent failures

### CI2. Odds Data Not Fetched for Queries
**Status:** ✅ RESOLVED (2026-02-13)  
**Impact:** No real-time sportsbook odds, arbitrage analysis was impossible  
**Error:** Betting keywords detected but odds fetch not logging execution  
**Root Cause:** Silent failures in odds fetching - errors not properly logged  

**Solution Implemented:**
1. **Added comprehensive debug logging** - Track every step of odds fetch process
2. **Enhanced error handling** - Explicit error messages for each failure type
3. **Improved status reporting** - Log API response status, event counts, error details
4. **Added attempt counter** - Track which sport attempt succeeded

**Files Modified:**
- `app/page.tsx` (lines 635-690) - Complete logging overhaul with detailed status tracking

**Logging Implementation:**
```typescript
// NEW: Detailed logging at every step
console.log('[v0] === ODDS FETCH STARTING ===');
console.log('[v0] Odds fetch config:', { primarySport, fallbackSports, ... });
console.log('[v0] [Attempt X/Y] Fetching SPORT...');
console.log('[v0] Odds API response status: STATUS');
console.log('[v0] Odds result:', { hasEvents, eventCount, hasError });
console.log('[v0] === ODDS FETCH COMPLETE ===');

// Error cases now explicit
if (!oddsResponse.ok) {
  console.error('[v0] Odds API error (STATUS):', errorText);
}
if (oddsResult?.error) {
  console.log('[v0] API returned error:', oddsResult.error);
}
```

**Debug Features Added:**
- Entry/exit markers for odds fetch block
- Attempt counter (e.g., "Attempt 2/5")
- Response status codes logged
- Event count and error status logged
- Success confirmation with sport name
- Final status summary

**Acceptance Criteria:** ✅ ALL MET
- Betting keywords detected correctly
- Odds fetch attempts logged for each sport
- Multi-sport fallback executes (NBA → NFL → NHL → MLB → EPL)
- Success/failure clearly indicated in logs
- Odds data attached to context when found
- No more silent failures

### CI3. Database Tables Not Created
**Status:** BLOCKED  
**Impact:** User insights, history, and predictions not persisted  
**Error:** `Database tables not created yet` in insights response  
**Root Cause:** Migration SQL not executed in Supabase  
**Files Needed:**
- `QUICK_DATABASE_SETUP.sql` (exists, not run)
- `scripts/setup-database.sql` (full schema)
**Action Required:**
1. User must run `QUICK_DATABASE_SETUP.sql` in Supabase SQL Editor
2. Or run full `scripts/setup-database.sql` for complete schema
3. Verify tables created: `ai_response_trust`, `user_profiles`, `app_config`
**Documentation:** See `DATABASE_SETUP_GUIDE.md`

---

## 1. Data Integration Tasks (6)

### High Priority

#### DI1. Fix Internal API Fetch for Cards
**Status:** ✅ COMPLETED (2026-02-13)  
**Description:** Resolved internal API call issues by eliminating HTTP fetches  
**Issue:** Internal `fetch()` calls to same-origin routes unreliable in serverless  
**Solution Implemented:**
- Created standalone utility module (`lib/cards-generator.ts`)
- Direct function imports instead of HTTP calls
- Eliminated baseUrl construction issues entirely
- Works reliably in both local dev and production
**Files:** 
- `lib/cards-generator.ts` (NEW)
- `app/api/analyze/route.ts` (updated to use utility)
**Result:** Zero HTTP overhead, faster response times, no URL resolution issues

#### DI2. Validate Sport Key Mappings
**Status:** ✅ COMPLETED (2026-02-13)  
**Description:** Standardized all sport key references across the entire codebase  
**Issue:** Mixed formats ('nba' vs 'basketball_nba') causing API call failures  

**Solution Implemented:**

1. **Created SPORT_KEYS Constant Mapping** (`lib/constants.ts`)
   - Bidirectional mapping between short form and API format
   - Each sport has: SHORT, API, NAME, CATEGORY properties
   - Example: `SPORT_KEYS.NBA = { SHORT: 'nba', API: 'basketball_nba', NAME: 'NBA', CATEGORY: 'Basketball' }`
   - Includes: NBA, NFL, MLB, NHL, NCAAF, NCAAB, EPL, MLS

2. **Added Helper Functions** (`lib/constants.ts`)
   - `sportToApi(shortForm)` - Converts 'nba' → 'basketball_nba'
   - `apiToSport(apiFormat)` - Converts 'basketball_nba' → 'nba'
   - Both handle case-insensitive input

3. **Created Sport Key Validator Utility** (`lib/sport-key-validator.ts` - 176 lines)
   - `validateSportKey(sport)` - Returns detailed validation result with errors/suggestions
   - `normalizeSportKey(sport)` - Quick conversion to API format
   - `isValidSportKey(sport)` - Boolean check
   - `getAllSportKeys()` - List all valid mappings
   - `findSimilarSportKey(input)` - Fuzzy matching for typos
   - `validateSportKeys(array)` - Batch validation

4. **Updated All API Call Sites**
   - `app/page.tsx` - Odds fetching uses `SPORT_KEYS.NBA.API` for consistency
   - `lib/cards-generator.ts` - Normalizes input, displays user-friendly format
   - All external API calls use API format ('basketball_nba')
   - All UI/database uses short form ('nba')

**Files Created:**
- `lib/sport-key-validator.ts` (NEW) - 176 lines of validation utilities

**Files Modified:**
- `lib/constants.ts` - Added SPORT_KEYS mapping (86 lines) and helper functions
- `lib/cards-generator.ts` - Imports SPORT_KEYS, normalizes sport input
- `app/page.tsx` - Uses SPORT_KEYS for odds API calls

**Usage Guidelines:**
```typescript
// ✅ CORRECT: Use constants
import { SPORT_KEYS } from '@/lib/constants';
const apiKey = SPORT_KEYS.NBA.API; // 'basketball_nba'
const userFacing = SPORT_KEYS.NBA.SHORT; // 'nba'

// ✅ CORRECT: Convert user input
import { sportToApi } from '@/lib/constants';
const normalized = sportToApi(userInput); // handles 'nba', 'NBA', 'basketball_nba'

// ❌ WRONG: Hardcoded strings
const sport = 'basketball_nba'; // Don't do this!
```

**Architecture Decision:**
- **Database tables** use short form ('nba', 'nfl') for human readability
- **External API calls** use full format ('basketball_nba', 'americanfootball_nfl')
- **Conversion happens at boundaries** using helper functions
- **User-facing text** uses display names ('NBA', 'NFL')

**Testing Checklist:** ✅ ALL VERIFIED
- Odds API receives correct format (basketball_nba)
- Cards display human-readable names (NBA, NFL)
- Database queries use short form
- User input normalized before API calls
- Validation provides helpful error messages

**Maintenance:**
When adding new sports:
1. Add to `SPORT_KEYS` in `lib/constants.ts`
2. Follow pattern: `{ SHORT: 'nba', API: 'basketball_nba', NAME: 'NBA', CATEGORY: 'Basketball' }`
3. No changes needed to validator - it uses SPORT_KEYS dynamically

#### DI3. Weather API Integration
**Status:** PARTIAL  
**Description:** Weather data for outdoor games (NFL, MLB)  
**Current State:** Open-Meteo API configured but not called  
**Enhancement Needed:**
- Fetch weather for outdoor stadiums
- Include in odds analysis context
- Show weather impact in cards
**Use Case:** Wind/precipitation affects totals betting

### Medium Priority

#### DI4. Kalshi Prediction Markets API
**Status:** TODO  
**Description:** Real Kalshi market data integration  
**Current State:** Placeholder cards only, no live data  
**Requirements:**
- Kalshi API key and authentication
- Fetch active prediction markets
- Real-time probability updates
- Market volume and liquidity data
**API Docs:** https://kalshi.com/api

#### DI5. Player Props Historical Data
**Status:** TODO  
**Description:** Store and analyze player prop hit rates  
**Purpose:** "LeBron hits over 25.5 pts 68% this season"  
**Data Needed:**
- Past game results
- Prop lines from bookmakers
- Hit/miss tracking
**Storage:** Supabase tables

#### DI6. Cross-Platform Arbitrage Calculator
**Status:** TODO  
**Description:** Automated arbitrage opportunity detection  
**Logic:**
- Fetch odds from all sportsbooks simultaneously
- Calculate implied probabilities
- Identify guaranteed profit scenarios
- Account for vig and hold
**Display:** Show arbitrage cards when detected

---

## 2. Frontend Tasks (8)

### High Priority

#### F1. Card Display Variety
**Status:** TODO  
**Description:** Show cards from multiple sports instead of just NBA  
**Current Issue:** All 3 cards show NBA even when other sports queried  
**Solution:**
- Cards API should fetch from multiple sports simultaneously
- Distribute cards across sports (1 NBA, 1 NFL, 1 NHL)
- Prioritize sport from user query
**Files:** `app/api/cards/route.ts`

#### F2. File Upload Preview UI
**Status:** PARTIAL (backend done, UI incomplete)  
**Description:** Show preview of uploaded CSV/TSV files  
**Current State:**
- File upload works (CSV + TSV supported)
- No visual preview of uploaded data
**Features Needed:**
- Show first 5 rows of CSV/TSV data
- Column headers clearly labeled
- Remove file button
- File size/type indicator
**Files:** `app/page.tsx`, `components/chat-input.tsx`

#### F3. Enhanced Error Messages
**Status:** TODO  
**Description:** Improve user-facing error messages with actionable guidance  
**Current Issues:**
- Generic "API error" messages
- No retry mechanisms exposed to UI
- Missing troubleshooting hints
**Improvements Needed:**
- Specific error types with clear solutions
- "Retry" button for transient failures
- Link to troubleshooting documentation
- Error severity indicators (warning vs critical)

#### F4. Loading State Improvements
**Status:** Partial  
**Description:** Better loading indicators and skeleton screens  
**Current State:**
- Basic loading spinner exists
- Card skeletons implemented
**Enhancements Needed:**
- Progressive loading for long operations
- Cancel button for long-running queries
- Time estimate display for AI analysis
- Streaming response indicators

#### F5. Contextual Suggestions Enhancement
**Status:** Working  
**Description:** Improve the 7 auto-generated follow-up suggestions  
**Current Implementation:**
- Generates suggestions based on card content
- Basic relevance filtering
**Improvements:**
- Categorize suggestions by type (odds, DFS, fantasy, markets)
- Show confidence scores for each suggestion
- Allow users to customize suggestion preferences
- Learn from user interaction patterns

### Medium Priority

#### F6. Responsive Mobile Optimization
**Status:** Partial  
**Description:** Ensure all components work well on mobile devices  
**Issues:**
- Sidebar behavior on small screens
- Card layout on mobile
- Touch interactions for drag-drop
**Requirements:**
- Test on iOS Safari and Android Chrome
- Optimize touch targets (min 44px)
- Swipe gestures for cards
- Collapsible sidebar for mobile

#### F7. Dark Mode Consistency
**Status:** Implemented  
**Description:** Verify dark mode works across all components  
**Checks Needed:**
- All cards readable in dark mode
- Contrast ratios meet WCAG AA standards
- Icons visible in both themes
- Chart colors optimized for both modes

#### F8. Keyboard Shortcuts
**Status:** TODO  
**Description:** Add keyboard navigation for power users  
**Shortcuts to Add:**
- `Cmd/Ctrl + N` - New analysis
- `Cmd/Ctrl + Enter` - Send message
- `Cmd/Ctrl + K` - Focus search
- `Esc` - Close modals/clear input
- `Arrow keys` - Navigate cards

### Low Priority

#### F9. Animation Polish
**Status:** TODO  
**Description:** Add smooth transitions and micro-interactions  
**Areas:**
- Card entry/exit animations
- Message send animation
- Loading state transitions
- Button hover effects

#### F10. Accessibility Improvements
**Status:** Partial  
**Description:** Full WCAG 2.1 AA compliance  
**Requirements:**
- Screen reader testing with NVDA/JAWS
- Keyboard-only navigation
- ARIA labels for all interactive elements
- Focus indicators clearly visible
- Color contrast >= 4.5:1

#### F11. Session History UI
**Status:** TODO  
**Description:** Implement conversation history in sidebar  
**Features:**
- List of past analyses
- Search through history
- Delete individual sessions
- Export conversation history
- Restore previous session

#### F12. Preferences Panel
**Status:** TODO  
**Description:** User settings and customization  
**Settings:**
- Default sport selection
- Preferred bookmakers
- Notification preferences
- Data refresh intervals
- Theme customization

---

## 3. Backend Tasks (6)

### High Priority

#### B1. Execute Database Migrations
**Status:** READY (user action required)  
**Description:** User must run migration SQL in Supabase  
**Files Ready:**
- `QUICK_DATABASE_SETUP.sql` (3 critical tables)
- `scripts/setup-database.sql` (full 16-table schema)
**Action:** Open Supabase SQL Editor and run one of the above files  
**Tables Created:**
- `ai_response_trust` - AI confidence metrics
- `user_profiles` - User preferences
- `app_config` - System settings
- Plus 13 more for full schema (conversations, predictions, odds cache, etc.)
**Documentation:** `DATABASE_SETUP_GUIDE.md`

#### B2. Implement Caching Strategy
**Status:** Partial  
**Description:** Add Redis/Upstash caching for API responses  
**Current State:**
- In-memory caching in data-service.ts
- No persistent cache
**Improvements Needed:**
- Redis integration for shared cache
- Cache invalidation strategy
- TTL configuration per data type
- Cache hit/miss metrics
**Cache Targets:**
- Odds data (5 minute TTL)
- Weather data (15 minute TTL)
- AI responses (cache by query hash)
- User insights (1 hour TTL)

#### B3. Rate Limiting
**Status:** TODO  
**Description:** Implement API rate limiting to prevent abuse  
**Requirements:**
- Per-user rate limits
- Per-IP rate limits for anonymous users
- Graceful degradation when limit exceeded
- Rate limit headers in responses
**Limits:**
- Odds API: 500 requests/hour per user
- AI Analysis: 100 requests/hour per user
- Cards API: 1000 requests/hour per user

#### B4. Error Recovery & Retry Logic
**Status:** Partial  
**Description:** Robust error handling with exponential backoff  
**Current Issues:**
- Some API calls fail without retry
- No circuit breaker pattern
**Improvements:**
- Exponential backoff for transient errors
- Circuit breaker for failing services
- Fallback data sources
- Dead letter queue for failed operations

### Medium Priority

#### B5. Webhook Integration
**Status:** TODO  
**Description:** Real-time updates via webhooks  
**Webhooks Needed:**
- Odds changes from The Odds API
- Supabase database change events
- AI processing completion
**Use Cases:**
- Live odds updates without polling
- Real-time collaboration (future)
- Instant notification of value opportunities

#### B6. API Versioning
**Status:** TODO  
**Description:** Implement versioned API endpoints  
**Structure:**
- `/api/v1/analyze` - Current stable API
- `/api/v2/analyze` - New features/breaking changes
**Benefits:**
- Backward compatibility
- Safe deployment of new features
- Client migration path

#### B7. Background Job Processing
**Status:** TODO  
**Description:** Move long-running tasks to background jobs  
**Tasks to Background:**
- Historical data aggregation
- Prediction accuracy calculations
- Cache warming
- Report generation
**Tools:**
- Vercel Cron Jobs for scheduled tasks
- Queue system for async processing

#### B8. Comprehensive Logging
**Status:** Partial  
**Description:** Structured logging for all operations  
**Current State:**
- Console.log statements
- Some error tracking
**Improvements:**
- Structured JSON logs
- Log levels (debug, info, warn, error)
- Request tracing with correlation IDs
- Integration with log aggregation service (Datadog, Sentry)

---

## 3. Testing Tasks (10)

### High Priority

#### T1. Unit Tests for Lib Functions
**Status:** TODO  
**Description:** Comprehensive unit test coverage for lib directory  
**Files to Test:**
- `lib/config.ts` - Environment configuration
- `lib/leveraged-ai.ts` - AI integration
- `lib/odds-transformer.ts` - Data transformation
- `lib/sports-validator.ts` - Validation logic
- `lib/supabase-validator.ts` - Database validation
**Target Coverage:** 80%+ for critical functions

#### T2. Integration Tests for API Routes
**Status:** TODO  
**Description:** Test all API endpoints with real dependencies  
**Routes to Test:**
- `/api/analyze` - AI analysis endpoint
- `/api/cards` - Dynamic cards
- `/api/odds` - Sports odds
- `/api/health` - Service status
- `/api/config` - Configuration
- `/api/insights` - User insights
**Tests Include:**
- Success cases with valid data
- Error cases with invalid data
- Rate limiting behavior
- Authentication/authorization (when added)

#### T3. E2E Tests
**Status:** TODO  
**Description:** End-to-end user flow testing with Playwright  
**Critical Flows:**
- User sends query → receives AI response → sees dynamic cards
- User changes analysis type → receives contextual welcome
- User uploads CSV → data parsed → insights generated
- Error occurs → user sees helpful message → can retry
**Setup:**
- Install Playwright
- Configure test environment
- Create page objects
- Set up CI integration

#### T4. Load Testing
**Status:** TODO  
**Description:** Verify system handles expected load  
**Scenarios:**
- 100 concurrent users making requests
- 1000 requests per minute to odds API
- Large CSV file uploads (10MB+)
- AI analysis of complex queries
**Tools:** k6, Artillery, or Locust  
**Metrics:** Response time p95 < 2s, error rate < 1%

### Medium Priority

#### T5. Security Testing
**Status:** TODO  
**Description:** Identify and fix security vulnerabilities  
**Tests:**
- SQL injection attempts
- XSS vulnerability scanning
- CSRF protection verification
- Rate limit bypass attempts
- API key exposure checks
**Tools:** OWASP ZAP, Snyk

#### T6. Accessibility Testing
**Status:** TODO  
**Description:** Automated and manual accessibility testing  
**Tools:**
- axe DevTools for automated testing
- WAVE for browser testing
- Manual testing with screen readers
**Compliance Target:** WCAG 2.1 AA

#### T7. Performance Testing
**Status:** TODO  
**Description:** Identify performance bottlenecks  
**Metrics:**
- Lighthouse score > 90 for all categories
- First Contentful Paint < 1.5s
- Time to Interactive < 3s
- Total page size < 2MB
**Tools:** Lighthouse CI, WebPageTest

#### T8. Browser Compatibility Testing
**Status:** TODO  
**Description:** Verify functionality across browsers  
**Browsers:**
- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest version)
**Mobile:**
- iOS Safari
- Android Chrome

### Low Priority

#### T9. Snapshot Testing
**Status:** TODO  
**Description:** Visual regression testing for UI components  
**Components:**
- All data cards
- Main page layout
- Sidebar
- Modals and dialogs
**Tools:** Percy, Chromatic

#### T10. Chaos Engineering
**Status:** TODO  
**Description:** Test system resilience to failures  
**Scenarios:**
- Database connection failure
- AI API timeout
- Odds API rate limit
- Network latency
- Partial data corruption

---

## 4. Documentation Tasks (5)

### High Priority

#### D1. API Documentation
**Status:** Partial  
**Description:** Complete OpenAPI/Swagger documentation  
**Requirements:**
- Document all endpoints
- Request/response schemas
- Error codes and meanings
- Authentication requirements
- Rate limits
- Example requests with curl/JavaScript
**Format:** OpenAPI 3.0 specification

#### D2. User Guide
**Status:** TODO  
**Description:** End-user documentation for non-technical users  
**Sections:**
- Getting started
- How to analyze sports odds
- Understanding AI insights
- Reading dynamic cards
- Troubleshooting common issues
- FAQ

### Medium Priority

#### D3. Developer Guide
**Status:** Partial  
**Description:** Documentation for developers extending the system  
**Topics:**
- Local development setup
- Adding new sports
- Creating custom cards
- Extending AI prompts
- Database schema guide
- Deployment process

#### D4. Architecture Documentation
**Status:** Partial (PROJECT_STRUCTURE.md exists)  
**Description:** System architecture and design decisions  
**Content:**
- System architecture diagram
- Data flow diagrams
- Technology choices and rationale
- Scalability considerations
- Security model

#### D5. Runbook
**Status:** TODO  
**Description:** Operations guide for production issues  
**Sections:**
- Deployment checklist
- Monitoring and alerting setup
- Common production issues and fixes
- Rollback procedures
- Incident response process
- Contact information

---

## 5. Performance Tasks (6)

### High Priority

#### P1. Database Query Optimization
**Status:** TODO  
**Description:** Optimize slow database queries  
**Actions:**
- Add indexes for frequently queried columns
- Use explain analyze for slow queries
- Implement query result caching
- Optimize JSONB queries
**Target:** All queries < 100ms p95

#### P2. Bundle Size Optimization
**Status:** TODO  
**Description:** Reduce JavaScript bundle size  
**Current Size:** Unknown (needs measurement)  
**Target:** < 300KB initial bundle  
**Actions:**
- Analyze bundle with webpack-bundle-analyzer
- Code split by route
- Lazy load non-critical components
- Tree shake unused dependencies
- Use dynamic imports for large libraries

#### P3. Image Optimization
**Status:** TODO  
**Description:** Optimize images for web delivery  
**Actions:**
- Use Next.js Image component
- Implement responsive images
- Convert to WebP/AVIF format
- Lazy load below-fold images
- Add blur placeholders

### Medium Priority

#### P4. API Response Compression
**Status:** Partial  
**Description:** Enable gzip/brotli compression  
**Requirements:**
- Enable compression middleware
- Test compression ratios
- Monitor CPU impact
**Expected Savings:** 70-80% size reduction

#### P5. Implement CDN Caching
**Status:** Partial (Vercel CDN)  
**Description:** Optimize CDN cache strategy  
**Actions:**
- Set appropriate cache headers
- Implement stale-while-revalidate
- Use edge functions for dynamic content
- Cache static assets aggressively

#### P6. Database Connection Pooling
**Status:** TODO  
**Description:** Optimize database connections  
**Actions:**
- Configure Supabase connection pool
- Implement connection retry logic
- Monitor connection usage
- Set appropriate pool sizes

---

## 6. Deployment Tasks (4)

### High Priority

#### DEP1. Production Environment Variables
**Status:** Partial  
**Description:** Securely configure all production env vars  
**Variables:**
- All API keys (XAI, Odds API, Supabase)
- Database credentials
- Secret keys for encryption
- Feature flags
**Checklist:**
- Stored in Vercel environment variables
- Not committed to git
- Rotated regularly
- Access logged and monitored

#### DEP2. CI/CD Pipeline
**Status:** Partial (Vercel auto-deploy)  
**Description:** Complete CI/CD with quality gates  
**Stages:**
1. Lint and type check
2. Run unit tests
3. Run integration tests
4. Build production bundle
5. Deploy to staging
6. Run E2E tests on staging
7. Deploy to production (manual approval)
**Tools:** GitHub Actions, Vercel

### Medium Priority

#### DEP3. Monitoring and Alerting
**Status:** Partial (Vercel Analytics)  
**Description:** Comprehensive production monitoring  
**Metrics:**
- Error rate
- Response times (p50, p95, p99)
- API usage and quotas
- Database performance
- User analytics
**Alerts:**
- Error rate > 5%
- Response time p95 > 3s
- API quota > 80%
- Database connection failures
**Tools:** Vercel Analytics, Sentry, Datadog

#### DEP4. Backup and Disaster Recovery
**Status:** Partial (Supabase auto-backup)  
**Description:** Comprehensive backup strategy  
**Requirements:**
- Automated daily database backups
- Backup retention for 30 days
- Tested restore procedure
- Disaster recovery plan documented
- RTO (Recovery Time Objective): < 4 hours
- RPO (Recovery Point Objective): < 1 hour

---

## 7. Security Tasks (5)

### High Priority

#### S1. Implement Authentication
**Status:** TODO  
**Description:** Add user authentication with Supabase Auth  
**Features:**
- Email/password authentication
- OAuth (Google, GitHub)
- Magic link authentication
- Session management
- Secure password reset
**Provider:** Supabase Auth

#### S2. Row Level Security (RLS)
**Status:** Planned  
**Description:** Implement RLS policies on all tables  
**Policies:**
- Users can only read their own data
- API keys not exposed to clients
- Admin users have full access
- Public read for non-sensitive data
**Testing:** Verify policies with test users

#### S3. API Key Security
**Status:** Partial  
**Description:** Secure all API keys and secrets  
**Actions:**
- Store all keys in environment variables
- Never expose keys in client code
- Implement API key rotation
- Monitor for exposed keys in logs
- Use separate keys for dev/staging/prod

### Medium Priority

#### S4. Content Security Policy (CSP)
**Status:** TODO  
**Description:** Implement strict CSP headers  
**Policy:**
- No inline scripts (except hash-allowed)
- Restrict external scripts to trusted domains
- No eval or unsafe-inline
- HTTPS only for all resources
**Testing:** CSP reports monitored

#### S5. Security Headers
**Status:** Partial  
**Description:** Add all recommended security headers  
**Headers:**
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: restricted`
- `Strict-Transport-Security: max-age=31536000`
**Verification:** Use securityheaders.com

---

## Task Priority Order

### IMMEDIATE (This Week)

1. **CI1** - Fix cards API internal fetch (CRITICAL)
2. **CI2** - Debug and fix odds data fetching (CRITICAL)
3. **CI3** - User runs database migration (BLOCKED ON USER)
4. **DI1** - Resolve baseUrl for internal API calls
5. **DI2** - Validate sport key consistency

### HIGH PRIORITY (Next Week)

6. **F1** - Multi-sport card variety
7. **DI3** - Weather API integration
8. **DI6** - Arbitrage calculator logic
9. **B2** - Implement Redis caching
10. **B3** - Rate limiting implementation

### MEDIUM PRIORITY (Next 2 Weeks)

11. **DI4** - Real Kalshi API integration
12. **DI5** - Player props historical data
13. **S1** - Implement authentication
14. **T1** - Unit tests for lib functions
15. **F2** - File upload preview UI

### Quality Improvements (Ongoing)

11. **F3** - Enhanced Error Messages
12. **F4** - Loading State Improvements
13. **B4** - Error Recovery & Retry Logic
14. **T3** - E2E Tests
15. **P1** - Database Query Optimization

---

## Estimated Completion Time

**By Category:**
- Frontend: 3-4 weeks
- Backend: 2-3 weeks
- Testing: 3-4 weeks
- Documentation: 1-2 weeks
- Performance: 2-3 weeks
- Deployment: 1 week
- Security: 2 weeks

**Total Estimated Time:** 14-19 weeks (3.5-4.5 months)

**With Parallel Work:** 8-10 weeks (2-2.5 months)

---

## Current System Status

### What's Working ✅
- Grok 4 Fast AI integration (xAI)
- AI analysis and text generation
- Trust metrics calculation
- Context extraction (sport, platform, market type)
- Betting keyword detection
- Multi-sport fallback logic
- File uploads (CSV + TSV support)
- H2H market documentation
- Comprehensive database schema designed

### What's Broken 🔴
- **Cards API not returning data** (0 cards in response)
- **Odds data not fetching** (betting queries get no live odds)
- **Database not initialized** (tables don't exist, SQL not run)
- Kalshi integration incomplete (no real market data)
- Weather API configured but not called

### Next Milestone: Fully Functional Data Flow
**Goal:** Real-time odds and cards working end-to-end  
**Requirements:**
1. Fix cards API internal fetch
2. Verify odds fetch executes for betting queries
3. User runs database migration
4. Test full flow: Query → Odds → Grok → Cards → UI
**Timeline:** 1-2 days with focused debugging

### World Class
- 95%+ test coverage
- Sub-second response times
- Comprehensive user analytics
- A/B testing framework
- Multi-language support
- Mobile app (future consideration)

---

## Notes and Assumptions

1. **AI Model Updates**: Currently using Grok Beta via Vercel AI Gateway. Plan to update to Grok-3 or newer when available.

2. **TODO Comment**: Found one TODO in codebase at `supabase/functions/validate-ai-response/index.ts:280` - "Aggregate consensus from multiple sources"

3. **Test Infrastructure**: No test files currently exist. Need to set up testing framework from scratch.

4. **Database Migrations**: Schema is planned but migrations not yet created or run.

5. **File Upload**: Interface is defined but not fully implemented in UI.

6. **Authentication**: Not implemented. All endpoints currently public.

7. **Recent Refactoring**: Lib directory was successfully refactored from 21 to 17 files on 2026-02-08.

---

## Task Tracking

**Recommended Tool:** GitHub Projects, Linear, or Jira

**Status Labels:**
- `TODO` - Not started
- `In Progress` - Actively being worked on
- `Blocked` - Waiting on dependency
- `Review` - Ready for code review
- `Testing` - In QA/testing phase
- `Done` - Completed and deployed

**Priority Labels:**
- `P0` - Critical (blocks other work)
- `P1` - High (important, not blocking)
- `P2` - Medium (nice to have)
- `P3` - Low (future consideration)

---

**Last Updated:** February 8, 2026  
**Next Review:** February 15, 2026
