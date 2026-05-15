/**
 * lib/analyze/validation.ts
 * Zod schemas, model routing, image validation, and file-size guard.
 */
import { z } from 'zod';
import type { AnalyzeContext } from './types';

// ── Request body schema ────────────────────────────────────────────────────────
// Validates at the HTTP boundary so malformed bodies fail fast with a clean 400
// instead of propagating undefined/oversized values deep into the pipeline.
export const AnalyzeBodySchema = z.object({
  userMessage:        z.string().min(1, 'Message is required').max(24000, 'Message too long'),
  existingCards:      z.array(z.any()).max(50).optional().default([]),
  context:            z.record(z.any()).optional().default({}),
  customInstructions: z.string().max(2000).optional(),
  imageAttachments:   z.array(z.any()).max(5).optional().default([]),
  deepThink:          z.boolean().optional().default(false),
});

/**
 * Returns true for query types that benefit from the faster grok-3-fast path:
 * - Pure fantasy queries (hasFantasyIntent && !hasBettingIntent)
 * - CSV / file uploads (user's own data, not real-time odds)
 * - Off-season / no-games contexts
 * - Kalshi/political market queries
 */
export function shouldUseFastModel(
  userMessage: string,
  context: AnalyzeContext | undefined,
): boolean {
  const lower = userMessage.toLowerCase();
  if (context?.hasFantasyIntent && !context?.hasBettingIntent) return true;
  if (userMessage.includes('[File:')) return true;
  if (context?.noGamesAvailable) return true;
  if (context?.isPoliticalMarket) return true;

  const kalshiKeywords = ['kalshi', 'prediction market', 'deeper analysis on:'];
  if (kalshiKeywords.some(k => lower.includes(k))) return true;
  if (/[,\s]yes\s+\w/i.test(userMessage)) return true;

  // MLB Statcast / HR queries always use the primary model — accuracy matters
  if (
    context?.sport === 'mlb' &&
    (lower.includes('hr') || lower.includes('statcast') || lower.includes('pitch') ||
      lower.includes('home run') || lower.includes('barrel'))
  ) {
    return false;
  }
  return false;
}

// ── Image attachment validation ────────────────────────────────────────────────
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface ImageAttachmentLike {
  name: string;
  base64: string;
  mimeType: string;
}

/** Filter image attachments to allowed MIME types and size limit. */
export function validateImageAttachments<T extends ImageAttachmentLike>(attachments: T[]): T[] {
  return attachments.filter((img) => {
    if (!ALLOWED_IMAGE_MIMES.has(img.mimeType)) {
      console.warn(`[API/analyze] Rejected image with unsupported MIME type: ${img.mimeType}`);
      return false;
    }
    const estimatedBytes = (img.base64?.length ?? 0) * 0.75;
    if (estimatedBytes > MAX_IMAGE_BYTES) {
      console.warn(`[API/analyze] Rejected image exceeding size limit: ~${Math.round(estimatedBytes / 1024)}KB`);
      return false;
    }
    return true;
  });
}

/**
 * Truncate inline file blocks in the user message to 50 rows so the enriched
 * prompt stays well within the 12k-token budget.
 * The client caps file rows at 100 (chat-input) but this is a server-side safety net.
 */
export function applyFileSizeGuard(rawMessage: string): string {
  if (!rawMessage.includes('[File:')) return rawMessage;
  return rawMessage.replace(
    /(\[File:\s*[^\]]+\s*\((\d+)\s+rows?\)\])([\s\S]*?)(?=\n\[File:|$)/gi,
    (_m, hdr, rowStr, content) => {
      const rowCount = parseInt(rowStr, 10);
      if (rowCount <= 50) return _m;
      const lines = content.trimStart().split('\n');
      const headerRow = lines[0] ?? '';
      const dataRows  = lines.slice(1, 51).join('\n');
      return `${hdr}\n${headerRow}\n${dataRows}\n[... ${rowCount - 50} more rows saved server-side — use query_adp tool for lookups]\n[ADP_FILE_SUMMARY_MODE: true]`;
    },
  );
}
