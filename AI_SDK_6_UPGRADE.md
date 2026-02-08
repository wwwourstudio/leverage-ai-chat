# AI SDK 6 Upgrade - Type Safety Fixes

## Issue Resolution

### Problem
TypeScript error: `Type 'string' is not assignable to type 'LanguageModelV1'`

### Root Cause
The codebase was using AI SDK v4 (`"ai": "^4.0.52"`) but the code was written for AI SDK v6 patterns. In AI SDK v4, you cannot pass model strings directly - you need to use provider-specific model instances.

### Solution Implemented

#### 1. Upgraded AI SDK Dependencies
```json
// package.json - Before
"ai": "^4.0.52"

// package.json - After
"ai": "^6.0.0",
"@ai-sdk/react": "^3.0.0"
```

#### 2. Proper Model Instantiation
Instead of passing model strings, we now use the xAI provider's model function:

```typescript
// Before (AI SDK 4 - doesn't work)
import { generateText } from 'ai';
const result = await generateText({
  model: 'xai/grok-beta', // ❌ Type error: string not assignable to LanguageModelV1
  prompt: '...'
});

// After (AI SDK 6 - correct)
import { generateText } from 'ai';
import { xai } from '@ai-sdk/xai';

const result = await generateText({
  model: xai('grok-beta'), // ✅ Returns LanguageModelV1 instance
  prompt: '...'
});
```

## Files Modified

### 1. `/package.json`
- Upgraded `ai` from `^4.0.52` to `^6.0.0`
- Added `@ai-sdk/react: ^3.0.0` for React hooks

### 2. `/app/api/analyze/route.ts`
- Added: `import { xai } from '@ai-sdk/xai'`
- Changed: `model: 'xai/grok-beta'` → `model: xai('grok-beta')`

### 3. `/lib/leveraged-ai.ts`
- Added: `import { xai } from '@ai-sdk/xai'`
- Updated all `generateText` calls to use `xai('grok-beta')`
- Fixed reference from `this.xaiModel` to `this.aiEnabled`

## API Changes in AI SDK 6

### Key Differences from v4/v5:

1. **Model Parameter**
   - v4/v5: Provider-specific imports required
   - v6: Use provider functions: `xai()`, `openai()`, `anthropic()`

2. **Token Limits**
   - v4/v5: `maxTokens`
   - v6: `maxOutputTokens`

3. **Message Format**
   - v6 uses `ModelMessage` type (not `CoreMessage`)
   - `convertToModelMessages()` is now async (must be awaited)

4. **Streaming**
   - v6: `toUIMessageStreamResponse()` for HTTP responses
   - Works seamlessly with `useChat` from `@ai-sdk/react`

## Supported xAI Models

With `@ai-sdk/xai` provider:
- `grok-beta` - Latest Grok model
- `grok-vision-beta` - Vision-capable Grok
- `grok-2-latest` - Grok 2 stable release

## Environment Variables Required

```bash
XAI_API_KEY=xai-...  # Your xAI API key
```

The xAI provider automatically uses `XAI_API_KEY` from environment variables.

## Testing

After these changes, all TypeScript compilation errors should be resolved:
```bash
npm run build  # Should complete without type errors
```

## Additional Benefits

1. **Type Safety**: Full TypeScript support with proper model types
2. **Auto-complete**: IDE suggestions for model parameters
3. **Error Prevention**: Compile-time checks for invalid model configurations
4. **Future-proof**: Using latest AI SDK patterns and best practices

## Migration Guide for Other Files

If you need to add AI functionality elsewhere:

```typescript
// 1. Import dependencies
import { generateText } from 'ai';
import { xai } from '@ai-sdk/xai';

// 2. Use in server-side code (API routes or Server Actions)
export async function POST(req: Request) {
  const result = await generateText({
    model: xai('grok-beta'),
    system: 'You are a helpful assistant',
    prompt: 'Hello!',
    temperature: 0.7,
    maxOutputTokens: 500,
  });
  
  return Response.json({ text: result.text });
}
```

## References

- [AI SDK 6 Documentation](https://sdk.vercel.ai/docs)
- [xAI Provider Docs](https://sdk.vercel.ai/providers/xai)
- [Migration Guide v5→v6](https://sdk.vercel.ai/docs/migration/v5-to-v6)
