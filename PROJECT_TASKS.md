# NFC Assistant - Remaining Project Tasks

**Last Updated:** February 8, 2026  
**Project Status:** Core functionality complete, optimization and enhancement phase

---

## Task Categories Overview

- **Frontend** - 12 tasks
- **Backend** - 8 tasks
- **Testing** - 10 tasks
- **Documentation** - 5 tasks
- **Performance** - 6 tasks
- **Deployment** - 4 tasks
- **Security** - 5 tasks

**Total Tasks:** 50

---

## 1. Frontend Tasks (12)

### High Priority

#### F1. Fix Grok-3 Display References
**Status:** In Progress  
**Description:** Update all UI references from "Grok-3" to "Grok Beta" to match actual model name  
**Files Affected:**
- `app/page.tsx` (11 occurrences at lines 119-123, 791, 795, 879, 883, 1051+)
- `lib/grok-pipeline.ts` (line 280)
- Welcome messages and AI model display text
**Acceptance Criteria:**
- All user-facing text shows correct model name
- No confusion about which AI model is being used
- Model name matches actual API implementation

#### F2. Implement File Upload UI
**Status:** TODO  
**Description:** Complete the file attachment interface for images and CSV files  
**Files Affected:**
- `app/page.tsx` (FileAttachment interface defined but not fully integrated)
**Features Needed:**
- Drag-and-drop interface
- File preview thumbnails
- CSV parsing and validation
- File size limits and type validation
- Remove file functionality
**Acceptance Criteria:**
- Users can attach images and CSV files to messages
- Files are validated before upload
- Preview shows file content appropriately

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

## 2. Backend Tasks (8)

### High Priority

#### B1. Implement Database Migrations
**Status:** Planned  
**Description:** Create and run all Supabase migrations from schema plan  
**Files Needed:**
- `supabase/migrations/20260208_ai_response_trust.sql`
- `supabase/migrations/20260208_predictions.sql`
- `supabase/migrations/20260208_user_profiles.sql`
- `supabase/migrations/20260208_rls_policies.sql`
**Tables to Create:**
- `ai_response_trust` - Store AI confidence and trust metrics
- `predictions` - Historical predictions and outcomes
- `user_profiles` - User preferences and settings
- `session_history` - Conversation history
- `api_usage` - Track API calls and quotas
**Acceptance Criteria:**
- All tables created successfully
- Indexes properly configured
- RLS policies active and tested
- Foreign key constraints validated

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

## Task Priority Matrix

### Critical Path (Must Complete First)

1. **B1** - Implement Database Migrations
2. **T1** - Unit Tests for Lib Functions
3. **S1** - Implement Authentication
4. **S2** - Row Level Security
5. **DEP1** - Production Environment Variables

### High Value (Complete Next)

6. **F1** - Fix Grok-3 Display References
7. **F2** - Implement File Upload UI
8. **B2** - Implement Caching Strategy
9. **B3** - Rate Limiting
10. **T2** - Integration Tests for API Routes

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

## Success Criteria

### Minimum Viable Product (MVP)
- ✅ Core AI analysis working
- ✅ Real-time odds integration
- ✅ Dynamic card system
- ⚠️ Basic error handling (needs improvement)
- ⚠️ Documentation (needs user guide)
- ❌ No authentication (critical gap)
- ❌ No testing (critical gap)

### Production Ready
- 80%+ test coverage
- Authentication implemented
- All security headers configured
- Monitoring and alerting active
- User documentation complete
- Performance benchmarks met
- Zero critical vulnerabilities

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
