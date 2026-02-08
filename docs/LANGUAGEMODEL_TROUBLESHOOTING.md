# LanguageModel Version Compatibility Guide

**Comprehensive guide for AI SDK LanguageModel type compatibility issues**

## Table of Contents

1. [Problem Overview](#problem-overview)
2. [Version Differences](#version-differences)
3. [Type Extensions](#type-extensions)
4. [Adapter Utilities](#adapter-utilities)
5. [Migration Guide](#migration-guide)
6. [Testing & Verification](#testing--verification)
7. [Quick Reference](#quick-reference)

---

## Problem Overview

### The Error
```typescript
Type 'LanguageModelV1' is not assignable to type 'LanguageModel'.
  Property 'supportedUrls' is missing in type 'LanguageModelV1' 
  but required in type 'LanguageModelV2'.
```

### Root Cause
The AI SDK evolved through multiple versions (V1, V2, V3), with each version adding new properties:

- **V1**: Core functionality (text generation, streaming)
- **V2**: Added `supportedUrls` property for URL-based context
- **V3**: Added additional capabilities (multimodal, tool calling enhancements)

When code expects `LanguageModel` (generic) but receives `LanguageModelV1`, TypeScript enforces that all properties from newer versions must exist.

---

## Version Differences

### LanguageModelV1 (AI SDK 4.x-5.x)
```typescript
interface LanguageModelV1 {
  specificationVersion: 'v1';
  provider: string;
  modelId: string;
  
  doGenerate(options: LanguageModelV1CallOptions): Promise<LanguageModelV1CallResult>;
  doStream(options: LanguageModelV1CallOptions): Promise<LanguageModelV1StreamResult>;
  
  defaultObjectGenerationMode?: 'json' | 'tool';
  maxTokens?: number;
  // ❌ Missing: supportedUrls
}
```

### LanguageModelV2 (AI SDK 6.x)
```typescript
interface LanguageModelV2 extends LanguageModelV1 {
  specificationVersion: 'v2';
  
  // ✅ New in V2
  supportedUrls?: string[];
  supportsImageUrls?: boolean;
  
  // Enhanced methods
  doGenerate(options: LanguageModelV2CallOptions): Promise<LanguageModelV2CallResult>;
}
```

### LanguageModelV3 (Future)
```typescript
interface LanguageModelV3 extends LanguageModelV2 {
  specificationVersion: 'v3';
  
  // Enhanced capabilities
  supportsToolStreaming?: boolean;
  supportsParallelToolCalls?: boolean;
}
```

---

## Type Extensions

### Solution 1: Module Augmentation (Automatic)

The project includes `types/ai-sdk-extensions.d.ts` which automatically extends V1:

```typescript
import 'ai';

declare module 'ai' {
  interface LanguageModelV1 {
    /**
     * Optional URLs that the model supports for context inclusion.
     * Added for compatibility with LanguageModelV2.
     */
    supportedUrls?: string[];
    
    /**
     * Whether the model supports image URLs in messages.
     * Added for compatibility with LanguageModelV2.
     */
    supportsImageUrls?: boolean;
  }
}
```

**How It Works:**
- TypeScript module augmentation merges this with the original interface
- All `LanguageModelV1` instances now have these optional properties
- No runtime changes - properties remain undefined for actual V1 models
- Type errors disappear because the interface now matches V2's requirements

### Solution 2: Union Type (Manual)

If you prefer explicit handling:

```typescript
type CompatibleLanguageModel = LanguageModelV1 | LanguageModelV2 | LanguageModelV3;

function useModel(model: CompatibleLanguageModel) {
  // Type-safe access
  if ('supportedUrls' in model && model.supportedUrls) {
    console.log('Model supports URLs:', model.supportedUrls);
  }
}
```

---

## Adapter Utilities

The `lib/model-adapter.ts` file provides runtime utilities:

### 1. Type Guards

```typescript
import { isModelV2, isModelV3, isModelWithUrlSupport } from '@/lib/model-adapter';

// Check specific version
if (isModelV2(model)) {
  // TypeScript knows model has supportedUrls
  console.log(model.supportedUrls);
}

// Check capability
if (isModelWithUrlSupport(model)) {
  // Safe to use URL features
  model.supportedUrls?.forEach(url => {});
}
```

### 2. Model Adapter

```typescript
import { adaptModel } from '@/lib/model-adapter';

// Safely adapt any model version
const adapted = adaptModel(model);

// Access properties with confidence
console.log('Supports URLs:', adapted.supportsUrls);
console.log('Supported URL list:', adapted.supportedUrls);
```

### 3. Debug Utilities

```typescript
import { debugModel } from '@/lib/model-adapter';

// Get comprehensive model info
const info = debugModel(model);
console.log(info);
// {
//   version: 'v1',
//   provider: 'openai',
//   modelId: 'gpt-4',
//   hasUrlSupport: false,
//   hasImageUrlSupport: false,
//   capabilities: ['text-generation', 'streaming']
// }
```

---

## Migration Guide

### Scenario 1: Upgrading from AI SDK 5.x to 6.x

**Before (AI SDK 5.x):**
```typescript
import { openai } from '@ai-sdk/openai';

const model = openai('gpt-4'); // Returns LanguageModelV1
```

**After (AI SDK 6.x):**
```typescript
import { openai } from '@ai-sdk/openai';

const model = openai('gpt-4'); // Returns LanguageModelV2
// ✅ Now has supportedUrls property
```

**Action Required:** None if using type extensions, or update type annotations:
```typescript
// Old
function generate(model: LanguageModelV1) { }

// New
function generate(model: LanguageModel) { } // Or LanguageModelV2
```

### Scenario 2: Mixed Model Versions

If your app uses multiple AI SDK versions:

```typescript
import { adaptModel } from '@/lib/model-adapter';

function handleModel(model: unknown) {
  const adapted = adaptModel(model);
  
  if (adapted.supportsUrls) {
    // Use URL features
    await generateWithContext(model, adapted.supportedUrls);
  } else {
    // Fallback for V1 models
    await generateBasic(model);
  }
}
```

### Scenario 3: Custom Model Implementations

If you've implemented custom models:

```typescript
// ❌ Old implementation (V1)
class CustomModel implements LanguageModelV1 {
  specificationVersion = 'v1' as const;
  // ... other required methods
}

// ✅ Updated for V2 compatibility
class CustomModel implements LanguageModelV2 {
  specificationVersion = 'v2' as const;
  supportedUrls = ['https://docs.example.com'];
  supportsImageUrls = true;
  // ... other required methods
}
```

---

## Testing & Verification

### Automated Type Verification

The project includes `scripts/verify-model-types.ts`:

```bash
# Run type verification
npx tsx scripts/verify-model-types.ts
```

**Tests Include:**
1. ✅ V1 model compatibility with V2 interface
2. ✅ Adapter function type safety
3. ✅ Type guard accuracy
4. ✅ Union type handling
5. ✅ Optional property access
6. ✅ Runtime behavior validation
7. ✅ Cross-version compatibility

### Manual Testing

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

// Test model works with latest SDK
const result = await generateText({
  model: openai('gpt-4'), // Should work regardless of version
  prompt: 'Hello!'
});

console.log('✅ Model compatible:', result.text);
```

---

## Quick Reference

### Check Model Version

```typescript
const version = model.specificationVersion; // 'v1' | 'v2' | 'v3'
```

### Safe Property Access

```typescript
// Option 1: Optional chaining
const urls = model.supportedUrls?.length ?? 0;

// Option 2: Type guard
if (isModelV2(model)) {
  const urls = model.supportedUrls; // Type-safe
}

// Option 3: Adapter
const adapted = adaptModel(model);
const hasSupport = adapted.supportsUrls;
```

### Common Patterns

```typescript
// Pattern 1: Graceful degradation
const enhancedGenerate = async (model: LanguageModel, context?: string[]) => {
  if (isModelWithUrlSupport(model) && context) {
    // Use enhanced features
    return generateWithContext(model, context);
  }
  // Fallback to basic generation
  return generateBasic(model);
};

// Pattern 2: Feature detection
const supportsFeature = (model: LanguageModel, feature: string): boolean => {
  switch (feature) {
    case 'urls':
      return 'supportedUrls' in model && Boolean(model.supportedUrls);
    case 'images':
      return 'supportsImageUrls' in model && Boolean(model.supportsImageUrls);
    default:
      return false;
  }
};

// Pattern 3: Version-specific handling
const handleByVersion = (model: LanguageModel) => {
  switch (model.specificationVersion) {
    case 'v1':
      return handleV1(model);
    case 'v2':
      return handleV2(model as LanguageModelV2);
    case 'v3':
      return handleV3(model as LanguageModelV3);
    default:
      throw new Error(`Unsupported version: ${model.specificationVersion}`);
  }
};
```

---

## Troubleshooting

### Error: "Property 'supportedUrls' does not exist"

**Solution:** Ensure `types/ai-sdk-extensions.d.ts` is included in your tsconfig:
```json
{
  "include": ["**/*.ts", "**/*.tsx", "types/**/*.d.ts"]
}
```

### Error: "Cannot find module 'ai'"

**Solution:** Install AI SDK dependencies:
```bash
npm install ai @ai-sdk/openai @ai-sdk/anthropic
```

### Error: Type mismatch in CallSettings

**Solution:** Use generic LanguageModel type instead of specific version:
```typescript
// ❌ Too specific
const settings: { model: LanguageModelV1 } = { model };

// ✅ Flexible
const settings: { model: LanguageModel } = { model };
```

---

## Best Practices

1. **Use Generic Types**: Prefer `LanguageModel` over `LanguageModelV1` in function signatures
2. **Feature Detection**: Check capabilities, not versions
3. **Type Guards**: Use provided utilities instead of raw type assertions
4. **Graceful Degradation**: Support older model versions when possible
5. **Test Across Versions**: Verify compatibility with multiple AI SDK versions

---

## Related Documentation

- [TypeScript Troubleshooting](./TYPESCRIPT_TROUBLESHOOTING.md) - General type fixes
- [AI SDK Documentation](https://sdk.vercel.ai) - Official AI SDK docs
- [Complete Documentation](../COMPLETE_DOCUMENTATION.md) - Full project guide

---

**Last Updated:** Consolidated from 5 separate LanguageModel documentation files.
