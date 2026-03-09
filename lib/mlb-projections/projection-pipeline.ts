/**
 * LeverageMetrics MLB Projection Pipeline
 * Orchestrates: MLB Stats API → Statcast → Weather → Features → Models → Monte Carlo → Cards
 */

import { fetchTodaysGames, type MLBGame, type MLBBatter, type MLBPitcher } from './mlb-stats-api';
import { fetchStatcastHitters, fetchStatcastPitchers, findHitterByName, findPitcherByName } from './statcast-client';
import { getParkFactors } from './park-factors';
import {
  buildHitterFeatures,
  buildPitcherFeatures,
  buildBiomechanicsFeatures,
  computeWeatherAdjustment,
  type WeatherConditions,
} from './feature-engineering';
import {
  computeHitterProbs,
  computePitcherProbs,
  pitcherBreakoutScore,
  type HitterProjectedStats,
  type PitcherProjectedStats,
} from './models';
import { computeMatchupVariables, getDFSMatchupLabel } from './matchup-engine';
import { simulateHitter, simulatePitcher } from './monte-carlo';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlayerProjection {
  // Identity
  playerId: number;
  playerName: string;
  team: string;
  teamAbbr: string;
  position: string;
  playerType: 'hitter' | 'pitcher';
  batsThrows: 'R' | 'L' | 'S';

  // Game context
  gameId: number;
  opponent: string;
  opponentAbbr: string;
  venue: string;
  gameTime: string;
  opposingPitcher?: string;
  opposingBatter?: string; // For pitcher context

  // Model outputs
  hrProj: number;          // P(HR per game) = 1 - (1-hrPerAB)^4
  hrPerAB: number;
  kProj: number;           // Expected Ks per game (pitchers) or K% (hitters)
  breakoutScore: number;   // 0–100 (pitchers only; hitters get 0)

  // Monte Carlo percentiles
  percentiles: { p10: number; p50: number; p90: number };
  dkPtsProjection: number; // Expected DraftKings fantasy pts

  // Feature context
  parkFactor: number;
  weatherAdjustment: number;
  weatherConditions: WeatherConditions;
  dfsMatchupScore: number;  // 0–1 composite
  dfsMatchupLabel: string;

  // Raw Statcast features (for card display)
  statcastSummary: {
    exitVelocity?: number;
    launchAngle?: number;
    barrelPct?: number;
    xwOBA?: number;
    hardHitPct?: number;
    velocity?: number;      // Pitcher FB velocity
    spinRate?: number;
    kPct: number;
    bbPct: number;
  };

  // Card display
  status: 'hot' | 'edge' | 'value' | 'neutral';
  lastUpdated: string;
}

export interface MLBProjectionCardData {
  type: 'mlb_projection_card';
  title: string;
  category: 'MLB';
  subcategory: 'HR Projection' | 'K Projection' | 'Breakout' | 'Daily Projections';
  gradient: string;
  status: string;
  realData: boolean;
  // Projection fields
  player_id: number;
  player_name: string;
  team: string;
  position: string;
  projections: { hr_proj: number; k_proj: number; breakout_score: number };
  percentiles: { p10: number; p50: number; p90: number };
  matchup_score: number;
  summary_metrics: Array<{ label: string; value: string }>;
  lightbox: { sections: LightboxSection[] };
  trend_note: string;
  last_updated: string;
}

interface LightboxSection {
  title: string;
  metrics: Array<{ label: string; value: string }>;
}

// ─── Indoor/dome stadiums (weather-neutral) ──────────────────────────────────
const INDOOR_TEAMS = new Set(['TB', 'MIA', 'HOU', 'SEA', 'TOR', 'ARI', 'MIN']);

// ─── Main pipeline ────────────────────────────────────────────────────────────

interface PipelineOptions {
  date?: string;
  limit?: number;
  playerName?: string;
  playerType?: 'hitter' | 'pitcher' | 'all';
}

/**
 * Run the full projection pipeline for today's MLB slate.
 * Returns MLBProjectionCardData[] ready for DynamicCardRenderer.
 */
export async function runProjectionPipeline(opts: PipelineOptions = {}): Promise<MLBProjectionCardData[]> {
  const { limit = 10, playerName, playerType = 'all' } = opts;

  console.log('[MLBProj] Starting projection pipeline:', opts);

  // 1. Fetch today's games
  const games = await fetchTodaysGames(opts.date);
  if (games.length === 0) {
    console.warn('[MLBProj] No games found for date:', opts.date ?? 'today');
    return [];
  }

  // 2. Fetch all Statcast data in parallel
  const [allHitters, allPitchers] = await Promise.all([
    fetchStatcastHitters(200),
    fetchStatcastPitchers(60),
  ]);

  const projections: MLBProjectionCardData[] = [];

  for (const game of games) {
    if (projections.length >= limit) break;

    // 3. Build weather conditions for this game's venue
    const weather = await buildWeatherConditions(game);

    // 4. Process pitchers
    if (playerType !== 'hitter') {
      const pitchers = [game.probableHomePitcher, game.probableAwayPitcher].filter(Boolean) as MLBPitcher[];
      for (const pitcher of pitchers) {
        if (projections.length >= limit) break;
        if (playerName && !pitcher.fullName.toLowerCase().includes(playerName.toLowerCase())) continue;

        const statcast = allPitchers.find(p => p.playerId === pitcher.id) ??
          await findPitcherByName(pitcher.fullName).catch(() => null) ??
          null;

        if (!statcast) continue;

        const parkFactors = getParkFactors(pitcher.teamAbbr);
        const features = buildPitcherFeatures(statcast, parkFactors, weather);
        const bio = buildBiomechanicsFeatures(statcast);
        const probs = computePitcherProbs(features);
        const breakout = pitcherBreakoutScore(bio);
        const sim = simulatePitcher(probs, 1000);

        const opposingTeam = pitcher.teamAbbr === game.homeTeamAbbr ? game.awayTeam : game.homeTeam;
        const card = buildPitcherCard(pitcher, statcast, probs, sim, breakout, features, weather, game, opposingTeam);
        projections.push(card);
      }
    }

    // 5. Process hitters
    if (playerType !== 'pitcher') {
      const lineups = [...(game.homeLineup ?? []), ...(game.awayLineup ?? [])];
      // If no lineups posted, skip hitters (we can't project without lineup order)
      const hittersToProcess = lineups.length > 0 ? lineups.slice(0, 6) : []; // Top 6 in lineup

      for (const batter of hittersToProcess) {
        if (projections.length >= limit) break;
        if (playerName && !batter.fullName.toLowerCase().includes(playerName.toLowerCase())) continue;

        // Find opposing pitcher
        const isHome = batter.teamAbbr === game.homeTeamAbbr;
        const opposingPitcher = isHome ? game.probableAwayPitcher : game.probableHomePitcher;

        const statcast = allHitters.find(h => h.playerId === batter.id) ??
          await findHitterByName(batter.fullName).catch(() => null) ??
          null;

        if (!statcast) continue;

        const parkFactors = getParkFactors(batter.teamAbbr);
        const features = buildHitterFeatures(
          { ...statcast, bats: batter.bats },
          parkFactors,
          weather,
          opposingPitcher?.throws ?? 'R',
          batter.position,
        );
        const probs = computeHitterProbs(features);

        // Get pitcher features for matchup engine
        const pitcherStatcast = opposingPitcher
          ? allPitchers.find(p => p.playerId === opposingPitcher.id)
          : null;
        const pitcherFeatures = pitcherStatcast
          ? buildPitcherFeatures(pitcherStatcast, parkFactors, weather)
          : null;

        const matchup = pitcherFeatures
          ? computeMatchupVariables(features, pitcherFeatures, weather, parkFactors)
          : { dfsMatchupScore: 0.5, ...defaultMatchupVars() };

        const sim = simulateHitter(probs, 1000);

        const card = buildHitterCard(batter, statcast, probs, sim, features, matchup, weather, game, opposingPitcher?.fullName);
        projections.push(card);
      }
    }
  }

  // Sort: hot first, then by HR projection descending
  return projections
    .sort((a, b) => {
      const statusOrder: Record<string, number> = { hot: 0, edge: 1, value: 2, neutral: 3 };
      const ao = statusOrder[a.status] ?? 3;
      const bo = statusOrder[b.status] ?? 3;
      if (ao !== bo) return ao - bo;
      return b.projections.hr_proj - a.projections.hr_proj;
    })
    .slice(0, limit);
}

// ─── Card builders ────────────────────────────────────────────────────────────

function buildHitterCard(
  batter: MLBBatter,
  statcast: Awaited<ReturnType<typeof findHitterByName>>,
  probs: HitterProjectedStats,
  sim: ReturnType<typeof simulateHitter>,
  features: ReturnType<typeof buildHitterFeatures>,
  matchup: any,
  weather: WeatherConditions,
  game: MLBGame,
  opposingPitcher?: string,
): MLBProjectionCardData {
  const hrProjPct = +(probs.hrPerGame * 100).toFixed(1);
  const status = hrProjPct >= 15 ? 'hot' : hrProjPct >= 10 ? 'edge' : hrProjPct >= 6 ? 'value' : 'neutral';

  return {
    type: 'mlb_projection_card',
    title: `${batter.fullName} — HR Projection`,
    category: 'MLB',
    subcategory: 'HR Projection',
    gradient: 'from-emerald-600/75 via-teal-900/55 to-slate-900/40',
    status,
    realData: true,
    player_id: batter.id,
    player_name: batter.fullName,
    team: batter.team,
    position: batter.position,
    projections: {
      hr_proj: +probs.hrPerGame.toFixed(3),
      k_proj:  +(probs.kProb * 4).toFixed(2), // Projected hitter Ks per game
      breakout_score: 0,
    },
    percentiles: {
      p10: sim.hrs.p10,
      p50: sim.hrs.p50,
      p90: sim.hrs.p90,
    },
    matchup_score: matchup.dfsMatchupScore,
    summary_metrics: [
      { label: 'HR Prob/Game',    value: `${hrProjPct}%` },
      { label: 'DK Proj Pts',     value: sim.dkPts.mean.toFixed(1) },
      { label: 'Matchup',         value: getDFSMatchupLabel(matchup.dfsMatchupScore) },
      { label: 'Barrel Rate',     value: `${statcast?.barrelPct?.toFixed(1) ?? '—'}%` },
      { label: 'Exit Velocity',   value: `${statcast?.avgExitVelocity?.toFixed(1) ?? '—'} mph` },
      { label: 'Park Factor',     value: features.parkFactor.toFixed(2) },
    ],
    lightbox: {
      sections: [
        {
          title: 'Monte Carlo Simulation (1,000 games)',
          metrics: [
            { label: 'P10 (Floor)',   value: `${sim.hrs.p10} HR` },
            { label: 'P50 (Median)', value: `${sim.hrs.p50} HR` },
            { label: 'P90 (Ceiling)',value: `${sim.hrs.p90} HR` },
            { label: 'DK Pts Floor', value: sim.dkPts.p10.toFixed(1) },
            { label: 'DK Pts Median',value: sim.dkPts.p50.toFixed(1) },
            { label: 'DK Pts Ceiling',value: sim.dkPts.p90.toFixed(1) },
          ],
        },
        {
          title: 'Statcast Profile',
          metrics: [
            { label: 'xwOBA',        value: statcast?.xwOBA?.toFixed(3) ?? '—' },
            { label: 'Hard Hit%',    value: `${statcast?.hardHitPct?.toFixed(1) ?? '—'}%` },
            { label: 'Sweet Spot%',  value: `${statcast?.sweetSpotPct?.toFixed(1) ?? '—'}%` },
            { label: 'Launch Angle', value: `${statcast?.launchAngle?.toFixed(1) ?? '—'}°` },
            { label: 'Pull%',        value: `${statcast?.pullPct?.toFixed(1) ?? '—'}%` },
          ],
        },
        {
          title: 'Matchup Context',
          metrics: [
            { label: 'vs Pitcher',       value: opposingPitcher ?? 'TBD' },
            { label: 'Park Factor',      value: features.parkFactor.toFixed(2) },
            { label: 'Weather Adj',      value: features.weatherAdjustment >= 0 ? `+${(features.weatherAdjustment * 100).toFixed(1)}%` : `${(features.weatherAdjustment * 100).toFixed(1)}%` },
            { label: 'Platoon',          value: features.platoonAdvantage > 0 ? 'Advantage' : 'Disadvantage' },
            { label: 'DFS Score',        value: `${(matchup.dfsMatchupScore * 100).toFixed(0)}/100` },
          ],
        },
      ],
    },
    trend_note: `${batter.fullName} projects ${hrProjPct}% HR probability vs ${opposingPitcher ?? 'TBD'} with ${getDFSMatchupLabel(matchup.dfsMatchupScore).toLowerCase()}.`,
    last_updated: `LeverageMetrics Engine — ${new Date().toLocaleDateString()}`,
  };
}

function buildPitcherCard(
  pitcher: MLBPitcher,
  statcast: NonNullable<Awaited<ReturnType<typeof findPitcherByName>>>,
  probs: PitcherProjectedStats,
  sim: ReturnType<typeof simulatePitcher>,
  breakout: number,
  features: ReturnType<typeof buildPitcherFeatures>,
  weather: WeatherConditions,
  game: MLBGame,
  opposingTeam: string,
): MLBProjectionCardData {
  const ksPer9 = +(probs.ksPer9).toFixed(1);
  const status = breakout >= 70 ? 'hot' : ksPer9 >= 10 ? 'edge' : ksPer9 >= 8 ? 'value' : 'neutral';

  return {
    type: 'mlb_projection_card',
    title: `${pitcher.fullName} — K & Breakout`,
    category: 'MLB',
    subcategory: breakout >= 70 ? 'Breakout' : 'K Projection',
    gradient: breakout >= 70
      ? 'from-amber-600/75 via-orange-900/55 to-slate-900/40'
      : 'from-violet-600/75 via-purple-900/55 to-slate-900/40',
    status,
    realData: true,
    player_id: pitcher.id,
    player_name: pitcher.fullName,
    team: pitcher.team,
    position: 'SP',
    projections: {
      hr_proj: 0,
      k_proj:  +sim.ks.mean.toFixed(1),
      breakout_score: breakout,
    },
    percentiles: {
      p10: sim.ks.p10,
      p50: sim.ks.p50,
      p90: sim.ks.p90,
    },
    matchup_score: Math.min(1, probs.ksPer9 / 12),
    summary_metrics: [
      { label: 'K/9 Proj',        value: `${ksPer9}` },
      { label: 'Breakout Score',  value: `${breakout}/100` },
      { label: 'DK Proj Pts',     value: sim.dkPts.mean.toFixed(1) },
      { label: 'Avg Velocity',    value: `${statcast.avgVelocity.toFixed(1)} mph` },
      { label: 'Spin Rate',       value: `${statcast.spinRate.toFixed(0)} rpm` },
      { label: 'WHIP Proj',       value: probs.whip.toFixed(2) },
    ],
    lightbox: {
      sections: [
        {
          title: 'Strikeout Simulation (1,000 starts)',
          metrics: [
            { label: 'K Floor (P10)',   value: `${sim.ks.p10}` },
            { label: 'K Median (P50)',  value: `${sim.ks.p50}` },
            { label: 'K Ceiling (P90)', value: `${sim.ks.p90}` },
            { label: 'DK Pts Floor',    value: sim.dkPts.p10.toFixed(1) },
            { label: 'DK Pts Ceiling',  value: sim.dkPts.p90.toFixed(1) },
          ],
        },
        {
          title: 'Breakout Indicators (Biomechanics)',
          metrics: [
            { label: 'Breakout Score',   value: `${breakout}/100` },
            { label: 'Velocity',         value: `${statcast.avgVelocity.toFixed(1)} mph` },
            { label: 'Spin Rate',        value: `${statcast.spinRate.toFixed(0)} rpm` },
            { label: 'Extension',        value: `${statcast.extension.toFixed(1)} ft` },
            { label: 'H. Break',         value: `${statcast.horizontalBreak.toFixed(1)}"` },
            { label: 'V. Break',         value: `${statcast.verticalBreak.toFixed(1)}"` },
          ],
        },
        {
          title: 'Matchup Context',
          metrics: [
            { label: 'vs Team',          value: opposingTeam },
            { label: 'K Rate',           value: `${statcast.kPct.toFixed(1)}%` },
            { label: 'BB Rate',          value: `${statcast.bbPct.toFixed(1)}%` },
            { label: 'HR/9',             value: statcast.hrPer9.toFixed(2) },
            { label: 'Park K Factor',    value: features.parkFactor.toFixed(2) },
          ],
        },
      ],
    },
    trend_note: breakout >= 70
      ? `${pitcher.fullName} shows strong breakout indicators (${breakout}/100) — ${ksPer9} K/9 projection.`
      : `${pitcher.fullName} projects ${ksPer9} K/9 vs ${opposingTeam}.`,
    last_updated: `LeverageMetrics Engine — ${new Date().toLocaleDateString()}`,
  };
}

// ─── Weather helpers ──────────────────────────────────────────────────────────

async function buildWeatherConditions(game: MLBGame): Promise<WeatherConditions> {
  const isIndoor = INDOOR_TEAMS.has(game.homeTeamAbbr);
  if (isIndoor) {
    return { tempF: 72, windSpeedMph: 0, windDirectionDeg: 0, isOutdoor: false };
  }

  try {
    const { fetchWeatherForLocation } = await import('@/lib/weather-service');
    if (!game.venueLat || !game.venueLon) throw new Error('No coordinates');
    const w = await fetchWeatherForLocation(game.venueLat, game.venueLon);
    if (!w) throw new Error('No weather data returned');
    // Open-Meteo returns temperature in °C, wind in km/h
    const tempF = w.temperature * 9 / 5 + 32;
    const windMph = w.windSpeed * 0.621371;
    return {
      tempF,
      windSpeedMph: windMph,
      windDirectionDeg: 180, // Default: wind blowing in from CF
      isOutdoor: true,
    };
  } catch {
    return { tempF: 65, windSpeedMph: 5, windDirectionDeg: 180, isOutdoor: true };
  }
}

function defaultMatchupVars() {
  return {
    platoon: 0.5, hotZone: 0.5, pitchHitterInteraction: 0.5,
    umpireZone: 0.5, parkFactor: 0.5, weatherFactor: 0.5,
    velocityGap: 0.5, pitchDeception: 0.5, sprayAngleMatchup: 0.5,
  };
}

/**
 * Fetch projection for a single player by name (used by the AI tool).
 */
export async function projectSinglePlayer(name: string, type: 'hitter' | 'pitcher'): Promise<MLBProjectionCardData | null> {
  const cards = await runProjectionPipeline({ playerName: name, playerType: type, limit: 1 });
  if (cards.length > 0) return cards[0];

  // Fallback: try direct Statcast lookup even without a game context
  const weather: WeatherConditions = { tempF: 72, windSpeedMph: 8, windDirectionDeg: 90, isOutdoor: true };
  const parkFactors = getParkFactors('NYY'); // Neutral default

  if (type === 'hitter') {
    const statcast = await findHitterByName(name).catch(() => null);
    if (!statcast) return null;
    const features = buildHitterFeatures(statcast, parkFactors, weather);
    const probs = computeHitterProbs(features);
    const sim = simulateHitter(probs, 1000);
    return buildHitterCard(
      { id: statcast.playerId, fullName: statcast.playerName, team: statcast.team, teamAbbr: '', battingOrder: 3, position: 'DH', bats: statcast.bats },
      statcast, probs, sim, features,
      { dfsMatchupScore: 0.55, ...defaultMatchupVars() },
      weather,
      { homeTeam: statcast.team, awayTeam: 'Opponent', homeTeamAbbr: '', awayTeamAbbr: '', venue: '', venueLat: 0, venueLon: 0, gamePk: 0, gameDate: '', status: '', homeLineup: [], awayLineup: [] },
      undefined,
    );
  } else {
    const statcast = await findPitcherByName(name).catch(() => null);
    if (!statcast) return null;
    const features = buildPitcherFeatures(statcast, parkFactors, weather);
    const bio = buildBiomechanicsFeatures(statcast);
    const probs = computePitcherProbs(features);
    const breakout = pitcherBreakoutScore(bio);
    const sim = simulatePitcher(probs, 1000);
    return buildPitcherCard(
      { id: statcast.playerId, fullName: statcast.playerName, team: statcast.team, teamAbbr: '', throws: statcast.throws },
      statcast, probs, sim, breakout, features, weather,
      { homeTeam: statcast.team, awayTeam: 'Opponent', homeTeamAbbr: '', awayTeamAbbr: '', venue: '', venueLat: 0, venueLon: 0, gamePk: 0, gameDate: '', status: '', homeLineup: [], awayLineup: [] },
      'Upcoming Opponent',
    );
  }
}
