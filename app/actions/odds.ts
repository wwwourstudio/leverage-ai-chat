'use server'

import {
  fetchOdds,
  cacheOdds,
  getOddsWithCache,
  getCachedOdds,
  getSports,
  findBestOdds,
  compareAllMarkets,
  findArbitrageOpportunities,
  getOddsMovement,
  cleanupExpiredCache,
  type Sport,
  type Market,
  type Region,
  type OddsEvent,
} from '@/lib/services/odds-api'

/**
 * Fetch and cache live odds for a sport
 */
export async function fetchLiveOdds(
  sport: Sport,
  markets: Market[] = ['h2h', 'spreads', 'totals'],
  regions: Region[] = ['us'],
  forceRefresh: boolean = false
) {
  try {
    console.log('[v0] Fetching live odds for', sport, 'markets:', markets)
    
    const events = await getOddsWithCache(sport, markets, forceRefresh)
    
    return {
      success: true,
      data: events,
      count: events.length,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error('[v0] Error fetching odds:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch odds',
    }
  }
}

/**
 * Get cached odds without API call
 */
export async function getCachedOddsAction(sport?: Sport, eventId?: string) {
  try {
    const cached = await getCachedOdds(sport, eventId)
    
    return {
      success: true,
      data: cached,
      count: cached.length,
      cached: true,
    }
  } catch (error) {
    console.error('[v0] Error getting cached odds:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get cached odds',
    }
  }
}

/**
 * Get best odds for a specific event across all bookmakers
 */
export async function getBestOddsForEvent(
  eventId: string,
  marketType: 'h2h' | 'spreads' | 'totals' = 'h2h'
) {
  try {
    const cached = await getCachedOdds(undefined, eventId)
    
    if (cached.length === 0) {
      return {
        success: false,
        error: 'Event not found in cache',
      }
    }

    // Reconstruct event from cache
    const event = cached[0].event
    const bestOdds = findBestOdds(event, marketType)

    return {
      success: true,
      event: {
        id: event.id,
        sport: event.sport_key,
        teams: `${event.away_team} @ ${event.home_team}`,
        commenceTime: event.commence_time,
      },
      bestOdds,
      marketType,
    }
  } catch (error) {
    console.error('[v0] Error finding best odds:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to find best odds',
    }
  }
}

/**
 * Compare all market types for an event
 */
export async function compareMarketsForEvent(eventId: string) {
  try {
    const cached = await getCachedOdds(undefined, eventId)
    
    if (cached.length === 0) {
      return {
        success: false,
        error: 'Event not found in cache',
      }
    }

    const event = cached[0].event
    const comparison = compareAllMarkets(event)

    return {
      success: true,
      event: {
        id: event.id,
        sport: event.sport_key,
        teams: `${event.away_team} @ ${event.home_team}`,
        commenceTime: event.commence_time,
      },
      comparison,
    }
  } catch (error) {
    console.error('[v0] Error comparing markets:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to compare markets',
    }
  }
}

/**
 * Find arbitrage opportunities for an event
 */
export async function findArbitrageForEvent(
  eventId: string,
  marketType: 'h2h' | 'spreads' | 'totals' = 'h2h'
) {
  try {
    const cached = await getCachedOdds(undefined, eventId)
    
    if (cached.length === 0) {
      return {
        success: false,
        error: 'Event not found in cache',
      }
    }

    const event = cached[0].event
    const arbitrage = findArbitrageOpportunities(event, marketType)

    return {
      success: true,
      event: {
        id: event.id,
        sport: event.sport_key,
        teams: `${event.away_team} @ ${event.home_team}`,
        commenceTime: event.commence_time,
      },
      arbitrage,
      marketType,
    }
  } catch (error) {
    console.error('[v0] Error finding arbitrage:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to find arbitrage',
    }
  }
}

/**
 * Get available sports
 */
export async function getAvailableSports() {
  try {
    const sports = await getSports()
    
    return {
      success: true,
      sports,
    }
  } catch (error) {
    console.error('[v0] Error getting sports:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get sports',
    }
  }
}

/**
 * Get odds movement history for an event
 */
export async function getOddsMovementHistory(eventId: string, hoursBack: number = 24) {
  try {
    const movement = await getOddsMovement(eventId, hoursBack)
    
    return {
      success: true,
      data: movement,
      count: movement.length,
      hoursBack,
    }
  } catch (error) {
    console.error('[v0] Error getting odds movement:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get odds movement',
    }
  }
}

/**
 * Cleanup expired cache entries (admin function)
 */
export async function cleanupExpiredOdds() {
  try {
    const count = await cleanupExpiredCache()
    
    return {
      success: true,
      deletedCount: count,
    }
  } catch (error) {
    console.error('[v0] Error cleaning up cache:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cleanup cache',
    }
  }
}

/**
 * Batch fetch odds for multiple sports
 */
export async function fetchMultipleSports(
  sports: Sport[],
  markets: Market[] = ['h2h', 'spreads', 'totals']
) {
  try {
    console.log('[v0] Batch fetching odds for sports:', sports)
    
    const results = await Promise.allSettled(
      sports.map((sport) => fetchLiveOdds(sport, markets, ['us'], false))
    )

    const successful = results.filter((r) => r.status === 'fulfilled')
    const failed = results.filter((r) => r.status === 'rejected')

    return {
      success: true,
      results: {
        successful: successful.length,
        failed: failed.length,
        total: sports.length,
      },
      data: successful.map((r) => (r as PromiseFulfilledResult<any>).value),
    }
  } catch (error) {
    console.error('[v0] Error batch fetching:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to batch fetch',
    }
  }
}
