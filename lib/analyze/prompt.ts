/**
 * lib/analyze/prompt.ts
 * System prompt construction: addendum selection, prompt-cache split,
 * and custom-instructions sanitisation.
 *
 * Note: *enrichment* (odds/Kalshi/Statcast injection) lives in prompt-enrichment.ts.
 * This file handles the static system-prompt skeleton only.
 */
import {
  SYSTEM_PROMPT,
  MLB_ANALYSIS_ADDENDUM,
  NFBC_ADP_ADDENDUM,
  MLB_PROJECTION_ADDENDUM,
  FANTASY_STARTSIT_ADDENDUM,
  DEEP_THINK_ADDENDUM,
} from '@/lib/constants';
import type { SportDetectionResult } from './types';

// ── Prompt-injection guard ─────────────────────────────────────────────────────
// Strip common jailbreak patterns from user-controlled custom instructions
// before injecting them into the system prompt.
export function sanitizeCustomInstructions(raw: string): string {
  const sanitized = raw
    .slice(0, 2000) // hard character cap
    .replace(/ignore\s+(all\s+)?(previous|above|prior)\s+instructions?/gi, '[filtered]')
    .replace(/forget\s+(all\s+)?(previous|above|prior)\s+instructions?/gi, '[filtered]')
    .replace(/disregard\s+(all\s+)?(previous|above|prior)\s+instructions?/gi, '[filtered]')
    .replace(/\bsystem\s*prompt\b/gi, '[filtered]')
    .replace(/\[INST\]|\[\/INST\]|<s>|<\/s>|<\|im_start\|>|<\|im_end\|>/g, '') // LLM escape tokens
    .replace(/\bDAN\b|\bjailbreak\b/gi, '[filtered]') // common jailbreak keywords
    .trim();
  if (sanitized !== raw.trim().slice(0, 2000)) {
    console.warn('[API/analyze] Custom instructions sanitized — potential injection attempt filtered');
  }
  return sanitized;
}

export interface SystemPromptParts {
  /** Full system prompt including current date and user profile — used for verification only. */
  systemPrompt: string;
  /**
   * Stable system body WITHOUT the date line or user profile so the prefix is
   * identical across calls and users — maximises Anthropic cache hit rate.
   */
  cachedSystem: string;
  /**
   * Dynamic prefix (today's date + user profile) injected per-request.
   * Excluded from cachedSystem intentionally.
   */
  dynamicSystem: string;
}

/**
 * Build all three system-prompt parts for a request.
 *
 * The split allows xAI → Anthropic prompt caching to cache the large static body
 * while re-injecting per-request dynamic context (date, user profile) separately.
 */
export function buildSystemPrompt(
  detection: SportDetectionResult,
  dateStr: string,
  customInstructions?: string,
  deepThink = false,
): SystemPromptParts {
  const { hasStartSitIntent, hasMLBProjectionIntent, isMLBStatcastMode, hasADPIntent } = detection;

  const sanitized = customInstructions?.trim()
    ? sanitizeCustomInstructions(customInstructions)
    : '';

  // ── Full prompt (with date baked in) ────────────────────────────────────────
  const baseSystemPrompt = SYSTEM_PROMPT.replace('[CURRENT_DATE]', dateStr);
  const baseWithAddendum = selectAddendum(baseSystemPrompt, detection);
  const baseWithProfile = sanitized
    ? `${baseWithAddendum}\n\n## USER PROFILE & BETTING PREFERENCES\n${sanitized}`
    : baseWithAddendum;
  const systemPrompt = deepThink ? `${baseWithProfile}${DEEP_THINK_ADDENDUM}` : baseWithProfile;

  // ── Cached body (no date, no user profile) ───────────────────────────────────
  // Stripping the date line keeps the prefix stable so cache hit rate stays high
  // even when the same user sends two requests on different days.
  const cachedSystemBase = SYSTEM_PROMPT.replace('Today: [CURRENT_DATE].', '').replace(/^\n+/, '');
  const cachedWithAddendum = selectAddendum(cachedSystemBase, detection);
  const cachedSystem = deepThink ? `${cachedWithAddendum}${DEEP_THINK_ADDENDUM}` : cachedWithAddendum;

  // ── Dynamic prefix (date + optional user profile) ────────────────────────────
  const dynamicSystemParts: string[] = [`Today: ${dateStr}.`];
  if (sanitized) {
    dynamicSystemParts.push(`## USER PROFILE & BETTING PREFERENCES\n${sanitized}`);
  }
  const dynamicSystem = dynamicSystemParts.join('\n\n');

  return { systemPrompt, cachedSystem, dynamicSystem };
}

/** Pick the correct system-prompt addendum based on the active intent. */
function selectAddendum(base: string, detection: SportDetectionResult): string {
  const { hasStartSitIntent, hasMLBProjectionIntent, isMLBStatcastMode, hasADPIntent } = detection;
  if (hasStartSitIntent)     return `${base}${FANTASY_STARTSIT_ADDENDUM}`;
  if (hasMLBProjectionIntent) return `${base}${MLB_PROJECTION_ADDENDUM}`;
  if (isMLBStatcastMode)      return `${base}${MLB_ANALYSIS_ADDENDUM}`;
  if (hasADPIntent)           return `${base}${NFBC_ADP_ADDENDUM}`;
  return base;
}
