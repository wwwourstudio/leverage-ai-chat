/**
 * Unified Weather Service
 * Consolidates weather-service.ts and weather-analytics.ts
 * Provides both basic weather data and advanced analytics
 */

import { EXTERNAL_APIS, CARD_TYPES, CARD_STATUS, LOG_PREFIXES } from '@/lib/constants';

// Minimal stadium data inlined (lib/stadium-database was removed in refactor)
interface Stadium {
  team: string;
  latitude: number;
  longitude: number;
  timezone: string;
  roofType: 'open' | 'dome' | 'retractable';
  fieldOrientation?: string;
}

const STADIUM_DATABASE: Stadium[] = [
  { team: 'Green Bay Packers', latitude: 44.5013, longitude: -88.0622, timezone: 'America/Chicago', roofType: 'open' },
  { team: 'Kansas City Chiefs', latitude: 39.0489, longitude: -94.4839, timezone: 'America/Chicago', roofType: 'open' },
  { team: 'Buffalo Bills', latitude: 42.7738, longitude: -78.7870, timezone: 'America/New_York', roofType: 'open' },
  { team: 'Chicago Bears', latitude: 41.8623, longitude: -87.6167, timezone: 'America/Chicago', roofType: 'open' },
  { team: 'New York Giants', latitude: 40.8136, longitude: -74.0745, timezone: 'America/New_York', roofType: 'open' },
  { team: 'New York Jets', latitude: 40.8136, longitude: -74.0745, timezone: 'America/New_York', roofType: 'open' },
  { team: 'Denver Broncos', latitude: 39.7439, longitude: -105.0201, timezone: 'America/Denver', roofType: 'open' },
  { team: 'Seattle Seahawks', latitude: 47.5952, longitude: -122.3316, timezone: 'America/Los_Angeles', roofType: 'open' },
  { team: 'San Francisco 49ers', latitude: 37.4033, longitude: -121.9694, timezone: 'America/Los_Angeles', roofType: 'open' },
  { team: 'New England Patriots', latitude: 42.0909, longitude: -71.2643, timezone: 'America/New_York', roofType: 'open' },
  { team: 'Pittsburgh Steelers', latitude: 40.4468, longitude: -80.0158, timezone: 'America/New_York', roofType: 'open' },
  { team: 'Cleveland Browns', latitude: 41.5061, longitude: -81.6995, timezone: 'America/New_York', roofType: 'open' },
  { team: 'Baltimore Ravens', latitude: 39.2779, longitude: -76.6227, timezone: 'America/New_York', roofType: 'open' },
  { team: 'Cincinnati Bengals', latitude: 39.0954, longitude: -84.5160, timezone: 'America/New_York', roofType: 'open' },
  { team: 'Miami Dolphins', latitude: 25.9580, longitude: -80.2389, timezone: 'America/New_York', roofType: 'open' },
  { team: 'Los Angeles Rams', latitude: 33.9535, longitude: -118.3392, timezone: 'America/Los_Angeles', roofType: 'dome' },
  { team: 'Los Angeles Chargers', latitude: 33.9535, longitude: -118.3392, timezone: 'America/Los_Angeles', roofType: 'dome' },
  // MLB outdoor stadiums
  { team: 'Chicago Cubs', latitude: 41.9484, longitude: -87.6554, timezone: 'America/Chicago', roofType: 'open' },
  { team: 'Boston Red Sox', latitude: 42.3467, longitude: -71.0972, timezone: 'America/New_York', roofType: 'open' },
  { team: 'New York Yankees', latitude: 40.8296, longitude: -73.9262, timezone: 'America/New_York', roofType: 'open' },
  { team: 'New York Mets', latitude: 40.7571, longitude: -73.8458, timezone: 'America/New_York', roofType: 'open' },
  { team: 'San Francisco Giants', latitude: 37.7786, longitude: -122.3893, timezone: 'America/Los_Angeles', roofType: 'open' },
  { team: 'Los Angeles Dodgers', latitude: 34.0739, longitude: -118.2400, timezone: 'America/Los_Angeles', roofType: 'open' },
  { team: 'Pittsburgh Pirates', latitude: 40.4469, longitude: -80.0057, timezone: 'America/New_York', roofType: 'open' },
];

function getStadiumByTeam(teamName: string): Stadium | undefined {
  const normalized = teamName.toLowerCase();
  return STADIUM_DATABASE.find(stadium =>
    stadium.team.toLowerCase().includes(normalized) ||
    normalized.includes(stadium.team.toLowerCase())
  );
}

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
      signal: AbortSignal.timeout(6000)
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
    // Timeouts are expected under load — callers have neutral-weather fallbacks,
    // so don't spam the logs. Surface non-timeout errors at warn level.
    const isTimeout =
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError');
    if (!isTimeout) {
      console.warn(`${LOG_PREFIXES.API} Weather fetch error:`, error instanceof Error ? error.message : error);
    }
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

    const response = await fetch(forecastUrl, { signal: AbortSignal.timeout(8_000) });
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

// ============================================================================
// MLB WEATHER HR FACTOR
//
// Wind + temperature affect HR rates significantly:
//   • Warm air is less dense → ball carries further (+10% at 95°F vs 60°F)
//   • Wind blowing out → major HR boost (Wrigley out to CF is notorious)
//   • Wind blowing in → strong suppressor
//   • Domes → neutral (factor = 1.0)
//
// Stadium orientation (outfield bearing = compass direction centerfield faces)
// determines whether a wind blows out, across, or in.
// Source: surveyed from Google Earth / Statcast geodata.
// ============================================================================

/** Outfield bearing = compass direction the CF fence faces, relative to home plate */
const MLB_OUTFIELD_BEARINGS: Record<string, number> = {
  // Team name → degrees (0 = N, 90 = E, 180 = S, 270 = W)
  'Chicago Cubs':          315,  // Wrigley: CF faces NW
  'Boston Red Sox':        305,  // Fenway: CF faces WNW
  'New York Yankees':      225,  // Yankee Stadium: CF faces SW
  'New York Mets':         200,  // Citi Field: CF faces SSW
  'San Francisco Giants':  290,  // Oracle: CF faces WNW — strong SF wind
  'Los Angeles Dodgers':   180,  // Dodger Stadium: CF faces S
  'Chicago White Sox':     225,  // Guaranteed Rate: CF faces SW
  'Pittsburgh Pirates':    200,  // PNC Park: CF faces SSW
  'Baltimore Orioles':     260,  // Camden Yards: CF faces W
  'Cleveland Guardians':   240,  // Progressive: CF faces WSW
  'Detroit Tigers':        220,  // Comerica: CF faces SW
  'Minnesota Twins':       260,  // Target Field: CF faces W
  'Kansas City Royals':    240,  // Kauffman: CF faces WSW
  'Texas Rangers':         200,  // Globe Life: CF faces SSW
  'Houston Astros':          0,  // Minute Maid: retractable dome → ignored
  'Seattle Mariners':        0,  // T-Mobile: retractable dome → ignored
  'Arizona Diamondbacks':    0,  // Chase: retractable dome → ignored
  'Toronto Blue Jays':       0,  // Rogers Centre: dome → ignored
  'Miami Marlins':           0,  // LoanDepot: dome → ignored
  'Tampa Bay Rays':          0,  // Tropicana: dome → ignored
  'Milwaukee Brewers':       0,  // American Family: retractable → ignored
  'Atlanta Braves':        210,  // Truist Park: CF faces SSW
  'Washington Nationals':  240,  // Nationals Park: CF faces WSW
  'Philadelphia Phillies': 250,  // Citizens Bank: CF faces W
  'Cincinnati Reds':       220,  // Great American: CF faces SW
  'St. Louis Cardinals':   210,  // Busch Stadium: CF faces SSW
  'Colorado Rockies':      210,  // Coors Field: CF faces SSW — high altitude
  'Oakland Athletics':     270,  // Oakland Coliseum: CF faces W
  'Los Angeles Angels':    220,  // Angel Stadium: CF faces SW
  'San Diego Padres':      215,  // Petco Park: CF faces SSW
};

/** Whether the home team plays in a dome (weather irrelevant) */
const MLB_DOME_TEAMS = new Set([
  'Houston Astros', 'Seattle Mariners', 'Arizona Diamondbacks',
  'Toronto Blue Jays', 'Miami Marlins', 'Tampa Bay Rays', 'Milwaukee Brewers',
]);

/**
 * Input context for the HR weather factor calculation.
 * Use `fetchWeatherForLocation()` to get temp + wind, and the home team name
 * to look up stadium orientation automatically.
 */
export interface WeatherHRContext {
  /** Air temperature in Fahrenheit */
  temp: number;
  /** Wind speed in mph */
  windSpeed: number;
  /** Wind direction in meteorological degrees (0=N, 90=E, 180=S, 270=W)
   *  This is the direction the wind is COMING FROM. */
  windDeg: number;
  /** Home team name — used to look up stadium orientation.
   *  If omitted, wind direction adjustment is skipped. */
  homeTeam?: string;
}

/**
 * Compute a park + weather HR multiplier for use in the HR probability model.
 *
 * Factor interpretation:
 *   1.0 = neutral (league-average conditions)
 *   > 1.0 = conditions favour home runs (warm, wind out)
 *   < 1.0 = conditions suppress home runs (cold, wind in, dome)
 *
 * Clamped to [0.70, 1.40] — beyond that range we'd be extrapolating.
 *
 * @example
 * // Wrigley, 88°F, 14 mph blowing out to CF
 * weatherHRFactor({ temp: 88, windSpeed: 14, windDeg: 135, homeTeam: 'Chicago Cubs' })
 * // → ~1.28 (warm + strong out wind at a wind-friendly park)
 */
export function weatherHRFactor(ctx: WeatherHRContext): number {
  const { temp, windSpeed, windDeg, homeTeam } = ctx;

  // Dome parks: weather has no effect
  if (homeTeam && MLB_DOME_TEAMS.has(homeTeam)) return 1.0;

  let factor = 1.0;

  // ── Temperature adjustment ────────────────────────────────────────────────
  // Air density decreases with temperature → ball carries further in warm air.
  // Approximate: ~0.5% carry difference per °F relative to 72°F baseline.
  if (temp >= 95)       factor += 0.12;
  else if (temp >= 85)  factor += 0.08;
  else if (temp >= 75)  factor += 0.04;
  else if (temp <= 40)  factor -= 0.12;
  else if (temp <= 50)  factor -= 0.08;
  else if (temp <= 60)  factor -= 0.04;

  // Coors Field altitude bonus (already partially baked into park factor, but
  // temperature swing there is extreme — cold night games can drop HR rate significantly)
  if (homeTeam === 'Colorado Rockies') factor += 0.05; // thin air baseline bonus

  // ── Wind adjustment ───────────────────────────────────────────────────────
  if (windSpeed >= 5 && homeTeam) {
    const outfieldBearing = MLB_OUTFIELD_BEARINGS[homeTeam];
    if (outfieldBearing !== undefined && outfieldBearing !== 0) {
      // Wind direction = where wind COMES FROM.
      // Wind blows TOWARD = windDeg + 180°.
      const windToward  = (windDeg + 180) % 360;
      const diff        = Math.abs(windToward - outfieldBearing);
      const angleDiff   = Math.min(diff, 360 - diff); // 0–180°

      // angleDiff = 0 → directly out to CF (maximum boost)
      // angleDiff = 90 → crosswind (minimal HR effect)
      // angleDiff = 180 → directly in from CF (suppressor)
      const windComponent = Math.cos((angleDiff * Math.PI) / 180); // +1 to -1

      if (windSpeed >= 15)     factor += windComponent * 0.18;
      else if (windSpeed >= 10) factor += windComponent * 0.12;
      else                      factor += windComponent * 0.06;
    }
  } else if (windSpeed >= 10 && !homeTeam) {
    // No stadium data — conservative generic adjustment
    factor += 0.05; // assume slight boost on average
  }

  // Clamp to realistic range
  return Math.max(0.70, Math.min(1.40, factor));
}
