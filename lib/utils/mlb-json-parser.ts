/**
 * Utilities for parsing MLB betting analysis responses that may be
 * unstructured markdown text instead of valid JSON.
 */

export interface MLBAnalysis {
  pick: string;
  book: string;
  odds: string | number;
  discrepancy: string;
  edge: string;
  raw?: string;
}

/**
 * Attempts multiple strategies to extract a valid JSON object from a string:
 * 1. Direct JSON.parse (object or first element of an array)
 * 2. JSON inside a ```json ... ``` code block
 * 3. All non-greedy {...} blocks (tries each, picks first valid MLBAnalysis)
 * 4. Full greedy {...} span as last JSON attempt
 * 5. Structured parsing of markdown betting analysis text
 */
export function extractMLBJson(raw: string): MLBAnalysis {
  const trimmed = raw.trim();

  // Strategy 1: direct parse — handles both plain objects and arrays
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      const first = parsed.find(isMLBAnalysis);
      if (first) return first;
    } else if (isMLBAnalysis(parsed)) {
      return parsed;
    }
  } catch {
    // fall through
  }

  // Strategy 2: ```json ... ``` or ``` ... ``` code block
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      const inner = codeBlockMatch[1].trim();
      const parsed = JSON.parse(inner);
      if (Array.isArray(parsed)) {
        const first = parsed.find(isMLBAnalysis);
        if (first) return first;
      } else if (isMLBAnalysis(parsed)) {
        return parsed;
      }
    } catch {
      // fall through
    }
  }

  // Strategy 3: non-greedy {...} blocks — avoids merging adjacent objects
  const nonGreedyCandidates = [...trimmed.matchAll(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\}/g)].map(m => m[0]);
  for (const candidate of nonGreedyCandidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (isMLBAnalysis(parsed)) return parsed;
    } catch {
      // try next
    }
  }

  // Strategy 4: greedy first {...} span (catches deeply-nested objects)
  const greedyMatch = trimmed.match(/\{[\s\S]*\}/);
  if (greedyMatch) {
    try {
      const parsed = JSON.parse(greedyMatch[0]);
      if (Array.isArray(parsed)) {
        const first = parsed.find(isMLBAnalysis);
        if (first) return first;
      } else if (isMLBAnalysis(parsed)) {
        return parsed;
      }
    } catch {
      // fall through
    }
  }

  // Strategy 5: parse markdown betting analysis text into structured object
  return parseMarkdownBettingText(trimmed);
}

/**
 * Parses unstructured markdown betting analysis text into an MLBAnalysis object.
 *
 * Handles text like:
 *   **Pick:** Bet on **San Francisco Giants ML at -104** on BetMGM for value.
 *   - **Edge from odds discrepancy:** Giants at **+100** on BetMGM vs. **-117** on DraftKings
 *     indicates potential sharp money on the underdog, offering a +2.5% implied edge...
 */
export function parseMarkdownBettingText(text: string): MLBAnalysis {
  // Strip markdown bold markers for easier matching
  const plain = text.replace(/\*\*/g, "");

  // --- pick ---
  // Match "Pick: Bet on <team> <bet-type> at <odds> on <book>"
  // e.g. "Pick: Bet on San Francisco Giants ML at -104 on BetMGM for value."
  const pickMatch = plain.match(/Pick:\s*(.+?)(?:\.|$)/i);
  const pick = pickMatch ? pickMatch[1].trim() : plain.split("\n")[0].trim();

  // --- book ---
  // Find "on <Book>" near the pick
  const bookMatch = plain.match(/\bon\s+([A-Z][A-Za-z]+(?:[A-Z][A-Za-z]+)*)\b/);
  const book = bookMatch ? bookMatch[1].trim() : extractBook(plain);

  // --- odds ---
  // Look for odds near the pick (e.g. "at -104" or "at +100")
  const oddsMatch = plain.match(/\bat\s+([-+]?\d{3,4})\b/);
  const odds = oddsMatch ? oddsMatch[1] : extractOdds(plain);

  // --- discrepancy ---
  // Look for lines like "Giants at +100 on BetMGM vs. -117 on DraftKings"
  const discrepancyMatch = plain.match(
    /(?:odds discrepancy|line differences?)[:\s]*([\s\S]*?)(?:\n|$)/i
  );
  const vsMatch = plain.match(/([A-Z][^\n]*(?:[-+]\d{3})[^\n]*vs[^\n]*[-+]\d{3}[^\n]*)/i);
  const discrepancy = discrepancyMatch
    ? discrepancyMatch[1].trim()
    : vsMatch
    ? vsMatch[1].trim()
    : extractDiscrepancy(plain);

  // --- edge ---
  // Look for "X% implied edge" or "edge of X%"
  const edgeMatch = plain.match(/([\+\-]?\d+(?:\.\d+)?%[^.]*edge|edge[^.]*?[\+\-]?\d+(?:\.\d+)?%)/i);
  const edge = edgeMatch ? edgeMatch[0].trim() : extractEdge(plain);

  return { pick, book, odds, discrepancy, edge, raw: text };
}

// ---- Fallback field extractors ----

function extractBook(text: string): string {
  const known = ["BetMGM", "DraftKings", "FanDuel", "Caesars", "PointsBet", "BetRivers", "ESPNBet"];
  for (const b of known) {
    if (text.includes(b)) return b;
  }
  const m = text.match(/\bon\s+([A-Z][A-Za-z]{3,})\b/);
  return m ? m[1] : "Unknown";
}

function extractOdds(text: string): string {
  const m = text.match(/([-+]\d{3,4})/);
  return m ? m[1] : "N/A";
}

function extractDiscrepancy(text: string): string {
  const m = text.match(/([-+]\d{3})\s*(?:on\s+\w+)?\s*vs\.?\s*([-+]\d{3})/i);
  return m ? `${m[1]} vs ${m[2]}` : "N/A";
}

function extractEdge(text: string): string {
  const m = text.match(/([\+\-]?\d+(?:\.\d+)?%)/);
  return m ? m[1] : "N/A";
}

function isMLBAnalysis(obj: unknown): obj is MLBAnalysis {
  if (typeof obj !== "object" || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.pick === "string" &&
    typeof o.book === "string" &&
    typeof o.odds !== "undefined"
  );
}
