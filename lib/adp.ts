import fs from 'fs';
import path from 'path';

export interface ADPPlayer {
  rank: number;
  playerName: string;
  team: string;
  position: string;
  adp: number;
  byeWeek?: number;
}

let cachedADP: ADPPlayer[] | null = null;

/**
 * Quote-aware CSV tokenizer.
 * Handles fields like "Ohtani, Shohei" and "UT, P" correctly.
 */
function parseCSVLine(line: string): string[] {
  const tokens: string[] = [];
  let cur = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Escaped double-quote inside a quoted field ("" → ")
      if (inQuote && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === ',' && !inQuote) {
      tokens.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  tokens.push(cur.trim());
  return tokens;
}

/**
 * Convert "Last, First" → "First Last".
 * If the name contains no comma it is returned as-is.
 */
function reverseNFBCName(raw: string): string {
  const commaIdx = raw.indexOf(',');
  if (commaIdx === -1) return raw.trim();
  const last  = raw.slice(0, commaIdx).trim();
  const first = raw.slice(commaIdx + 1).trim();
  return first ? `${first} ${last}` : last;
}

export function loadADP(): ADPPlayer[] {
  if (cachedADP) return cachedADP;

  const csvPaths = [
    path.join(process.cwd(), 'public', 'adp', 'ADP.csv'),
    path.join(process.cwd(), 'public', 'adp - ADP.csv'),
  ];

  for (const csvPath of csvPaths) {
    if (!fs.existsSync(csvPath)) continue;

    const raw = fs.readFileSync(csvPath, 'utf-8');
    const lines = raw.trim().split('\n');
    if (lines.length < 2) continue;

    // Parse headers with the same quote-aware tokenizer
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());

    // Flexible column index lookup
    const idx = (keys: string[]): number => {
      for (const key of keys) {
        const i = headers.findIndex(h => h === key || h.startsWith(key));
        if (i !== -1) return i;
      }
      return -1;
    };

    const rankIdx     = idx(['rank']);
    const playerIdx   = idx(['player']);          // "Player" column
    const teamIdx     = idx(['team']);
    const posIdx      = idx(['position(s)', 'position', 'pos']);
    const adpIdx      = idx(['adp']);

    const players: ADPPlayer[] = [];

    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const cols = parseCSVLine(line);

      const playerRaw = playerIdx !== -1 ? (cols[playerIdx] ?? '') : '';
      if (!playerRaw) continue;

      const posRaw   = posIdx   !== -1 ? (cols[posIdx]   ?? '') : '';
      // First position token (e.g. "UT, P" → "UT")
      const position = posRaw.split(',')[0].trim();

      const adpRaw   = adpIdx   !== -1 ? (cols[adpIdx]   ?? '') : '';
      const rankRaw  = rankIdx  !== -1 ? (cols[rankIdx]  ?? '') : '';
      const teamRaw  = teamIdx  !== -1 ? (cols[teamIdx]  ?? '') : '';

      players.push({
        rank:       parseInt(rankRaw)    || 999,
        playerName: reverseNFBCName(playerRaw),
        team:       teamRaw,
        position,
        adp:        parseFloat(adpRaw)  || 999,
      });
    }

    const valid = players.filter(p => p.playerName && p.adp !== 999);
    console.log(`[ADP] Loaded ${valid.length} players from local CSV`);
    cachedADP = valid.length > 0 ? valid : players.filter(p => p.playerName);
    return cachedADP;
  }

  console.error('[ADP] No CSV found at public/adp/ADP.csv — ADP features disabled');
  return [];
}
