# NFC Sports AI Assistant - Setup Guide

## Production-Ready SaaS Integration

This is a fully integrated sports betting and fantasy sports AI assistant built with:

- **Next.js 16** - App Router with React Server Components
- **Supabase** - PostgreSQL database with Row Level Security + Realtime
- **Grok AI** - xAI's latest model via AI SDK 6
- **TypeScript** - Full type safety
- **shadcn/ui** - Production-grade UI components

## Required Environment Variables

Add these in the v0 **Vars** section (sidebar):

```env
# Supabase (auto-configured via v0 integration)
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Grok AI (auto-configured via v0 integration)
# No additional setup needed - uses Vercel AI Gateway

# Optional: Custom redirect for dev
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/
```

## Database Setup

### Step 1: Connect Supabase Integration

1. Open the sidebar in v0
2. Navigate to **Connect** section
3. Select **Supabase** and follow the prompts
4. Your database credentials will be automatically configured

### Step 2: Run Database Migration

The SQL migration file is located at:
`supabase/migrations/20260201_trust_integrity_system.sql`

This creates:
- **users** table with credits system
- **chats** table for conversation history
- **messages** table with AI responses
- **trust_scores** table for validation metrics
- **credits_ledger** for transaction tracking
- **odds_data** for sports betting data
- **file_attachments** for user uploads
- **validations** for AI fact-checking

**To execute:**
```bash
# Use the Supabase CLI or v0's built-in migration runner
# The migration includes full RLS policies for security
```

### Step 3: Connect Grok AI

1. Open the sidebar in v0
2. Navigate to **Connect** section
3. Select **Grok** integration
4. AI SDK will automatically use the AI Gateway (zero-config)

## Features Implemented

### Authentication
- Email/password signup with confirmation
- Supabase Auth with session management
- Protected routes via middleware
- HTTP-only cookie sessions

### Credit System
- Database-backed credit tracking
- Real-time balance updates via Supabase Realtime
- Transaction ledger for audit trail
- Initial 50 credits for new users
- 1 credit per AI message

### AI Chat
- Streaming responses with AI SDK 6
- Grok 2 model for sports analysis
- Conversation history persistence
- Real-time message sync across devices
- Context-aware system prompts

### Trust & Validation
- Supabase Edge Function for AI validation
- Trust score calculation (0-100%)
- Source tracking and reliability metrics
- Asynchronous fact-checking

### Real-time Features
- Live message updates
- Credit balance sync
- Presence indicators (ready for extension)
- Multi-device synchronization

## Architecture

### Frontend (`/app/`)
- **page.tsx** - Server Component (auth check, data fetching)
- **auth/login** - Authentication pages
- **components/chat-interface.tsx** - Client Component (interactive UI)

### Backend (`/app/actions/`)
- **auth.ts** - Sign up, sign in, sign out, get user
- **credits.ts** - Balance management, ledger operations
- **chat.ts** - CRUD operations for chats and messages
- **ai.ts** - AI response generation with streaming

### Database Layer (`/lib/supabase/`)
- **client.ts** - Browser-side Supabase client
- **server.ts** - Server-side Supabase client
- **proxy.ts** - Session refresh in middleware

### Security
- Row Level Security (RLS) policies on all tables
- User data isolated by `auth.uid()`
- Service role key only used server-side
- No client access to sensitive operations

## Usage Flow

1. **User signs up** → Email confirmation required
2. **Login redirect** → Lands on main chat interface
3. **Create new chat** → Stored in database
4. **Send message** → User message saved, AI generates response
5. **Stream response** → Real-time tokens displayed
6. **Credit deduction** → Balance updated, ledger logged
7. **Trust validation** → Edge function scores response asynchronously

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Deployment

Deploy directly from v0:

1. Click **Publish** button in top-right
2. Choose Vercel project
3. Environment variables auto-configured
4. Database connected via Supabase integration
5. Deploy!

## Troubleshooting

### Issue: Database connection error
- **Solution**: Ensure Supabase integration is connected in v0 sidebar → Connect

### Issue: Migration failed
- **Solution**: Check Supabase dashboard for existing tables, may need to reset

### Issue: AI not responding
- **Solution**: Verify Grok integration is connected and AI Gateway is enabled

### Issue: Credits not updating
- **Solution**: Check Supabase Realtime is enabled for the `users` table

## Next Steps

- [ ] Add OAuth providers (Google, GitHub)
- [ ] Implement file upload to Supabase Storage
- [ ] Add Stripe for credit purchases
- [ ] Implement betting odds data ingestion
- [ ] Add fantasy sports player database
- [ ] Build admin dashboard
- [ ] Add email notifications
- [ ] Implement rate limiting with Upstash

## Support

For issues or questions, check:
- v0 documentation: https://v0.dev/docs
- Supabase docs: https://supabase.com/docs
- AI SDK docs: https://sdk.vercel.ai

---

**Built with v0** - Production-ready from day one.
