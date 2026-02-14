# Serverless & Edge Runtime Best Practices

## Process Information Access in Serverless Environments

### The Problem

In traditional Node.js applications, the `process` global object provides access to runtime information like version, uptime, memory usage, etc. However, in serverless and edge runtime environments (Vercel Edge, AWS Lambda, Cloudflare Workers), access to `process` may be restricted or unavailable.

### Common Issues

#### ❌ Unsafe Access
```typescript
// Will throw errors in some environments
const nodeVersion = process.version;
const uptime = process.uptime();
const memory = process.memoryUsage();
```

#### ✅ Safe Access
```typescript
// Use defensive checks
const nodeVersion = typeof process !== 'undefined' && process.version 
  ? process.version 
  : 'unavailable';

const uptime = typeof process !== 'undefined' && typeof process.uptime === 'function'
  ? process.uptime()
  : null;
```

### Recommended Solution: Use Utility Functions

We've created `lib/process-utils.ts` that provides safe access to all process information:

```typescript
import { 
  getProcessInfo, 
  getNodeVersion,
  getUptime,
  getRuntimeEnvironment 
} from '@/lib/process-utils';

// Get all available info
const info = getProcessInfo();
console.log(info.nodeVersion); // null if unavailable
console.log(info.uptime); // null if unavailable

// Get specific values
const version = getNodeVersion(); // Returns null in restricted environments
const uptime = getUptime(); // Returns null if unavailable
const runtime = getRuntimeEnvironment(); // 'edge', 'vercel-serverless', 'node', etc.
```

## Environment Variables

### Best Practices

#### 1. Server-Side Variables

Server-side environment variables should NOT be prefixed with `NEXT_PUBLIC_`:

```typescript
// ✅ Server-side only
SUPABASE_SERVICE_ROLE_KEY=secret_key
XAI_API_KEY=api_key
ODDS_API_KEY=api_key

// ❌ Never expose secrets with NEXT_PUBLIC_
NEXT_PUBLIC_SECRET_KEY=bad_idea // Exposed to browser!
```

#### 2. Client-Side Variables

Client-side variables MUST be prefixed with `NEXT_PUBLIC_`:

```typescript
// ✅ Safe to expose to browser
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=public_anon_key
NEXT_PUBLIC_APP_URL=https://your-app.com
```

#### 3. Safe Access Patterns

Use the configuration utilities from `lib/config.ts`:

```typescript
import { 
  getServerEnv, 
  getClientEnv, 
  getOddsApiKey,
  isSupabaseConfigured 
} from '@/lib/config';

// Server-side API routes
export async function GET() {
  const apiKey = getServerEnv('ODDS_API_KEY', { required: true });
  // ...
}

// Client-side components
export function MyComponent() {
  const supabaseUrl = getClientEnv('NEXT_PUBLIC_SUPABASE_URL');
  // ...
}

// Use specific getters
const oddsKey = getOddsApiKey(); // Returns undefined if not set
const hasSupabase = isSupabaseConfigured(); // Boolean check
```

### Environment Variable Validation

#### Runtime Validation

Check for required variables at runtime:

```typescript
import { validateEnv } from '@/lib/config';

const { valid, missing, message } = validateEnv([
  'ODDS_API_KEY',
  'XAI_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL'
]);

if (!valid) {
  console.error(message);
  // Handle missing variables
}
```

#### Startup Validation

Add validation to your API routes:

```typescript
import { assertServicesConfigured } from '@/lib/config';

export async function GET() {
  // Throws error with helpful message if not configured
  assertServicesConfigured(['supabase', 'odds']);
  
  // Continue with API logic
}
```

## Runtime Environment Detection

### Different Environments

Your app may run in various environments:

1. **Edge Runtime** (Vercel Edge Functions, Cloudflare Workers)
   - Limited Node.js APIs
   - No file system access
   - Restricted process access
   
2. **Serverless Functions** (AWS Lambda, Vercel Functions)
   - Full Node.js environment
   - Cold starts
   - Stateless
   
3. **Traditional Node.js** (local development)
   - Full process access
   - Persistent state
   - All Node.js APIs available

### Detection Utilities

```typescript
import { 
  isNodeEnvironment,
  isEdgeRuntime,
  getRuntimeEnvironment,
  getProcessApiAvailability 
} from '@/lib/process-utils';

// Check environment type
if (isEdgeRuntime()) {
  console.log('Running in edge runtime');
}

if (isNodeEnvironment()) {
  console.log('Running in Node.js');
}

// Get specific runtime name
const runtime = getRuntimeEnvironment();
// Returns: 'edge', 'vercel-serverless', 'aws-lambda', 'node', etc.

// Check which APIs are available
const apis = getProcessApiAvailability();
console.log(apis);
// {
//   version: true,
//   platform: true,
//   uptime: false,  // Not available in edge
//   memoryUsage: false,
//   cpuUsage: false,
//   env: true
// }
```

## Memory and Performance Monitoring

### Safe Memory Monitoring

```typescript
import { getMemoryUsage } from '@/lib/process-utils';

const memory = getMemoryUsage();

if (memory) {
  const heapUsedMB = Math.round(memory.heapUsed / 1024 / 1024);
  console.log(`Memory used: ${heapUsedMB}MB`);
} else {
  console.log('Memory monitoring not available in this runtime');
}
```

### Performance Tracking

Track API response times instead of relying on process metrics:

```typescript
export async function GET() {
  const startTime = Date.now();
  
  try {
    // Your API logic
    const result = await fetchData();
    
    const duration = Date.now() - startTime;
    console.log(`[v0] Request completed in ${duration}ms`);
    
    return NextResponse.json(result, {
      headers: {
        'X-Response-Time': `${duration}ms`
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[v0] Request failed after ${duration}ms`);
    throw error;
  }
}
```

## Deployment-Specific Configurations

### Vercel

Set environment variables in your Vercel dashboard or `.env.local`:

```bash
# .env.local (never commit this file)
ODDS_API_KEY=your_key_here
XAI_API_KEY=your_key_here
SUPABASE_SERVICE_ROLE_KEY=your_key_here

# Public variables
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### Edge Runtime Restrictions

When using `export const runtime = 'edge'`:

- ✅ Available: `process.env`
- ❌ Limited: `process.version`, `process.platform`
- ❌ Unavailable: `process.uptime()`, `process.memoryUsage()`, `process.cpuUsage()`
- ❌ No file system access
- ❌ No native Node.js modules

### Conditional Logic Based on Runtime

```typescript
import { getRuntimeEnvironment } from '@/lib/process-utils';

export async function GET() {
  const runtime = getRuntimeEnvironment();
  
  if (runtime === 'edge') {
    // Use edge-compatible APIs only
    return EdgeResponse();
  } else {
    // Can use full Node.js APIs
    return NodeResponse();
  }
}
```

## Testing Across Environments

### Local Development

Test both runtimes locally:

```typescript
// pages/api/test-edge.ts
export const runtime = 'edge';

export async function GET() {
  // Test edge runtime behavior
}

// pages/api/test-node.ts
export const runtime = 'nodejs';

export async function GET() {
  // Test Node.js runtime behavior
}
```

### Environment Variable Testing

Create a test endpoint:

```typescript
// app/api/test-env/route.ts
import { getServiceStatus } from '@/lib/config';

export async function GET() {
  const status = getServiceStatus();
  return NextResponse.json(status);
}
```

Visit `/api/test-env` to see which services are configured.

## Common Pitfalls

### 1. Assuming Node.js APIs Are Always Available

❌ **Don't:**
```typescript
const uptime = process.uptime();
```

✅ **Do:**
```typescript
import { getUptime } from '@/lib/process-utils';
const uptime = getUptime(); // Returns null if unavailable
```

### 2. Exposing Secrets to Client

❌ **Don't:**
```typescript
// This is exposed to the browser!
NEXT_PUBLIC_API_SECRET=secret
```

✅ **Do:**
```typescript
// Keep secrets server-side only
API_SECRET=secret
```

### 3. Not Handling Missing Environment Variables

❌ **Don't:**
```typescript
const apiKey = process.env.ODDS_API_KEY; // Might be undefined
fetch(`https://api.com?key=${apiKey}`); // Breaks if undefined
```

✅ **Do:**
```typescript
import { getOddsApiKey } from '@/lib/config';

const apiKey = getOddsApiKey();
if (!apiKey) {
  return NextResponse.json(
    { error: 'ODDS_API_KEY not configured' },
    { status: 500 }
  );
}
```

## Additional Resources

- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Vercel Edge Runtime](https://vercel.com/docs/functions/edge-functions/edge-runtime)
- [Serverless Best Practices](https://www.serverless.com/framework/docs/providers/aws/guide/functions)

## Summary

1. **Always use defensive checks** when accessing `process` properties
2. **Use utility functions** from `lib/process-utils.ts` for safe access
3. **Never expose secrets** with `NEXT_PUBLIC_` prefix
4. **Validate environment variables** at startup
5. **Test in multiple runtimes** (edge and Node.js)
6. **Handle missing values gracefully** with null/undefined checks
7. **Use configuration utilities** from `lib/config.ts`
8. **Monitor performance** with timestamps, not process metrics
