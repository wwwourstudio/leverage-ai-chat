/**
 * Unified Weather Service
 * Consolidates weather-service.ts and weather-analytics.ts
 * Provides both basic weather data and advanced analytics
 */

import { EXTERNAL_APIS, CARD_TYPES, CARD_STATUS, LOG_PREFIXES } from '@/lib/constants';
import { Stadium, getStadiumByTeam } from '@/lib/stadium-database';

// ============================================
// Types
// ============================================

export interface WeatherData {
  temperature: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
  weatherCode: number;
  condition: string;
}

export interface HourlyForecast {
  time: string;
  temperature: number;
  precipitation: number;
  precipitationProbability: number;
  windSpeed: number;
  windDirection: number;
  weatherCode: number;
  condition: string;
}

export interface GameTimeForecast {
  kickoff: HourlyForecast;
  halftime: HourlyForecast;
  final: HourlyForecast;
  trend: 'improving' | 'worsening' | 'stable';
  impact: 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface WindAnalysis {
  direction: number;
  speed: number;
  gust: number;
  favoredEndzone: 'north' | 'south' | 'east' | 'west' | 'none';
  passingImpact: 'severe' | 'moderate' | 'minimal';
  kickingImpact: 'severe' | 'moderate' | 'minimal';
}

// ============================================
// Cache Management
// ============================================

const weatherCache = new Map<string, { data: WeatherData; timestamp: number }>();
const WEATHER_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export function clearWeatherCache(): void {
  weatherCache.clear();
  console.log(`${LOG_PREFIXES.API} Weather cache cleared`);
}

// ============================================
// Core Weather Fetching
// ============================================

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

export async function fetchWeatherForLocation(
  latitude: number,
  longitude: number,
  skipCache: boolean = false
): Promise<WeatherData | null> {
  const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  
  if (!skipCache) {
    const cached = weatherCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < WEATHER_CACHE_TTL) {
      return cached.data;
    }
  }
  
  try {
    const url = `${EXTERNAL_APIS.WEATHER.BASE_URL}${EXTERNAL_APIS.WEATHER.FORECAST_ENDPOINT}?latitude=${latitude}&longitude=${longitude}&current=${EXTERNAL_APIS.WEATHER.DEFAULT_PARAMS}`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    if (!data.current) {
      return null;
    }
    
    const current = data.current;
    
    const weatherData: WeatherData = {
      temperature: Math.round(current.temperature_2m * 9/5 + 32),
      humidity: current.relative_humidity_2m || 50,
      precipitation: current.precipitation || 0,
      windSpeed: Math.round(current.windspeed_10m * 0.621371),
      weatherCode: current.weathercode,
      condition: getWeatherCondition(current.weathercode)
    };
    
    weatherCache.set(cacheKey, {
      data: weatherData,
      timestamp: Date.now()
    });
    
    return weatherData;
  } catch (error) {
    console.error(`${LOG_PREFIXES.API} Weather fetch error:`, error);
    return null;
  }
}

// ============================================
// Game Impact Analysis
// ============================================

export function getGameImpact(weather: WeatherData): string {
  const { windSpeed, precipitation, weatherCode, temperature } = weather;
  
  if (windSpeed > 20) {
    return 'High wind - Impacts passing game significantly';
  }
  
  if (precipitation > 5) {
    return 'Heavy precipitation - Favor run game and unders';
  }
  
  if (temperature < 32 && weatherCode >= 71) {
    return 'Snow conditions - Expect lower scoring';
  }
  
  if (weatherCode >= 51 && weatherCode <= 67) {
    return 'Rain expected - Ball handling concerns';
  }
  
  if (temperature > 95) {
    return 'Extreme heat - Fatigue factor for players';
  }
  
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

// ============================================
// Game Time Forecast (Advanced)
// ============================================

export async function getGameTimeForecast(
  team: string,
  gameTime: Date
): Promise<GameTimeForecast | null> {
  try {
    const stadium = getStadiumByTeam(team);
    if (!stadium) {
      return null;
    }

    const forecastUrl = `https://api.open-meteo.com/v1/forecast?` +
      `latitude=${stadium.latitude}&longitude=${stadium.longitude}` +
      `&hourly=temperature_2m,precipitation,precipitation_probability,wind_speed_10m,wind_direction_10m,weather_code` +
      `&timezone=${encodeURIComponent(stadium.timezone)}` +
      `&forecast_days=7`;

    const response = await fetch(forecastUrl);
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    const gameHourIndex = findClosestHourIndex(data.hourly.time, gameTime);
    if (gameHourIndex === -1) {
      return null;
    }

    const kickoff = buildHourlyForecast(data.hourly, gameHourIndex);
    const halftime = buildHourlyForecast(data.hourly, gameHourIndex + 2);
    const final = buildHourlyForecast(data.hourly, gameHourIndex + 3);

    const trend = analyzeTrend(kickoff, halftime, final);
    const impact = calculateWeatherImpact(kickoff, halftime, final);
    const recommendation = generateRecommendation(kickoff, halftime, final, trend);

    return { kickoff, halftime, final, trend, impact, recommendation };
  } catch (error) {
    console.error('[Weather] Game time forecast error:', error);
    return null;
  }
}

// ============================================
// Wind Analysis
// ============================================

export function analyzeWindDirection(
  stadium: Stadium,
  windDirection: number,
  windSpeed: number
): WindAnalysis {
  const fieldOrientation = parseFieldOrientation(stadium.fieldOrientation || 'North-South');
  const relativeAngle = (windDirection - fieldOrientation + 360) % 360;
  
  let favoredEndzone: WindAnalysis['favoredEndzone'] = 'none';
  if (windSpeed > 10) {
    if (relativeAngle >= 0 && relativeAngle < 45) favoredEndzone = 'north';
    else if (relativeAngle >= 45 && relativeAngle < 135) favoredEndzone = 'east';
    else if (relativeAngle >= 135 && relativeAngle < 225) favoredEndzone = 'south';
    else if (relativeAngle >= 225 && relativeAngle < 315) favoredEndzone = 'west';
    else favoredEndzone = 'north';
  }

  const passingImpact = windSpeed > 20 ? 'severe' : windSpeed > 12 ? 'moderate' : 'minimal';
  const kickingImpact = windSpeed > 15 ? 'severe' : windSpeed > 10 ? 'moderate' : 'minimal';

  return {
    direction: windDirection,
    speed: windSpeed,
    gust: windSpeed * 1.3,
    favoredEndzone,
    passingImpact,
    kickingImpact
  };
}

// ============================================
// Helper Functions
// ============================================

function findClosestHourIndex(times: string[], targetTime: Date): number {
  const targetTimestamp = targetTime.getTime();
  let closestIndex = -1;
  let minDiff = Infinity;

  times.forEach((time, index) => {
    const timeTimestamp = new Date(time).getTime();
    const diff = Math.abs(timeTimestamp - targetTimestamp);
    
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = index;
    }
  });

  return closestIndex;
}

function buildHourlyForecast(hourlyData: any, index: number): HourlyForecast {
  return {
    time: hourlyData.time[index],
    temperature: hourlyData.temperature_2m[index],
    precipitation: hourlyData.precipitation[index] || 0,
    precipitationProbability: hourlyData.precipitation_probability[index] || 0,
    windSpeed: hourlyData.wind_speed_10m[index],
    windDirection: hourlyData.wind_direction_10m[index],
    weatherCode: hourlyData.weather_code[index],
    condition: getWeatherCondition(hourlyData.weather_code[index])
  };
}

function analyzeTrend(
  kickoff: HourlyForecast,
  halftime: HourlyForecast,
  final: HourlyForecast
): 'improving' | 'worsening' | 'stable' {
  const kickoffScore = kickoff.precipitation + kickoff.windSpeed / 5 + 
    (kickoff.temperature < 32 || kickoff.temperature > 85 ? 10 : 0);
  
  const finalScore = final.precipitation + final.windSpeed / 5 + 
    (final.temperature < 32 || final.temperature > 85 ? 10 : 0);

  const diff = finalScore - kickoffScore;

  if (diff > 3) return 'worsening';
  if (diff < -3) return 'improving';
  return 'stable';
}

function calculateWeatherImpact(
  kickoff: HourlyForecast,
  halftime: HourlyForecast,
  final: HourlyForecast
): 'high' | 'medium' | 'low' {
  const avgWindSpeed = (kickoff.windSpeed + halftime.windSpeed + final.windSpeed) / 3;
  const avgPrecipitation = (kickoff.precipitation + halftime.precipitation + final.precipitation) / 3;
  const avgTemp = (kickoff.temperature + halftime.temperature + final.temperature) / 3;

  if (avgWindSpeed > 20 || avgPrecipitation > 5 || avgTemp < 20 || avgTemp > 95) {
    return 'high';
  }

  if (avgWindSpeed > 12 || avgPrecipitation > 2 || avgTemp < 32 || avgTemp > 85) {
    return 'medium';
  }

  return 'low';
}

function generateRecommendation(
  kickoff: HourlyForecast,
  halftime: HourlyForecast,
  final: HourlyForecast,
  trend: string
): string {
  const impact = calculateWeatherImpact(kickoff, halftime, final);

  if (impact === 'high') {
    if (kickoff.windSpeed > 20) {
      return 'High wind expected - strongly favor run-heavy offenses and under bets';
    }
    if (kickoff.precipitation > 5) {
      return 'Heavy precipitation - favor ground game, consider under on totals';
    }
    return 'Severe weather conditions expected - significant game impact likely';
  }

  if (impact === 'medium') {
    if (trend === 'worsening') {
      return 'Conditions deteriorating during game - may favor team that scores early';
    }
    if (trend === 'improving') {
      return 'Conditions improving during game - later quarters may see more scoring';
    }
    return 'Moderate weather impact - consider home field advantage';
  }

  return 'Minimal weather impact expected - focus on team matchups and trends';
}

function parseFieldOrientation(orientation: string): number {
  const normalized = orientation.toLowerCase();
  
  if (normalized.includes('north-south') || normalized.includes('n-s')) return 0;
  if (normalized.includes('northeast-southwest') || normalized.includes('ne-sw')) return 45;
  if (normalized.includes('east-west') || normalized.includes('e-w')) return 90;
  if (normalized.includes('southeast-northwest') || normalized.includes('se-nw')) return 135;
  
  return 0;
}
