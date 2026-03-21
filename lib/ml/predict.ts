/**
 * ML prediction interface — TensorFlow.js HR probability model.
 *
 * The model is loaded once at module init (lazy singleton) and reused across
 * calls.  In production this runs in a long-lived Node.js serverless function
 * (60s timeout on /api/analyze) with the model file stored in /public/models/hr/.
 *
 * Training data shape: 8 features per player-game row
 *   [barrel_rate, hard_hit_rate, hr9_vs_hand, park_factor, weather_factor,
 *    matchup_factor, batter_platoon_score, pitcher_platoon_score]
 *
 * Output: sigmoid scalar ∈ (0, 1) representing P(HR | game)
 *
 * Callers must clamp the output — this function returns the raw sigmoid,
 * which is already in [0,1] but callers should apply clamp01() defensively.
 */

// Lazy singleton — loaded on first call, not at import time.
// Using a dynamic require pattern so tfjs-node doesn't block the module graph
// in environments where it isn't installed (tests, edge runtime).
let _model: { predict: (x: number[][]) => Promise<number> } | null = null;

async function getModel() {
  if (_model) return _model;

  // Dynamic import so tfjs-node is never bundled into edge/client chunks
  const tf = await import('@tensorflow/tfjs-node').catch(() => null);

  if (!tf) {
    throw new Error('tfjs-node not available in this runtime');
  }

  const modelPath =
    process.env.HR_MODEL_PATH ?? 'file://./public/models/hr/model.json';

  const loaded = await tf.loadLayersModel(modelPath);

  _model = {
    predict: async (features: number[][]): Promise<number> => {
      const input  = tf.tensor2d(features, [features.length, features[0].length]);
      const output = loaded.predict(input) as ReturnType<typeof tf.tensor2d>;
      const data   = await output.data();
      input.dispose();
      output.dispose();
      return data[0];
    },
  };

  return _model;
}

/**
 * Run the trained HR probability model on a single feature vector.
 *
 * @param features  8-element array:
 *   [barrel_rate, hard_hit_rate, hr9_vs_hand, park_factor, weather_factor,
 *    matchup_factor, batter_platoon_score, pitcher_platoon_score]
 * @returns sigmoid probability ∈ (0, 1)
 * @throws  if model cannot be loaded (caller should catch and fall back to rule-based)
 */
export async function predictHRFromFeatures(features: number[]): Promise<number> {
  const model = await getModel();
  return model.predict([features]);
}

/** Reset the model singleton (useful for tests or model hot-swap). */
export function resetModelCache(): void {
  _model = null;
}
