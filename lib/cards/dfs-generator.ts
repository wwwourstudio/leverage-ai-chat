import { CARD_TYPES, CARD_STATUS } from '@/lib/constants';
import type { CardData } from '@/lib/types';

type InsightCard = CardData;

type DFSGame = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  total: number;
  homeWinProb: number;
};

// Default game O/U per sport when no real games are available
const DEFAULT_TOTALS: Record<string, number> = {
  basketball_nba: 222.5,
  americanfootball_nfl: 47.5,
  icehockey_nhl: 6.0,
  baseball_mlb: 8.5,
};

// DK projection scaling: projMult × game O/U ≈ top-position DK points
const DFS_CFG: Record<string, { posLabel: string; projMult: number; sport: string; stackTip: string }> = {
  basketball_nba:        { posLabel: 'G/F', projMult: 0.135, sport: 'NBA', stackTip: 'guards and forwards' },
  americanfootball_nfl:  { posLabel: 'QB',  projMult: 0.52,  sport: 'NFL', stackTip: 'QB-WR stacks' },
  icehockey_nhl:         { posLabel: 'W',   projMult: 2.5,   sport: 'NHL', stackTip: 'top-line forwards and power-play units' },
  baseball_mlb:          { posLabel: 'SP',  projMult: 1.6,   sport: 'MLB', stackTip: '4-5 man batting order stacks' },
};

const DFS_ROSTER: Record<string, Array<{ pos: string; scale: number; sf: number }>> = {
  baseball_mlb: [
    { pos: 'SP',   scale: 1.00, sf: 1.00 }, { pos: 'SP',   scale: 0.82, sf: 0.90 },
    { pos: 'C',    scale: 0.30, sf: 0.42 }, { pos: '1B',   scale: 0.42, sf: 0.50 },
    { pos: '2B',   scale: 0.38, sf: 0.46 }, { pos: '3B',   scale: 0.40, sf: 0.48 },
    { pos: 'SS',   scale: 0.38, sf: 0.47 }, { pos: 'OF',   scale: 0.42, sf: 0.52 },
    { pos: 'OF',   scale: 0.36, sf: 0.44 }, { pos: 'OF',   scale: 0.30, sf: 0.38 },
  ],
  basketball_nba: [
    { pos: 'PG',   scale: 1.00, sf: 1.00 }, { pos: 'SG',   scale: 0.78, sf: 0.82 },
    { pos: 'SF',   scale: 0.82, sf: 0.87 }, { pos: 'PF',   scale: 0.72, sf: 0.77 },
    { pos: 'C',    scale: 0.85, sf: 0.90 }, { pos: 'G',    scale: 0.60, sf: 0.65 },
    { pos: 'F',    scale: 0.55, sf: 0.60 }, { pos: 'UTIL', scale: 0.50, sf: 0.55 },
  ],
  americanfootball_nfl: [
    { pos: 'QB',   scale: 1.00, sf: 1.00 }, { pos: 'RB',   scale: 0.62, sf: 0.72 },
    { pos: 'RB',   scale: 0.48, sf: 0.58 }, { pos: 'WR',   scale: 0.72, sf: 0.82 },
    { pos: 'WR',   scale: 0.58, sf: 0.68 }, { pos: 'WR',   scale: 0.44, sf: 0.52 },
    { pos: 'TE',   scale: 0.50, sf: 0.60 }, { pos: 'FLEX', scale: 0.52, sf: 0.62 },
    { pos: 'DST',  scale: 0.32, sf: 0.38 },
  ],
  icehockey_nhl: [
    { pos: 'C',    scale: 1.00, sf: 1.00 }, { pos: 'C',    scale: 0.72, sf: 0.78 },
    { pos: 'W',    scale: 0.85, sf: 0.88 }, { pos: 'W',    scale: 0.70, sf: 0.74 },
    { pos: 'W',    scale: 0.58, sf: 0.62 }, { pos: 'D',    scale: 0.65, sf: 0.69 },
    { pos: 'D',    scale: 0.52, sf: 0.56 }, { pos: 'G',    scale: 1.20, sf: 0.95 },
    { pos: 'UTIL', scale: 0.45, sf: 0.50 },
  ],
};

// 2025-26 season player pools per sport/position
const DFS_PLAYERS: Record<string, Record<string, string[]>> = {
  baseball_mlb: {
    SP:   ['Zack Wheeler', 'Logan Webb', 'Corbin Burnes', 'Freddy Peralta', 'Pablo López', 'Tyler Glasnow', 'Kevin Gausman', 'Chris Sale'],
    C:    ['Adley Rutschman', 'William Contreras', 'Cal Raleigh', 'Salvador Perez', 'Bo Naylor'],
    '1B': ['Freddie Freeman', 'Pete Alonso', 'Matt Olson', 'Bryce Harper', 'Vladimir Guerrero Jr.'],
    '2B': ['José Altuve', 'Marcus Semien', 'Jazz Chisholm Jr.', 'Gleyber Torres', 'Andrés Giménez'],
    '3B': ['Manny Machado', 'Austin Riley', 'Rafael Devers', 'Nolan Arenado', 'José Ramírez'],
    SS:   ['Bobby Witt Jr.', 'Gunnar Henderson', 'Elly De La Cruz', 'Trea Turner', 'Jeremy Peña'],
    OF:   ['Aaron Judge', 'Juan Soto', 'Mookie Betts', 'Ronald Acuña Jr.', 'Kyle Tucker', 'Julio Rodríguez', 'Yordan Alvarez', 'Randy Arozarena'],
    UTIL: ['Shohei Ohtani', 'Bryce Harper', 'José Ramírez', 'Jorge Soler', 'Matt Olson'],
  },
  basketball_nba: {
    PG:   ['Shai Gilgeous-Alexander', 'Luka Dončić', 'Tyrese Haliburton', "De'Aaron Fox", 'Damian Lillard'],
    SG:   ['Donovan Mitchell', 'Devin Booker', 'Anthony Edwards', 'Darius Garland', 'Zach LaVine'],
    SF:   ['LeBron James', 'Jayson Tatum', 'Mikal Bridges', 'OG Anunoby', 'Brandon Ingram'],
    PF:   ['Giannis Antetokounmpo', 'Pascal Siakam', 'Evan Mobley', 'Julius Randle', 'Jabari Smith Jr.'],
    C:    ['Nikola Jokić', 'Joel Embiid', 'Anthony Davis', 'Karl-Anthony Towns', 'Bam Adebayo'],
    G:    ['Kyrie Irving', 'Immanuel Quickley', 'Tyler Herro', 'Jalen Green', 'Fred VanVleet'],
    F:    ['Scottie Barnes', 'Franz Wagner', 'Paolo Banchero', 'Miles Bridges', 'Jimmy Butler'],
    UTIL: ['Jalen Brunson', 'Victor Wembanyama', 'Chet Holmgren', 'Alperen Şengün', 'Nikola Vucevic'],
  },
  americanfootball_nfl: {
    QB:   ['Patrick Mahomes', 'Josh Allen', 'Lamar Jackson', 'Jalen Hurts', 'Joe Burrow'],
    RB:   ['Saquon Barkley', 'Christian McCaffrey', 'Bijan Robinson', 'Derrick Henry', 'Josh Jacobs', 'Breece Hall'],
    WR:   ['Tyreek Hill', 'Justin Jefferson', 'CeeDee Lamb', "Ja'Marr Chase", 'Amon-Ra St. Brown', 'Davante Adams'],
    TE:   ['Travis Kelce', 'Mark Andrews', 'Sam LaPorta', 'David Njoku', 'Dallas Goedert'],
    FLEX: ['Deebo Samuel', 'Jonathan Taylor', 'Tee Higgins', 'Stefon Diggs', 'Keenan Allen'],
    DST:  ['Eagles DST', 'Ravens DST', '49ers DST', 'Cowboys DST', 'Bills DST'],
  },
  icehockey_nhl: {
    C:    ['Connor McDavid', 'Nathan MacKinnon', 'Auston Matthews', 'Brayden Point', 'Elias Lindholm'],
    W:    ['Leon Draisaitl', 'David Pastrnak', 'Mikko Rantanen', 'William Nylander', 'Jason Robertson', 'Jake Guentzel', 'Kirill Kaprizov'],
    D:    ['Cale Makar', 'Adam Fox', 'Quinn Hughes', 'Roman Josi', 'Rasmus Dahlin'],
    G:    ['Andrei Vasilevskiy', 'Jake Oettinger', 'Linus Ullmark', 'Ilya Sorokin', 'Juuse Saros'],
    UTIL: ['Alex DeBrincat', 'Brady Tkachuk', 'Tage Thompson', 'Elias Pettersson', 'Aleksander Barkov'],
  },
};

// ESPN CDN team slugs for logo URLs
const ESPN_TEAMS: Record<string, Record<string, string>> = {
  baseball_mlb: {
    'Red Sox': 'bos', 'White Sox': 'chw', 'Blue Jays': 'tor',
    'Dodgers': 'lad', 'Giants': 'sf', 'Royals': 'kc', 'Cubs': 'chc',
    'Braves': 'atl', 'Phillies': 'phi', 'Pirates': 'pit', 'Cardinals': 'stl',
    'Guardians': 'cle', 'Rockies': 'col', 'Mariners': 'sea', 'Angels': 'laa',
    'Padres': 'sd', 'Diamondbacks': 'ari', 'Rangers': 'tex', 'Astros': 'hou',
    'Athletics': 'oak', 'Tigers': 'det', 'Orioles': 'bal', 'Nationals': 'wsh',
    'Marlins': 'mia', 'Reds': 'cin', 'Brewers': 'mil', 'Twins': 'min',
    'Mets': 'nym', 'Yankees': 'nyy', 'Rays': 'tb',
  },
  basketball_nba: {
    'Trail Blazers': 'por', 'Jazz': 'utah',
    'Hawks': 'atl', 'Celtics': 'bos', 'Nets': 'bkn', 'Hornets': 'cha',
    'Bulls': 'chi', 'Cavaliers': 'cle', 'Mavericks': 'dal', 'Nuggets': 'den',
    'Pistons': 'det', 'Warriors': 'gs', 'Rockets': 'hou', 'Pacers': 'ind',
    'Clippers': 'lac', 'Lakers': 'lal', 'Grizzlies': 'mem', 'Heat': 'mia',
    'Bucks': 'mil', 'Timberwolves': 'min', 'Pelicans': 'no', 'Knicks': 'ny',
    'Thunder': 'okc', 'Magic': 'orl', '76ers': 'phi', 'Suns': 'phx',
    'Kings': 'sac', 'Spurs': 'sa', 'Raptors': 'tor', 'Wizards': 'wsh',
  },
  americanfootball_nfl: {
    '49ers': 'sf', 'Cardinals': 'ari', 'Falcons': 'atl', 'Ravens': 'bal',
    'Bills': 'buf', 'Panthers': 'car', 'Bears': 'chi', 'Bengals': 'cin',
    'Browns': 'cle', 'Cowboys': 'dal', 'Broncos': 'den', 'Lions': 'det',
    'Packers': 'gb', 'Texans': 'hou', 'Colts': 'ind', 'Jaguars': 'jax',
    'Chiefs': 'kc', 'Raiders': 'lv', 'Chargers': 'lac', 'Rams': 'lar',
    'Dolphins': 'mia', 'Vikings': 'min', 'Patriots': 'ne', 'Saints': 'no',
    'Giants': 'nyg', 'Jets': 'nyj', 'Eagles': 'phi', 'Steelers': 'pit',
    'Seahawks': 'sea', 'Buccaneers': 'tb', 'Titans': 'ten', 'Commanders': 'wsh',
  },
  icehockey_nhl: {
    'Maple Leafs': 'tor', 'Blue Jackets': 'cbj', 'Golden Knights': 'vgk',
    'Ducks': 'ana', 'Bruins': 'bos', 'Sabres': 'buf', 'Flames': 'cgy',
    'Hurricanes': 'car', 'Blackhawks': 'chi', 'Avalanche': 'col',
    'Stars': 'dal', 'Wings': 'det', 'Oilers': 'edm', 'Panthers': 'fla',
    'Kings': 'lak', 'Wild': 'min', 'Canadiens': 'mtl', 'Predators': 'nsh',
    'Devils': 'njd', 'Islanders': 'nyi', 'Rangers': 'nyr', 'Senators': 'ott',
    'Flyers': 'phi', 'Penguins': 'pit', 'Sharks': 'sjs', 'Kraken': 'sea',
    'Blues': 'stl', 'Lightning': 'tb', 'Canucks': 'van', 'Capitals': 'wsh', 'Jets': 'wpg',
  },
};

function teamAbbr(normalizedSport: string, name: string): string {
  const words = name.trim().split(/\s+/);
  const last = words[words.length - 1] ?? name;
  const last2 = words.length >= 2 ? `${words[words.length - 2]} ${last}` : last;
  const map = ESPN_TEAMS[normalizedSport] ?? {};
  return map[last2] ?? map[last] ?? last.slice(0, 3).toLowerCase();
}

function buildLineup(
  normalizedSport: string,
  games: DFSGame[],
  pitcherByTeam: Map<string, string>,
): { players: InsightCard['data'][]; totalProjected: number } {
  const cfg = DFS_CFG[normalizedSport] ?? { posLabel: 'FLEX', projMult: 0.20, sport: 'DFS', stackTip: 'top scorers' };
  const rosterSlots = DFS_ROSTER[normalizedSport] ?? DFS_ROSTER.basketball_nba;
  const playerPool   = DFS_PLAYERS[normalizedSport] ?? DFS_PLAYERS.basketball_nba;
  const topGame      = games[0];
  const topProjBase  = Math.round(topGame.total * cfg.projMult);
  const topSalBase   = normalizedSport === 'icehockey_nhl' ? 9200
                     : normalizedSport === 'baseball_mlb'  ? 9400
                     : normalizedSport === 'americanfootball_nfl' ? 8200 : 9000;

  const usedNames: Set<string> = new Set();
  const posCtrs: Record<string, number> = {};

  const players = rosterSlots.map(slot => {
    const pool  = playerPool[slot.pos] ?? playerPool.UTIL ?? [];
    const ct    = posCtrs[slot.pos] ?? 0;
    posCtrs[slot.pos] = ct + 1;

    let playerName: string;
    if (slot.pos === 'SP' && normalizedSport === 'baseball_mlb') {
      const g = games[ct] ?? topGame;
      const tWord = (g.homeWinProb >= 0.5 ? g.homeTeam : g.awayTeam).split(' ').pop() ?? '';
      playerName = pitcherByTeam.get(tWord) ?? pool[ct % Math.max(1, pool.length)] ?? `${tWord} SP`;
    } else {
      let idx = ct % Math.max(1, pool.length);
      for (let t = 0; t < pool.length && usedNames.has(pool[idx]); t++) {
        idx = (idx + 1) % pool.length;
      }
      playerName = pool[idx] ?? `${slot.pos} Starter`;
    }
    usedNames.add(playerName);

    const pts = Math.round(topProjBase * slot.scale * 10) / 10;
    const sal = Math.round((topSalBase * slot.sf) / 100) * 100;
    return {
      player_name:   playerName,
      player_type:   slot.pos,
      dk_pts_mean:   Math.max(3, pts),
      salary:        sal,
      p10:           Math.round(pts * 0.55 * 10) / 10,
      p90:           Math.round(pts * 1.55 * 10) / 10,
      matchup_score: Math.min(99, Math.round(55 + slot.scale * 40)),
    };
  });

  const totalProjected = Math.round(players.reduce((s, p) => s + (p.dk_pts_mean as number), 0) * 10) / 10;
  return { players, totalProjected };
}

/** Fetch today's MLB probable starters (non-critical — silently fails). */
async function resolvePitchers(normalizedSport: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (normalizedSport !== 'baseball_mlb') return map;
  try {
    const { cacheGet, bucket } = await import('@/lib/cache/redis-cache');
    const schedKey = `mlb:schedule:v1:${new Date().toISOString().slice(0, 10)}:${bucket(300_000)}`;
    let sched: any[] | null = await cacheGet<any[]>(schedKey).catch(() => null);
    if (!sched?.length) {
      const { fetchTodaysGames } = await import('@/lib/mlb-projections/mlb-stats-api');
      sched = await Promise.race([
        fetchTodaysGames(),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000)),
      ]).catch(() => null);
    }
    for (const g of (sched ?? [])) {
      const homeWord = (g.homeTeam ?? g.home ?? '').split(' ').pop() ?? '';
      const awayWord = (g.awayTeam ?? g.away ?? '').split(' ').pop() ?? '';
      if (homeWord && g.probableHomePitcher?.fullName) map.set(homeWord, g.probableHomePitcher.fullName);
      if (awayWord && g.probableAwayPitcher?.fullName) map.set(awayWord, g.probableAwayPitcher.fullName);
    }
  } catch { /* non-critical */ }
  return map;
}

/** Fetch live games from the Odds API. Returns [] on any failure. */
async function fetchLiveGames(normalizedSport: string): Promise<DFSGame[]> {
  try {
    const { getOddsApiKey } = await import('@/lib/config');
    const key = getOddsApiKey();
    if (!key) return [];

    const url = `https://api.the-odds-api.com/v4/sports/${normalizedSport}/odds?apiKey=${key}&regions=us&markets=h2h,totals&oddsFormat=american`;
    const resp = await Promise.race<Response | null>([
      fetch(url, { next: { revalidate: 0 } } as RequestInit),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 6000)),
    ]);
    if (!resp?.ok) return [];

    interface OddsEvent {
      id: string; home_team: string; away_team: string; commence_time: string;
      bookmakers?: Array<{ markets?: Array<{ key: string; outcomes?: Array<{ name: string; price?: number; point?: number }> }> }>;
    }
    const events: OddsEvent[] = await resp.json();
    const toDecimal = (p: number) => p > 0 ? 1 + p / 100 : 1 - 100 / p;

    return events.map(ev => {
      let total = 0, homeWinProb = 0.5;
      for (const bk of ev.bookmakers ?? []) {
        for (const mkt of bk.markets ?? []) {
          if (mkt.key === 'totals' && total === 0) {
            const ov = mkt.outcomes?.find(o => o.name === 'Over');
            if (ov?.point) total = ov.point;
          }
          if (mkt.key === 'h2h' && homeWinProb === 0.5) {
            const home = mkt.outcomes?.find(o => o.name === ev.home_team);
            const away = mkt.outcomes?.find(o => o.name === ev.away_team);
            if (home?.price && away?.price) {
              const hi = 1 / toDecimal(home.price);
              const ai = 1 / toDecimal(away.price);
              homeWinProb = hi / (hi + ai);
            }
          }
        }
      }
      return { id: ev.id, homeTeam: ev.home_team, awayTeam: ev.away_team, startTime: ev.commence_time, total, homeWinProb };
    }).filter(g => g.total > 0).sort((a, b) => b.total - a.total);
  } catch (err) {
    console.warn('[v0] [DFS] Odds API fetch failed:', err instanceof Error ? err.message : String(err));
    return [];
  }
}

/**
 * Generate DFS insight cards for a given sport.
 * Always returns cards — falls back to estimated projections when no live games are available.
 */
export async function generateDFSCards(
  normalizedSport: string,
  count: number,
  displaySport: string,
): Promise<InsightCard[]> {
  const cfg = DFS_CFG[normalizedSport] ?? { posLabel: 'FLEX', projMult: 0.20, sport: displaySport, stackTip: 'top scorers' };

  // Fetch real games and MLB pitchers concurrently
  const [liveGames, pitcherByTeam] = await Promise.all([
    fetchLiveGames(normalizedSport),
    resolvePitchers(normalizedSport),
  ]);

  // Use real games or synthesize one from sport-default O/U
  const games: DFSGame[] = liveGames.length > 0 ? liveGames : [{
    id: 'synthetic',
    homeTeam: 'Home',
    awayTeam: 'Away',
    startTime: new Date().toISOString(),
    total: DEFAULT_TOTALS[normalizedSport] ?? 222.5,
    homeWinProb: 0.5,
  }];

  const isSynthetic = liveGames.length === 0;
  const topGame = games[0];
  const cards: InsightCard[] = [];

  // ── DFS Games slate card (only when real games available) ──────────────────
  if (!isSynthetic) {
    const byTime = [...games].sort((a, b) => a.startTime.localeCompare(b.startTime));
    type SlateGroup = { startTime: string; games: DFSGame[] };
    const slateGroups: SlateGroup[] = [];
    for (const g of byTime) {
      const last = slateGroups[slateGroups.length - 1];
      if (last && Math.abs(new Date(g.startTime).getTime() - new Date(last.startTime).getTime()) < 90 * 60 * 1000) {
        last.games.push(g);
      } else {
        slateGroups.push({ startTime: g.startTime, games: [g] });
      }
    }
    const dfsSlates = slateGroups.map((sg, i) => ({
      draftGroupId: i + 1,
      slateLabel: sg.games.length === 1 ? 'Showdown' : sg.games.length >= 8 ? 'Main Slate' : `${sg.games.length}-game slate`,
      contestType: (sg.games.length === 1 ? 'showdown' : 'classic') as 'showdown' | 'classic',
      startDate: sg.startTime,
      gameCount: sg.games.length,
      games: sg.games.map((g, j) => ({
        gameId: j + 1,
        awayTeamAbbr: teamAbbr(normalizedSport, g.awayTeam),
        homeTeamAbbr: teamAbbr(normalizedSport, g.homeTeam),
        startTime: g.startTime,
      })),
    }));

    cards.push({
      type: CARD_TYPES.DFS_GAMES,
      title: `Today's DFS Slates`,
      icon: 'Calendar',
      category: 'DFS',
      subcategory: `${dfsSlates.length} slate${dfsSlates.length !== 1 ? 's' : ''} · ${games.length} game${games.length !== 1 ? 's' : ''}`,
      gradient: 'from-blue-700 to-indigo-700',
      status: CARD_STATUS.LIVE,
      realData: true,
      data: {
        slates: dfsSlates,
        selectedDraftGroupId: null,
        sport: normalizedSport.includes('basketball') ? 'nba'
             : normalizedSport.includes('football')   ? 'nfl'
             : normalizedSport.includes('hockey')     ? 'nhl' : 'mlb',
      },
      metadata: { realData: true, source: 'The Odds API' },
    } as any);
  }

  // ── DFS Lineup card ────────────────────────────────────────────────────────
  const { players: lineupPlayers, totalProjected } = buildLineup(normalizedSport, games, pitcherByTeam);

  cards.push({
    type: CARD_TYPES.DFS_LINEUP_CARD,
    title: `${cfg.sport} DK Optimal Lineup`,
    icon: 'Users',
    category: 'DFS',
    subcategory: `${cfg.sport} · DraftKings · ${isSynthetic ? 'Projected' : `${games.length}-game slate`}`,
    gradient: 'from-violet-700 to-purple-800',
    status: CARD_STATUS.LIVE,
    realData: !isSynthetic,
    data: {
      lineup: lineupPlayers,
      site: 'DK',
      sport: normalizedSport,
      totalProjected,
      slateGames: isSynthetic ? 0 : games.length,
      topGame: isSynthetic
        ? `${cfg.sport} projected lineup (no games posted yet)`
        : `${topGame.awayTeam} @ ${topGame.homeTeam} (O/U ${topGame.total})`,
      realData: !isSynthetic,
    },
    metadata: { realData: !isSynthetic, source: isSynthetic ? 'Projected' : 'The Odds API' },
  } as any);

  // ── Slate leader card ──────────────────────────────────────────────────────
  const topTeam   = topGame.homeWinProb >= 0.5 ? topGame.homeTeam : topGame.awayTeam;
  const topWord   = topTeam.split(' ').pop() ?? topTeam;
  const topAnchor = pitcherByTeam.get(topWord)
    ?? (normalizedSport === 'baseball_mlb' ? `${topWord} SP (TBD)` : `${topWord} ${cfg.posLabel}`);
  const topProjBase = Math.round(topGame.total * cfg.projMult);
  const topSal      = Math.round((topProjBase * 190 + 3800) / 100) * 100;

  cards.push({
    type: CARD_TYPES.DFS_MATCHUP,
    title: isSynthetic
      ? `${cfg.sport} Slate Leader`
      : `${topGame.awayTeam.split(' ').pop()} @ ${topGame.homeTeam.split(' ').pop()} — Slate Leader`,
    icon: 'Trophy',
    category: 'DFS',
    subcategory: `${cfg.sport} · O/U ${topGame.total} · Top Stack`,
    gradient: 'from-orange-600 to-red-700',
    status: 'optimal',
    realData: !isSynthetic,
    data: {
      player: topAnchor,
      team: topWord,
      position: cfg.posLabel,
      sport: normalizedSport,
      salary: `$${topSal.toLocaleString()}`,
      projection: topProjBase.toFixed(1),
      ownership: `${Math.min(35, Math.round(8 + topProjBase / 4))}%`,
      boomCeiling: (topProjBase * 1.5).toFixed(1),
      bustFloor: (topProjBase * 0.5).toFixed(1),
      targetGame: isSynthetic ? `${cfg.sport} — no games posted yet` : `${topGame.awayTeam} @ ${topGame.homeTeam}`,
      matchupScore: isSynthetic ? 72 : 88,
      platforms: ['DraftKings', 'FanDuel'],
      dkValue: (topProjBase / (topSal / 1000)).toFixed(2),
      tips: isSynthetic
        ? `No games posted yet for tonight's ${cfg.sport} slate. Check DraftKings closer to lock. Target ${cfg.stackTip}.`
        : `${topGame.awayTeam} @ ${topGame.homeTeam} has the slate's highest O/U at ${topGame.total}. Target ${cfg.stackTip} — both teams implied for big scoring.`,
      realData: !isSynthetic,
    },
  } as any);

  console.log(`[v0] [DFS] Generated ${cards.length} cards for ${normalizedSport} (${isSynthetic ? 'synthetic' : `${games.length} live games`})`);
  return cards.slice(0, count);
}
