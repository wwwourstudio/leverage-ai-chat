/**
 * DFS Adapter — Converts PlayerProjections into DFSCard-compatible data
 *
 * DraftKings MLB scoring:
 * Singles: 3 | Doubles: 5 | Triples: 8 | HR: 10
 * RBI: 2 | Run: 2 | BB: 2 | SB: 5 | K: -0.5
 * Pitcher Out: 0.75 | K: 2 | W: 4 | ER: -2
 */

import { runProjectionPipeline, type MLBProjectionCardData } from './projection-pipeline';
import { fetchPlayerGameLog, fetchPlayerHomeSplits, gameLogToDKPts } from './mlb-stats-api';
import { fetchTodaysGames } from './mlb-stats-api';

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
  };
}

/**
 * Build DFS-ready cards from the projection pipeline.
 * Returns DFSCard-compatible objects sorted by projected DK pts.
 * Each card is enriched with recent game log data and home/road splits.
 */
export async function buildDFSCards(opts: { limit?: number; date?: string } = {}): Promise<DFSCardData[]> {
  const { limit = 9 } = opts;

  const [projections, todaysGames] = await Promise.all([
    runProjectionPipeline({
      playerType: 'all',
      limit: limit * 2, // Over-fetch to filter and rank
      date: opts.date,
    }),
    fetchTodaysGames(opts.date).catch(() => []),
  ]);

  if (projections.length === 0) return [];

  // Sort by DK pts projection descending
  const sorted = [...projections].sort((a, b) => {
    const aDK = a.summary_metrics.find(m => m.label === 'DK Proj Pts');
    const bDK = b.summary_metrics.find(m => m.label === 'DK Proj Pts');
    return parseFloat(bDK?.value ?? '0') - parseFloat(aDK?.value ?? '0');
  });

  const topN = sorted.slice(0, limit);

  // Enrich each player with game log + splits in parallel (non-blocking)
  const enriched = await Promise.allSettled(
    topN.map(async (proj) => {
      const card = projectionToDFSCard(proj, todaysGames);
      const isHitter = proj.position !== 'SP' && proj.position !== 'RP';
      const group = isHitter ? 'hitting' : 'pitching';

      // Attempt to find player ID from summary metrics
      const playerIdStr = proj.summary_metrics.find(m => m.label === 'Player ID')?.value;
      const playerId = playerIdStr ? parseInt(playerIdStr, 10) : null;

      if (playerId && !isNaN(playerId)) {
        card.data.playerId = String(playerId);

        // Parallel enrichment — failures are silently ignored
        const [gameLogs, splits] = await Promise.allSettled([
          fetchPlayerGameLog(playerId, group, 5),
          fetchPlayerHomeSplits(playerId, group),
        ]);

        // Recent form
        if (gameLogs.status === 'fulfilled' && gameLogs.value.length > 0) {
          const logs = gameLogs.value;
          const dkPtsArr = logs.map(log => gameLogToDKPts(log));
          card.data.recentDKPts = dkPtsArr.map(p => p.toFixed(1)).join(',');
          const avg = dkPtsArr.reduce((s, p) => s + p, 0) / dkPtsArr.length;
          card.data.recentGamesAvg = `${avg.toFixed(1)} avg · L${dkPtsArr.length}`;
        }

        // Home/road splits
        if (splits.status === 'fulfilled') {
          const s = splits.value;
          if (s.homeGames > 0 || s.roadGames > 0) {
            if (s.homeGames > 0) {
              card.data.homeDKAvg = s.homeAvgDKPts.toFixed(1);
              card.data.homeSplitGames = `${s.homeGames} G`;
            }
            if (s.roadGames > 0) {
              card.data.roadDKAvg = s.roadAvgDKPts.toFixed(1);
              card.data.roadSplitGames = `${s.roadGames} G`;
            }
          }
        }
      }

      return card;
    })
  );

  return enriched
    .filter((r): r is PromiseFulfilledResult<DFSCardData> => r.status === 'fulfilled')
    .map(r => r.value);
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
