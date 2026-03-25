/**
 * Re-export shim for backward compatibility.
 * The canonical implementation lives in lib/weather/index.ts.
 */
export {
  fetchWeatherForLocation,
  getGameImpact,
  getGameTimeForecast,
  analyzeWindDirection,
  clearWeatherCache,
  type WeatherData,
  type HourlyForecast,
  type GameTimeForecast,
  type WindAnalysis,
} from './weather/index';

import { fetchWeatherForLocation, getGameImpact } from './weather/index';
import { CARD_TYPES, CARD_STATUS } from '@/lib/constants';

// Mirror of the Stadium interface from weather/index.ts (local use only)
interface StadiumEntry {
  team: string;
  latitude: number;
  longitude: number;
  roofType: 'open' | 'dome' | 'retractable';
}

// Subset of stadiums with reliable GPS coordinates for weather enrichment.
// Covers the teams most likely to appear in live odds cards.
const ENRICHMENT_STADIUMS: StadiumEntry[] = [
  // NFL
  { team: 'green bay packers',   latitude: 44.5013,  longitude: -88.0622,  roofType: 'open' },
  { team: 'kansas city chiefs',  latitude: 39.0489,  longitude: -94.4839,  roofType: 'open' },
  { team: 'buffalo bills',       latitude: 42.7738,  longitude: -78.7870,  roofType: 'open' },
  { team: 'chicago bears',       latitude: 41.8623,  longitude: -87.6167,  roofType: 'open' },
  { team: 'new york giants',     latitude: 40.8136,  longitude: -74.0745,  roofType: 'open' },
  { team: 'new york jets',       latitude: 40.8136,  longitude: -74.0745,  roofType: 'open' },
  { team: 'denver broncos',      latitude: 39.7439,  longitude: -105.0201, roofType: 'open' },
  { team: 'seattle seahawks',    latitude: 47.5952,  longitude: -122.3316, roofType: 'open' },
  { team: 'san francisco 49ers', latitude: 37.4033,  longitude: -121.9694, roofType: 'open' },
  { team: 'new england patriots',latitude: 42.0909,  longitude: -71.2643,  roofType: 'open' },
  { team: 'pittsburgh steelers', latitude: 40.4468,  longitude: -80.0158,  roofType: 'open' },
  { team: 'cleveland browns',    latitude: 41.5061,  longitude: -81.6995,  roofType: 'open' },
  { team: 'baltimore ravens',    latitude: 39.2779,  longitude: -76.6227,  roofType: 'open' },
  { team: 'cincinnati bengals',  latitude: 39.0954,  longitude: -84.5160,  roofType: 'open' },
  { team: 'miami dolphins',      latitude: 25.9580,  longitude: -80.2389,  roofType: 'open' },
  // MLB
  { team: 'chicago cubs',        latitude: 41.9484,  longitude: -87.6554,  roofType: 'open' },
  { team: 'boston red sox',      latitude: 42.3467,  longitude: -71.0972,  roofType: 'open' },
  { team: 'new york yankees',    latitude: 40.8296,  longitude: -73.9262,  roofType: 'open' },
  { team: 'new york mets',       latitude: 40.7571,  longitude: -73.8458,  roofType: 'open' },
  { team: 'san francisco giants',latitude: 37.7786,  longitude: -122.3893, roofType: 'open' },
  { team: 'los angeles dodgers', latitude: 34.0739,  longitude: -118.2400, roofType: 'open' },
  { team: 'pittsburgh pirates',  latitude: 40.4469,  longitude: -80.0057,  roofType: 'open' },
];

function findStadium(teamName: string): StadiumEntry | undefined {
  const normalized = teamName.toLowerCase();
  return ENRICHMENT_STADIUMS.find(
    s => normalized.includes(s.team) || s.team.includes(normalized)
  );
}

/** Extract a team name from a card's data fields. */
function extractTeamFromCard(card: Record<string, unknown>): string | null {
  const data = card.data as Record<string, unknown> | undefined;
  if (!data) return null;

  // Common field names used across card types
  for (const key of ['homeTeam', 'home_team', 'team', 'awayTeam', 'away_team', 'matchup']) {
    const val = data[key];
    if (typeof val === 'string' && val.length > 1) return val;
  }

  // Try the card title as a fallback
  if (typeof card.title === 'string') return card.title;
  return null;
}

/**
 * Enrich a set of cards with live weather data from Open-Meteo.
 *
 * For each outdoor-sport card that references a known team/stadium,
 * we fetch current weather (with a 4 s timeout + 15 min cache) and append
 * a WeatherCard to the output array.  Cards without a matching stadium, and
 * domed/indoor venues, are skipped silently.
 *
 * The function is intentionally non-throwing: a weather fetch failure never
 * causes the caller to lose its original cards.
 */
export async function enrichCardsWithWeather<T>(cards: T[]): Promise<T[]> {
  if (!Array.isArray(cards) || cards.length === 0) return cards;

  const weatherCardsAdded = new Set<string>(); // dedupe by stadium key
  const weatherCards: T[] = [];

  await Promise.all(
    cards.map(async (card) => {
      const c = card as Record<string, unknown>;
      const team = extractTeamFromCard(c);
      if (!team) return;

      const stadium = findStadium(team);
      if (!stadium || stadium.roofType === 'dome') return;

      const stadiumKey = `${stadium.latitude.toFixed(2)},${stadium.longitude.toFixed(2)}`;
      if (weatherCardsAdded.has(stadiumKey)) return;
      weatherCardsAdded.add(stadiumKey);

      try {
        const wx = await Promise.race([
          fetchWeatherForLocation(stadium.latitude, stadium.longitude),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 4000)),
        ]);

        if (!wx) return;

        const impact = getGameImpact(wx);
        const isHighImpact = wx.windSpeed > 15 || wx.precipitation > 3 || wx.temperature < 32;

        const weatherCard = {
          type: CARD_TYPES.WEATHER_GAME,
          title: `Game Weather — ${stadium.team.split(' ').slice(-1)[0]}`,
          category: 'Weather',
          subcategory: 'Current Conditions',
          gradient: 'from-sky-600 to-blue-800',
          status: isHighImpact ? CARD_STATUS.ALERT : CARD_STATUS.NEUTRAL,
          realData: true,
          data: {
            Team:        stadium.team,
            Temperature: `${wx.temperature}°F`,
            Condition:   wx.condition,
            'Wind Speed': `${wx.windSpeed} mph`,
            Humidity:    `${wx.humidity}%`,
            Precipitation: wx.precipitation > 0 ? `${wx.precipitation} mm` : 'None',
            Impact:      impact,
          },
        } as unknown as T;

        weatherCards.push(weatherCard);
      } catch {
        // Silently skip — weather enrichment is best-effort
      }
    })
  );

  return [...cards, ...weatherCards];
}
