# TypeScript Error Analysis: 'string' is not assignable to 'LanguageModelV1'

## Error Summary

**Error Message:**
```
Type 'string' is not assignable to type 'LanguageModelV1'.ts(2322)
index.d.ts(2475, 5): The expected type comes from property 'model' which is declared here on type 'CallSettings & Prompt & { model: LanguageModelV1; ... }'
```

## Root Cause Analysis

### 1. **Type System Mismatch**
The error occurs when passing a string literal (e.g., `'xai/grok-beta'`) to the `model` property of `generateText()` or `streamText()`, which expects a `LanguageModelV1` instance.

**Why this happens:**
- AI SDK 6 requires typed model instances from provider packages
- String model identifiers were used in earlier SDK versions (v4) with a different architecture
- The type system enforces proper provider instantiation for better type safety and autocomplete

### 2. **Version Confusion**
This error commonly appears when:
- Code written for AI SDK v4 patterns is run with v6 dependencies
- Provider packages are missing from imports
- Model strings are passed directly without instantiation

## Solution Strategies

### ✅ Strategy 1: Use Provider-Specific Model Functions (RECOMMENDED)

Import the provider function and call it with the model name:

```typescript
// CORRECT - AI SDK 6 Pattern
import { generateText } from 'ai';
import { xai } from '@ai-sdk/xai';

const result = await generateText({
  model: xai('grok-beta'), // ✅ Returns LanguageModelV1 instance
  prompt: 'Analyze this game...'
});
```

**Available Providers:**
- `xai` from `@ai-sdk/xai` - For Grok models (grok-beta, grok-vision-beta)
- `openai` from `@ai-sdk/openai` - For GPT models
- `anthropic` from `@ai-sdk/anthropic` - For Claude models
- `google` from `@ai-sdk/google` - For Gemini models

### ❌ Strategy 2: String Model Identifiers (DOES NOT WORK IN v6)

```typescript
// WRONG - This causes the TypeScript error
import { generateText } from 'ai';

const result = await generateText({
  model: 'xai/grok-beta', // ❌ Type error
  prompt: '...'
});
```

**Why it fails:**
- The `model` parameter has type `LanguageModelV1`
- String literals don't satisfy this type constraint
- TypeScript enforces strict typing for better safety

## Implementation Guide

### Step 1: Install Required Packages

Ensure you have AI SDK 6 and the provider package:

```json
{
  "dependencies": {
    "ai": "^6.0.0",
    "@ai-sdk/react": "^3.0.0",
    "@ai-sdk/xai": "^1.0.8"
  }
}
```

### Step 2: Update Imports

Add the provider import at the top of your file:

```typescript
import { generateText } from 'ai';
import { xai } from '@ai-sdk/xai'; // Add this
```

### Step 3: Update Model Calls

Replace string model identifiers with provider function calls:

```typescript
// Before (causes error)
model: 'xai/grok-beta'

// After (correct)
model: xai('grok-beta')
```

### Step 4: Handle Environment Variables

Provider packages respect environment variables:

```typescript
// XAI_API_KEY is automatically used by @ai-sdk/xai
// No need to pass apiKey explicitly in most cases

// For custom configuration:
import { xai } from '@ai-sdk/xai';

const customXai = xai({
  apiKey: process.env.CUSTOM_XAI_KEY,
  baseURL: 'https://custom-endpoint.example.com'
});

const result = await generateText({
  model: customXai('grok-beta')
});
```

## Complete Examples

### Example 1: Basic Text Generation

```typescript
import { generateText } from 'ai';
import { xai } from '@ai-sdk/xai';

export async function POST(req: Request) {
  const { prompt } = await req.json();
  
  const result = await generateText({
    model: xai('grok-beta'),
    prompt,
    temperature: 0.7,
    maxOutputTokens: 1000,
  });
  
  return Response.json({ text: result.text });
}
```

### Example 2: With System Prompt

```typescript
import { generateText } from 'ai';
import { xai } from '@ai-sdk/xai';

const result = await generateText({
  model: xai('grok-beta'),
  system: 'You are a sports betting analyst.',
  prompt: 'Analyze this matchup...',
  temperature: 0.7,
  maxOutputTokens: 2000,
});
```

### Example 3: Streaming Response

```typescript
import { streamText } from 'ai';
import { xai } from '@ai-sdk/xai';

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const result = streamText({
    model: xai('grok-beta'),
    messages,
    temperature: 0.7,
  });
  
  return result.toUIMessageStreamResponse();
}
```

### Example 4: Multiple Providers

```typescript
import { generateText } from 'ai';
import { xai } from '@ai-sdk/xai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

// Use different models based on requirements
const grokResult = await generateText({
  model: xai('grok-beta'),
  prompt: 'Fast reasoning task...'
});

const gptResult = await generateText({
  model: openai('gpt-5'),
  prompt: 'General purpose task...'
});

const claudeResult = await generateText({
  model: anthropic('claude-sonnet-4.5'),
  prompt: 'Complex analysis task...'
});
```

## Type Safety Benefits

Using proper provider functions provides:

### 1. **Compile-Time Type Checking**
```typescript
// TypeScript catches invalid model names
model: xai('invalid-model') // TypeScript error before runtime
```

### 2. **Autocomplete Support**
```typescript
// IDE shows available models
model: xai('grok-') // Autocomplete suggests: grok-beta, grok-vision-beta
```

### 3. **Parameter Validation**
```typescript
// Provider-specific parameters are type-checked
const result = await generateText({
  model: xai('grok-beta'),
  maxOutputTokens: 1000, // ✅ Valid
  maxTokens: 1000, // ❌ Error: Use maxOutputTokens in v6
});
```

## Migration Checklist

If migrating from AI SDK v4 to v6:

- [ ] Update `ai` package to `^6.0.0`
- [ ] Install provider packages (e.g., `@ai-sdk/xai`)
- [ ] Add provider imports to files using AI
- [ ] Replace string model identifiers with provider function calls
- [ ] Update `maxTokens` to `maxOutputTokens`
- [ ] Test all AI-powered features
- [ ] Update environment variable names if needed

## Common Pitfalls

### Pitfall 1: Missing Provider Import
```typescript
// ❌ Error: xai is not defined
const result = await generateText({
  model: xai('grok-beta')
});

// ✅ Solution: Add import
import { xai } from '@ai-sdk/xai';
```

### Pitfall 2: Wrong Parameter Name
```typescript
// ❌ Error: maxTokens doesn't exist in v6
const result = await generateText({
  model: xai('grok-beta'),
  maxTokens: 1000
});

// ✅ Solution: Use maxOutputTokens
maxOutputTokens: 1000
```

### Pitfall 3: Version Mismatch
```typescript
// If you have ai@4.x but code expects v6 patterns:
// 1. Update package.json
"ai": "^6.0.0"

// 2. Run npm install
npm install

// 3. Restart TypeScript server in IDE
```

## Debugging Steps

If you still see the error after applying fixes:

### 1. Verify Package Versions
```bash
npm list ai @ai-sdk/xai @ai-sdk/react
```

Expected output:
```
├── ai@6.0.0
├── @ai-sdk/react@3.0.0
└── @ai-sdk/xai@1.0.8
```

### 2. Check Import Statements
Ensure all files using AI have provider imports:
```typescript
import { generateText } from 'ai';
import { xai } from '@ai-sdk/xai'; // Required!
```

### 3. Restart TypeScript Server
In VS Code: `Cmd/Ctrl + Shift + P` → "TypeScript: Restart TS Server"

### 4. Clear Node Modules and Reinstall
```bash
rm -rf node_modules package-lock.json
npm install
```

### 5. Check for Multiple AI SDK Versions
```bash
npm ls ai
```
Ensure only one version is installed.

## Configuration Best Practices

### Environment Variables
```env
# .env.local
XAI_API_KEY=your_xai_api_key_here
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
```

### TypeScript Configuration
Ensure strict mode is enabled in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

## Additional Resources

- **AI SDK 6 Documentation**: https://sdk.vercel.ai
- **Provider Packages**: https://sdk.vercel.ai/providers
- **Migration Guide**: https://sdk.vercel.ai/docs/migration
- **xAI Models**: https://docs.x.ai/api

## Summary

The `'string' is not assignable to type 'LanguageModelV1'` error is resolved by:

1. **Using provider functions** instead of string literals
2. **Importing provider packages** (`@ai-sdk/xai`, etc.)
3. **Calling provider functions** with model names: `xai('grok-beta')`
4. **Ensuring AI SDK v6** is installed

This approach provides better type safety, autocomplete, and compile-time error detection, resulting in more reliable AI-powered applications.
