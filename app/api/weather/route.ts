import { NextRequest, NextResponse } from 'next/server';
import {
  fetchWeatherForLocation,
  getGameTimeForecast,
  type WeatherData,
  type GameTimeForecast
} from '@/lib/weather/index';

export const runtime = 'edge';

const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500
} as const;

const ERROR_MESSAGES = {
  WEATHER_UNAVAILABLE: 'Weather data unavailable',
  INVALID_COORDINATES: 'Invalid coordinates provided',
  MISSING_PARAMETERS: 'Missing required parameters',
  INTERNAL_ERROR: 'Internal server error'
} as const;

/**
 * POST /api/weather
 * Fetch weather data for game location
 * 
 * Request body:
 *  - latitude: number, longitude: number (for current weather)
 *  OR
 *  - team: string, gameTime: ISO date string (for game forecast)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { latitude, longitude, team, gameTime } = body;
    
    console.log('[v0] [API/weather] POST request:', { latitude, longitude, team, gameTime });
    
    // Option 1: Direct coordinates for current weather
    if (latitude !== undefined && longitude !== undefined) {
      const weather = await fetchWeatherForLocation(latitude, longitude);
      
      if (!weather) {
        return NextResponse.json(
          {
            success: false,
            error: ERROR_MESSAGES.WEATHER_UNAVAILABLE,
            weather: null,
            message: 'Weather data could not be retrieved for the specified location'
          },
          { status: HTTP_STATUS.NOT_FOUND }
        );
      }
      
      console.log('[v0] [API/weather] ✓ Weather fetched for coordinates');
      
      return NextResponse.json({
        success: true,
        weather,
        location: { latitude, longitude },
        timestamp: new Date().toISOString()
      });
    }
    
    // Option 2: Team-based with game time forecast
    if (team) {
      const gameDate = gameTime ? new Date(gameTime) : new Date();
      const forecast = await getGameTimeForecast(team, gameDate);
      
      if (!forecast) {
        return NextResponse.json(
          {
            success: false,
            error: `Weather forecast unavailable for ${team}`,
            forecast: null,
            message: 'Stadium not found or weather data unavailable. Team must have a known stadium location.'
          },
          { status: HTTP_STATUS.NOT_FOUND }
        );
      }
      
      console.log(`[v0] [API/weather] ✓ Forecast generated for ${team}`);
      
      return NextResponse.json({
        success: true,
        forecast,
        team,
        gameTime: gameDate.toISOString(),
        timestamp: new Date().toISOString()
      });
    }
    
    // Missing required parameters
    return NextResponse.json(
      {
        success: false,
        error: ERROR_MESSAGES.MISSING_PARAMETERS,
        message: 'Provide either (latitude, longitude) for current weather or (team, gameTime) for game forecast'
      },
      { status: HTTP_STATUS.BAD_REQUEST }
    );
    
  } catch (error) {
    console.error('[v0] [API/weather] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.INTERNAL_ERROR,
        weather: null,
        timestamp: new Date().toISOString()
      },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}

/**
 * GET /api/weather?latitude=40.8&longitude=-74.0
 * Fetch current weather for coordinates via query parameters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const latStr = searchParams.get('latitude');
    const lonStr = searchParams.get('longitude');
    const team = searchParams.get('team');
    
    console.log('[v0] [API/weather] GET request:', { latitude: latStr, longitude: lonStr, team });
    
    // Option 1: Coordinates provided
    if (latStr && lonStr) {
      const latitude = parseFloat(latStr);
      const longitude = parseFloat(lonStr);
      
      if (isNaN(latitude) || isNaN(longitude)) {
        return NextResponse.json(
          {
            success: false,
            error: ERROR_MESSAGES.INVALID_COORDINATES,
            message: 'Latitude and longitude must be valid numbers'
          },
          { status: HTTP_STATUS.BAD_REQUEST }
        );
      }
      
      const weather = await fetchWeatherForLocation(latitude, longitude);
      
      if (!weather) {
        return NextResponse.json(
          {
            success: false,
            error: ERROR_MESSAGES.WEATHER_UNAVAILABLE,
            weather: null
          },
          { status: HTTP_STATUS.NOT_FOUND }
        );
      }
      
      console.log('[v0] [API/weather] ✓ Weather fetched for coordinates');
      
      return NextResponse.json({
        success: true,
        weather,
        location: { latitude, longitude },
        timestamp: new Date().toISOString()
      });
    }
    
    // Option 2: Team provided (current weather at team's stadium)
    if (team) {
      const forecast = await getGameTimeForecast(team, new Date());
      
      if (!forecast) {
        return NextResponse.json(
          {
            success: false,
            error: `Weather data unavailable for ${team}`,
            message: 'Team stadium not found in database'
          },
          { status: HTTP_STATUS.NOT_FOUND }
        );
      }
      
      console.log(`[v0] [API/weather] ✓ Weather fetched for ${team} stadium`);
      
      return NextResponse.json({
        success: true,
        weather: forecast.kickoff,
        team,
        timestamp: new Date().toISOString()
      });
    }
    
    // No valid parameters
    return NextResponse.json(
      {
        success: false,
        error: ERROR_MESSAGES.MISSING_PARAMETERS,
        message: 'Provide either latitude & longitude or team as query parameters'
      },
      { status: HTTP_STATUS.BAD_REQUEST }
    );
    
  } catch (error) {
    console.error('[v0] [API/weather] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.INTERNAL_ERROR,
        weather: null
      },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
