/**
 * Weather Service
 * Fetches weather data for game locations to enhance betting insights
 */

import { EXTERNAL_APIS, CARD_TYPES, CARD_STATUS } from './constants';

interface WeatherData {
  temperature: number;
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

// Common NFL/MLB stadium locations
const STADIUM_LOCATIONS: Record<string, GameLocation> = {
  // NFL
  'Buffalo Bills': { latitude: 42.7738, longitude: -78.7870, city: 'Buffalo', stadium: 'Highmark Stadium' },
  'Green Bay Packers': { latitude: 44.5013, longitude: -88.0622, city: 'Green Bay', stadium: 'Lambeau Field' },
  'Chicago Bears': { latitude: 41.8623, longitude: -87.6167, city: 'Chicago', stadium: 'Soldier Field' },
  'Denver Broncos': { latitude: 39.7439, longitude: -105.0201, city: 'Denver', stadium: 'Empower Field' },
  // MLB
  'Chicago Cubs': { latitude: 41.9484, longitude: -87.6553, city: 'Chicago', stadium: 'Wrigley Field' },
  'Boston Red Sox': { latitude: 42.3467, longitude: -71.0972, city: 'Boston', stadium: 'Fenway Park' },
  // Add more as needed
};

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
 * Fetch weather data for a location
 */
export async function fetchWeatherForLocation(
  latitude: number,
  longitude: number
): Promise<WeatherData | null> {
  try {
    const url = `${EXTERNAL_APIS.WEATHER.BASE_URL}${EXTERNAL_APIS.WEATHER.FORECAST_ENDPOINT}?latitude=${latitude}&longitude=${longitude}&current=${EXTERNAL_APIS.WEATHER.DEFAULT_PARAMS}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error('[Weather] API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    const current = data.current;
    
    return {
      temperature: Math.round(current.temperature_2m * 9/5 + 32), // Convert to Fahrenheit
      precipitation: current.precipitation || 0,
      windSpeed: Math.round(current.windspeed_10m * 0.621371), // Convert to mph
      weatherCode: current.weathercode,
      condition: getWeatherCondition(current.weathercode)
    };
  } catch (error) {
    console.error('[Weather] Fetch error:', error);
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
  data: {
    location: string;
    matchup: string;
    temperature: string;
    condition: string;
    wind: string;
    precipitation: string;
    gameImpact: string;
    gameTime: string;
  };
  status: string;
  realData: boolean;
}

/**
 * Generate weather card for a game
 */
export async function generateWeatherCard(
  homeTeam: string,
  awayTeam: string,
  gameTime: Date
): Promise<WeatherCard | null> {
  // Try to find stadium location
  const location = STADIUM_LOCATIONS[homeTeam];
  if (!location) {
    console.log('[Weather] No location data for:', homeTeam);
    return null;
  }
  
  const weather = await fetchWeatherForLocation(location.latitude, location.longitude);
  if (!weather) {
    return null;
  }
  
  const impact = getGameImpact(weather);
  const status = getWeatherStatus(weather);
  
  return {
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
}

interface CardData {
  matchup?: string;
  gameTime?: string | Date;
  [key: string]: unknown;
}

interface Card {
  data?: CardData;
  [key: string]: unknown;
}

/**
 * Enhance odds cards with weather data
 */
export async function enrichCardsWithWeather(cards: Card[]): Promise<Card[]> {
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
