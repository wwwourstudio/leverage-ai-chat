/**
 * DFS Adapter — Converts PlayerProjections into DFSCard-compatible data
 *
 * DraftKings MLB scoring:
 * Singles: 3 | Doubles: 5 | Triples: 8 | HR: 10
 * RBI: 2 | Run: 2 | BB: 2 | SB: 5 | K: -0.5
 * Pitcher Out: 0.75 | K: 2 | W: 4 | ER: -2
 */

import { runProjectionPipeline, type MLBProjectionCardData } from './projection-pipeline';
import {
  fetchPlayerGameLog, fetchPlayerHomeSplits, gameLogToDKPts,
  fetchTodaysGames, fetchScratchedPlayerIds, fetchConfirmedLineup, findPlayerIdByName,
} from './mlb-stats-api';
import {
  fetchDKDraftables, getMainSlate,
  type DKDraftable, type DKDraftGroup,
} from './draftkings-api';

export interface DFSCardData {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  status: string;
  realData: boolean;
  data: {
    player: string;
    team: string;
    position: string;
    salary: string;
    projection: string;       // Projected DK pts
    ownership: string;        // Estimated ownership %
    boomCeiling: string;      // P90 DK pts
    bustFloor: string;        // P10 DK pts
    targetGame: string;
    tips: string;
    matchupScore: string;
    parkFactor: string;
    hrProb: string;
    dkValue: string;          // Pts per $1000 (value score)
    source: string;
    // Enriched fields (optional — non-fatal if missing)
    recentDKPts?:    string;  // CSV of last 5 game DK pts, most-recent last
    recentGamesAvg?: string;  // e.g. "10.8 avg · L5"
    homeDKAvg?:      string;  // avg DK pts in home games
    roadDKAvg?:      string;  // avg DK pts in road games
    homeSplitGames?: string;  // e.g. "8 G"
    roadSplitGames?: string;  // e.g. "6 G"
    cardCategory?:   string;  // 'optimal'|'value'|'matchup'|'contrarian'|'chalk'
    stackTeam?:      string;
    stackType?:      string;  // 'full'|'mini'
    stackPartners?:  string[];
    playerId?:       string;  // numeric player ID for lookups
    gameDate?:       string;  // ISO datetime of the game (for today-filter)
    // ── Availability fields (set when card is built from a DK slate) ────────
    isPlaying?:        boolean;
    availabilityReason?: 'IL' | 'scratched' | 'not-in-lineup' | 'no-game' | 'available';
    dkSalary?:         number;       // DK-authoritative salary (numeric)
    dkDraftableId?:    number;
    confirmedStarter?: boolean;
    slateDraftGroupId?: number;
  };
}

/** Returned alongside cards when callers need to know the slate context. */
export interface DFSCardsResult {
  cards: DFSCardData[];
  /** Slate the cards belong to. null when the DK feed was unavailable (degraded mode). */
  slate: DKDraftGroup | null;
  /** True when DK was unreachable and we fell back to projection-only cards. */
  degradedMode: boolean;
  /** Reason for degraded mode, surfaced in the UI banner. */
  degradedReason?: string;
}

/**
 * Build DFS-ready cards for a real DraftKings contest slate. Each card is
 * tied to a player who is actually in DK's draftable pool, with availability
 * (`isPlaying`) computed from DK status, MLB scratches, and confirmed lineups.
 *
 * Falls back to projection-only cards (degradedMode=true) when DK is unreachable.
 */
export async function buildDFSCardsWithSlate(
  opts: { limit?: number; date?: string; draftGroupId?: number } = {},
): Promise<DFSCardsResult> {
  const limit = opts.limit ?? 9;

  // Resolve slate
  let slate: DKDraftGroup | null = null;
  let degradedReason: string | undefined;
  if (typeof opts.draftGroupId === 'number') {
    // Caller picked a specific slate — we still need its metadata, fetched via getMainSlate's parent list.
    const main = await getMainSlate(opts.date ? new Date(opts.date) : undefined);
    if (main.ok && main.value.draftGroupId === opts.draftGroupId) slate = main.value;
    // If the caller's draftGroupId isn't the main slate we don't have the metadata,
    // but we can still fetch draftables for it. Slate label/games will be unknown.
    if (!slate) slate = { draftGroupId: opts.draftGroupId, startDate: '', gameCount: 0, slateLabel: `Slate ${opts.draftGroupId}`, contestType: 'classic', games: [] };
  } else {
    const main = await getMainSlate(opts.date ? new Date(opts.date) : undefined);
    if (main.ok) slate = main.value;
    else degradedReason = main.error.message;
  }

  // ── Degraded mode: DK unreachable. Fall through to projection-only cards. ─
  if (!slate) {
    const cards = await buildProjectionOnlyCards({ limit, date: opts.date });
    return { cards, slate: null, degradedMode: true, degradedReason };
  }

  // Fetch DK draftables for the slate
  const draftablesResult = await fetchDKDraftables(slate.draftGroupId);
  if (!draftablesResult.ok) {
    const cards = await buildProjectionOnlyCards({ limit, date: opts.date });
    return { cards, slate: null, degradedMode: true, degradedReason: draftablesResult.error.message };
  }
  const draftables = draftablesResult.value;
  if (draftables.length === 0) {
    return { cards: [], slate, degradedMode: false };
  }

  // Pull supporting data in parallel
  const slateTeams = new Set<string>();
  for (const g of slate.games) {
    if (g.awayTeamAbbr) slateTeams.add(g.awayTeamAbbr.toUpperCase());
    if (g.homeTeamAbbr) slateTeams.add(g.homeTeamAbbr.toUpperCase());
  }

  const [projections, todaysGames, scratchedIds] = await Promise.all([
    runProjectionPipeline({ playerType: 'all', limit: limit * 8, date: opts.date }).catch(() => [] as MLBProjectionCardData[]),
    fetchTodaysGames(opts.date).catch(() => []),
    fetchScratchedPlayerIds(opts.date).catch(() => new Set<number>()),
  ]);

  // Pull confirmed lineups for any games starting within the next 90 minutes (or already underway)
  const now = Date.now();
  const lineupChecks = await Promise.all(
    todaysGames
      .filter(g => slateTeams.has(g.homeTeamAbbr) || slateTeams.has(g.awayTeamAbbr))
      .filter(g => {
        const starts = Date.parse(g.gameDate);
        return Number.isFinite(starts) && starts - now < 90 * 60 * 1000; // ≤ 90 min away or already started
      })
      .map(async g => ({ gamePk: g.gamePk, lineup: await fetchConfirmedLineup(g.gamePk) })),
  );
  const confirmedBatterIds = new Set<number>();
  let anyLineupOfficial = false;
  for (const { lineup } of lineupChecks) {
    if (lineup.isOfficial) {
      anyLineupOfficial = true;
      for (const id of lineup.homeBatters) confirmedBatterIds.add(id);
      for (const id of lineup.awayBatters) confirmedBatterIds.add(id);
    }
  }

  // Build projection lookup keyed by normalized name+team — DK and MLB Stats API
  // use different player IDs, so we join by name. Team disambiguates duplicates.
  const projByKey = new Map<string, MLBProjectionCardData>();
  for (const p of projections) {
    projByKey.set(joinKey(p.player_name, p.team), p);
  }

  // Build a card for every draftable, then mark availability and enrich.
  const cards: DFSCardData[] = [];
  for (const d of draftables) {
    const isHitter = d.position !== 'SP' && d.position !== 'RP';
    const teamUp = d.team.toUpperCase();

    // Availability rules — first match wins.
    let availabilityReason: NonNullable<DFSCardData['data']['availabilityReason']> = 'available';
    let isPlaying = true;
    if (slateTeams.size > 0 && !slateTeams.has(teamUp)) {
      isPlaying = false;
      availabilityReason = 'no-game';
    } else if (d.status === 'OUT') {
      isPlaying = false;
      availabilityReason = 'IL';
    } else if (scratchedIds.has(d.playerId)) {
      isPlaying = false;
      availabilityReason = 'scratched';
    } else if (isHitter && anyLineupOfficial && !confirmedBatterIds.has(d.playerId)) {
      // Lineups are out for at least one game; if this hitter isn't in any confirmed list, drop them.
      isPlaying = false;
      availabilityReason = 'not-in-lineup';
    }

    const proj = projByKey.get(joinKey(d.displayName, d.team));
    const card = draftableToDFSCard(d, proj, slate, { isPlaying, availabilityReason, isOfficialLineupConfirmed: isHitter && confirmedBatterIds.has(d.playerId) });
    cards.push(card);
  }

  // Enrich confirmed players with game logs / splits — bound the fan-out.
  const ENRICH_LIMIT = Math.max(40, limit * 6);
  const enrichTargets = cards.filter(c => c.data.isPlaying).slice(0, ENRICH_LIMIT);
  await Promise.all(enrichTargets.map(async card => {
    const playerName = card.data.player;
    const team = card.data.team;
    let playerId: number | null = card.data.playerId ? parseInt(card.data.playerId, 10) : null;
    if (!playerId || Number.isNaN(playerId)) {
      playerId = await findPlayerIdByName(playerName);
      if (playerId) card.data.playerId = String(playerId);
    }
    if (!playerId) return;
    const isHitter = card.data.position !== 'SP' && card.data.position !== 'RP';
    const group = isHitter ? 'hitting' : 'pitching';
    const [logsRes, splitsRes] = await Promise.allSettled([
      fetchPlayerGameLog(playerId, group, 5),
      fetchPlayerHomeSplits(playerId, group),
    ]);
    if (logsRes.status === 'fulfilled' && logsRes.value.length > 0) {
      const dkPtsArr = logsRes.value.map(gameLogToDKPts);
      card.data.recentDKPts = dkPtsArr.map(p => p.toFixed(1)).join(',');
      const avg = dkPtsArr.reduce((s, p) => s + p, 0) / dkPtsArr.length;
      card.data.recentGamesAvg = `${avg.toFixed(1)} avg · L${dkPtsArr.length}`;
    }
    if (splitsRes.status === 'fulfilled') {
      const s = splitsRes.value;
      if (s.homeGames > 0) { card.data.homeDKAvg = s.homeAvgDKPts.toFixed(1); card.data.homeSplitGames = `${s.homeGames} G`; }
      if (s.roadGames > 0) { card.data.roadDKAvg  = s.roadAvgDKPts.toFixed(1); card.data.roadSplitGames = `${s.roadGames} G`; }
    }
    // Annotate targetGame from the slate game list (DK already gives us competitionName)
    if (!card.data.targetGame && card.data.team) {
      const game = todaysGames.find(g => g.homeTeamAbbr.toUpperCase() === team || g.awayTeamAbbr.toUpperCase() === team);
      if (game) card.data.targetGame = `${game.awayTeamAbbr} @ ${game.homeTeamAbbr}`;
    }
    // Suppress redundant `team` data
    void team;
  }));

  return { cards, slate, degradedMode: false };
}

/**
 * Backward-compatible thin wrapper. Returns ONLY the cards array, defaulting
 * to the Main slate. Callers that need slate metadata should use
 * `buildDFSCardsWithSlate()` directly.
 */
export async function buildDFSCards(opts: { limit?: number; date?: string; draftGroupId?: number } = {}): Promise<DFSCardData[]> {
  const result = await buildDFSCardsWithSlate(opts);
  return result.cards;
}

// ─── Legacy projection-only path (used as a fallback when DK is unreachable) ─

async function buildProjectionOnlyCards(opts: { limit: number; date?: string }): Promise<DFSCardData[]> {
  const { limit } = opts;
  const [projections, todaysGames] = await Promise.all([
    runProjectionPipeline({ playerType: 'all', limit: limit * 2, date: opts.date }),
    fetchTodaysGames(opts.date).catch(() => []),
  ]);
  if (projections.length === 0) return [];
  const sorted = [...projections].sort((a, b) => {
    const aDK = a.summary_metrics.find(m => m.label === 'DK Proj Pts');
    const bDK = b.summary_metrics.find(m => m.label === 'DK Proj Pts');
    return parseFloat(bDK?.value ?? '0') - parseFloat(aDK?.value ?? '0');
  });
  const topN = sorted.slice(0, limit);
  const enriched = await Promise.allSettled(topN.map(async proj => {
    const card = projectionToDFSCard(proj, todaysGames);
    // No DK pool means we can't verify availability — flag as unknown so the
    // optimizer treats them as eligible only in degraded mode.
    card.data.isPlaying = true;
    card.data.availabilityReason = 'available';
    return card;
  }));
  return enriched.filter((r): r is PromiseFulfilledResult<DFSCardData> => r.status === 'fulfilled').map(r => r.value);
}

// ─── DK-driven card builders ─────────────────────────────────────────────────

/** Normalize a player name + team into a stable join key for matching DK ↔ projection rows. */
function joinKey(name: string, team: string): string {
  const n = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const t = team.toUpperCase().replace(/[^A-Z]/g, '');
  return `${n}|${t}`;
}

/** Build a DFSCard from a DK draftable, optionally enriched by a matching projection. */
function draftableToDFSCard(
  d: DKDraftable,
  proj: MLBProjectionCardData | undefined,
  slate: DKDraftGroup,
  flags: { isPlaying: boolean; availabilityReason: NonNullable<DFSCardData['data']['availabilityReason']>; isOfficialLineupConfirmed: boolean },
): DFSCardData {
  const isHitter = d.position !== 'SP' && d.position !== 'RP';
  const dkPtsNum = proj
    ? parseFloat(proj.summary_metrics.find(m => m.label === 'DK Proj Pts')?.value ?? String(d.projectedFpts))
    : d.projectedFpts;

  const parkFactor = proj ? parseFloat(proj.summary_metrics.find(m => m.label === 'Park Factor')?.value ?? '1.0') : 1.0;
  // Value score: DK pts / ($salary / 1000) — aim for ≥ 3.5
  const valueScore = d.salary > 0 ? dkPtsNum / (d.salary / 1000) : 0;

  // Estimated ownership: top-projected players get higher ownership
  const ownershipBase = isHitter ? (dkPtsNum > 8 ? 28 : dkPtsNum > 6 ? 18 : 10) : (dkPtsNum > 22 ? 32 : 20);
  const ownershipAdj = (parkFactor - 1.0) * 10;
  const estimatedOwnership = Math.max(5, Math.min(55, ownershipBase + ownershipAdj));

  const p10Section = proj?.lightbox.sections[0]?.metrics;
  const p10DK = p10Section?.find(m => m.label.includes('DK Pts Floor'))?.value ?? '—';
  const p90DK = p10Section?.find(m => m.label.includes('DK Pts Ceiling'))?.value ?? '—';

  const matchupLabel = proj?.summary_metrics.find(m => m.label === 'Matchup')?.value ??
    proj?.summary_metrics.find(m => m.label === 'K/9 Proj')?.value ?? '—';

  const tip = proj
    ? (isHitter ? buildHitterTip(proj, parkFactor, valueScore) : buildPitcherTip(proj))
    : (isHitter ? 'DK draftable — projection pending' : 'DK draftable — projection pending');

  return {
    type: 'dfs-lineup',
    title: `${d.displayName} — DFS Play`,
    category: 'MLB',
    subcategory: `DK ${d.position} · ${d.team}`,
    gradient: proj?.gradient ?? 'from-orange-500/30 via-red-500/15 to-amber-500/20',
    status: !flags.isPlaying ? 'fallback' : valueScore >= 3.5 ? 'value' : proj?.status === 'hot' ? 'hot' : 'value',
    realData: true,
    data: {
      player:       d.displayName,
      team:         d.team,
      position:     d.position,
      salary:       `$${d.salary.toLocaleString()}`,
      projection:   dkPtsNum.toFixed(1),
      ownership:    `${estimatedOwnership.toFixed(0)}%`,
      boomCeiling:  String(p90DK),
      bustFloor:    String(p10DK),
      targetGame:   d.competitionName,
      gameDate:     d.gameStartTime,
      tips:         tip,
      matchupScore: proj ? `${(proj.matchup_score * 100).toFixed(0)}/100` : '—',
      parkFactor:   parkFactor.toFixed(2),
      hrProb:       proj && isHitter ? `${(proj.projections.hr_proj * 100).toFixed(1)}%` : '—',
      dkValue:      valueScore.toFixed(2),
      source:       proj ? 'LeverageMetrics + DK Draftables' : 'DK Draftables',
      isPlaying:        flags.isPlaying,
      availabilityReason: flags.availabilityReason,
      dkSalary:         d.salary,
      dkDraftableId:    d.draftableId,
      confirmedStarter: flags.isOfficialLineupConfirmed,
      slateDraftGroupId: slate.draftGroupId,
    },
  };
}

function projectionToDFSCard(proj: MLBProjectionCardData, todaysGames: Awaited<ReturnType<typeof fetchTodaysGames>> = []): DFSCardData {
  const dkPts    = proj.summary_metrics.find(m => m.label === 'DK Proj Pts')?.value ?? '0';
  const dkPtsNum = parseFloat(dkPts) || 0;
  const isHitter = proj.position !== 'SP' && proj.position !== 'RP';

  // Estimated salary from DK pts (calibrated to 2025 DK MLB pricing)
  // Rule of thumb: 1 DK pt ≈ $800 in salary; starters have salary floor ~$7,000
  const estimatedSalary = isHitter
    ? Math.round(Math.max(2800, Math.min(7200, dkPtsNum * 820)) / 100) * 100
    : Math.round(Math.max(6000, Math.min(10500, dkPtsNum * 420)) / 100) * 100;

  // Estimated ownership: top-projected players get higher ownership
  const ownershipBase = isHitter ? (dkPtsNum > 8 ? 28 : dkPtsNum > 6 ? 18 : 10) : (dkPtsNum > 22 ? 32 : 20);
  // Park factor and matchup adjust ownership (favorable matchups = higher ownership)
  const parkFactor = parseFloat(proj.summary_metrics.find(m => m.label === 'Park Factor')?.value ?? '1.0');
  const ownershipAdj = (parkFactor - 1.0) * 10;
  const estimatedOwnership = Math.max(5, Math.min(55, ownershipBase + ownershipAdj + (Math.random() * 6 - 3)));

  // Value score: DK pts / ($salary / 1000) — aim for ≥ 3.5
  const valueScore = estimatedSalary > 0 ? dkPtsNum / (estimatedSalary / 1000) : 0;

  // P10/P90 from lightbox (Monte Carlo)
  const p10Section = proj.lightbox.sections[0]?.metrics;
  const p10DK = p10Section?.find(m => m.label.includes('DK Pts Floor'))?.value ?? '0';
  const p90DK = p10Section?.find(m => m.label.includes('DK Pts Ceiling'))?.value ?? '0';

  const matchupLabel = proj.summary_metrics.find(m => m.label === 'Matchup')?.value ??
    proj.summary_metrics.find(m => m.label === 'K/9 Proj')?.value ?? '—';

  const tip = isHitter
    ? buildHitterTip(proj, parkFactor, valueScore)
    : buildPitcherTip(proj);

  // Match player's team to today's games for targetGame
  const teamUpper = proj.team.toUpperCase();
  const matchingGame = todaysGames.find(g =>
    g.homeTeamAbbr.toUpperCase() === teamUpper ||
    g.awayTeamAbbr.toUpperCase() === teamUpper ||
    g.homeTeam.toUpperCase().includes(teamUpper) ||
    g.awayTeam.toUpperCase().includes(teamUpper)
  );
  const targetGame = matchingGame
    ? `${matchingGame.awayTeamAbbr} @ ${matchingGame.homeTeamAbbr}`
    : '';

  return {
    type: 'dfs-lineup',
    title: `${proj.player_name} — DFS Play`,
    category: 'MLB',
    subcategory: `DK ${proj.position} · ${proj.team}`,
    gradient: proj.gradient,
    status: proj.status === 'hot' ? 'hot' : valueScore >= 3.5 ? 'value' : proj.status === 'edge' ? 'optimal' : 'value',
    realData: true,
    data: {
      player:       proj.player_name,
      team:         proj.team,
      position:     proj.position,
      salary:       `$${estimatedSalary.toLocaleString()}`,
      projection:   dkPtsNum.toFixed(1),
      ownership:    `${estimatedOwnership.toFixed(0)}%`,
      boomCeiling:  p90DK,
      bustFloor:    p10DK,
      targetGame,
      gameDate:     matchingGame?.gameDate ?? undefined,
      tips:         tip,
      matchupScore: `${(proj.matchup_score * 100).toFixed(0)}/100`,
      parkFactor:   parkFactor.toFixed(2),
      hrProb:       isHitter ? `${(proj.projections.hr_proj * 100).toFixed(1)}%` : '—',
      dkValue:      valueScore.toFixed(2),
      source:       'LeverageMetrics Engine',
    },
  };
}

function buildHitterTip(proj: MLBProjectionCardData, parkFactor: number, valueScore: number): string {
  const tips: string[] = [];
  if (proj.projections.hr_proj > 0.12) tips.push(`Elite HR upside (${(proj.projections.hr_proj * 100).toFixed(0)}%)`);
  if (parkFactor >= 1.10) tips.push('Very HR-friendly park');
  if (proj.matchup_score >= 0.65) tips.push('Strong matchup score');
  if (valueScore >= 3.5) tips.push(`Good value (${valueScore.toFixed(1)} pts/$k)`);
  return tips.join(' · ') || 'LeverageMetrics projection';
}

function buildPitcherTip(proj: MLBProjectionCardData): string {
  const tips: string[] = [];
  if (proj.projections.breakout_score >= 70) tips.push(`Breakout candidate (${proj.projections.breakout_score}/100)`);
  if (proj.projections.k_proj >= 7) tips.push(`High K upside (${proj.projections.k_proj.toFixed(1)} proj Ks)`);
  return tips.join(' · ') || 'LeverageMetrics pitcher projection';
}
