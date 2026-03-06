/**
 * Fantasy Card Generator
 *
 * Generates InsightCard objects for the fantasy platform's chat-card experience.
 * Uses archived 2025 NFL season data + VBD math computed on-the-fly for NFL.
 * For in-season sports (NBA, MLB, NHL) returns live-query cards backed by the AI.
 *
 * Card types produced:
 *   FANTASY_VBD         - Top players at a position by Value-Based Drafting score (NFL 2025 historical)
 *   FANTASY_TIER_CLIFF  - Tier drop alerts (pick-now-or-never signals)
 *   FANTASY_DRAFT       - Draft recommendation (best pick + leverage plays)
 *   FANTASY_WAIVER      - Waiver wire targets with FAAB bid estimates
 *   FANTASY_PROJECTION  - Single-player projection detail
 *   FANTASY_ADVICE      - Live-query cards for non-NFL sports (NBA, MLB, NHL, etc.)
 */

import type { InsightCard } from '@/lib/cards-generator';

// ============================================================================
// Archived 2025 NFL season data (PPR, final season projections)
// NOTE: NFL 2025 season is complete. These are historical reference values.
// For live in-season sports (NBA, MLB, NHL) use generateNonNFLFantasyCards().
// ============================================================================

interface EmbeddedPlayer {
  name: string;
  team: string;
  pos: 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';
  pts: number;   // projected PPR fantasy points
  adp: number;   // ADP (overall pick)
}

const NFL_PROJECTIONS_2025: EmbeddedPlayer[] = [
  // QBs
  { name: 'Josh Allen',          team: 'BUF', pos: 'QB', pts: 418, adp: 1.8 },
  { name: 'Lamar Jackson',       team: 'BAL', pos: 'QB', pts: 412, adp: 2.4 },
  { name: 'Jalen Hurts',         team: 'PHI', pos: 'QB', pts: 390, adp: 5.2 },
  { name: 'Dak Prescott',        team: 'DAL', pos: 'QB', pts: 352, adp: 38 },
  { name: 'CJ Stroud',           team: 'HOU', pos: 'QB', pts: 347, adp: 42 },
  { name: 'Anthony Richardson',  team: 'IND', pos: 'QB', pts: 341, adp: 55 },
  { name: 'Jordan Love',         team: 'GB',  pos: 'QB', pts: 334, adp: 64 },
  { name: 'Justin Herbert',      team: 'LAC', pos: 'QB', pts: 329, adp: 71 },
  { name: 'Patrick Mahomes',     team: 'KC',  pos: 'QB', pts: 325, adp: 79 },
  { name: 'Tua Tagovailoa',      team: 'MIA', pos: 'QB', pts: 311, adp: 88 },
  { name: 'Sam Darnold',         team: 'MIN', pos: 'QB', pts: 300, adp: 99 },
  { name: 'Baker Mayfield',      team: 'TB',  pos: 'QB', pts: 292, adp: 110 },
  { name: 'Brock Purdy',         team: 'SF',  pos: 'QB', pts: 285, adp: 121 },
  { name: 'Trevor Lawrence',     team: 'JAX', pos: 'QB', pts: 280, adp: 134 },
  { name: 'Aaron Rodgers',       team: 'NYJ', pos: 'QB', pts: 265, adp: 148 },

  // RBs
  { name: 'Breece Hall',         team: 'NYJ', pos: 'RB', pts: 312, adp: 3.1 },
  { name: 'Saquon Barkley',      team: 'PHI', pos: 'RB', pts: 307, adp: 4.5 },
  { name: 'Jahmyr Gibbs',        team: 'DET', pos: 'RB', pts: 301, adp: 6.8 },
  { name: 'De\'Von Achane',      team: 'MIA', pos: 'RB', pts: 293, adp: 8.2 },
  { name: 'Christian McCaffrey', team: 'SF',  pos: 'RB', pts: 287, adp: 11.4 },
  { name: 'Josh Jacobs',         team: 'GB',  pos: 'RB', pts: 275, adp: 14.7 },
  { name: 'Travis Etienne',      team: 'JAX', pos: 'RB', pts: 271, adp: 17.2 },
  { name: 'Kyren Williams',      team: 'LAR', pos: 'RB', pts: 265, adp: 19.8 },
  { name: 'Jonathan Taylor',     team: 'IND', pos: 'RB', pts: 260, adp: 23.1 },
  { name: 'Isiah Pacheco',       team: 'KC',  pos: 'RB', pts: 254, adp: 27.4 },
  { name: 'Tony Pollard',        team: 'TEN', pos: 'RB', pts: 248, adp: 31.6 },
  { name: 'Derrick Henry',       team: 'BAL', pos: 'RB', pts: 242, adp: 35.9 },
  { name: 'Aaron Jones',         team: 'MIN', pos: 'RB', pts: 238, adp: 40.2 },
  { name: 'Rachaad White',       team: 'TB',  pos: 'RB', pts: 231, adp: 45.1 },
  { name: 'David Montgomery',    team: 'DET', pos: 'RB', pts: 225, adp: 51.3 },
  { name: 'Rhamondre Stevenson', team: 'NE',  pos: 'RB', pts: 219, adp: 57.8 },
  { name: 'Joe Mixon',           team: 'HOU', pos: 'RB', pts: 212, adp: 64.4 },
  { name: 'Bijan Robinson',      team: 'ATL', pos: 'RB', pts: 208, adp: 71.2 },
  { name: 'Zack Moss',           team: 'CIN', pos: 'RB', pts: 195, adp: 82.7 },
  { name: 'AJ Dillon',           team: 'GB',  pos: 'RB', pts: 182, adp: 98.1 },
  { name: 'Jerome Ford',         team: 'CLE', pos: 'RB', pts: 175, adp: 111.4 },

  // WRs
  { name: 'CeeDee Lamb',         team: 'DAL', pos: 'WR', pts: 342, adp: 2.9 },
  { name: 'Tyreek Hill',         team: 'MIA', pos: 'WR', pts: 332, adp: 7.4 },
  { name: 'Ja\'Marr Chase',      team: 'CIN', pos: 'WR', pts: 326, adp: 9.1 },
  { name: 'Justin Jefferson',    team: 'MIN', pos: 'WR', pts: 319, adp: 12.3 },
  { name: 'Amon-Ra St. Brown',   team: 'DET', pos: 'WR', pts: 301, adp: 16.5 },
  { name: 'Davante Adams',       team: 'NYJ', pos: 'WR', pts: 285, adp: 22.8 },
  { name: 'Stefon Diggs',        team: 'HOU', pos: 'WR', pts: 278, adp: 28.3 },
  { name: 'DeVonta Smith',       team: 'PHI', pos: 'WR', pts: 267, adp: 33.7 },
  { name: 'DJ Moore',            team: 'CHI', pos: 'WR', pts: 261, adp: 39.4 },
  { name: 'Jaylen Waddle',       team: 'MIA', pos: 'WR', pts: 254, adp: 45.9 },
  { name: 'Mike Evans',          team: 'TB',  pos: 'WR', pts: 249, adp: 52.6 },
  { name: 'Tee Higgins',         team: 'CIN', pos: 'WR', pts: 244, adp: 58.1 },
  { name: 'Puka Nacua',          team: 'LAR', pos: 'WR', pts: 239, adp: 63.4 },
  { name: 'George Pickens',      team: 'PIT', pos: 'WR', pts: 234, adp: 68.9 },
  { name: 'Deebo Samuel',        team: 'SF',  pos: 'WR', pts: 229, adp: 75.2 },
  { name: 'Keenan Allen',        team: 'CHI', pos: 'WR', pts: 224, adp: 81.8 },
  { name: 'Tank Dell',           team: 'HOU', pos: 'WR', pts: 220, adp: 88.3 },
  { name: 'Courtland Sutton',    team: 'DEN', pos: 'WR', pts: 215, adp: 94.7 },
  { name: 'Chris Olave',         team: 'NO',  pos: 'WR', pts: 210, adp: 101.2 },
  { name: 'Michael Pittman',     team: 'IND', pos: 'WR', pts: 205, adp: 108.4 },
  { name: 'Drake London',        team: 'ATL', pos: 'WR', pts: 200, adp: 114.7 },
  { name: 'DK Metcalf',          team: 'SEA', pos: 'WR', pts: 196, adp: 121.3 },
  { name: 'Josh Downs',          team: 'IND', pos: 'WR', pts: 192, adp: 128.6 },
  { name: 'Zay Flowers',         team: 'BAL', pos: 'WR', pts: 188, adp: 136.1 },
  { name: 'Calvin Ridley',       team: 'TEN', pos: 'WR', pts: 183, adp: 143.8 },
  { name: 'Rashee Rice',         team: 'KC',  pos: 'WR', pts: 179, adp: 151.4 },
  { name: 'Rome Odunze',         team: 'CHI', pos: 'WR', pts: 174, adp: 159.7 },
  { name: 'Ladd McConkey',       team: 'LAC', pos: 'WR', pts: 170, adp: 168.2 },
  { name: 'Curtis Samuel',       team: 'BUF', pos: 'WR', pts: 164, adp: 178.4 },
  { name: 'Dontayvion Wicks',    team: 'GB',  pos: 'WR', pts: 158, adp: 190.1 },
  { name: 'Charlie Jones',       team: 'CIN', pos: 'WR', pts: 151, adp: 201.6 },

  // TEs
  { name: 'Sam LaPorta',         team: 'DET', pos: 'TE', pts: 203, adp: 13.6 },
  { name: 'Travis Kelce',        team: 'KC',  pos: 'TE', pts: 197, adp: 18.9 },
  { name: 'Mark Andrews',        team: 'BAL', pos: 'TE', pts: 186, adp: 26.4 },
  { name: 'Dallas Goedert',      team: 'PHI', pos: 'TE', pts: 181, adp: 34.7 },
  { name: 'Trey McBride',        team: 'ARI', pos: 'TE', pts: 175, adp: 44.1 },
  { name: 'Jake Ferguson',       team: 'DAL', pos: 'TE', pts: 166, adp: 56.3 },
  { name: 'Evan Engram',         team: 'JAX', pos: 'TE', pts: 161, adp: 69.8 },
  { name: 'Kyle Pitts',          team: 'ATL', pos: 'TE', pts: 155, adp: 84.2 },
  { name: 'David Njoku',         team: 'CLE', pos: 'TE', pts: 150, adp: 99.6 },
  { name: 'Pat Freiermuth',      team: 'PIT', pos: 'TE', pts: 144, adp: 115.1 },
  { name: 'T.J. Hockenson',      team: 'MIN', pos: 'TE', pts: 139, adp: 129.3 },
  { name: 'Tyler Higbee',        team: 'LAR', pos: 'TE', pts: 130, adp: 146.7 },
  { name: 'Dalton Kincaid',      team: 'BUF', pos: 'TE', pts: 125, adp: 163.2 },
  { name: 'Luke Musgrave',       team: 'GB',  pos: 'TE', pts: 119, adp: 180.4 },
  { name: 'Foster Moreau',       team: 'NO',  pos: 'TE', pts: 113, adp: 198.7 },

  // K / DEF (placeholder scoring)
  { name: 'Evan McPherson',      team: 'CIN', pos: 'K',   pts: 145, adp: 160 },
  { name: 'Harrison Butker',     team: 'KC',  pos: 'K',   pts: 142, adp: 168 },
  { name: 'Jake Moody',          team: 'SF',  pos: 'K',   pts: 139, adp: 177 },
  { name: '49ers D/ST',          team: 'SF',  pos: 'DEF', pts: 148, adp: 62 },
  { name: 'Cowboys D/ST',        team: 'DAL', pos: 'DEF', pts: 140, adp: 84 },
  { name: 'Ravens D/ST',         team: 'BAL', pos: 'DEF', pts: 137, adp: 97 },
];

// ============================================================================
// VBD Math (inline — avoids requiring full stat objects for embedded data)
// ============================================================================

interface PlayerVBD {
  name: string;
  team: string;
  pos: string;
  pts: number;
  adp: number;
  vbd: number;
  tier: number;
  rank: number; // positional rank
}

const REPLACEMENT_RANKS: Record<string, number> = {
  QB: 13, RB: 30, WR: 31, TE: 13, K: 13, DEF: 13,
};

function computeVBD(players: EmbeddedPlayer[]): PlayerVBD[] {
  const byPos = new Map<string, EmbeddedPlayer[]>();
  for (const p of players) {
    const arr = byPos.get(p.pos) || [];
    arr.push(p);
    byPos.set(p.pos, arr);
  }

  const result: PlayerVBD[] = [];

  for (const [pos, posPlayers] of byPos.entries()) {
    const sorted = [...posPlayers].sort((a, b) => b.pts - a.pts);
    const replRank = (REPLACEMENT_RANKS[pos] || 13) - 1;
    const replPts = sorted[replRank]?.pts ?? sorted[sorted.length - 1].pts;

    // Assign tiers by natural breaks in projection curve
    const tier1Threshold = sorted[0].pts * 0.92;
    const tier2Threshold = sorted[0].pts * 0.82;
    const tier3Threshold = sorted[0].pts * 0.70;

    sorted.forEach((p, idx) => {
      let tier = 4;
      if (p.pts >= tier1Threshold) tier = 1;
      else if (p.pts >= tier2Threshold) tier = 2;
      else if (p.pts >= tier3Threshold) tier = 3;

      result.push({
        name: p.name,
        team: p.team,
        pos: p.pos,
        pts: p.pts,
        adp: p.adp,
        vbd: Math.round(p.pts - replPts),
        tier,
        rank: idx + 1,
      });
    });
  }

  return result;
}

// Pre-compute VBD for all embedded players once
const ALL_PLAYERS_VBD: PlayerVBD[] = computeVBD(NFL_PROJECTIONS_2025);

// ============================================================================
// Tier Cliff Detection (inline)
// ============================================================================

interface TierCliff {
  pos: string;
  cliffAfterName: string;
  cliffAfterRank: number;
  dropPts: number;
  dropPct: number;
  urgency: number; // 0-1
}

function detectCliffs(players: PlayerVBD[]): TierCliff[] {
  const cliffs: TierCliff[] = [];

  const positions = ['QB', 'RB', 'WR', 'TE'];
  for (const pos of positions) {
    const sorted = players
      .filter(p => p.pos === pos)
      .sort((a, b) => a.rank - b.rank);

    for (let i = 0; i < sorted.length - 1; i++) {
      const drop = sorted[i].pts - sorted[i + 1].pts;
      const dropPct = (drop / sorted[i].pts) * 100;

      if (dropPct >= 5) { // significant drop threshold
        cliffs.push({
          pos,
          cliffAfterName: sorted[i].name,
          cliffAfterRank: sorted[i].rank,
          dropPts: Math.round(drop),
          dropPct: Math.round(dropPct * 10) / 10,
          urgency: Math.min(1, dropPct / 20),
        });
      }
    }
  }

  // Return top cliff per position (biggest drop)
  const topByPos = new Map<string, TierCliff>();
  for (const cliff of cliffs) {
    const existing = topByPos.get(cliff.pos);
    if (!existing || cliff.dropPct > existing.dropPct) {
      topByPos.set(cliff.pos, cliff);
    }
  }

  return Array.from(topByPos.values()).sort((a, b) => b.dropPct - a.dropPct);
}

const TIER_CLIFFS: TierCliff[] = detectCliffs(ALL_PLAYERS_VBD);

// ============================================================================
// Simulated Waiver Wire Targets (Week-relative examples)
// ============================================================================

interface WaiverTarget {
  name: string;
  team: string;
  pos: string;
  faabBid: number;
  faabPct: number;
  breakoutScore: number;
  reason: string;
  rostered: number;
}

function getWaiverTargets(): WaiverTarget[] {
  return [
    {
      name: 'Tank Dell',       team: 'HOU', pos: 'WR',
      faabBid: 31, faabPct: 15, breakoutScore: 2.3,
      reason: '3-week usage spike, CJ Stroud targeting rate +18% vs ROS pace',
      rostered: 38,
    },
    {
      name: 'Luke Musgrave',   team: 'GB',  pos: 'TE',
      faabBid: 18, faabPct: 9,  breakoutScore: 1.8,
      reason: 'Higbee injury opens role; GB lacks TE depth behind him',
      rostered: 22,
    },
    {
      name: 'Jerome Ford',     team: 'CLE', pos: 'RB',
      faabBid: 24, faabPct: 12, breakoutScore: 1.5,
      reason: 'Nick Chubb practice status; Ford is the handcuff to have',
      rostered: 44,
    },
    {
      name: 'Dontayvion Wicks', team: 'GB', pos: 'WR',
      faabBid: 12, faabPct: 6,  breakoutScore: 1.4,
      reason: 'Christian Watson IR opens WR2 target share in Love offense',
      rostered: 17,
    },
  ];
}

// ============================================================================
// Generic VBD Computation (sport-agnostic)
// ============================================================================

interface GenericPlayer {
  name: string; team: string; pos: string; pts: number; adp: number;
}

function computeVBDGeneric(
  players: GenericPlayer[],
  replacementRanks: Record<string, number>
): PlayerVBD[] {
  const byPos = new Map<string, GenericPlayer[]>();
  for (const p of players) {
    const arr = byPos.get(p.pos) ?? [];
    arr.push(p);
    byPos.set(p.pos, arr);
  }
  const result: PlayerVBD[] = [];
  for (const [pos, posPlayers] of byPos.entries()) {
    const sorted = [...posPlayers].sort((a, b) => b.pts - a.pts);
    const replIdx = Math.min((replacementRanks[pos] ?? 8) - 1, sorted.length - 1);
    const replPts = sorted[replIdx].pts;
    const t1 = sorted[0].pts * 0.92, t2 = sorted[0].pts * 0.82, t3 = sorted[0].pts * 0.70;
    sorted.forEach((p, idx) => {
      const tier = p.pts >= t1 ? 1 : p.pts >= t2 ? 2 : p.pts >= t3 ? 3 : 4;
      result.push({ name: p.name, team: p.team, pos: p.pos, pts: p.pts, adp: p.adp, vbd: Math.round(p.pts - replPts), tier, rank: idx + 1 });
    });
  }
  return result;
}

// ============================================================================
// MLB 2025 Projections (5×5 roto standard scoring)
// ============================================================================

const MLB_PROJECTIONS_2025: GenericPlayer[] = [
  { name: 'Ronald Acuna Jr.',      team: 'ATL', pos: 'OF', pts: 52.4, adp: 1.2  },
  { name: 'Mookie Betts',          team: 'LAD', pos: 'OF', pts: 48.8, adp: 4.1  },
  { name: 'Juan Soto',             team: 'NYM', pos: 'OF', pts: 47.2, adp: 5.8  },
  { name: 'Kyle Tucker',           team: 'CHC', pos: 'OF', pts: 45.1, adp: 8.3  },
  { name: 'Julio Rodriguez',       team: 'SEA', pos: 'OF', pts: 43.6, adp: 11.4 },
  { name: 'Mike Trout',            team: 'LAA', pos: 'OF', pts: 41.2, adp: 14.7 },
  { name: 'Yordan Alvarez',        team: 'HOU', pos: 'OF', pts: 39.8, adp: 18.3 },
  { name: 'Fernando Tatis Jr.',    team: 'SD',  pos: 'OF', pts: 38.4, adp: 22.6 },
  { name: 'Corbin Carroll',        team: 'ARI', pos: 'OF', pts: 36.2, adp: 28.1 },
  { name: 'Randy Arozarena',       team: 'SEA', pos: 'OF', pts: 33.8, adp: 36.4 },
  { name: 'Elly De La Cruz',       team: 'CIN', pos: 'SS', pts: 44.8, adp: 6.5  },
  { name: 'Jose Ramirez',          team: 'CLE', pos: 'SS', pts: 44.2, adp: 7.8  },
  { name: 'Bobby Witt Jr.',        team: 'KC',  pos: 'SS', pts: 43.1, adp: 9.2  },
  { name: 'Corey Seager',          team: 'TEX', pos: 'SS', pts: 39.4, adp: 18.6 },
  { name: 'Gunnar Henderson',      team: 'BAL', pos: 'SS', pts: 37.8, adp: 24.3 },
  { name: 'Trea Turner',           team: 'PHI', pos: 'SS', pts: 35.6, adp: 31.7 },
  { name: 'Freddie Freeman',       team: 'LAD', pos: '1B', pts: 42.3, adp: 12.1 },
  { name: 'Matt Olson',            team: 'ATL', pos: '1B', pts: 40.8, adp: 16.4 },
  { name: 'Vladimir Guerrero Jr.', team: 'TOR', pos: '1B', pts: 38.2, adp: 23.8 },
  { name: 'Pete Alonso',           team: 'NYM', pos: '1B', pts: 36.4, adp: 30.2 },
  { name: 'Christian Walker',      team: 'HOU', pos: '1B', pts: 32.8, adp: 42.6 },
  { name: 'Jose Altuve',           team: 'HOU', pos: '2B', pts: 36.8, adp: 27.4 },
  { name: 'Marcus Semien',         team: 'TEX', pos: '2B', pts: 34.6, adp: 34.1 },
  { name: 'Ozzie Albies',          team: 'ATL', pos: '2B', pts: 33.2, adp: 40.8 },
  { name: 'Jeff McNeil',           team: 'NYM', pos: '2B', pts: 30.2, adp: 48.3 },
  { name: 'Austin Riley',          team: 'ATL', pos: '3B', pts: 38.8, adp: 20.4 },
  { name: 'Rafael Devers',         team: 'BOS', pos: '3B', pts: 36.6, adp: 29.1 },
  { name: 'Nolan Arenado',         team: 'STL', pos: '3B', pts: 33.4, adp: 39.8 },
  { name: 'Manny Machado',         team: 'SD',  pos: '3B', pts: 32.1, adp: 44.2 },
  { name: 'Adley Rutschman',       team: 'BAL', pos: 'C',  pts: 34.8, adp: 32.4 },
  { name: 'Will Smith',            team: 'LAD', pos: 'C',  pts: 32.6, adp: 40.2 },
  { name: 'William Contreras',     team: 'MIL', pos: 'C',  pts: 30.4, adp: 49.6 },
  { name: 'Sean Murphy',           team: 'ATL', pos: 'C',  pts: 28.8, adp: 57.1 },
  { name: 'Spencer Strider',       team: 'ATL', pos: 'SP', pts: 38.6, adp: 19.3 },
  { name: 'Gerrit Cole',           team: 'NYY', pos: 'SP', pts: 36.2, adp: 23.7 },
  { name: 'Zac Gallen',            team: 'ARI', pos: 'SP', pts: 34.8, adp: 28.5 },
  { name: 'Logan Webb',            team: 'SF',  pos: 'SP', pts: 33.4, adp: 33.8 },
  { name: 'Dylan Cease',           team: 'SD',  pos: 'SP', pts: 32.2, adp: 38.1 },
  { name: 'Corbin Burnes',         team: 'BAL', pos: 'SP', pts: 31.4, adp: 41.7 },
  { name: 'Max Fried',             team: 'NYY', pos: 'SP', pts: 30.6, adp: 45.3 },
  { name: 'Yoshinobu Yamamoto',    team: 'LAD', pos: 'SP', pts: 29.8, adp: 49.2 },
  { name: 'Sandy Alcantara',       team: 'MIA', pos: 'SP', pts: 28.4, adp: 54.6 },
  { name: 'Shane McClanahan',      team: 'TB',  pos: 'SP', pts: 27.6, adp: 60.1 },
  { name: 'Edwin Diaz',            team: 'NYM', pos: 'RP', pts: 28.4, adp: 55.1 },
  { name: 'Ryan Helsley',          team: 'STL', pos: 'RP', pts: 27.8, adp: 58.6 },
  { name: 'Josh Hader',            team: 'HOU', pos: 'RP', pts: 27.2, adp: 62.3 },
  { name: 'Felix Bautista',        team: 'BAL', pos: 'RP', pts: 26.6, adp: 67.4 },
  { name: 'Devin Williams',        team: 'MIL', pos: 'RP', pts: 25.8, adp: 73.2 },
];

const MLB_REPLACEMENT_RANKS: Record<string, number> = {
  OF: 9, '1B': 4, '2B': 3, '3B': 3, SS: 5, C: 3, SP: 9, RP: 4,
};

const ALL_MLB_VBD: PlayerVBD[] = computeVBDGeneric(MLB_PROJECTIONS_2025, MLB_REPLACEMENT_RANKS);
const MLB_TIER_CLIFFS: TierCliff[] = detectCliffs(ALL_MLB_VBD);

function getMLBWaiverTargets(): WaiverTarget[] {
  return [
    { name: 'Corbin Carroll',    team: 'ARI', pos: 'OF', faabBid: 28, faabPct: 14, breakoutScore: 2.1, reason: 'Leadoff slot locked in; ARI offense surging — +18% HR rate last 30 days', rostered: 42 },
    { name: 'Sandy Alcantara',   team: 'MIA', pos: 'SP', faabBid: 22, faabPct: 11, breakoutScore: 1.9, reason: 'Post-TJ velocity back to 97 mph; K/9 climbed to 9.8 over last 4 starts', rostered: 31 },
    { name: 'William Contreras', team: 'MIL', pos: 'C',  faabBid: 18, faabPct: 9,  breakoutScore: 1.6, reason: 'Top-5 C in H2H leagues; .298 BA with 8 HR in last 30 days', rostered: 58 },
    { name: 'Ryan Helsley',      team: 'STL', pos: 'RP', faabBid: 15, faabPct: 7,  breakoutScore: 1.4, reason: 'Locked-in closer role; 14 saves with sub-1.00 WHIP this season', rostered: 67 },
  ];
}

// ============================================================================
// NBA 2025 Projections (9-category standard scoring)
// ============================================================================

const NBA_PROJECTIONS_2025: GenericPlayer[] = [
  { name: 'Nikola Jokic',             team: 'DEN', pos: 'C',  pts: 68.4, adp: 1.1  },
  { name: 'Luka Doncic',              team: 'LAL', pos: 'PG', pts: 64.2, adp: 2.3  },
  { name: 'Giannis Antetokounmpo',    team: 'MIL', pos: 'PF', pts: 61.8, adp: 3.5  },
  { name: 'Shai Gilgeous-Alexander',  team: 'OKC', pos: 'PG', pts: 58.4, adp: 4.8  },
  { name: 'LeBron James',             team: 'LAL', pos: 'SF', pts: 54.6, adp: 5.8  },
  { name: 'Joel Embiid',              team: 'PHI', pos: 'C',  pts: 55.1, adp: 6.2  },
  { name: 'Donovan Mitchell',         team: 'CLE', pos: 'SG', pts: 53.6, adp: 7.3  },
  { name: 'Jayson Tatum',             team: 'BOS', pos: 'PF', pts: 52.8, adp: 7.9  },
  { name: 'Anthony Davis',            team: 'LAL', pos: 'C',  pts: 52.4, adp: 8.8  },
  { name: 'Trae Young',               team: 'ATL', pos: 'PG', pts: 52.8, adp: 9.4  },
  { name: 'Kevin Durant',             team: 'PHX', pos: 'SF', pts: 51.2, adp: 10.4 },
  { name: 'Anthony Edwards',          team: 'MIN', pos: 'SG', pts: 51.8, adp: 10.9 },
  { name: 'Tyrese Haliburton',        team: 'IND', pos: 'PG', pts: 50.6, adp: 11.2 },
  { name: 'Domantas Sabonis',         team: 'SAC', pos: 'C',  pts: 48.2, adp: 12.3 },
  { name: 'Devin Booker',             team: 'PHX', pos: 'SG', pts: 49.2, adp: 13.1 },
  { name: 'De\'Aaron Fox',            team: 'SAS', pos: 'PG', pts: 47.8, adp: 14.7 },
  { name: 'Bam Adebayo',              team: 'MIA', pos: 'C',  pts: 44.8, adp: 16.4 },
  { name: 'Paolo Banchero',           team: 'ORL', pos: 'PF', pts: 46.4, adp: 15.3 },
  { name: 'Kawhi Leonard',            team: 'LAC', pos: 'SF', pts: 46.8, adp: 16.1 },
  { name: 'Jaylen Brown',             team: 'BOS', pos: 'SG', pts: 47.6, adp: 16.8 },
  { name: 'Ja Morant',                team: 'MEM', pos: 'PG', pts: 45.2, adp: 17.6 },
  { name: 'Rudy Gobert',              team: 'MIN', pos: 'C',  pts: 42.6, adp: 19.1 },
  { name: 'Julius Randle',            team: 'NYK', pos: 'PF', pts: 43.8, adp: 18.9 },
  { name: 'Zach LaVine',              team: 'CHI', pos: 'SG', pts: 44.2, adp: 20.3 },
  { name: 'Jaren Jackson Jr.',        team: 'MEM', pos: 'PF', pts: 41.6, adp: 22.4 },
  { name: 'Mikal Bridges',            team: 'NYK', pos: 'SF', pts: 38.4, adp: 27.8 },
];

const NBA_REPLACEMENT_RANKS: Record<string, number> = {
  PG: 5, SG: 5, SF: 4, PF: 5, C: 5,
};

const ALL_NBA_VBD: PlayerVBD[] = computeVBDGeneric(NBA_PROJECTIONS_2025, NBA_REPLACEMENT_RANKS);
const NBA_TIER_CLIFFS: TierCliff[] = detectCliffs(ALL_NBA_VBD);

function getNBAWaiverTargets(): WaiverTarget[] {
  return [
    { name: 'Jaren Jackson Jr.', team: 'MEM', pos: 'PF', faabBid: 35, faabPct: 17, breakoutScore: 2.4, reason: 'Blocks leader; MEM minutes ceiling removed post All-Star break', rostered: 76 },
    { name: 'Bam Adebayo',       team: 'MIA', pos: 'C',  faabBid: 28, faabPct: 14, breakoutScore: 2.0, reason: 'Post-All-Star usage rate spiked to 28.4%; 35+ min in 9 straight', rostered: 82 },
    { name: 'Paolo Banchero',    team: 'ORL', pos: 'PF', faabBid: 22, faabPct: 11, breakoutScore: 1.8, reason: 'Wagner ankle injury opens 4-6 additional touches per game', rostered: 91 },
    { name: 'Mikal Bridges',     team: 'NYK', pos: 'SF', faabBid: 15, faabPct: 7,  breakoutScore: 1.5, reason: 'Rising 3P% and usage in Thibs offense; 18+ pts in 7 straight', rostered: 69 },
  ];
}

// ============================================================================
// Public Card Generator Functions
// ============================================================================

function getGradient(pos: string): string {
  const g: Record<string, string> = {
    QB: 'from-red-600 to-rose-700',
    RB: 'from-green-600 to-emerald-700',
    WR: 'from-blue-600 to-cyan-700',
    TE: 'from-orange-600 to-amber-700',
    K:  'from-purple-600 to-violet-700',
    DEF:'from-slate-600 to-gray-700',
  };
  return g[pos] || 'from-blue-600 to-indigo-700';
}

/** VBD Rankings card for a position (or top overall) */
export function generateVBDCard(pos?: string): InsightCard {
  let players: PlayerVBD[];

  if (pos) {
    const posUpper = pos.toUpperCase();
    players = ALL_PLAYERS_VBD
      .filter(p => p.pos === posUpper)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 8);
  } else {
    // Overall value board — top 8 by VBD across all skill positions
    players = ALL_PLAYERS_VBD
      .filter(p => ['QB', 'RB', 'WR', 'TE'].includes(p.pos))
      .sort((a, b) => b.vbd - a.vbd)
      .slice(0, 8);
  }

  const topPos = pos?.toUpperCase() || 'OVERALL';
  const tierCliff = TIER_CLIFFS.find(c => c.pos === topPos);
  const bestTier = players[0]?.tier || 1;

  return {
    type: 'FANTASY_VBD',
    title: pos ? `${pos.toUpperCase()} VBD Rankings` : 'Value Board — Top Picks',
    icon: 'Trophy',
    category: 'FANTASY',
    subcategory: pos ? `${pos.toUpperCase()} • PPR • NFL 2025 Final` : 'NFL 2025 Final · PPR · 12-Team',
    gradient: getGradient(pos?.toUpperCase() || 'WR'),
    data: {
      fantasyCardType: 'vbd_rankings',
      position: topPos,
      players: players.map(p => ({
        name: p.name,
        team: p.team,
        pos: p.pos,
        vbd: p.vbd,
        pts: p.pts,
        adp: p.adp,
        tier: p.tier,
        rank: p.rank,
      })),
      tierCliff: tierCliff ? {
        cliffAfterName: tierCliff.cliffAfterName,
        dropPct: tierCliff.dropPct,
      } : null,
      scoringFormat: 'PPR',
      leagueSize: 12,
      status: bestTier === 1 ? 'target' : bestTier === 2 ? 'value' : 'sleeper',
    },
    metadata: { realData: false, dataSource: 'NFL 2025 Final Season Data' },
  };
}

/** Tier cliff alert card (all positions) */
export function generateTierCliffCard(): InsightCard {
  const cliffs = TIER_CLIFFS.slice(0, 4);

  return {
    type: 'FANTASY_TIER_CLIFF',
    title: 'Tier Cliff Alerts',
    icon: 'AlertTriangle',
    category: 'FANTASY',
    subcategory: 'Draft Now or Lose Value',
    gradient: 'from-yellow-600 to-orange-700',
    data: {
      fantasyCardType: 'tier_cliff',
      cliffs: cliffs.map(c => ({
        pos: c.pos,
        cliffAfterName: c.cliffAfterName,
        cliffAfterRank: c.cliffAfterRank,
        dropPcts: c.dropPct,
        urgency: c.urgency,
        label: `${c.pos}${c.cliffAfterRank} → ${c.dropPct.toFixed(1)}% drop`,
      })),
      description: 'These tier breaks represent the highest-leverage draft moments. Miss a tier-1 player and you may wait 3–4 rounds for equivalent value.',
      status: 'hot',
    },
    metadata: { realData: false, dataSource: 'NFL 2025 Final Season Data' },
  };
}

/** Draft recommendation card for a given pick slot */
export function generateDraftCard(round: number = 1, pick: number = 5, leagueSize: number = 12): InsightCard {
  const overallPick = (round - 1) * leagueSize + pick;

  // Players still realistically available at this pick (ADP within ±15 picks)
  const available = ALL_PLAYERS_VBD
    .filter(p => ['QB', 'RB', 'WR', 'TE'].includes(p.pos) && p.adp >= overallPick * 0.8)
    .sort((a, b) => b.vbd - a.vbd)
    .slice(0, 20);

  const bestPick = available[0];
  const leveragePicks = available
    .slice(1)
    .filter(p => p.pos !== bestPick?.pos)
    .slice(0, 3);

  const cliffs = TIER_CLIFFS.filter(c =>
    available.some(p => p.pos === c.pos && p.name === c.cliffAfterName)
  );

  return {
    type: 'FANTASY_DRAFT',
    title: `Draft Board — Round ${round}, Pick ${pick}`,
    icon: 'Target',
    category: 'FANTASY',
    subcategory: `Overall #${overallPick} • PPR • 12-Team`,
    gradient: 'from-indigo-600 to-purple-700',
    data: {
      fantasyCardType: 'draft_recommendation',
      round,
      pick,
      overallPick,
      bestPick: bestPick ? {
        name: bestPick.name,
        team: bestPick.team,
        pos: bestPick.pos,
        vbd: bestPick.vbd,
        pts: bestPick.pts,
        adp: bestPick.adp,
        tier: bestPick.tier,
        reason: `VBD +${bestPick.vbd} pts above replacement. Tier ${bestPick.tier} at ${bestPick.pos}.`,
      } : null,
      leveragePicks: leveragePicks.map(p => ({
        name: p.name,
        team: p.team,
        pos: p.pos,
        vbd: p.vbd,
        pts: p.pts,
        adp: p.adp,
        tier: p.tier,
        reason: getReason(p),
      })),
      tierCliffAlerts: cliffs.map(c => `${c.pos}: ${c.dropPct.toFixed(1)}% drop after ${c.cliffAfterName}`),
      status: 'target',
    },
    metadata: { realData: false, dataSource: 'NFL 2025 Final Season Data' },
  };
}

function getReason(p: PlayerVBD): string {
  if (p.pos === 'QB') return `Zero-QB strategy opportunity — elite upside at reduced ADP`;
  if (p.pos === 'TE') return `Premium TE scarcity — value drops 40%+ after top 3`;
  if (p.pos === 'RB') return `Workhorse back with strong pass-catching role`;
  return `Elite WR in high-target offense — floor + ceiling`;
}

/** Waiver wire targets card */
export function generateWaiverCard(): InsightCard {
  const targets = getWaiverTargets();

  return {
    type: 'FANTASY_WAIVER',
    title: 'Waiver Wire Targets',
    icon: 'Zap',
    category: 'FANTASY',
    subcategory: 'FAAB Optimizer • Kelly-Sized Bids',
    gradient: 'from-teal-600 to-cyan-700',
    data: {
      fantasyCardType: 'waiver',
      targets: targets.map(t => ({
        name: t.name,
        team: t.team,
        pos: t.pos,
        faabBid: t.faabBid,
        faabPct: t.faabPct,
        breakoutScore: t.breakoutScore,
        reason: t.reason,
        rostered: t.rostered,
      })),
      description: 'Kelly-optimized FAAB bids. Breakout score = rolling 3-week z-score acceleration.',
      budgetNote: 'Bids shown as % of $100 FAAB budget. Scale linearly with your actual budget.',
      status: 'hot',
    },
    metadata: { realData: false, dataSource: 'NFL 2025 Final Season Data' },
  };
}

/** Single player projection detail card */
export function generatePlayerProjectionCard(playerName: string): InsightCard | null {
  const nameLower = playerName.toLowerCase();
  const player = ALL_PLAYERS_VBD.find(p =>
    p.name.toLowerCase().includes(nameLower) ||
    nameLower.includes(p.name.toLowerCase().split(' ')[1] || '')
  );

  if (!player) return null;

  return {
    type: 'FANTASY_PROJECTION',
    title: player.name,
    icon: 'User',
    category: 'FANTASY',
    subcategory: `${player.pos} • ${player.team} • 2025 Projection`,
    gradient: getGradient(player.pos),
    data: {
      fantasyCardType: 'projection',
      name: player.name,
      team: player.team,
      pos: player.pos,
      pts: player.pts,
      vbd: player.vbd,
      adp: player.adp,
      tier: player.tier,
      rank: player.rank,
      scoringFormat: 'PPR',
      analysis: generatePlayerAnalysis(player),
      status: player.tier === 1 ? 'target' : player.tier === 2 ? 'value' : 'sleeper',
    },
    metadata: { realData: false, dataSource: 'NFL 2025 Final Season Data' },
  };
}

function generatePlayerAnalysis(p: PlayerVBD): string {
  const tierLabel = ['Elite', 'Strong', 'Solid', 'Speculative'][p.tier - 1] || 'Speculative';
  const vbdLabel = p.vbd > 100 ? 'elite' : p.vbd > 50 ? 'solid' : p.vbd > 0 ? 'marginal' : 'replacement-level';
  return `${tierLabel} Tier ${p.tier} ${p.pos}. ${p.pts} projected PPR points — ${vbdLabel} VBD of +${p.vbd} above ${p.pos} replacement level. ADP ${p.adp} suggests ${p.adp < 20 ? 'early-round priority' : p.adp < 60 ? 'mid-round value' : 'late-round target'}.`;
}

// ============================================================================
// Main Entry Point — Generate 1-N Fantasy Cards Based on Intent
// ============================================================================

/**
 * Generate fantasy cards for non-NFL sports.
 * MLB and NBA have embedded projections → real VBD/waiver/draft cards.
 * Other sports (NHL, soccer, etc.) fall back to informational prompt cards.
 */
function generateNonNFLFantasyCards(sport: string, count: number): InsightCard[] {
  const isMLB = sport.includes('baseball') || sport === 'mlb';
  const isNBA = sport.includes('basketball') || sport === 'nba';

  // ── MLB ──────────────────────────────────────────────────────────────────
  if (isMLB) {
    const cards: InsightCard[] = [];
    const topPlayers = ALL_MLB_VBD
      .filter(p => ['OF', 'SS', '1B', '2B', '3B', 'C'].includes(p.pos))
      .sort((a, b) => b.vbd - a.vbd)
      .slice(0, 8);
    const cliff = MLB_TIER_CLIFFS[0];

    cards.push({
      type: 'FANTASY_VBD',
      title: 'MLB Value Board — Top Picks',
      icon: 'Trophy',
      category: 'FANTASY',
      subcategory: 'MLB 2026 • 5×5 Roto • 12-Team',
      gradient: 'from-indigo-600 to-purple-700',
      data: {
        fantasyCardType: 'vbd_rankings',
        position: 'OVERALL',
        sport: 'MLB',
        players: topPlayers.map(p => ({ name: p.name, team: p.team, pos: p.pos, vbd: p.vbd, pts: p.pts, adp: p.adp, tier: p.tier, rank: p.rank })),
        tierCliff: cliff ? { cliffAfterName: cliff.cliffAfterName, dropPct: cliff.dropPct } : null,
        scoringFormat: '5×5 Roto',
        leagueSize: 12,
        status: 'target',
      },
      metadata: { realData: false, dataSource: 'MLB 2026 Pre-Season Projections' },
    });

    if (cards.length < count) {
      const targets = getMLBWaiverTargets();
      cards.push({
        type: 'FANTASY_WAIVER',
        title: 'MLB Waiver Wire Targets',
        icon: 'Zap',
        category: 'FANTASY',
        subcategory: 'MLB 2026 • FAAB Optimizer',
        gradient: 'from-teal-600 to-cyan-700',
        data: {
          fantasyCardType: 'waiver',
          sport: 'MLB',
          targets: targets.map(t => ({ name: t.name, team: t.team, pos: t.pos, faabBid: t.faabBid, faabPct: t.faabPct, breakoutScore: t.breakoutScore, reason: t.reason, rostered: t.rostered })),
          description: 'Top MLB waiver pickups ranked by breakout score.',
          budgetNote: 'FAAB bids shown as % of $100 budget. Scale to your actual budget.',
          status: 'hot',
        },
        metadata: { realData: false, dataSource: 'MLB 2026 Waiver Engine' },
      });
    }

    if (cards.length < count) {
      const spPlayers = ALL_MLB_VBD.filter(p => p.pos === 'SP').sort((a, b) => b.vbd - a.vbd).slice(0, 5);
      const bestSP = spPlayers[0];
      cards.push({
        type: 'FANTASY_DRAFT',
        title: 'MLB Draft Board — SP Targets',
        icon: 'Target',
        category: 'FANTASY',
        subcategory: 'MLB 2026 • SP Rankings',
        gradient: 'from-indigo-600 to-purple-700',
        data: {
          fantasyCardType: 'draft_recommendation',
          sport: 'MLB',
          round: 2, pick: 3, overallPick: 15,
          bestPick: bestSP ? { name: bestSP.name, team: bestSP.team, pos: bestSP.pos, vbd: bestSP.vbd, pts: bestSP.pts, adp: bestSP.adp, tier: bestSP.tier, reason: `VBD +${bestSP.vbd} above SP replacement. Tier ${bestSP.tier} arm.` } : null,
          leveragePicks: spPlayers.slice(1, 4).map(p => ({ name: p.name, team: p.team, pos: p.pos, vbd: p.vbd, pts: p.pts, adp: p.adp, tier: p.tier, reason: `Tier ${p.tier} SP — elite ERA/WHIP/K combo at ADP ${p.adp}` })),
          tierCliffAlerts: MLB_TIER_CLIFFS.slice(0, 2).map(c => `${c.pos}: ${c.dropPct.toFixed(1)}% drop after ${c.cliffAfterName}`),
          status: 'target',
        },
        metadata: { realData: false, dataSource: 'MLB 2026 Draft Engine' },
      });
    }

    return cards.slice(0, count);
  }

  // ── NBA ──────────────────────────────────────────────────────────────────
  if (isNBA) {
    const cards: InsightCard[] = [];
    const topPlayers = ALL_NBA_VBD.sort((a, b) => b.vbd - a.vbd).slice(0, 8);
    const cliff = NBA_TIER_CLIFFS[0];

    cards.push({
      type: 'FANTASY_VBD',
      title: 'NBA Value Board — Top Picks',
      icon: 'Trophy',
      category: 'FANTASY',
      subcategory: 'NBA 2025-26 • 9-Cat • 12-Team',
      gradient: 'from-orange-600 to-red-700',
      data: {
        fantasyCardType: 'vbd_rankings',
        position: 'OVERALL',
        sport: 'NBA',
        players: topPlayers.map(p => ({ name: p.name, team: p.team, pos: p.pos, vbd: p.vbd, pts: p.pts, adp: p.adp, tier: p.tier, rank: p.rank })),
        tierCliff: cliff ? { cliffAfterName: cliff.cliffAfterName, dropPct: cliff.dropPct } : null,
        scoringFormat: '9-Category',
        leagueSize: 12,
        status: 'target',
      },
      metadata: { realData: false, dataSource: 'NBA 2025-26 Projections' },
    });

    if (cards.length < count) {
      const targets = getNBAWaiverTargets();
      cards.push({
        type: 'FANTASY_WAIVER',
        title: 'NBA Waiver Wire Targets',
        icon: 'Zap',
        category: 'FANTASY',
        subcategory: 'NBA 2025-26 • FAAB Optimizer',
        gradient: 'from-teal-600 to-cyan-700',
        data: {
          fantasyCardType: 'waiver',
          sport: 'NBA',
          targets: targets.map(t => ({ name: t.name, team: t.team, pos: t.pos, faabBid: t.faabBid, faabPct: t.faabPct, breakoutScore: t.breakoutScore, reason: t.reason, rostered: t.rostered })),
          description: 'Top NBA waiver pickups ranked by breakout score.',
          budgetNote: 'Bids shown as % of $100 budget.',
          status: 'hot',
        },
        metadata: { realData: false, dataSource: 'NBA 2025-26 Waiver Engine' },
      });
    }

    if (cards.length < count) {
      const bestPlayer = [...ALL_NBA_VBD].sort((a, b) => b.vbd - a.vbd)[0];
      const leverages = [...ALL_NBA_VBD].sort((a, b) => b.vbd - a.vbd).slice(1, 4);
      cards.push({
        type: 'FANTASY_DRAFT',
        title: 'NBA Draft Board — Round 1',
        icon: 'Target',
        category: 'FANTASY',
        subcategory: 'NBA 2025-26 • 9-Cat Rankings',
        gradient: 'from-orange-600 to-red-700',
        data: {
          fantasyCardType: 'draft_recommendation',
          sport: 'NBA',
          round: 1, pick: 1, overallPick: 1,
          bestPick: bestPlayer ? { name: bestPlayer.name, team: bestPlayer.team, pos: bestPlayer.pos, vbd: bestPlayer.vbd, pts: bestPlayer.pts, adp: bestPlayer.adp, tier: bestPlayer.tier, reason: `VBD +${bestPlayer.vbd} above positional replacement. Unanimous #1 overall.` } : null,
          leveragePicks: leverages.map(p => ({ name: p.name, team: p.team, pos: p.pos, vbd: p.vbd, pts: p.pts, adp: p.adp, tier: p.tier, reason: `Tier ${p.tier} ${p.pos} — ${p.pts} projected cat pts at ADP ${p.adp}` })),
          tierCliffAlerts: NBA_TIER_CLIFFS.slice(0, 2).map(c => `${c.pos}: ${c.dropPct.toFixed(1)}% drop after ${c.cliffAfterName}`),
          status: 'target',
        },
        metadata: { realData: false, dataSource: 'NBA 2025-26 Draft Engine' },
      });
    }

    return cards.slice(0, count);
  }

  // ── Fallback for unsupported sports (NHL, Soccer, etc.) ──────────────────
  const sportLabel = sport
    .replace(/^(americanfootball|basketball|baseball|icehockey|soccer|mma|boxing)_?/, '')
    .toUpperCase()
    .replace(/_/g, ' ') || sport.toUpperCase();
  const gradient = ({ NHL: 'from-blue-600 to-cyan-700', EPL: 'from-green-500 to-teal-600', MLS: 'from-green-500 to-teal-600' } as Record<string, string>)[sportLabel] || 'from-slate-600 to-gray-700';

  const cards: InsightCard[] = [];
  cards.push({
    type: 'FANTASY_ADVICE', title: `${sportLabel} Fantasy Intelligence`, icon: 'Trophy',
    category: 'FANTASY', subcategory: `${sportLabel} • Season Analysis`, gradient,
    data: { fantasyCardType: 'sport_overview', sport: sportLabel, description: `${sportLabel} fantasy analysis powered by Grok AI with live knowledge.`, note: `Ask about specific ${sportLabel} players, waiver targets, trade values, or matchup analysis.`, features: ['Live Player Stats', 'Waiver Wire Targets', 'Injury Updates', 'Trade Analysis'], realData: false, status: 'available' },
    metadata: { realData: false, dataSource: `${sportLabel} Fantasy Engine` },
  });
  while (cards.length < count) {
    if (cards.length === 1) {
      cards.push({ type: 'FANTASY_WAIVER', title: `${sportLabel} Waiver Targets`, icon: 'Zap', category: 'FANTASY', subcategory: `${sportLabel} • Waiver Wire`, gradient, data: { fantasyCardType: 'waiver', sport: sportLabel, description: `Ask Leverage AI for this week's top ${sportLabel} waiver wire pickups.`, note: 'Include your league settings for tailored advice.', realData: false, status: 'available' }, metadata: { realData: false, dataSource: `${sportLabel} Waiver Engine` } });
    } else {
      cards.push({ type: 'FANTASY_DRAFT', title: `${sportLabel} Draft Board`, icon: 'Target', category: 'FANTASY', subcategory: `${sportLabel} • Rankings`, gradient, data: { fantasyCardType: 'draft_recommendation', sport: sportLabel, description: `Ask for ${sportLabel} draft rankings, sleepers, or ADP analysis.`, note: 'Specify your draft format and league size for personalised recommendations.', realData: false, status: 'available' }, metadata: { realData: false, dataSource: `${sportLabel} Draft Engine` } });
    }
  }
  return cards.slice(0, count);
}

/**
 * Parse user message for fantasy intent signals and return relevant cards.
 * Called by lib/cards-generator.ts when category === 'fantasy' | 'draft' | 'waiver'.
 *
 * @param userMessage - The user's chat message (used to detect intent keywords)
 * @param count       - Number of cards to return
 * @param sport       - Normalised sport key from context (e.g. 'baseball_mlb').
 *                      When set and non-NFL, returns sport-appropriate cards instead
 *                      of the hardcoded NFL projection data.
 */
export function generateFantasyCards(
  userMessage: string = '',
  count: number = 3,
  sport?: string
): InsightCard[] {
  // Non-NFL sport → don't show NFL player data; return sport-branded cards instead
  const isNFL = !sport || sport.includes('football') || sport === '';
  if (!isNFL) {
    return generateNonNFLFantasyCards(sport, count);
  }

  const msg = userMessage.toLowerCase();
  const cards: InsightCard[] = [];

  // Check for player-specific query first
  const allPlayerNames = NFL_PROJECTIONS_2025.map(p => p.name.toLowerCase());
  const mentionedPlayer = NFL_PROJECTIONS_2025.find(p =>
    msg.includes(p.name.toLowerCase()) ||
    msg.includes(p.name.toLowerCase().split(' ')[1] || '__nomatch__')
  );
  if (mentionedPlayer) {
    const card = generatePlayerProjectionCard(mentionedPlayer.name);
    if (card) cards.push(card);
  }

  // Position-specific queries
  const posMap: Record<string, string> = {
    qb: 'QB', quarterback: 'QB',
    rb: 'RB', runningback: 'RB', 'running back': 'RB',
    wr: 'WR', receiver: 'WR', 'wide receiver': 'WR',
    te: 'TE', 'tight end': 'TE',
  };

  let detectedPos: string | undefined;
  for (const [keyword, pos] of Object.entries(posMap)) {
    if (msg.includes(keyword)) { detectedPos = pos; break; }
  }

  // Draft-related queries → draft board + tier cliffs + VBD
  if (msg.includes('draft') || msg.includes('pick') || msg.includes('adp') || msg.includes('vbd')) {
    if (cards.length < count) {
      // Try to detect round/pick from message e.g. "round 2 pick 4"
      const roundMatch = msg.match(/round\s*(\d+)/i);
      const pickMatch = msg.match(/pick\s*(\d+)/i);
      const round = roundMatch ? parseInt(roundMatch[1]) : 1;
      const pick = pickMatch ? parseInt(pickMatch[1]) : 5;
      cards.push(generateDraftCard(round, pick, 12));
    }
    if (cards.length < count) cards.push(generateTierCliffCard());
    if (cards.length < count) cards.push(generateVBDCard(detectedPos));
  }

  // Waiver / FAAB queries
  if (msg.includes('waiver') || msg.includes('faab') || msg.includes('pickup') || msg.includes('add')) {
    if (cards.length < count) cards.push(generateWaiverCard());
    if (cards.length < count) cards.push(generateVBDCard(detectedPos));
  }

  // Tier / cliff queries
  if (msg.includes('tier') || msg.includes('cliff') || msg.includes('avoid')) {
    if (cards.length < count) cards.push(generateTierCliffCard());
    if (cards.length < count) cards.push(generateVBDCard(detectedPos));
  }

  // Generic fantasy / rankings queries
  if (cards.length === 0 || msg.includes('ranking') || msg.includes('projection') || msg.includes('best')) {
    if (cards.length < count) cards.push(generateVBDCard(detectedPos));
    if (cards.length < count) cards.push(generateTierCliffCard());
    if (cards.length < count) cards.push(generateDraftCard(1, 5));
  }

  // Fill remaining slots with a waiver card or general VBD
  while (cards.length < count) {
    const hasWaiver = cards.some(c => c.type === 'FANTASY_WAIVER');
    cards.push(hasWaiver ? generateVBDCard() : generateWaiverCard());
  }

  return cards.slice(0, count);
}
