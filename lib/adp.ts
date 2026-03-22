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
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());

    const players: ADPPlayer[] = lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim());
      const get = (key: string) => cols[headers.indexOf(key)] ?? '';
      return {
        rank: parseInt(get('rank')) || 999,
        playerName: get('player_name') || get('name') || get('player'),
        team: get('team'),
        position: get('position') || get('pos'),
        adp: parseFloat(get('adp')) || 999,
        byeWeek: parseInt(get('bye_week') || get('bye')) || undefined,
      };
    }).filter(p => p.playerName);

    console.log(`[ADP] Loaded ${players.length} players from local CSV`);
    cachedADP = players;
    return players;
  }

  console.error('[ADP] No CSV found at public/adp/ADP.csv — ADP features disabled');
  return [];
}
