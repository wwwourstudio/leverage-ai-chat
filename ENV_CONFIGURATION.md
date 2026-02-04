# Environment Variables Configuration

This document outlines all required and optional environment variables for the NFC Assistant application.

## Required Variables

### Supabase Configuration
The application uses Supabase for data persistence, authentication, and trust metrics storage.

```bash
# Supabase URL - Your project URL
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# Supabase Anonymous Key - Public client key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Supabase Service Role Key - Server-side operations (keep secure)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Supabase JWT Secret - For token validation
SUPABASE_JWT_SECRET=your-jwt-secret
```

**How to get these:**
1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to Settings → API
4. Copy the values for URL and Keys

### AI Configuration (xAI Grok)
Required for AI-powered sports analysis and predictions.

```bash
# xAI API Key - For Grok AI model access
XAI_API_KEY=your-xai-api-key
```

**How to get this:**
1. Visit [xAI Console](https://console.x.ai/)
2. Create an account or sign in
3. Generate an API key from your dashboard
4. Model used: `grok-3` (production-ready)

### Sports Odds API
Required for real-time odds data and market analysis.

```bash
# The Odds API Key - For live sports odds
ODDS_API_KEY=your-odds-api-key
```

**How to get this:**
1. Go to [The Odds API](https://the-odds-api.com/)
2. Sign up for a free or paid account
3. Get your API key from the dashboard
4. Note: Free tier includes 500 requests/month

## Optional Variables

### Postgres/Database (Auto-configured with Supabase)
These are automatically set when using Supabase integration:

```bash
POSTGRES_URL=postgresql://...
POSTGRES_PRISMA_URL=postgresql://...
POSTGRES_URL_NON_POOLING=postgresql://...
POSTGRES_HOST=your-project.supabase.co
POSTGRES_DATABASE=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-password
```

### Vercel AI Gateway
Automatically configured when deployed on Vercel:

```bash
# AI Gateway for provider management (optional)
AI_GATEWAY_URL=https://api.vercel.ai/v1
```

## Environment Setup

### Local Development

Create a `.env.local` file in your project root:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
XAI_API_KEY=your-xai-api-key
ODDS_API_KEY=your-odds-api-key
```

### Production (Vercel)

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable with appropriate scope (Production, Preview, Development)
4. Redeploy your application

### Security Best Practices

✅ **DO:**
- Keep `SUPABASE_SERVICE_ROLE_KEY` and `XAI_API_KEY` secret (server-side only)
- Use different API keys for development and production
- Rotate keys periodically
- Monitor API usage and set up alerts

❌ **DON'T:**
- Commit `.env.local` to version control
- Share API keys publicly
- Use production keys in development
- Expose server-side keys in client code

## Variable Usage in Code

### Server-Side Only (Route Handlers, Server Components)
```typescript
// ✅ Safe - Server-side
const apiKey = process.env.XAI_API_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
```

### Client-Side (Browser)
```typescript
// ✅ Safe - Client-side (must be prefixed with NEXT_PUBLIC_)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ❌ Unsafe - Server keys exposed to browser
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // NEVER DO THIS
```

## Fallback Behavior

The application gracefully handles missing environment variables:

| Variable Missing | Behavior |
|-----------------|----------|
| `XAI_API_KEY` | Falls back to rule-based analysis with warning message |
| `ODDS_API_KEY` | Returns cached/demo odds data |
| `SUPABASE_*` | Uses default insights, no data persistence |

## Verification

To verify your configuration:

1. **Check Health Endpoint:**
   ```bash
   curl http://localhost:3000/api/health
   ```

2. **Test Grok AI:**
   ```bash
   curl -X POST http://localhost:3000/api/analyze \
     -H "Content-Type: application/json" \
     -d '{"query": "Test query"}'
   ```

3. **Test Odds API:**
   ```bash
   curl -X POST http://localhost:3000/api/odds \
     -H "Content-Type: application/json" \
     -d '{"sport": "americanfootball_nfl"}'
   ```

## Common Issues

### "Invalid API key" error
- Verify the key is correct and hasn't expired
- Check you're using the right key for the environment
- Ensure no extra spaces or characters

### "Table does not exist" error
- Run the Supabase migrations: `supabase db push`
- Verify Supabase connection is active
- Check database permissions

### CORS errors
- Ensure `NEXT_PUBLIC_` prefix for client-accessible variables
- Verify Supabase project URL is correct
- Check Supabase dashboard for allowed origins

## Support Resources

- **Supabase Docs:** https://supabase.com/docs
- **xAI Documentation:** https://docs.x.ai/
- **The Odds API Docs:** https://the-odds-api.com/liveapi/guides/v4/
- **Next.js Environment Variables:** https://nextjs.org/docs/basic-features/environment-variables
