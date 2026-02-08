# LanguageModel Version Compatibility Analysis

## Error Description

```typescript
Type 'LanguageModelV1' is not assignable to type 'LanguageModel'.
  Property 'supportedUrls' is missing in type 'LanguageModelV1' but required in type 'LanguageModelV2'.
```

This error occurs when there's a type mismatch between different versions of the LanguageModel interface in the AI SDK, specifically related to interface evolution and missing properties.

---

## Root Cause Analysis

### 1. **Interface Evolution in AI SDK**

The AI SDK's LanguageModel interface has evolved across versions:

- **LanguageModelV1**: Original interface without URL support
- **LanguageModelV2** (Theoretical): May include `supportedUrls` property for model-specific URL handling
- **LanguageModelV3** (Future): Potential further extensions

### 2. **Type Constraint Mismatch**

The error occurs when:
- A function/component expects `LanguageModel` (which might be a union or extended type)
- You provide `LanguageModelV1` (the basic type)
- The expected type requires properties not present in V1

### 3. **Common Scenarios**

```typescript
// Scenario A: Function expecting newer version
function processModel(model: LanguageModel) {
  // Expects model.supportedUrls
}

const myModel: LanguageModelV1 = xai('grok-beta'); // ❌ Missing supportedUrls
processModel(myModel); // Type error

// Scenario B: Interface mismatch in CallSettings
interface CallSettings {
  model: LanguageModel; // Expects all properties including supportedUrls
  // ...
}

const settings: CallSettings = {
  model: xai('grok-beta'), // ❌ LanguageModelV1 doesn't have supportedUrls
};
```

---

## Type System Investigation

### Step 1: Verify Installed Type Definitions

Check which version of AI SDK types are loaded:

```bash
# Check AI SDK version
npm list ai

# Verify type definitions exist
ls -la node_modules/ai/dist/index.d.ts
ls -la node_modules/@ai-sdk/xai/dist/index.d.ts
```

### Step 2: Examine Type Hierarchy

Create a diagnostic script to inspect the actual types:

```typescript
// scripts/inspect-model-types.ts
import type { LanguageModelV1 } from 'ai';
import { xai } from '@ai-sdk/xai';

// Test model instantiation
const model = xai('grok-beta');

// Type inspection
type ModelType = typeof model;
type ModelKeys = keyof ModelType;

// Check for supportedUrls
type HasSupportedUrls = 'supportedUrls' extends ModelKeys ? true : false;

console.log('Model type keys:', Object.keys(model));
console.log('Has supportedUrls:', 'supportedUrls' in model);
```

### Step 3: Check Type Definitions in node_modules

```bash
# Search for LanguageModel type definitions
grep -r "interface LanguageModel" node_modules/ai/dist/
grep -r "supportedUrls" node_modules/ai/dist/
```

---

## Solution Strategies

### ✅ Strategy 1: Use Type Assertions (Quick Fix)

If you're certain the model is compatible, use type assertions:

```typescript
import { xai } from '@ai-sdk/xai';

// Option A: Direct assertion
const model = xai('grok-beta') as unknown as LanguageModel;

// Option B: Extend the type
const modelV1 = xai('grok-beta');
const modelExtended = {
  ...modelV1,
  supportedUrls: undefined, // Add missing property
} as LanguageModel;
```

**⚠️ Warning**: This bypasses type checking and may cause runtime issues if the property is actually used.

### ✅ Strategy 2: Create Type-Safe Wrapper (Recommended)

Wrap LanguageModelV1 to add missing properties:

```typescript
// lib/model-adapter.ts
import type { LanguageModelV1 } from 'ai';

export interface ExtendedLanguageModel extends LanguageModelV1 {
  supportedUrls?: string[];
}

export function adaptModel(model: LanguageModelV1): ExtendedLanguageModel {
  return {
    ...model,
    supportedUrls: model.supportedUrls ?? [],
  };
}

// Usage
import { xai } from '@ai-sdk/xai';
import { adaptModel } from '@/lib/model-adapter';

const baseModel = xai('grok-beta');
const adaptedModel = adaptModel(baseModel);
```

### ✅ Strategy 3: Update Type Definitions (Most Correct)

If the type definitions are outdated, extend them:

```typescript
// types/ai-sdk-extensions.d.ts
import type { LanguageModelV1 } from 'ai';

declare module 'ai' {
  // Extend LanguageModelV1 to include supportedUrls
  interface LanguageModelV1 {
    supportedUrls?: string[];
  }
  
  // Or create a union type
  export type LanguageModel = LanguageModelV1 | LanguageModelV2 | LanguageModelV3;
  
  export interface LanguageModelV2 extends LanguageModelV1 {
    supportedUrls: string[];
  }
  
  export interface LanguageModelV3 extends LanguageModelV2 {
    // Future extensions
  }
}
```

### ✅ Strategy 4: Use Generic Type Parameters

Make your functions accept the specific version:

```typescript
// Instead of constraining to a specific version
function processModel<T extends LanguageModelV1>(model: T) {
  // Works with any model that extends V1
  return model;
}

// Usage
const model = xai('grok-beta');
processModel(model); // ✅ Type-safe
```

### ✅ Strategy 5: Check AI SDK Version Compatibility

Ensure you're using the correct AI SDK version:

```json
{
  "dependencies": {
    "ai": "^6.0.0",           // Must be v6+
    "@ai-sdk/xai": "^1.0.8",  // Latest provider
    "@ai-sdk/react": "^3.0.0" // Latest React bindings
  }
}
```

Update if necessary:

```bash
npm update ai @ai-sdk/xai @ai-sdk/react
```

---

## Implementation Plan

### Phase 1: Diagnosis (5 minutes)

1. **Identify Error Location**
   ```bash
   # Find where the error occurs
   grep -rn "LanguageModel" --include="*.ts" --include="*.tsx"
   ```

2. **Check Current Types**
   ```typescript
   // Add this to verify types
   console.log('[v0] Model type:', typeof xai('grok-beta'));
   console.log('[v0] Model keys:', Object.keys(xai('grok-beta')));
   ```

3. **Verify Package Versions**
   ```bash
   npm list ai @ai-sdk/xai
   ```

### Phase 2: Type Definition Fix (10 minutes)

1. **Create Extended Type Definition**
   ```bash
   touch types/ai-sdk-extensions.d.ts
   ```

2. **Add Type Extensions**
   ```typescript
   // types/ai-sdk-extensions.d.ts
   import 'ai';
   
   declare module 'ai' {
     interface LanguageModelV1 {
       supportedUrls?: string[];
     }
   }
   ```

3. **Update tsconfig.json**
   ```json
   {
     "compilerOptions": {
       "typeRoots": ["./types", "./node_modules/@types"]
     },
     "include": ["types/**/*"]
   }
   ```

### Phase 3: Code Updates (15 minutes)

1. **Update CallSettings Interface** (if you defined it)
   ```typescript
   // Before
   interface CallSettings {
     model: LanguageModel; // ❌ May not exist or may require V2
   }
   
   // After
   interface CallSettings {
     model: LanguageModelV1; // ✅ Use the actual type
   }
   ```

2. **Add Runtime Checks** (defensive programming)
   ```typescript
   function isModelWithUrls(model: any): model is LanguageModelV1 & { supportedUrls: string[] } {
     return 'supportedUrls' in model;
   }
   
   const model = xai('grok-beta');
   if (isModelWithUrls(model)) {
     console.log('URLs:', model.supportedUrls);
   }
   ```

3. **Update Imports**
   ```typescript
   // Be explicit about what you import
   import type { LanguageModelV1 } from 'ai';
   import { generateText, streamText } from 'ai';
   import { xai } from '@ai-sdk/xai';
   ```

### Phase 4: Testing (10 minutes)

1. **Type Check**
   ```bash
   npx tsc --noEmit
   ```

2. **Runtime Verification**
   ```typescript
   console.log('[v0] Testing model properties...');
   const testModel = xai('grok-beta');
   console.log('[v0] Model has supportedUrls:', 'supportedUrls' in testModel);
   console.log('[v0] All properties:', Object.keys(testModel));
   ```

3. **Build Test**
   ```bash
   npm run build
   ```

---

## Verification Checklist

- [ ] Confirmed AI SDK version is `^6.0.0` or higher
- [ ] Verified `@ai-sdk/xai` is `^1.0.8` or higher
- [ ] Created/updated `types/ai-sdk-extensions.d.ts` if needed
- [ ] Updated `tsconfig.json` to include custom type definitions
- [ ] Changed `LanguageModel` references to `LanguageModelV1` where appropriate
- [ ] Added type guards for optional properties
- [ ] Removed type assertions (`as any`) if used as temporary fix
- [ ] Ran `npx tsc --noEmit` without errors
- [ ] Tested build with `npm run build`
- [ ] Verified runtime behavior with console logs

---

## Advanced Debugging

### Inspect Actual Type Definitions

```typescript
// scripts/debug-types.ts
import type { LanguageModelV1 } from 'ai';
import { xai } from '@ai-sdk/xai';

const model = xai('grok-beta');

// Get prototype chain
console.log('Prototype:', Object.getPrototypeOf(model));
console.log('Constructor:', model.constructor.name);

// List all properties
console.log('Own properties:', Object.getOwnPropertyNames(model));
console.log('All keys:', Reflect.ownKeys(model));

// Check specific property
const descriptor = Object.getOwnPropertyDescriptor(model, 'supportedUrls');
console.log('supportedUrls descriptor:', descriptor);
```

### Compare Type Definitions

```bash
# Extract type definitions
npx tsc --declaration --emitDeclarationOnly --outDir temp-types

# Compare with node_modules
diff temp-types/lib/model-adapter.d.ts node_modules/ai/dist/index.d.ts
```

---

## Best Practices

1. **Always Use Specific Types**
   ```typescript
   // ✅ Good - Explicit version
   const model: LanguageModelV1 = xai('grok-beta');
   
   // ❌ Avoid - Vague type that may change
   const model: LanguageModel = xai('grok-beta');
   ```

2. **Handle Optional Properties Safely**
   ```typescript
   function useModelUrls(model: LanguageModelV1) {
     const urls = (model as any).supportedUrls ?? [];
     return urls;
   }
   ```

3. **Document Type Assumptions**
   ```typescript
   /**
    * Process a language model.
    * Note: Assumes LanguageModelV1 without supportedUrls property.
    * If your AI SDK version includes supportedUrls, extend this function.
    */
   function processModel(model: LanguageModelV1) {
     // ...
   }
   ```

4. **Use Type Guards**
   ```typescript
   type ModelWithUrls = LanguageModelV1 & { supportedUrls: string[] };
   
   function hasUrlSupport(model: LanguageModelV1): model is ModelWithUrls {
     return 'supportedUrls' in model && Array.isArray((model as any).supportedUrls);
   }
   ```

---

## Common Pitfalls

### ❌ Pitfall 1: Using Non-Existent Types

```typescript
// This might not exist in your version
import type { LanguageModelV2 } from 'ai'; // ❌ May not be exported
```

**Solution**: Stick to documented types or create your own extensions.

### ❌ Pitfall 2: Over-Aggressive Type Assertions

```typescript
// Dangerous - bypasses all type checking
const model = xai('grok-beta') as any;
```

**Solution**: Use specific type assertions or type guards.

### ❌ Pitfall 3: Mixing SDK Versions

```typescript
// package.json has mismatched versions
{
  "ai": "^4.0.0",        // ❌ Old version
  "@ai-sdk/xai": "^1.0.8" // ✅ New version
}
```

**Solution**: Ensure all AI SDK packages are on compatible versions.

---

## Additional Resources

- **AI SDK Documentation**: https://sdk.vercel.ai/
- **Type System Guide**: https://sdk.vercel.ai/docs/reference
- **Provider Packages**: https://sdk.vercel.ai/providers
- **Migration Guide**: https://sdk.vercel.ai/docs/migration

---

## Summary

The `'LanguageModelV1' is not assignable to 'LanguageModel'` error occurs due to interface evolution in the AI SDK. The `supportedUrls` property may be required in newer versions but not present in V1. 

**Recommended fix**: Update your type definitions to extend `LanguageModelV1` with optional `supportedUrls` property, or use the specific `LanguageModelV1` type throughout your codebase rather than a generic `LanguageModel` type that may be a union or extended interface.

The safest approach is to explicitly use `LanguageModelV1` and handle any additional properties as optional extensions through custom type definitions or adapters.
