/**
 * Advanced Weather Analytics Engine
 * 
 * Provides hour-by-hour forecasts, historical impact analysis,
 * and wind direction calculations for betting insights.
 */

import { Stadium, getStadiumByTeam } from './stadium-database';

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
  direction: number; // degrees
  speed: number;
  gust: number;
  favoredEndzone: 'north' | 'south' | 'east' | 'west' | 'none';
  quarterImpact: {
    q1: string;
    q2: string;
    q3: string;
    q4: string;
  };
  passingImpact: 'severe' | 'moderate' | 'minimal';
  kickingImpact: 'severe' | 'moderate' | 'minimal';
}

export interface WeatherImpactHistorical {
  team: string;
  condition: 'rain' | 'snow' | 'wind' | 'cold' | 'heat';
  gamesPlayed: number;
  winPercentage: number;
  avgPointsScored: number;
  avgPointsAllowed: number;
  lastUpdated: Date;
}

/**
 * Fetch hourly forecast for specific game time
 */
export async function getGameTimeForecast(
  team: string,
  gameTime: Date
): Promise<GameTimeForecast | null> {
  try {
    const stadium = getStadiumByTeam(team);
    if (!stadium) {
      console.warn(`[Weather] No stadium found for team: ${team}`);
      return null;
    }

    // Fetch hourly forecast from Open-Meteo
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?` +
      `latitude=${stadium.latitude}&longitude=${stadium.longitude}` +
      `&hourly=temperature_2m,precipitation,precipitation_probability,wind_speed_10m,wind_direction_10m,weather_code` +
      `&timezone=${encodeURIComponent(stadium.timezone)}` +
      `&forecast_days=7`;

    const response = await fetch(forecastUrl);
    if (!response.ok) {
      throw new Error(`Weather API returned ${response.status}`);
    }

    const data = await response.json();
    
    // Find the hour matching game time
    const gameHourIndex = findClosestHourIndex(data.hourly.time, gameTime);
    if (gameHourIndex === -1) {
      return null;
    }

    // Get kickoff, halftime (+2 hours), and final (+3 hours) forecasts
    const kickoff = buildHourlyForecast(data.hourly, gameHourIndex);
    const halftime = buildHourlyForecast(data.hourly, gameHourIndex + 2);
    const final = buildHourlyForecast(data.hourly, gameHourIndex + 3);

    // Analyze trend
    const trend = analyzeTrend(kickoff, halftime, final);
    const impact = calculateWeatherImpact(kickoff, halftime, final);
    const recommendation = generateRecommendation(kickoff, halftime, final, trend);

    return {
      kickoff,
      halftime,
      final,
      trend,
      impact,
      recommendation
    };
  } catch (error) {
    console.error('[Weather] Failed to fetch game time forecast:', error);
    return null;
  }
}

/**
 * Analyze wind direction relative to field orientation
 */
export function analyzeWindDirection(
  stadium: Stadium,
  windDirection: number,
  windSpeed: number
): WindAnalysis {
  // Convert field orientation to degrees
  const fieldOrientation = parseFieldOrientation(stadium.fieldOrientation || 'North-South');
  
  // Calculate wind angle relative to field
  const relativeAngle = (windDirection - fieldOrientation + 360) % 360;
  
  // Determine favored endzone
  let favoredEndzone: WindAnalysis['favoredEndzone'] = 'none';
  if (windSpeed > 10) {
    if (relativeAngle >= 0 && relativeAngle < 45) favoredEndzone = 'north';
    else if (relativeAngle >= 45 && relativeAngle < 135) favoredEndzone = 'east';
    else if (relativeAngle >= 135 && relativeAngle < 225) favoredEndzone = 'south';
    else if (relativeAngle >= 225 && relativeAngle < 315) favoredEndzone = 'west';
    else favoredEndzone = 'north';
  }

  // Calculate impact by quarter (teams switch sides)
  const quarterImpact = {
    q1: `Wind at ${favoredEndzone} endzone`,
    q2: `Wind at ${favoredEndzone} endzone`,
    q3: `Wind advantage switches`,
    q4: `Wind advantage switches`
  };

  // Determine passing and kicking impact
  const passingImpact = windSpeed > 20 ? 'severe' : windSpeed > 12 ? 'moderate' : 'minimal';
  const kickingImpact = windSpeed > 15 ? 'severe' : windSpeed > 10 ? 'moderate' : 'minimal';

  return {
    direction: windDirection,
    speed: windSpeed,
    gust: windSpeed * 1.3, // Estimate gusts at 30% higher
    favoredEndzone,
    quarterImpact,
    passingImpact,
    kickingImpact
  };
}

/**
 * Get historical weather impact for a team
 * Note: This would typically query a database with historical game data
 */
export async function getHistoricalWeatherImpact(
  team: string,
  condition: WeatherImpactHistorical['condition']
): Promise<WeatherImpactHistorical | null> {
  // TODO: Implement database query for historical data
  // For now, return mock data based on known patterns
  
  const mockData: Record<string, Partial<Record<WeatherImpactHistorical['condition'], WeatherImpactHistorical>>> = {
    'Green Bay Packers': {
      cold: {
        team: 'Green Bay Packers',
        condition: 'cold',
        gamesPlayed: 45,
        winPercentage: 0.68,
        avgPointsScored: 24.3,
        avgPointsAllowed: 18.7,
        lastUpdated: new Date()
      },
      snow: {
        team: 'Green Bay Packers',
        condition: 'snow',
        gamesPlayed: 12,
        winPercentage: 0.75,
        avgPointsScored: 21.5,
        avgPointsAllowed: 16.3,
        lastUpdated: new Date()
      }
    },
    'Miami Dolphins': {
      heat: {
        team: 'Miami Dolphins',
        condition: 'heat',
        gamesPlayed: 38,
        winPercentage: 0.63,
        avgPointsScored: 25.1,
        avgPointsAllowed: 20.4,
        lastUpdated: new Date()
      }
    },
    'Buffalo Bills': {
      snow: {
        team: 'Buffalo Bills',
        condition: 'snow',
        gamesPlayed: 18,
        winPercentage: 0.72,
        avgPointsScored: 23.8,
        avgPointsAllowed: 17.2,
        lastUpdated: new Date()
      }
    }
  };

  return mockData[team]?.[condition] || null;
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

function analyzeTrend(
  kickoff: HourlyForecast,
  halftime: HourlyForecast,
  final: HourlyForecast
): 'improving' | 'worsening' | 'stable' {
  // Calculate overall weather score (lower is worse)
  const kickoffScore = 
    kickoff.precipitation + 
    kickoff.windSpeed / 5 + 
    (kickoff.temperature < 32 || kickoff.temperature > 85 ? 10 : 0);
  
  const finalScore = 
    final.precipitation + 
    final.windSpeed / 5 + 
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
    if (kickoff.temperature < 20) {
      return 'Extreme cold - favor teams with cold-weather advantage, expect lower scoring';
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
  
  return 0; // Default to north-south
}
