# LanguageModel Type Compatibility - Migration Guide

## Overview

This guide helps you update existing code that has LanguageModel type compatibility issues, specifically the `'LanguageModelV1' is not assignable to type 'LanguageModel'` error.

---

## Pre-Migration Checklist

- [ ] Backup your code (or commit to git)
- [ ] Note all files with type errors
- [ ] Check AI SDK version (`npm list ai`)
- [ ] Verify `@ai-sdk/xai` is installed

---

## Migration Path

### Step 1: Understand Your Current State

Run TypeScript to see all errors:
```bash
npx tsc --noEmit > type-errors.txt
```

Look for:
- `LanguageModelV1` not assignable errors
- Missing `supportedUrls` property errors
- `CallSettings` type mismatches

### Step 2: Automatic Fix (No Code Changes Needed)

The type extensions in `types/ai-sdk-extensions.d.ts` automatically fix most issues:

```typescript
// Before: This had type errors
import { generateText } from 'ai';
import { xai } from '@ai-sdk/xai';

const result = await generateText({
  model: xai('grok-beta'), // ❌ Type error
  prompt: 'Test',
});

// After: Same code, but now works
import { generateText } from 'ai';
import { xai } from '@ai-sdk/xai';

const result = await generateText({
  model: xai('grok-beta'), // ✅ No error
  prompt: 'Test',
});
```

**Action Required**: None - restart TypeScript server if errors persist.

### Step 3: Update Custom Type Definitions

If you have custom interfaces that reference `LanguageModel`:

```typescript
// Before
interface MyCallSettings {
  model: LanguageModel; // May not exist or may be incompatible
}

// After - Option 1: Use LanguageModelV1
interface MyCallSettings {
  model: LanguageModelV1; // ✅ Specific type
}

// After - Option 2: Use the union type (if you created it)
import type { LanguageModel } from 'ai'; // Now a union via extensions
interface MyCallSettings {
  model: LanguageModel; // ✅ Includes all versions
}
```

### Step 4: Add Runtime Safety (Optional but Recommended)

For functions that access model properties:

```typescript
// Before: Unsafe property access
function processModel(model: any) {
  const urls = model.supportedUrls; // ❌ May be undefined
  return urls.map(url => fetch(url)); // ❌ Runtime error if undefined
}

// After: Safe property access
import { getSupportedUrls } from '@/lib/model-adapter';

function processModel(model: LanguageModelV1) {
  const urls = getSupportedUrls(model); // ✅ Always returns array
  return urls.map(url => fetch(url)); // ✅ Safe
}
```

### Step 5: Add Type Guards for Conditional Logic

If you need different behavior based on model capabilities:

```typescript
// Before: Unsafe check
function handleModel(model: any) {
  if (model.supportedUrls) { // ❌ TypeScript doesn't narrow type
    console.log(model.supportedUrls);
  }
}

// After: Type-safe guard
import { isModelWithUrlSupport } from '@/lib/model-adapter';

function handleModel(model: LanguageModelV1) {
  if (isModelWithUrlSupport(model)) { // ✅ Type guard
    console.log(model.supportedUrls); // ✅ TypeScript knows it exists
  }
}
```

---

## Common Migration Scenarios

### Scenario 1: Type Assertion Removal

```typescript
// Before: Using 'any' or 'as' to bypass errors
const model = xai('grok-beta') as any;
const model2 = xai('grok-beta') as unknown as LanguageModel;

// After: Direct usage (type extensions handle it)
const model = xai('grok-beta'); // ✅ Properly typed
```

### Scenario 2: CallSettings Interface

```typescript
// Before: Custom interface with type issues
interface CallSettings {
  model: LanguageModel; // ❌ Incompatible
  temperature?: number;
}

// After: Use correct type
interface CallSettings {
  model: LanguageModelV1; // ✅ Compatible via extensions
  temperature?: number;
}
```

### Scenario 3: Function Parameters

```typescript
// Before: Overly broad type
function analyzeWithModel(model: any) {
  // Implementation
}

// After: Specific type with safety
import { validateModelVersion } from '@/lib/model-adapter';

function analyzeWithModel(model: LanguageModelV1) {
  validateModelVersion(model, ['provider', 'modelId']);
  // Implementation
}
```

### Scenario 4: Property Access

```typescript
// Before: Direct access without checks
function getModelUrls(model: LanguageModelV1) {
  return model.supportedUrls || []; // ⚠️ Works but not type-safe
}

// After: Type-safe getter
import { getSupportedUrls } from '@/lib/model-adapter';

function getModelUrls(model: LanguageModelV1) {
  return getSupportedUrls(model); // ✅ Type-safe
}
```

### Scenario 5: Model Initialization

```typescript
// Before: Complex initialization with workarounds
const modelConfig = {
  model: xai('grok-beta') as any, // ❌ Type bypass
  ...otherConfig,
};

// After: Clean initialization with adapter
import { adaptModel } from '@/lib/model-adapter';

const modelConfig = {
  model: adaptModel(xai('grok-beta')), // ✅ Type-safe with guarantees
  ...otherConfig,
};
```

---

## Testing Your Migration

### 1. Type Checking
```bash
# Should complete without errors
npx tsc --noEmit
```

### 2. Run Verification Script
```bash
# Should pass all tests
npx tsx scripts/verify-model-types.ts
```

### 3. Build Test
```bash
# Should build successfully
npm run build
```

### 4. Runtime Test
```typescript
// Add temporary debug logging
import { debugModel } from '@/lib/model-adapter';

const model = xai('grok-beta');
debugModel(model, 'Migration Test');

// Remove after verification
```

---

## Rollback Plan

If something goes wrong:

### Quick Rollback
```bash
# Remove type extensions
rm types/ai-sdk-extensions.d.ts

# Remove adapter utilities  
rm lib/model-adapter.ts

# Restart TypeScript
# VS Code: Cmd+Shift+P → TypeScript: Restart TS Server
```

### Full Rollback
```bash
# Restore from git
git checkout types/ai-sdk-extensions.d.ts
git checkout lib/model-adapter.ts

# Or restore from backup
cp backup/types/ai-sdk-extensions.d.ts types/
```

---

## Post-Migration Checklist

- [ ] All TypeScript errors resolved (`npx tsc --noEmit`)
- [ ] Verification script passes (`npx tsx scripts/verify-model-types.ts`)
- [ ] Build succeeds (`npm run build`)
- [ ] Application runs without runtime errors
- [ ] No `any` types used for models
- [ ] Type guards used where appropriate
- [ ] Debug logging removed (if added)
- [ ] Documentation updated (if you added custom types)

---

## Best Practices Going Forward

1. **Always use specific types**
   ```typescript
   ✅ const model: LanguageModelV1 = xai('grok-beta');
   ❌ const model: any = xai('grok-beta');
   ```

2. **Use adapter utilities for safety**
   ```typescript
   import { adaptModel, getSupportedUrls } from '@/lib/model-adapter';
   ```

3. **Add type guards for optional properties**
   ```typescript
   import { isModelWithUrlSupport } from '@/lib/model-adapter';
   ```

4. **Debug during development**
   ```typescript
   import { debugModel } from '@/lib/model-adapter';
   debugModel(model); // See all properties
   ```

5. **Validate in critical paths**
   ```typescript
   import { validateModelVersion } from '@/lib/model-adapter';
   validateModelVersion(model, ['provider', 'modelId']);
   ```

---

## FAQ

### Q: Do I need to change my existing code?
**A:** In most cases, no. The type extensions automatically fix compatibility issues. Only add adapter utilities if you need runtime safety.

### Q: What if I'm using a different provider?
**A:** The solution works with all AI SDK providers (OpenAI, Anthropic, Google, etc.). Just import the appropriate provider function.

### Q: Will this break in future AI SDK versions?
**A:** The extensions are additive and non-breaking. If future versions add `supportedUrls` natively, your code will still work.

### Q: Should I use adaptModel everywhere?
**A:** No, only where you need guaranteed runtime safety or debugging. Type extensions handle compile-time safety automatically.

### Q: Can I remove the type extensions?
**A:** Only if your AI SDK version natively supports `supportedUrls`. Check with the verification script first.

---

## Support Resources

- **Quick Reference**: `LANGUAGEMODEL_QUICK_REFERENCE.md`
- **Full Diagnostic Guide**: `LANGUAGEMODEL_VERSION_COMPATIBILITY.md`
- **Implementation Details**: `LANGUAGEMODEL_FIX_IMPLEMENTATION.md`
- **Verification Script**: `scripts/verify-model-types.ts`

---

## Summary

The migration is mostly automatic thanks to TypeScript module augmentation. In most cases, simply restarting your TypeScript server will resolve all errors. Only add runtime utilities where you need extra safety or debugging capabilities.

✅ Minimal code changes required
✅ Backward compatible
✅ Forward compatible
✅ Zero breaking changes
✅ Type-safe throughout
