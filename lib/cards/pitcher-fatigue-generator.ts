import { CARD_TYPES } from '@/lib/constants';
import type { CardData } from '@/lib/types';

type InsightCard = CardData;

export async function generatePitcherFatigueCards(count: number): Promise<InsightCard[]> {
  const cards: InsightCard[] = [];
  try {
    const { computePitcherFatigue } = await import('@/lib/pitcher-fatigue');
    const { fetchTodaysGames, fetchPlayerGameLog } = await import('@/lib/mlb-projections/mlb-stats-api');

    const games = await fetchTodaysGames().catch(() => []);
    const probablePitchers = games.flatMap(g =>
      [g.probableHomePitcher, g.probableAwayPitcher].filter(
        (p): p is NonNullable<typeof p> => Boolean(p?.id),
      ),
    );

    const fatigueCards = await Promise.all(
      probablePitchers.slice(0, count * 2).map(async pitcher => {
        const logs = await fetchPlayerGameLog(pitcher.id, 'pitching', 5).catch(() => []);
        if (logs.length === 0) return null;
        const lastStart = logs[0];
        const lastStartMs = lastStart.rawDate
          ? new Date(lastStart.rawDate + 'T12:00:00Z').getTime()
          : NaN;
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const last7 = logs.filter(l => {
          const t = l.rawDate ? new Date(l.rawDate + 'T12:00:00Z').getTime() : NaN;
          return Number.isFinite(t) && t >= sevenDaysAgo;
        });
        const pitchCountLastStart = lastStart.numberOfPitches ?? 0;
        const inningsLastStart = parseFloat(String(lastStart.ip ?? '0'));
        const daysRest = Number.isFinite(lastStartMs)
          ? Math.max(0, Math.floor((Date.now() - lastStartMs) / 86_400_000))
          : 4;
        const pitchCountLast7Days = last7.reduce((s, l) => s + (l.numberOfPitches ?? 0), 0);
        if (pitchCountLastStart === 0) return null;
        const result = computePitcherFatigue({
          pitchCountLastStart,
          inningsLastStart,
          daysRest,
          pitchCountLast7Days,
        });
        return {
          type: CARD_TYPES.PITCHER_FATIGUE,
          title: `${pitcher.fullName} — Fatigue Report`,
          icon: 'Wind',
          category: 'MLB',
          subcategory: 'Pitcher Fatigue',
          gradient: 'from-blue-700 to-indigo-900',
          status:
            result.fatigueLabel === 'at-risk'
              ? 'alert'
              : result.fatigueLabel === 'tired'
                ? 'neutral'
                : 'value',
          data: {
            pitcherName: pitcher.fullName,
            fatigueMultiplier: result.fatigueMultiplier,
            fatigueLabel: result.fatigueLabel,
            pitchCountLastStart,
            inningsLastStart,
            daysRest,
            pitchCountLast7Days,
            bettingImpact: result.bettingImpact,
          },
          realData: true,
        } as InsightCard;
      }),
    );

    cards.push(
      ...fatigueCards.filter((c): c is NonNullable<typeof c> => c !== null).slice(0, count),
    );
  } catch (err) {
    console.error('[v0] [PITCHER-FATIGUE] Error:', err instanceof Error ? err.message : String(err));
  }
  return cards;
}
