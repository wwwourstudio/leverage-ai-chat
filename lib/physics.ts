/**
 * Pitch Physics Model
 *
 * Uses Statcast kinematic parameters to compute 3-D pitch trajectories and
 * evaluate pitch tunneling — how similar two pitches look to the batter at
 * the recognition window (~25 ft from the plate, t ≈ 0.167 s after release).
 *
 * Coordinate system (standard Statcast):
 *   x: horizontal (positive = catcher's right / pitcher's left)
 *   y: distance from release to plate (positive toward plate)
 *   z: vertical (positive = up)
 *
 * All distances in feet, velocities in ft/s, accelerations in ft/s².
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PitchParams {
  /** Initial velocity components at release (ft/s) */
  vx0: number;
  vy0: number;
  vz0: number;
  /** Acceleration components including gravity + Magnus force (ft/s²) */
  ax: number;
  ay: number;
  az: number;
  /** Pitch type label for display (e.g. "FF", "SL", "CH") */
  pitchType?: string;
  /** Release speed mph (informational) */
  releaseSpeed?: number;
  /** Spin rate RPM (informational) */
  spinRate?: number;
}

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface PitchTunnelPair {
  pitch1Type: string;
  pitch2Type: string;
  separationFt: number;    // Euclidean distance at decision point (ft)
  tunnelingScore: number;  // 0–100: 100 = perfect tunnel, 0 = easy to distinguish
}

export interface PitchMixAnalysis {
  bestTunnel: PitchTunnelPair;
  worstTunnel: PitchTunnelPair;
  avgSeparation: number;         // mean over all pitch pairs (ft)
  decisionPoint: number;         // t used (seconds)
  pairs: PitchTunnelPair[];
}

// ---------------------------------------------------------------------------
// Core kinematics
// ---------------------------------------------------------------------------

/**
 * 3-D position of a pitch at time t seconds after release.
 * Uses standard constant-acceleration kinematics:
 *   position = v₀·t + ½·a·t²
 *
 * Note: the release point origin is implicit (treated as 0,0,0).
 */
export function pitchPosition(t: number, params: PitchParams): Position3D {
  const { vx0, vy0, vz0, ax, ay, az } = params;
  const t2 = t * t;
  return {
    x: vx0 * t + 0.5 * ax * t2,
    y: vy0 * t + 0.5 * ay * t2,
    z: vz0 * t + 0.5 * az * t2,
  };
}

// ---------------------------------------------------------------------------
// Tunneling
// ---------------------------------------------------------------------------

/**
 * Decision-point time constant.
 * At ~25 ft from the plate, batters commit to their swing decision.
 * With vy0 ≈ −130 ft/s (90 mph) and ~55 ft release distance, t ≈ 0.167 s.
 */
const DECISION_POINT_T = 0.167;

/**
 * Euclidean distance (feet) between the positions of two pitches at the
 * batter's decision window.  Smaller = better tunnel.
 */
export function tunnelingScore(pitch1: PitchParams, pitch2: PitchParams): number {
  const p1 = pitchPosition(DECISION_POINT_T, pitch1);
  const p2 = pitchPosition(DECISION_POINT_T, pitch2);
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = p1.z - p2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Convert raw separation distance to a 0–100 tunneling quality score.
 * Calibrated so:
 *   0.0 ft separation → 100 (identical tunnel)
 *   1.0 ft separation → ~50  (average)
 *   2.0 ft separation → ~10  (poor tunnel)
 */
function separationToScore(separationFt: number): number {
  return Math.round(100 * Math.exp(-1.5 * separationFt));
}

// ---------------------------------------------------------------------------
// Pitch mix analysis
// ---------------------------------------------------------------------------

/**
 * Analyse all pitch-pair tunnels for a pitcher's mix.
 * Returns the best tunnel (lowest separation), worst, average, and all pairs.
 *
 * @param pitches Array of PitchParams representing distinct pitch types
 *                (pass representative samples — e.g. median kinematic values
 *                 per pitch type).
 */
export function analyzePitchMix(pitches: PitchParams[]): PitchMixAnalysis {
  if (pitches.length < 2) {
    const dummy: PitchTunnelPair = {
      pitch1Type: pitches[0]?.pitchType ?? 'Unknown',
      pitch2Type: '—',
      separationFt: 0,
      tunnelingScore: 100,
    };
    return {
      bestTunnel: dummy,
      worstTunnel: dummy,
      avgSeparation: 0,
      decisionPoint: DECISION_POINT_T,
      pairs: [],
    };
  }

  const pairs: PitchTunnelPair[] = [];

  for (let i = 0; i < pitches.length; i++) {
    for (let j = i + 1; j < pitches.length; j++) {
      const sep = tunnelingScore(pitches[i], pitches[j]);
      pairs.push({
        pitch1Type: pitches[i].pitchType ?? `Pitch${i + 1}`,
        pitch2Type: pitches[j].pitchType ?? `Pitch${j + 1}`,
        separationFt: Math.round(sep * 1000) / 1000,
        tunnelingScore: separationToScore(sep),
      });
    }
  }

  pairs.sort((a, b) => a.separationFt - b.separationFt);

  const avgSeparation =
    pairs.reduce((sum, p) => sum + p.separationFt, 0) / pairs.length;

  return {
    bestTunnel: pairs[0],
    worstTunnel: pairs[pairs.length - 1],
    avgSeparation: Math.round(avgSeparation * 1000) / 1000,
    decisionPoint: DECISION_POINT_T,
    pairs,
  };
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/**
 * Estimate the plate location (x, z) for a pitch.
 * Uses travel time derived from vy0 and a standard ~55 ft release distance.
 * Approximate — does not account for variable release extension.
 */
export function estimatePlateLocation(
  params: PitchParams,
  releaseDist = 55,
): { plateX: number; plateZ: number; travelTime: number } {
  // Solve y(t) = releaseDist: releaseDist = vy0*t + 0.5*ay*t²
  // Rearranged: 0.5*ay*t² + vy0*t - releaseDist = 0
  const { vx0, vz0, ax, ay, az } = params;
  const vy0 = params.vy0;
  const disc = vy0 * vy0 + 2 * ay * releaseDist;
  const travelTime = disc > 0 ? (-vy0 - Math.sqrt(disc)) / ay : releaseDist / Math.abs(vy0);
  const t2 = travelTime * travelTime;
  return {
    plateX: vx0 * travelTime + 0.5 * ax * t2,
    plateZ: vz0 * travelTime + 0.5 * az * t2,
    travelTime,
  };
}
