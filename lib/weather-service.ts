/**
 * Re-export shim for backward compatibility.
 * The canonical implementation lives in lib/weather/index.ts.
 *
 * The cards-generator dynamically imports `enrichCardsWithWeather` which
 * doesn't exist in the new weather module. We export a safe no-op here
 * so the dynamic import resolves without throwing.
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

/**
 * Stub for legacy callers that expect `enrichCardsWithWeather`.
 * Returns cards unmodified when weather enrichment is not available.
 */
export async function enrichCardsWithWeather<T>(cards: T[]): Promise<T[]> {
  return cards;
}
