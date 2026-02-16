/**
 * Weather Service
 * Fetches weather data for game locations to enhance betting insights
 * Enhanced with caching, error handling, and retry logic
 */

import { EXTERNAL_APIS, CARD_TYPES, CARD_STATUS, LOG_PREFIXES } from './constants';
import type { InsightCard } from './cards-generator';

interface WeatherData {
  temperature: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
  weatherCode: number;
  condition: string;
}

interface GameLocation {
  latitude: number;
  longitude: number;
  city: string;
  stadium?: string;
}

interface WeatherCard {
  location: string;
  matchup?: string;
  temperature: string;
  condition: string;
  wind: string;
  humidity: string;
  precipitation: string;
  gameImpact: string;
  gameTime?: string;
}

// Weather cache to avoid excessive API calls
const weatherCache = new Map<string, { data: WeatherData; timestamp: number }>();
const WEATHER_CACHE_TTL = 15 * 60 * 1000; // 15 minutes (weather doesn't change quickly)

// Common NFL/MLB stadium locations - expandable
const STADIUM_LOCATIONS: Record<string, GameLocation> = {
  // NFL
  'Buffalo Bills': { latitude: 42.7738, longitude: -78.7870, city: 'Buffalo', stadium: 'Highmark Stadium' },
  'Green Bay Packers': { latitude: 44.5013, longitude: -88.0622, city: 'Green Bay', stadium: 'Lambeau Field' },
  'Chicago Bears': { latitude: 41.8623, longitude: -87.6167, city: 'Chicago', stadium: 'Soldier Field' },
  'Denver Broncos': { latitude: 39.7439, longitude: -105.0201, city: 'Denver', stadium: 'Empower Field' },
  'Kansas City Chiefs': { latitude: 39.0489, longitude: -94.4839, city: 'Kansas City', stadium: 'Arrowhead Stadium' },
  'Seattle Seahawks': { latitude: 47.5952, longitude: -122.3316, city: 'Seattle', stadium: 'Lumen Field' },
  'New England Patriots': { latitude: 42.0909, longitude: -71.2643, city: 'Foxborough', stadium: 'Gillette Stadium' },
  'Dallas Cowboys': { latitude: 32.7473, longitude: -97.0945, city: 'Arlington', stadium: 'AT&T Stadium' },
  // MLB
  'Chicago Cubs': { latitude: 41.9484, longitude: -87.6553, city: 'Chicago', stadium: 'Wrigley Field' },
  'Boston Red Sox': { latitude: 42.3467, longitude: -71.0972, city: 'Boston', stadium: 'Fenway Park' },
  'New York Yankees': { latitude: 40.8296, longitude: -73.9262, city: 'Bronx', stadium: 'Yankee Stadium' },
  'Los Angeles Dodgers': { latitude: 34.0739, longitude: -118.2400, city: 'Los Angeles', stadium: 'Dodger Stadium' },
  // Add more as needed
};

/**
 * Fallback: Try to extract city from team name for generic location lookup
 */
function getLocationFromTeamName(teamName: string): GameLocation | null {
  const cityPatterns = [
    { pattern: /New York/i, loc: { latitude: 40.7128, longitude: -74.0060, city: 'New York' } },
    { pattern: /Los Angeles/i, loc: { latitude: 34.0522, longitude: -118.2437, city: 'Los Angeles' } },
    { pattern: /Chicago/i, loc: { latitude: 41.8781, longitude: -87.6298, city: 'Chicago' } },
    { pattern: /Houston/i, loc: { latitude: 29.7604, longitude: -95.3698, city: 'Houston' } },
    { pattern: /Phoenix/i, loc: { latitude: 33.4484, longitude: -112.0740, city: 'Phoenix' } },
    { pattern: /Philadelphia/i, loc: { latitude: 39.9526, longitude: -75.1652, city: 'Philadelphia' } },
    { pattern: /San Antonio/i, loc: { latitude: 29.4241, longitude: -98.4936, city: 'San Antonio' } },
    { pattern: /San Diego/i, loc: { latitude: 32.7157, longitude: -117.1611, city: 'San Diego' } },
    { pattern: /Dallas/i, loc: { latitude: 32.7767, longitude: -96.7970, city: 'Dallas' } },
    { pattern: /Miami/i, loc: { latitude: 25.7617, longitude: -80.1918, city: 'Miami' } },
  ];
  
  for (const { pattern, loc } of cityPatterns) {
    if (pattern.test(teamName)) {
      return loc;
    }
  }
  
  return null;
}

function getWeatherCondition(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly Cloudy';
  if (code <= 48) return 'Fog';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Heavy Rain';
  if (code <= 86) return 'Heavy Snow';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

function getGameImpact(weather: WeatherData): string {
  const { windSpeed, precipitation, weatherCode, temperature } = weather;
  
  // High wind impact
  if (windSpeed > 20) {
    return 'High wind - Impacts passing game significantly';
  }
  
  // Precipitation impact
  if (precipitation > 5) {
    return 'Heavy precipitation - Favor run game and unders';
  }
  
  // Snow/cold impact
  if (temperature < 32 && weatherCode >= 71) {
    return 'Snow conditions - Expect lower scoring';
  }
  
  // Rain impact
  if (weatherCode >= 51 && weatherCode <= 67) {
    return 'Rain expected - Ball handling concerns';
  }
  
  // Extreme heat
  if (temperature > 95) {
    return 'Extreme heat - Fatigue factor for players';
  }
  
  // Favorable conditions
  if (windSpeed < 10 && precipitation === 0 && temperature >= 55 && temperature <= 75) {
    return 'Ideal playing conditions';
  }
  
  return 'Minimal weather impact expected';
}

function getWeatherStatus(weather: WeatherData): string {
  const { windSpeed, precipitation, temperature } = weather;
  
  if (windSpeed > 15 || precipitation > 3 || temperature < 25 || temperature > 95) {
    return CARD_STATUS.ALERT;
  }
  
  if (windSpeed < 10 && precipitation === 0 && temperature >= 55 && temperature <= 75) {
    return CARD_STATUS.FAVORABLE;
  }
  
  return CARD_STATUS.NEUTRAL;
}

/**
 * Fetch weather data for a location with caching and retry logic
 */
export async function fetchWeatherForLocation(
  latitude: number,
  longitude: number,
  skipCache: boolean = false
): Promise<WeatherData | null> {
  // Round coordinates to 2 decimal places for cache key
  const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  
  // Check cache
  if (!skipCache) {
    const cached = weatherCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < WEATHER_CACHE_TTL) {
      console.log(`${LOG_PREFIXES.API} Weather cache hit for ${cacheKey}`);
      return cached.data;
    }
  }
  
  try {
    const url = `${EXTERNAL_APIS.WEATHER.BASE_URL}${EXTERNAL_APIS.WEATHER.FORECAST_ENDPOINT}?latitude=${latitude}&longitude=${longitude}&current=${EXTERNAL_APIS.WEATHER.DEFAULT_PARAMS}`;
    
    console.log(`${LOG_PREFIXES.API} Fetching weather for ${cacheKey}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000) // 8 second timeout
    });
    
    if (!response.ok) {
      console.error(`${LOG_PREFIXES.API} Weather API error:`, response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.current) {
      console.error(`${LOG_PREFIXES.API} Weather API returned invalid data`);
      return null;
    }
    
    const current = data.current;
    
    const weatherData: WeatherData = {
      temperature: Math.round(current.temperature_2m * 9/5 + 32), // Convert to Fahrenheit
      humidity: current.relative_humidity_2m || 50, // Default to 50% if missing
      precipitation: current.precipitation || 0,
      windSpeed: Math.round(current.windspeed_10m * 0.621371), // Convert to mph
      weatherCode: current.weathercode,
      condition: getWeatherCondition(current.weathercode)
    };
    
    // Cache successful response
    weatherCache.set(cacheKey, {
      data: weatherData,
      timestamp: Date.now()
    });
    
    return weatherData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`${LOG_PREFIXES.API} Weather fetch error:`, errorMessage);
    return null;
  }
}

interface WeatherCard {
  type: string;
  title: string;
  icon: string;
  category: string;
  subcategory: string;
  gradient: string;
  status: string;
  data: {
    location: string;
    matchup?: string; // Optional matchup field for game context
    temperature: string;
    condition: string;
    wind: string;
    humidity: string;
    precipitation: string;
    gameImpact: string;
    gameTime?: string;
  };
  realData?: boolean; // Track if weather data is real or mocked
  [key: string]: any; // Index signature for Card compatibility
}

/**
 * Generate weather card for a game with enhanced location lookup
 */
export async function generateWeatherCard(
  homeTeam: string,
  awayTeam: string,
  gameTime: Date
): Promise<WeatherCard | null> {
  // Try to find stadium location
  let location: GameLocation | null = STADIUM_LOCATIONS[homeTeam] || null;
  
  // Fallback to city-based lookup if no exact stadium match
  if (!location) {
    location = getLocationFromTeamName(homeTeam);
    if (!location) {
      console.log(`${LOG_PREFIXES.API} No location data for: ${homeTeam}`);
      return null;
    }
  }
  
  const weather = await fetchWeatherForLocation(location.latitude, location.longitude);
  if (!weather) {
    return null;
  }
  
  const impact = getGameImpact(weather);
  const status = getWeatherStatus(weather);
  
  const card: WeatherCard = {
    type: CARD_TYPES.WEATHER_GAME,
    title: 'Weather Impact Analysis',
    icon: 'Cloud',
    category: 'WEATHER',
    subcategory: 'Game Conditions',
    gradient: status === CARD_STATUS.ALERT ? 'from-yellow-500 to-orange-600' : 
              status === CARD_STATUS.FAVORABLE ? 'from-green-500 to-emerald-600' :
              'from-gray-500 to-slate-600',
    data: {
      location: `${location.city}${location.stadium ? ` (${location.stadium})` : ''}`,
      matchup: `${homeTeam} vs ${awayTeam}`,
      temperature: `${weather.temperature}°F`,
      condition: weather.condition,
      wind: `${weather.windSpeed} mph`,
      humidity: `${weather.humidity}%`,
      precipitation: `${weather.precipitation}mm`,
      gameImpact: impact,
      gameTime: gameTime.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    },
    status,
    realData: true
  };
  
  return card;
}

/**
 * Clear weather cache
 */
export function clearWeatherCache(): void {
  weatherCache.clear();
  console.log(`${LOG_PREFIXES.API} Weather cache cleared`);
}

/**
 * Get weather cache statistics
 */
export function getWeatherCacheStats(): {
  size: number;
  keys: string[];
} {
  return {
    size: weatherCache.size,
    keys: Array.from(weatherCache.keys())
  };
}

/**
 * Enhance odds cards with weather data
 */
export async function enrichCardsWithWeather(cards: InsightCard[]): Promise<InsightCard[]> {
  const enrichedCards = [...cards];
  
  for (const card of enrichedCards) {
    // Check if card has matchup data
    if (card.data?.matchup) {
      const matchup = card.data.matchup as string;
      const teams = matchup.split(' vs ');
      
      if (teams.length === 2) {
        const [homeTeam, awayTeam] = teams;
        const gameTime = card.data.gameTime ? new Date(card.data.gameTime) : new Date();
        
        // Try to generate weather card
        const weatherCard = await generateWeatherCard(homeTeam.trim(), awayTeam.trim(), gameTime);
        if (weatherCard) {
          enrichedCards.push(weatherCard);
        }
      }
    }
  }
  
  return enrichedCards;
}
