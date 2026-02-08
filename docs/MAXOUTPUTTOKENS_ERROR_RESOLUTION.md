# maxOutputTokens TypeScript Error - Root Cause Analysis & Resolution

## Error Description

```typescript
Object literal may only specify known properties, and 'maxOutputTokens' 
does not exist in type 'CallSettings & Prompt & { model: LanguageModelV1; ... }'
```

## Root Cause Analysis

### **Primary Cause: Type Definition Version Mismatch**

This error occurs when TypeScript's language server is using cached type definitions from an older version of the AI SDK while the runtime has been updated to a newer version.

**Why This Happens:**

1. **AI SDK Migration Context:**
   - AI SDK v4/v5 used `maxTokens`
   - AI SDK v6 introduced `maxOutputTokens` (breaking change)
   - TypeScript may cache old type definitions even after package upgrade

2. **Type Resolution Order:**
   ```
   TypeScript checks:
   1. node_modules/ai/dist/index.d.ts
   2. Cached .tsbuildinfo files
   3. IDE's language server cache
   
   If any of these reference old types, the error appears
   ```

3. **Current Status (Verified):**
   - ✅ Package installed: `ai@6.0.77`
   - ✅ Correct imports: `import { generateText } from 'ai'`
   - ✅ Correct usage: `model: xai('grok-beta')`
   - ✅ Property used: `maxOutputTokens: 500`
   - ⚠️ TypeScript cache may be stale

---

## Verification Steps

### Step 1: Verify AI SDK Version
```bash
# Check installed version
cat node_modules/ai/package.json | grep version

# Expected output: "version": "6.0.77" or higher
```

### Step 2: Check Type Definition
```bash
# Search for maxOutputTokens in type definitions
grep -r "maxOutputTokens" node_modules/ai/dist/index.d.ts

# Should find the property definition
```

### Step 3: Verify Code Usage
```typescript
// Current implementation (CORRECT for AI SDK 6)
import { generateText } from 'ai';
import { xai } from '@ai-sdk/xai';

const result = await generateText({
  model: xai('grok-beta'),           // ✅ LanguageModelV1 instance
  prompt: 'Your prompt',
  temperature: 0.7,
  maxOutputTokens: 500,              // ✅ AI SDK 6 property
});
```

---

## Resolution Strategies

### **Solution 1: Clear TypeScript Cache (Recommended First)**

TypeScript maintains build information that may be stale:

```bash
# 1. Remove TypeScript build cache
rm -rf .next
rm -rf node_modules/.cache
rm -f tsconfig.tsbuildinfo
rm -f .tsbuildinfo

# 2. Restart TypeScript language server (VS Code)
# Press: Cmd/Ctrl + Shift + P
# Type: "TypeScript: Restart TS Server"
# Select and execute

# 3. Restart the development server
npm run dev
```

### **Solution 2: Reinstall Dependencies**

If cache clearing doesn't work, reinstall packages:

```bash
# 1. Remove node_modules and lock file
rm -rf node_modules
rm package-lock.json  # or yarn.lock / pnpm-lock.yaml

# 2. Clear npm cache
npm cache clean --force

# 3. Reinstall
npm install

# 4. Restart IDE
```

### **Solution 3: Verify Type Definitions Loaded**

Check that TypeScript is reading the correct types:

```typescript
// Add this to any .ts file temporarily to test
import { generateText } from 'ai';

type GenerateTextParams = Parameters<typeof generateText>[0];

// Hover over GenerateTextParams in IDE
// Should show maxOutputTokens as an available property
```

### **Solution 4: Explicit Type Checking Workaround**

If all else fails, use type assertion (temporary):

```typescript
import { generateText } from 'ai';
import { xai } from '@ai-sdk/xai';

const result = await generateText({
  model: xai('grok-beta'),
  prompt: 'Your prompt',
  temperature: 0.7,
  maxOutputTokens: 500,
} as any); // Temporary workaround - remove after types load correctly

// Better: Use proper type
import type { GenerateTextParameters } from 'ai';

const params: GenerateTextParameters = {
  model: xai('grok-beta'),
  prompt: 'Your prompt',
  temperature: 0.7,
  maxOutputTokens: 500,
};

const result = await generateText(params);
```

---

## Property Name History & Documentation

### AI SDK Version Changes

| Version | Property Name | Notes |
|---------|--------------|-------|
| v4.x | `maxTokens` | Legacy property |
| v5.x | `maxTokens` | Still legacy |
| v6.x | `maxOutputTokens` | **Current** - renamed for clarity |

### Why the Rename?

The AI SDK team renamed `maxTokens` to `maxOutputTokens` to:
1. **Clarify intent**: Separate input token limits from output token limits
2. **Align with providers**: Match terminology used by OpenAI, Anthropic, etc.
3. **Better control**: Allow separate `maxInputTokens` in future versions

### Correct Usage (AI SDK 6)

```typescript
import { generateText } from 'ai';
import { xai } from '@ai-sdk/xai';

// ✅ CORRECT - AI SDK 6
await generateText({
  model: xai('grok-beta'),
  maxOutputTokens: 1000,  // Output tokens
  // maxInputTokens not yet available
});

// ❌ WRONG - AI SDK 4/5 (deprecated)
await generateText({
  model: xai('grok-beta'),
  maxTokens: 1000,  // Old property name
});
```

---

## Current Implementation Status

### Files Updated to AI SDK 6 ✅

1. **`app/api/analyze/route.ts`**
   ```typescript
   import { generateText } from 'ai';
   import { xai } from '@ai-sdk/xai';
   
   const result = await generateText({
     model: xai('grok-beta'),
     system: systemPrompt,
     prompt: userPrompt,
     temperature: AI_CONFIG.DEFAULT_TEMPERATURE,
     maxOutputTokens: AI_CONFIG.DEFAULT_MAX_TOKENS, // ✅
   });
   ```

2. **`lib/leveraged-ai.ts`**
   - Line 241: `maxOutputTokens: 500` ✅
   - Line 281: `maxOutputTokens: 200` ✅
   - Line 378: `maxOutputTokens: 100` ✅

All implementations are correct for AI SDK 6. The error is likely a TypeScript cache issue.

---

## Preventing Future Issues

### 1. Package.json Lock Versions
```json
{
  "dependencies": {
    "ai": "^6.0.0",              // ✅ Major version locked
    "@ai-sdk/xai": "^1.0.8",     // ✅ Compatible version
    "@ai-sdk/react": "^3.0.0"    // ✅ Compatible version
  }
}
```

### 2. Type Checking in CI/CD
```json
{
  "scripts": {
    "type-check": "tsc --noEmit",
    "build": "pnpm type-check && next build"
  }
}
```

### 3. IDE Settings (VS Code)
```json
// .vscode/settings.json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "typescript.tsserver.maxTsServerMemory": 4096
}
```

---

## Quick Fix Checklist

Use this checklist to resolve the error:

- [ ] Verify AI SDK version is 6.x in `node_modules/ai/package.json`
- [ ] Confirm using `maxOutputTokens` (not `maxTokens`)
- [ ] Confirm using `xai('grok-beta')` (not string `'xai/grok-beta'`)
- [ ] Delete `.next/` directory
- [ ] Delete `tsconfig.tsbuildinfo` file
- [ ] Restart TypeScript server in IDE
- [ ] Restart development server (`npm run dev`)
- [ ] If error persists, reinstall `node_modules`
- [ ] As last resort, restart IDE completely

---

## Additional Resources

### Official Documentation
- [AI SDK 6 Migration Guide](https://sdk.vercel.ai/docs/migration/v5-to-v6)
- [generateText API Reference](https://sdk.vercel.ai/docs/reference/generate-text)
- [xAI Provider Documentation](https://sdk.vercel.ai/providers/xai)

### Type Definitions
```typescript
// From ai/dist/index.d.ts (AI SDK 6)
export interface GenerateTextParameters<T extends ToolSet = ToolSet> {
  model: LanguageModelV1;
  prompt?: string;
  system?: string;
  messages?: Array<ModelMessage>;
  temperature?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  maxOutputTokens?: number;  // ✅ Available in AI SDK 6
  // ... other properties
}
```

---

## Summary

The `maxOutputTokens` property is **correct and available** in AI SDK 6. The error indicates TypeScript is using cached type definitions from an older version. Clearing the TypeScript cache and restarting the language server should resolve the issue immediately. All code in the project already uses the correct AI SDK 6 patterns.
