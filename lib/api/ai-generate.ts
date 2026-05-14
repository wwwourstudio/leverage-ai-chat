import { generateText } from 'ai';
import { createXai } from '@ai-sdk/xai';
import { getGrokApiKey } from '@/lib/config';
import { AI_CONFIG } from '@/lib/constants';

export class AiNotConfiguredError extends Error {
  constructor() { super('AI service not configured'); }
}

interface GenerateJsonOptions {
  system?: string;
  maxOutputTokens?: number;
  temperature?: number;
}

/**
 * Calls Grok with the given prompt and parses the response as JSON.
 * Strips markdown code fences before parsing.
 *
 * Throws AiNotConfiguredError if no XAI_API_KEY is set.
 * Throws SyntaxError if the model returns non-JSON output.
 */
export async function generateJson<T = unknown>(
  prompt: string,
  options: GenerateJsonOptions = {}
): Promise<T> {
  const apiKey = getGrokApiKey();
  if (!apiKey) throw new AiNotConfiguredError();

  const xai = createXai({ apiKey });
  const { text } = await generateText({
    model: xai(AI_CONFIG.MODEL_NAME),
    ...(options.system ? { system: options.system } : {}),
    prompt,
    maxOutputTokens: options.maxOutputTokens ?? 300,
    ...(options.temperature != null ? { temperature: options.temperature } : {}),
  });

  const cleaned = text.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
  return JSON.parse(cleaned) as T;
}
