/**
 * VPE 3.0 API Route
 * ===================
 * POST /api/vpe3 — Run the Vortex Projection Engine 3.0 pipeline.
 *
 * Accepts hitters, pitchers, MiLB players, and engine options.
 * Returns full VPE3Result with projections, breakout detection,
 * injury risk, DFS lineup, betting edges, and trade values.
 *
 * GET /api/vpe3 — Run with mock data for demo/testing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runVPEEngine } from '@/lib/vpe3/engine';
import {
  mockEliteHitter,
  mockAverageHitter,
  mockBreakoutHitter,
  mockAcePitcher,
  mockAveragePitcher,
  mockCloser,
  mockProspect,
  mockPitchingProspect,
} from '@/lib/vpe3/mock-data';
import type { HitterStats, PitcherStats, MinorLeaguePlayerStats } from '@/lib/vpe3/types';
import type { VPEEngineOptions } from '@/lib/vpe3/engine';

// ── GET: Demo with mock data ────────────────────────────────────────────────

export async function GET() {
  try {
    const hitters = [
      mockEliteHitter(),
      mockAverageHitter(),
      mockBreakoutHitter(),
    ];

    const pitchers = [
      mockAcePitcher(),
      mockAveragePitcher(),
      mockCloser(),
    ];

    const milbPlayers = [
      mockProspect(),
      mockPitchingProspect(),
    ];

    const result = runVPEEngine(hitters, pitchers, milbPlayers, {
      seed: 42,
      simIterations: 500,
      granularity: 'daily',
    });

    return NextResponse.json({
      success: true,
      data: {
        hitters: result.hitters.map(h => ({
          name: h.name,
          team: h.team,
          position: h.position,
          vpeVal: h.vpeVal,
          breakout: h.breakout,
        })),
        pitchers: result.pitchers.map(p => ({
          name: p.name,
          team: p.team,
          position: p.position,
          vpeVal: p.vpeVal,
          stuffPlus: p.stuffPlus,
          csw: p.csw,
          injuryRisk: p.injuryRisk,
        })),
        teamProjections: result.teamProjections,
        milbCallUps: result.milbCallUps,
        dfsLineup: result.dfsLineup,
        bettingEdges: result.bettingEdges,
        tradeValues: result.tradeValues,
        metadata: result.metadata,
      },
    });
  } catch (error) {
    console.error('[v0] [API/vpe3] Error running VPE 3.0 demo:', error);
    return NextResponse.json(
      { success: false, error: 'VPE 3.0 engine failed' },
      { status: 500 },
    );
  }
}

// ── POST: Custom data ───────────────────────────────────────────────────────

interface VPE3RequestBody {
  hitters?: HitterStats[];
  pitchers?: PitcherStats[];
  milbPlayers?: MinorLeaguePlayerStats[];
  options?: Partial<VPEEngineOptions>;
}

export async function POST(request: NextRequest) {
  try {
    const body: VPE3RequestBody = await request.json();

    const hitters = body.hitters ?? [mockEliteHitter()];
    const pitchers = body.pitchers ?? [mockAcePitcher()];
    const milbPlayers = body.milbPlayers ?? [];

    const options: VPEEngineOptions = {
      seed: body.options?.seed ?? 42,
      simIterations: Math.min(body.options?.simIterations ?? 500, 2000),
      granularity: body.options?.granularity ?? 'daily',
      salaryCap: body.options?.salaryCap ?? 50000,
      rosterSize: body.options?.rosterSize ?? 10,
      marketOdds: body.options?.marketOdds,
      tradeInputs: body.options?.tradeInputs,
    };

    const result = runVPEEngine(hitters, pitchers, milbPlayers, options);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[v0] [API/vpe3] Error running VPE 3.0:', error);
    return NextResponse.json(
      { success: false, error: 'VPE 3.0 engine failed' },
      { status: 500 },
    );
  }
}
