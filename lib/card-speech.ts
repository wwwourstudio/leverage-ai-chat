/**
 * card-speech.ts — converts structured card data to a spoken text summary.
 *
 * The /api/tts server route handles all final normalization (odds notation,
 * markdown, pauses). This module just produces a readable sentence per card.
 */

interface CardData {
  type: string;
  title: string;
  category?: string;
  subcategory?: string;
  data?: Record<string, unknown>;
}

// Keys to skip — they're visual metadata, not meaningful to hear
const SKIP_KEYS = new Set([
  'gradient', 'status', 'realData', 'id', 'type',
  'last_updated', 'source', 'confidence',
]);

/** Format a single value for speech — handles arrays and nested objects. */
function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'yes' : 'no';
  if (Array.isArray(val)) {
    return val.slice(0, 3).map(formatValue).filter(Boolean).join(', ');
  }
  if (typeof val === 'object') {
    // For nested objects, emit their values joined
    return Object.values(val as Record<string, unknown>)
      .slice(0, 3)
      .map(formatValue)
      .filter(Boolean)
      .join(', ');
  }
  return String(val);
}

/** Convert a key name like "spread_line" to "spread line". */
function humanKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

/**
 * Serialize an array of CardData objects to a natural spoken summary.
 * Each card becomes one sentence. The TTS server normalises odds notation.
 */
export function cardsToSpeech(cards: CardData[]): string {
  if (!cards?.length) return '';

  const parts: string[] = [];

  for (const card of cards.slice(0, 4)) {
    const label = card.title || card.type || 'card';
    const dataEntries = Object.entries(card.data ?? {})
      .filter(([k, v]) => !SKIP_KEYS.has(k) && v !== '' && v !== null && v !== undefined)
      .slice(0, 6);

    if (dataEntries.length === 0) {
      parts.push(label);
      continue;
    }

    const detail = dataEntries
      .map(([k, v]) => `${humanKey(k)}: ${formatValue(v)}`)
      .join('. ');

    parts.push(`${label}. ${detail}`);
  }

  return parts.join('. ');
}
