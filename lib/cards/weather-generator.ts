import { CARD_TYPES } from '@/lib/constants';
import type { CardData } from '@/lib/types';

type InsightCard = CardData;

export async function generateWeatherCards(count: number): Promise<InsightCard[]> {
  const cards: InsightCard[] = [];
  try {
    const { fetchTodaysGames } = await import('@/lib/mlb-projections/mlb-stats-api');
    const { getGameTimeForecast } = await import('@/lib/weather/index');

    const games = await fetchTodaysGames().catch(() => []);
    const weatherResults = await Promise.allSettled(
      games.slice(0, count * 2).map(async g => {
        const homeTeam = g.homeTeam ?? g.homeTeamAbbr ?? '';
        const gameTime = g.gameDate ? new Date(g.gameDate) : new Date();
        const forecast = await Promise.race([
          getGameTimeForecast(homeTeam, gameTime),
          new Promise<null>(res => setTimeout(() => res(null), 4_000)),
        ]);
        if (!forecast) return null;

        const kf = forecast.kickoff;
        const isHighImpact = forecast.impact === 'high';
        const compassPts = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const compassLabel = compassPts[Math.round(kf.windDirection / 45) % 8];

        return {
          type: CARD_TYPES.WEATHER_GAME,
          title: `${g.awayTeam} @ ${g.homeTeam} — Weather`,
          icon: 'Cloud',
          category: 'WEATHER',
          subcategory: 'Game-Time Forecast',
          gradient: isHighImpact
            ? 'from-amber-600/75 via-orange-900/55 to-slate-900/40'
            : 'from-sky-600/75 via-blue-900/55 to-slate-900/40',
          status: isHighImpact ? 'alert' : 'neutral',
          realData: true,
          data: {
            matchup: `${g.awayTeam} @ ${g.homeTeam}`,
            Temperature: `${Math.round(kf.temperature)}°F`,
            Condition: kf.condition,
            'Wind Speed': `${Math.round(kf.windSpeed)} mph ${compassLabel}`,
            'Rain Chance': `${kf.precipitationProbability}%`,
            Impact: forecast.impact.charAt(0).toUpperCase() + forecast.impact.slice(1),
            Trend: forecast.trend,
            Recommendation: forecast.recommendation,
            realData: true,
          },
        } as InsightCard;
      }),
    );

    const weatherCards = weatherResults
      .map(r => (r.status === 'fulfilled' ? r.value : null))
      .filter((c): c is NonNullable<typeof c> => c !== null);

    if (weatherCards.length > 0) {
      cards.push(...weatherCards.slice(0, count));
      return cards;
    }
  } catch (err) {
    console.error('[v0] [WEATHER] Error:', err instanceof Error ? err.message : String(err));
  }

  // Fallback: no games today or all domed venues
  cards.push({
    type: CARD_TYPES.WEATHER_GAME,
    title: 'No Outdoor Games Today',
    icon: 'Cloud',
    category: 'WEATHER',
    subcategory: 'Game-Time Forecast',
    gradient: 'from-sky-600/75 via-blue-900/55 to-slate-900/40',
    status: 'neutral',
    realData: false,
    data: {
      note: 'No outdoor MLB games scheduled today, or all venues are domed.',
      realData: false,
    },
  } as InsightCard);
  return cards;
}
