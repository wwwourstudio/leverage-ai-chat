/**
 * Server-only ADP CSV loader.
 *
 * The `.server.ts` suffix prevents Next.js / Turbopack from including this file
 * in any client bundle. It imports Node.js built-ins (fs, path) that are only
 * available in the Node.js runtime.
 *
 * Called via dynamic import from lib/adp-data.ts so the client bundle never
 * sees the `import fs from 'fs'` / `import path from 'path'` statements.
 */
import fs from 'fs';
import path from 'path';
import type { NFBCPlayer } from '@/lib/adp-data';

const CSV_CANDIDATES = [
  path.join(process.cwd(), 'public', 'adp', 'ADP.csv'),
  path.join(process.cwd(), 'public', 'adp - ADP.csv'),
];

/**
 * Reads and parses a local ADP CSV file.
 * Tries multiple candidate paths in order.
 *
 * @param parseTSV - The parser function from adp-data.ts (passed in to avoid
 *   a circular import since adp-data.ts already owns the parseTSV export).
 */
export async function loadADPFromCSV(
  parseTSV: (raw: string) => NFBCPlayer[],
): Promise<NFBCPlayer[] | null> {
  for (const csvPath of CSV_CANDIDATES) {
    try {
      const text = fs.readFileSync(csvPath, 'utf-8');
      if (!text.trim()) continue;
      const players = parseTSV(text);
      if (players.length === 0) {
        console.warn(
          `[v0] [ADP] ${path.basename(csvPath)} parsed to 0 players — check column headers (expected: Rank, Player, Team, Position(s), ADP)`,
        );
        continue;
      }
      console.log(`[v0] [ADP] Loaded ${players.length} MLB players from ${csvPath}`);
      return players;
    } catch {
      // File not found or unreadable — try next candidate
    }
  }
  return null;
}
