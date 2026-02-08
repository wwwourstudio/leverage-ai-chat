# TypeScript Troubleshooting Guide

**Consolidated guide covering all TypeScript errors and fixes in the NFC Assistant project**

## Table of Contents

1. [APIResponse Type Extensions](#apiresponse-type-extensions)
2. [Supabase Client Types](#supabase-client-types)
3. [Optional Property Safety](#optional-property-safety)
4. [Common Type Errors](#common-type-errors)
5. [Best Practices](#best-practices)
6. [Quick Reference](#quick-reference)

---

## APIResponse Type Extensions

### Problem
The `APIResponse` interface was missing properties that are actually returned by API routes, causing type errors:
- `useFallback?: boolean` - Not defined but used in error handling
- `details?: string` - Not defined but accessed in responses
- `errorType?: string` - Missing for error categorization

### Solution
Extended the `APIResponse` interface in `app/page.tsx`:

```typescript
interface APIResponse<T = any> {
  success: boolean;
  error?: string;
  data?: T;
  text?: string;
  cards?: InsightCard[];
  confidence?: number;
  sources?: Array<{
    name: string;
    type: 'database' | 'api' | 'model' | 'cache';
    reliability: number;
    url?: string;
  }>;
  model?: string;
  trustMetrics?: TrustMetrics;
  useFallback?: boolean; // Flag to indicate fallback mode was used
  details?: string; // Additional error or diagnostic details
  errorType?: string; // Type of error that occurred
}
```

**Key Changes:**
- Added three optional properties to match runtime behavior
- Maintained backward compatibility
- No breaking changes to existing code

---

## Supabase Client Types

### Problem
Supabase client initialization required non-null environment variables but TypeScript treats `process.env.*` as `string | undefined`.

### Current Implementation
The code correctly handles this with runtime checks:

```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  )
}

client = createBrowserClient(supabaseUrl, supabaseAnonKey)
```

**Why This Works:**
- Runtime check ensures variables exist before use
- TypeScript control flow analysis narrows the type after the check
- Clear error message guides developers to fix configuration

### Type-Safe Alternative (Optional)
If you want explicit type assertions:

```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}
```

---

## Optional Property Safety

### Problem: `oddsData` Null Safety
The `oddsData` variable can be `null` but code accessed nested properties without proper guards.

### Solution
Updated type signatures and added proper null checks:

**Before:**
```typescript
const buildSourcesList = (oddsData: any): Array<Source> => {
  // ... code
  if (oddsData?.success) {
    sources.push({ name: 'The Odds API (Live)', type: 'api' })
  }
}
```

**After:**
```typescript
const buildSourcesList = (oddsData: APIResponse<OddsEvent[]> | null): Array<Source> => {
  // ... code
  if (oddsData?.success && oddsData.data) {
    sources.push({ name: 'The Odds API (Live)', type: 'api' })
  }
}
```

**Key Improvements:**
1. Explicit `null` type in parameter
2. Additional check for `oddsData.data` existence
3. Proper type parameter instead of `any`

### General Pattern for Optional Access

```typescript
// ❌ Unsafe - can throw if data is undefined
const length = oddsData.data.length;

// ✅ Safe - uses optional chaining
const length = oddsData.data?.length ?? 0;

// ✅ Safe - explicit check
if (oddsData && oddsData.data) {
  const length = oddsData.data.length;
}
```

---

## Common Type Errors

### 1. Property Does Not Exist on Type

**Error:**
```
Property 'useFallback' does not exist on type 'APIResponse<any>'
```

**Cause:** Interface missing optional properties that runtime code expects

**Fix:** Add the property as optional to the interface
```typescript
interface APIResponse<T = any> {
  // ... existing properties
  useFallback?: boolean;
}
```

### 2. Type 'undefined' Not Assignable to Type 'string'

**Error:**
```
Type 'string | undefined' is not assignable to type 'string'
```

**Cause:** Environment variables are always `string | undefined`

**Fix:** Add runtime check or use non-null assertion with validation
```typescript
const value = process.env.MY_VAR;
if (!value) throw new Error('MY_VAR not configured');
// TypeScript now knows value is string
```

### 3. Object is Possibly 'null' or 'undefined'

**Error:**
```
Object is possibly 'null'. ts(2531)
```

**Cause:** Accessing properties on nullable types

**Fix:** Use optional chaining or explicit checks
```typescript
// Option 1: Optional chaining
const result = obj?.property?.nested;

// Option 2: Explicit check
if (obj && obj.property) {
  const result = obj.property.nested;
}
```

---

## Best Practices

### 1. Prefer Explicit Types Over `any`

```typescript
// ❌ Avoid
function processData(data: any) { }

// ✅ Better
function processData(data: APIResponse<OddsEvent[]>) { }
```

### 2. Use Optional Chaining for Nested Access

```typescript
// ❌ Verbose
if (response && response.data && response.data.items) {
  const count = response.data.items.length;
}

// ✅ Concise
const count = response?.data?.items?.length ?? 0;
```

### 3. Type Guard Functions

```typescript
function isSuccessResponse<T>(response: APIResponse<T>): response is APIResponse<T> & { success: true; data: T } {
  return response.success && response.data !== undefined;
}

// Usage
if (isSuccessResponse(apiResponse)) {
  // TypeScript knows apiResponse.data exists here
  console.log(apiResponse.data);
}
```

### 4. Nullish Coalescing for Defaults

```typescript
// ❌ Can fail with 0, false, ''
const value = obj.prop || 'default';

// ✅ Only null/undefined trigger default
const value = obj.prop ?? 'default';
```

### 5. Non-Null Assertion (Use Sparingly)

```typescript
// Only use when you're 100% certain value exists
const value = process.env.REQUIRED_VAR!;

// Better: Validate first
const value = process.env.REQUIRED_VAR;
if (!value) throw new Error('REQUIRED_VAR missing');
// Now TypeScript knows it's defined
```

---

## Quick Reference

### Checking for Existence
```typescript
// Null/undefined check
if (value != null) { } // Checks both null and undefined

// Truthy check (also excludes 0, false, '')
if (value) { }

// Type guard
if (typeof value === 'string') { }

// Array check
if (Array.isArray(value)) { }
```

### Type Assertions
```typescript
// As assertion
const element = document.getElementById('id') as HTMLDivElement;

// Angle bracket (not in JSX)
const element = <HTMLDivElement>document.getElementById('id');

// Non-null assertion
const value = possiblyNull!;
```

### Union Types
```typescript
type Result = Success | Error;

function handle(result: Result) {
  if ('data' in result) {
    // TypeScript knows this is Success
  } else {
    // TypeScript knows this is Error
  }
}
```

### Generic Constraints
```typescript
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

---

## Troubleshooting Checklist

When you encounter a TypeScript error:

1. **Read the error message carefully** - It usually tells you exactly what's wrong
2. **Check if properties exist** - Ensure interfaces match runtime behavior
3. **Verify null safety** - Use optional chaining or explicit checks
4. **Look for `any` types** - Replace with proper types
5. **Check environment variables** - Always validate before use
6. **Use type guards** - Narrow types safely with runtime checks
7. **Enable strict mode** - Catch errors early with `"strict": true` in tsconfig

---

## Related Documentation

- [LanguageModel Troubleshooting](./LANGUAGEMODEL_TROUBLESHOOTING.md) - AI SDK type issues
- [Complete Documentation](../COMPLETE_DOCUMENTATION.md) - Full project guide
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) - Official docs

---

**Last Updated:** This guide consolidates fixes from multiple previous documents into a single comprehensive reference.
