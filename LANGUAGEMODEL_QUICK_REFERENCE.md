# LanguageModel Type Compatibility - Quick Reference

## The Problem
```typescript
❌ Type 'LanguageModelV1' is not assignable to type 'LanguageModel'
   Property 'supportedUrls' is missing
```

## The Solution (3 Options)

### 1. Automatic (Type Extensions) ⭐ RECOMMENDED
```typescript
import { generateText } from 'ai';
import { xai } from '@ai-sdk/xai';

// Just works - type extensions handle everything
const result = await generateText({
  model: xai('grok-beta'), // ✅ No errors
  prompt: 'Your prompt',
});
```

### 2. Explicit Safety (Adapter)
```typescript
import { adaptModel } from '@/lib/model-adapter';
import { xai } from '@ai-sdk/xai';

const model = adaptModel(xai('grok-beta')); // ✅ Guaranteed safe
```

### 3. Type Guards (Conditional)
```typescript
import { isModelWithUrlSupport, getSupportedUrls } from '@/lib/model-adapter';

const model = xai('grok-beta');

if (isModelWithUrlSupport(model)) {
  console.log(model.supportedUrls); // ✅ Type-safe access
}

// Or use safe getter
const urls = getSupportedUrls(model); // ✅ Always returns array
```

---

## Common Patterns

### Pattern: Basic Generation
```typescript
import { generateText } from 'ai';
import { xai } from '@ai-sdk/xai';

const { text } = await generateText({
  model: xai('grok-beta'),
  prompt: 'Analyze...',
  temperature: 0.7,
});
```

### Pattern: Custom Settings
```typescript
import type { LanguageModelV1 } from 'ai';

interface MySettings {
  model: LanguageModelV1; // ✅ Has supportedUrls via extension
  temperature?: number;
}

const settings: MySettings = {
  model: xai('grok-beta'),
};
```

### Pattern: Type-Safe Properties
```typescript
import { getSupportedUrls } from '@/lib/model-adapter';

const model = xai('grok-beta');
const urls = getSupportedUrls(model); // ✅ string[] always
```

### Pattern: Debugging
```typescript
import { debugModel } from '@/lib/model-adapter';

const model = xai('grok-beta');
debugModel(model); // Logs all properties
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `types/ai-sdk-extensions.d.ts` | Type augmentation (automatic) |
| `lib/model-adapter.ts` | Runtime utilities |
| `scripts/verify-model-types.ts` | Verification tests |
| `LANGUAGEMODEL_VERSION_COMPATIBILITY.md` | Full diagnostic guide |
| `LANGUAGEMODEL_FIX_IMPLEMENTATION.md` | Implementation details |

---

## Verification Commands

```bash
# Check TypeScript
npx tsc --noEmit

# Run tests
npx tsx scripts/verify-model-types.ts

# Build
npm run build
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Type errors persist | Restart TS Server (Cmd+Shift+P → TypeScript: Restart) |
| Property undefined at runtime | Use `adaptModel(model)` |
| Need to check property exists | Use `isModelWithUrlSupport(model)` |
| Want to see all properties | Use `debugModel(model)` |

---

## Important Notes

✅ Type extensions load automatically via tsconfig
✅ No changes needed to existing code
✅ Works with all AI SDK 6 functions
✅ Compatible with future versions

📖 For detailed info, see `LANGUAGEMODEL_VERSION_COMPATIBILITY.md`
