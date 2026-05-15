/**
 * Post-streaming processing for the /api/analyze pipeline.
 *
 * Handles tool-result extraction, card assembly, and Statcast JSON parsing
 * after the AI streaming phase completes.
 */

import type { StatcastPlayer } from '@/lib/baseball-savant';
import type { InsightCard } from '@/lib/cards-generator';
import { NFBC_DRAFT_YEAR } from '@/lib/constants';
import type { AnalyzeContext, ToolResultsOutput, SportDetectionResult } from './types';

// ── Card types produced by MLB_ANALYSIS_ADDENDUM JSON output ─────────────────
export const STATCAST_CARD_TYPES = new Set([
  'statcast_summary_card', 'hr_prop_card', 'game_simulation_card',
  'leaderboard_card', 'pitch_analysis_card',
]);

/**
 * Parse tool results after streaming completes and build pending cards.
 *
 * @param allToolResults  Resolved tool result objects from the stream
 * @param allToolCalls    Tool call objects from the stream (for call args)
 * @param detection       Sport/intent detection result
 * @param context         Request context
 */
export function extractToolResults(
  allToolResults: any[],
  allToolCalls: any[],
  detection: SportDetectionResult,
  context: AnalyzeContext,
): ToolResultsOutput {
  const {
    hasADPIntent,
    hasHRPredictionIntent,
    expectsStatcastJSON,
  } = detection;

  let pendingADPCard: InsightCard | null = null;
  let pendingADPUploadCard: InsightCard | null = null;
  let pendingStatcastCard: InsightCard | null = null;
  let pendingHRPredictionCard: InsightCard | null = null;
  let skipStatcastJSON = false;

  // ── ADP tool results ──────────────────────────────────────────────────────
  if (hasADPIntent) {
    const adpResult = allToolResults.find((tr: any) => tr.toolName === 'query_adp');
    if (adpResult?.result?.players?.length > 0) {
      const tr = adpResult.result;
      const callArgs = allToolCalls.find((tc: any) => tc.toolName === 'query_adp')?.args ?? {};
      const adpSource = tr.source ?? `NFBC ${NFBC_DRAFT_YEAR} ADP`;
      const isNFLResult = adpSource.includes('NFFC') || adpSource.includes('NFL');
      const adpBrand = isNFLResult ? 'NFFC' : 'NFBC';
      let cardTitle = isNFLResult
        ? `NFFC ${NFBC_DRAFT_YEAR} NFL ADP Rankings`
        : `NFBC ${NFBC_DRAFT_YEAR} ADP Rankings`;
      if (callArgs.player) {
        const name = tr.players[0]?.displayName ?? callArgs.player;
        cardTitle = `${name} — ${adpBrand} ADP`;
      } else if (callArgs.position) {
        const rankSuffix = callArgs.rankMax ? ` (Top ${callArgs.rankMax})` : '';
        cardTitle = `Top ${callArgs.position}${rankSuffix} — ${adpBrand} ADP Board`;
      } else if (callArgs.rankMin != null || callArgs.rankMax != null) {
        const lo = callArgs.rankMin ?? 1;
        const hi = callArgs.rankMax ?? tr.total_players_in_dataset;
        cardTitle = `${adpBrand} ADP Picks #${lo}–${hi}`;
      }
      pendingADPCard = {
        type: 'adp-analysis',
        title: cardTitle,
        category: isNFLResult ? 'NFL' : 'MLB',
        subcategory: isNFLResult ? 'NFFC Draft Board' : 'NFBC Draft Board',
        gradient: isNFLResult
          ? 'from-green-600/80 via-emerald-700/60 to-green-900/40'
          : 'from-cyan-600/80 via-teal-700/60 to-cyan-900/40',
        status: 'value',
        realData: !tr.is_static_fallback,
        icon: isNFLResult ? '🏈' : '⚾',
        data: {
          players: JSON.stringify(tr.players),
          source: adpSource,
          totalInDataset: tr.total_players_in_dataset,
        },
      } as unknown as InsightCard;

      if (tr.is_static_fallback) {
        pendingADPUploadCard = {
          type: 'adp-upload',
          title: isNFLResult ? 'Upload NFFC Football ADP' : 'Upload NFBC Baseball ADP',
          icon: isNFLResult ? '🏈' : '⚾',
          category: isNFLResult ? 'NFL' : 'MLB',
          subcategory: isNFLResult ? 'NFFC ADP Upload' : 'NFBC ADP Upload',
          gradient: 'from-violet-600/80 via-purple-700/60 to-violet-900/40',
          status: 'pending',
          realData: false,
          data: { sport: isNFLResult ? 'nfl' : 'mlb' },
        } as unknown as InsightCard;
      }
    }
  }

  // ── HR Prediction tool results ─────────────────────────────────────────────
  if (hasHRPredictionIntent) {
    const hrResult = allToolResults.find((tr: any) => tr.toolName === 'predict_hr');
    if (hrResult?.result) {
      const hr = hrResult.result;
      pendingHRPredictionCard = {
        type:       'hr_prediction_card',
        title:      `${hr.player ?? 'Player'} — HR Prediction`,
        icon:       '💣',
        category:   'MLB',
        subcategory: 'HR Prop · v3 Engine',
        gradient:   'from-rose-600/20 via-red-900/15 to-slate-900/40',
        status:     hr.success ? 'edge' : 'neutral',
        realData:   true,
        data:       hr,
      } as unknown as InsightCard;
      console.log('[API/analyze] HR prediction card built for:', hr.player);
    } else {
      pendingHRPredictionCard = {
        type:       'hr_prediction_card',
        title:      'HR Prediction',
        icon:       '💣',
        category:   'MLB',
        subcategory: 'HR Prop · v3 Engine',
        gradient:   'from-rose-600/20 via-red-900/15 to-slate-900/40',
        status:     'neutral',
        realData:   false,
        data:       {
          success: false,
          error:   'Live MLB data unavailable — prediction could not be generated.',
          player:  'Unknown',
          type:    'hr_prediction_card',
        },
      } as unknown as InsightCard;
      console.warn('[API/analyze] HR prediction tool did not fire — emitting degraded card');
    }
  }

  // ── Statcast tool results ──────────────────────────────────────────────────
  if (expectsStatcastJSON) {
    const statcastResult = allToolResults.find((tr: any) => tr.toolName === 'query_statcast');
    if (statcastResult) {
      const srPlayers: StatcastPlayer[] = statcastResult.result?.players ?? [];
      if (srPlayers.length === 0) {
        skipStatcastJSON = true;
        console.warn('[API/analyze] Statcast tool returned no players — skipping JSON card mode');
      } else {
        const srSource: string = statcastResult.result?.source ?? 'Baseball Savant';
        if (srPlayers.length <= 3) {
          const p = srPlayers[0];
          const fmt = (n: number | undefined, decimals = 1) =>
            n != null ? n.toFixed(decimals) : 'N/A';
          const fmtAvg = (n: number | undefined) =>
            n != null ? n.toFixed(3).replace(/^0/, '') : 'N/A';
          pendingStatcastCard = {
            type: 'statcast_summary_card',
            title: `${p.name} — Statcast Profile`,
            category: 'MLB',
            subcategory: p.playerType === 'pitcher' ? 'Pitcher Metrics' : 'Contact Quality',
            gradient: 'from-indigo-600/80 via-violet-700/60 to-indigo-900/40',
            status: 'edge',
            icon: '⚾',
            realData: srSource.includes('real data'),
            summary_metrics: p.playerType === 'pitcher'
              ? [
                  { label: 'xwOBA Against', value: fmtAvg(p.xwoba) },
                  { label: 'Barrel % Against', value: `${fmt(p.barrelRate)}%` },
                  { label: 'Hard Hit % Against', value: `${fmt(p.hardHitPct)}%` },
                  { label: 'Exit Velo Against', value: `${fmt(p.exitVelocity)} mph` },
                  { label: 'Sweet Spot % Against', value: `${fmt(p.sweetSpotPct)}%` },
                ]
              : [
                  { label: 'xBA', value: fmtAvg(p.xba) },
                  { label: 'xwOBA', value: fmtAvg(p.xwoba) },
                  { label: 'Sweet Spot %', value: `${fmt(p.sweetSpotPct)}%` },
                  { label: 'Hard Hit %', value: `${fmt(p.hardHitPct)}%` },
                  { label: 'Barrel %', value: `${fmt(p.barrelRate)}%` },
                ],
            last_updated: srSource,
            data: { source: srSource },
          } as unknown as InsightCard;
        }
      }
    }
  }

  return {
    pendingADPCard,
    pendingADPUploadCard,
    pendingStatcastCard,
    pendingHRPredictionCard,
    skipStatcastJSON,
  };
}

/**
 * Parse a Statcast JSON card from AI response text.
 * Returns null if no valid Statcast card JSON is found.
 */
export function parseStatcastCardFromText(
  aiText: string,
  statcastCardTypes: Set<string>,
): Record<string, unknown> | null {
  const tryParseStatcastCard = (src: string): Record<string, unknown> | null => {
    try {
      const p = JSON.parse(src) as Record<string, unknown>;
      if (
        p !== null &&
        typeof p === 'object' &&
        typeof p.type === 'string' &&
        statcastCardTypes.has(p.type) &&
        typeof p.title === 'string' &&
        Array.isArray(p.summary_metrics)
      ) {
        return p;
      }
    } catch {
      // not valid JSON — try next candidate
    }
    return null;
  };

  const jsonCandidates: string[] = [];
  const codeFenceMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeFenceMatch) jsonCandidates.push(codeFenceMatch[1].trim());
  for (const m of aiText.matchAll(/\{[\s\S]*?\}/g)) jsonCandidates.push(m[0]);
  const fullSpanMatch = aiText.match(/\{[\s\S]*\}/);
  if (fullSpanMatch) jsonCandidates.push(fullSpanMatch[0]);

  for (const candidate of jsonCandidates) {
    const parsed = tryParseStatcastCard(candidate);
    if (parsed) return parsed;
  }
  return null;
}

/**
 * Assemble the final card array from resolved cards plus pending tool cards.
 */
export function assembleFinalCards(
  resolvedCards: InsightCard[],
  toolOutput: ToolResultsOutput,
  aiText: string,
  detection: SportDetectionResult,
  context: AnalyzeContext,
  noLiveGamesDetected: boolean,
  usedFallback: boolean,
  safeEnqueue: (chunk: Uint8Array) => void,
  sseChunk: (data: object) => Uint8Array,
  logger: any,
  LogCategory: any,
): { cards: InsightCard[]; aiText: string } {
  const { isMLBQuery, isAmbiguous, expectsStatcastJSON } = detection;
  const {
    pendingADPCard,
    pendingADPUploadCard,
    pendingStatcastCard,
    pendingHRPredictionCard,
    skipStatcastJSON,
  } = toolOutput;

  let cards: InsightCard[] = resolvedCards;
  let finalAiText = aiText;

  // ── Prepend pending tool cards ─────────────────────────────────────────────
  if (pendingHRPredictionCard) cards = [pendingHRPredictionCard, ...cards.slice(0, 4)];
  if (pendingADPCard) {
    if (context.hasPlayerIntent) {
      cards = [cards[0], pendingADPCard, ...cards.slice(1, 5)].filter(Boolean) as InsightCard[];
    } else {
      cards = [pendingADPCard, ...cards.slice(0, 5)];
    }
  }
  if (pendingADPUploadCard) cards = [...cards, pendingADPUploadCard];

  // ── MLB Statcast: parse Grok's JSON response into a card ───────────────────
  if (isMLBQuery && !usedFallback && !skipStatcastJSON) {
    const parsedStatcast = parseStatcastCardFromText(finalAiText, STATCAST_CARD_TYPES);
    if (parsedStatcast) {
      const statcastCard: InsightCard = { icon: '⚾', ...parsedStatcast } as InsightCard;
      cards = [statcastCard, ...cards.slice(0, 5)];
      const metricLines = ((parsedStatcast.summary_metrics as { label: string; value: string }[] | undefined) ?? [])
        .slice(0, 3)
        .map((m: { label: string; value: string }) => `**${m.label}:** ${m.value}`)
        .join(' · ');
      const cleanText = [
        `**${parsedStatcast.title}** — MLB Statcast Analysis`,
        metricLines,
        'See the card below for the full breakdown and splits.',
      ].filter(Boolean).join('\n');
      finalAiText = cleanText;
      safeEnqueue(sseChunk({ type: 'replace', text: cleanText }));
    } else if (expectsStatcastJSON) {
      const preview = finalAiText.slice(0, 120).replace(/\n/g, ' ');
      logger.warn(LogCategory.API, '[API/analyze] MLB Statcast JSON not found in response — prose fallback', {
        metadata: { previewChars: preview, responseLength: finalAiText.length, hasCodeFence: finalAiText.includes('```'), hasBrace: finalAiText.includes('{') },
      });
    }
  }

  // ── Statcast fallback card ─────────────────────────────────────────────────
  if (pendingStatcastCard) {
    if (!STATCAST_CARD_TYPES.has(cards[0]?.type as string)) {
      cards = [pendingStatcastCard, ...cards.slice(0, 5)];
      console.log('[API/analyze] Injected Statcast fallback card:', pendingStatcastCard.title);
    }
  }

  // ── Fallback bullet-point cards ────────────────────────────────────────────
  if (cards.length === 0 && !isAmbiguous && !usedFallback && context.sport) {
    const bullets = (finalAiText.match(/^[-•]\s+(.+)$/gm) ?? []).slice(0, 3);
    if (bullets.length > 0) {
      const sportGradients: Record<string, string> = {
        nba: 'from-orange-600/20 to-orange-900/10',
        nfl: 'from-blue-600/20 to-blue-900/10',
        mlb: 'from-red-600/20 to-red-900/10',
        nhl: 'from-cyan-600/20 to-cyan-900/10',
        ncaab: 'from-indigo-600/20 to-indigo-900/10',
        ncaaf: 'from-yellow-600/20 to-yellow-900/10',
      };
      const sport = context.sport.toLowerCase();
      cards = bullets.map(b => ({
        type: 'betting-insight',
        title: `${sport.toUpperCase()} Analysis`,
        category: sport,
        subcategory: 'AI Analysis',
        gradient: sportGradients[sport] ?? 'from-blue-600/20 to-purple-900/10',
        data: { insight: b.replace(/^[-•]\s+/, ''), source: 'Grok 4' },
        status: 'neutral',
        realData: false,
      } as InsightCard));
    }
  }

  // ── Strip placeholder cards when no live data ──────────────────────────────
  const finalCards = noLiveGamesDetected
    ? cards.filter((c: InsightCard) => c.data?.realData !== false && c.metadata?.realData !== false)
    : cards;

  return { cards: finalCards, aiText: finalAiText };
}
