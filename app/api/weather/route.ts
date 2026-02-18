import { NextRequest, NextResponse } from 'next/server';
import { fetchWeatherForLocation, generateWeatherCard } from '@/lib/weather-service';
import { LOG_PREFIXES, HTTP_STATUS, ERROR_MESSAGES } from '@/lib/constants';

export const runtime = 'edge';

interface WeatherRequest {
  latitude?: number;
  longitude?: number;
  homeTeam?: string;
  awayTeam?: string;
  gameTime?: string;
}

/**
 * Weather API Route
 * Provides real-time weather data for game locations
 * Can fetch by coordinates or by team names
 */
export async function POST(req: NextRequest) {
  try {
    console.log(`${LOG_PREFIXES.API} === WEATHER API REQUEST ===`);
    
    const body: WeatherRequest = await req.json();
    const { latitude, longitude, homeTeam, awayTeam, gameTime } = body;

    // Option 1: Fetch by coordinates
    if (latitude !== undefined && longitude !== undefined) {
      console.log(`${LOG_PREFIXES.API} Fetching weather for coordinates: ${latitude}, ${longitude}`);
      
      const weather = await fetchWeatherForLocation(latitude, longitude);
      
      if (!weather) {
        return NextResponse.json(
          {
            success: false,
            error: ERROR_MESSAGES.WEATHER_UNAVAILABLE,
            timestamp: new Date().toISOString(),
          },
          { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
        );
      }

      return NextResponse.json({
        success: true,
        weather,
        timestamp: new Date().toISOString(),
      });
    }

    // Option 2: Generate full weather card for a game
    if (homeTeam && awayTeam) {
      console.log(`${LOG_PREFIXES.API} Generating weather card for: ${homeTeam} vs ${awayTeam}`);
      
      const parsedGameTime = gameTime ? new Date(gameTime) : new Date();
      const card = await generateWeatherCard(homeTeam, awayTeam, parsedGameTime);

      if (!card) {
        return NextResponse.json(
          {
            success: false,
            error: 'Could not generate weather card - location data unavailable',
            timestamp: new Date().toISOString(),
          },
          { status: HTTP_STATUS.NOT_FOUND }
        );
      }

      return NextResponse.json({
        success: true,
        card,
        timestamp: new Date().toISOString(),
      });
    }

    // Invalid request
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid request - provide either coordinates or team names',
        timestamp: new Date().toISOString(),
      },
      { status: HTTP_STATUS.BAD_REQUEST }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`${LOG_PREFIXES.API} Weather API error:`, errorMessage);
    
    return NextResponse.json(
      {
        success: false,
        error: ERROR_MESSAGES.INTERNAL_ERROR,
        details: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}

/**
 * GET endpoint for quick weather lookup by coordinates
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    if (!lat || !lon) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters: lat and lon',
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid coordinates - must be numbers',
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
        },
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }

    return NextResponse.json({
      success: true,
      weather,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`${LOG_PREFIXES.API} Weather GET error:`, errorMessage);
    
    return NextResponse.json(
      {
        success: false,
        error: ERROR_MESSAGES.INTERNAL_ERROR,
        details: errorMessage,
      },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
