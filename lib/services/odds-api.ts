// The Odds API integration for live sports betting odds
// Docs: https://the-odds-api.com/liveapi/guides/v4/

import { createClient } from '@/lib/supabase/server'

const ODDS_API_KEY = process.env.ODDS_API_KEY!
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4'

export type Sport = 
  | 'americanfootball_nfl'
  | 'basketball_nba'
  | 'baseball_mlb'
  | 'icehockey_nhl'
  | 'soccer_epl'
  | 'soccer_uefa_champs_league'

export type Market = 'h2h' | 'spreads' | 'totals'

export type Region = 'us' | 'uk' | 'eu' | 'au'

export interface OddsEvent {
  id: string
  sport_key: string
  sport_title: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers: Bookmaker[]
}

export interface Bookmaker {
  key: string
  title: string
  last_update: string
  markets: Market[]
}

export interface Market {
  key: string
  last_update: string
  outcomes: Outcome[]
}

export interface Outcome {
  name: string
  price: number
  point?: number
}

export interface CachedOdds {
  event: OddsEvent
  cachedAt: Date
  expiresAt: Date
}

/**
 * Fetch live odds for a specific sport
 */
export async function fetchOdds(
  sport: Sport,
  markets: Market[] = ['h2h'],
  regions: Region[] = ['us'],
  oddsFormat: 'american' | 'decimal' = 'american'
): Promise<OddsEvent[]> {
  const url = new URL(`${ODDS_API_BASE}/sports/${sport}/odds`)
  url.searchParams.set('apiKey', ODDS_API_KEY)
  url.searchParams.set('regions', regions.join(','))
  url.searchParams.set('markets', markets.join(','))
  url.searchParams.set('oddsFormat', oddsFormat)

  console.log('[v0] Fetching odds from API:', url.toString())

  const response = await fetch(url.toString(), {
    next: { revalidate: 300 }, // Cache for 5 minutes
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`Odds API error: ${response.status} - ${JSON.stringify(error)}`)
  }

  const data = await response.json()
  console.log('[v0] Fetched odds for', data.length, 'events')
  
  return data
}

/**
 * Cache odds data in Supabase for faster retrieval
 */
export async function cacheOdds(events: OddsEvent[]): Promise<void> {
  const supabase = await createClient()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

  const records = events.flatMap((event) =>
    event.bookmakers.flatMap((bookmaker) =>
      bookmaker.markets.map((market) => ({
        sport: event.sport_key,
        league: event.sport_title,
        event_id: event.id,
        event_name: `${event.away_team} @ ${event.home_team}`,
        commence_time: event.commence_time,
        bookmaker: bookmaker.key,
        market: market.key,
        odds_data: {
          outcomes: market.outcomes,
          last_update: bookmaker.last_update,
        },
        expires_at: expiresAt.toISOString(),
      }))
    )
  )

  const { error } = await supabase.from('odds_cache').upsert(records, {
    onConflict: 'event_id,bookmaker,market',
  })

  if (error) {
    console.error('[v0] Error caching odds:', error)
    throw error
  }

  console.log('[v0] Cached', records.length, 'odds records')
}

/**
 * Get cached odds from Supabase
 */
export async function getCachedOdds(
  sport?: Sport,
  eventId?: string
): Promise<CachedOdds[]> {
  const supabase = await createClient()

  let query = supabase
    .from('odds_cache')
    .select('*')
    .gt('expires_at', new Date().toISOString())

  if (sport) {
    query = query.eq('sport', sport)
  }

  if (eventId) {
    query = query.eq('event_id', eventId)
  }

  const { data, error } = await query.order('commence_time', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    event: {
      id: row.event_id,
      sport_key: row.sport,
      sport_title: row.league,
      commence_time: row.commence_time,
      home_team: row.event_name.split(' @ ')[1] ?? '',
      away_team: row.event_name.split(' @ ')[0] ?? '',
      bookmakers: [
        {
          key: row.bookmaker,
          title: row.bookmaker,
          last_update: (row.odds_data as any).last_update,
          markets: [
            {
              key: row.market,
              last_update: (row.odds_data as any).last_update,
              outcomes: (row.odds_data as any).outcomes,
            },
          ],
        },
      ],
    },
    cachedAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
  }))
}

/**
 * Fetch odds with caching
 */
export async function getOddsWithCache(
  sport: Sport,
  markets: Market[] = ['h2h'],
  forceRefresh = false
): Promise<OddsEvent[]> {
  // Try cache first
  if (!forceRefresh) {
    const cached = await getCachedOdds(sport)
    if (cached.length > 0) {
      console.log('[v0] Using cached odds:', cached.length, 'events')
      // Group by event
      const eventMap = new Map<string, OddsEvent>()
      cached.forEach(({ event }) => {
        if (!eventMap.has(event.id)) {
          eventMap.set(event.id, event)
        } else {
          const existing = eventMap.get(event.id)!
          existing.bookmakers.push(...event.bookmakers)
        }
      })
      return Array.from(eventMap.values())
    }
  }

  // Fetch fresh data
  const events = await fetchOdds(sport, markets)
  
  // Cache in background
  cacheOdds(events).catch((err) => {
    console.error('[v0] Failed to cache odds:', err)
  })

  return events
}

/**
 * Get available sports
 */
export async function getSports(): Promise<{ key: string; title: string }[]> {
  const url = new URL(`${ODDS_API_BASE}/sports`)
  url.searchParams.set('apiKey', ODDS_API_KEY)

  const response = await fetch(url.toString(), {
    next: { revalidate: 3600 }, // Cache for 1 hour
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch sports: ${response.status}`)
  }

  return response.json()
}

/**
 * Find best odds across bookmakers for all market types
 */
export function findBestOdds(event: OddsEvent, marketType: string = 'h2h'): {
  team: string
  bestPrice: number
  bookmaker: string
  point?: number
  allOdds: { bookmaker: string; price: number; point?: number }[]
}[] {
  const bestOdds = new Map<
    string,
    {
      price: number
      bookmaker: string
      point?: number
      allOdds: { bookmaker: string; price: number; point?: number }[]
    }
  >()

  event.bookmakers.forEach((bookmaker) => {
    const targetMarket = bookmaker.markets.find((m) => m.key === marketType)
    if (!targetMarket) return

    targetMarket.outcomes.forEach((outcome) => {
      const key = outcome.point !== undefined ? `${outcome.name}_${outcome.point}` : outcome.name
      const existing = bestOdds.get(key)

      const oddsEntry = {
        bookmaker: bookmaker.title,
        price: outcome.price,
        point: outcome.point,
      }

      if (!existing || outcome.price > existing.price) {
        bestOdds.set(key, {
          price: outcome.price,
          bookmaker: bookmaker.title,
          point: outcome.point,
          allOdds: existing ? [...existing.allOdds, oddsEntry] : [oddsEntry],
        })
      } else {
        existing.allOdds.push(oddsEntry)
      }
    })
  })

  return Array.from(bestOdds.entries()).map(([key, data]) => ({
    team: key.includes('_') ? key.split('_')[0] : key,
    bestPrice: data.price,
    bookmaker: data.bookmaker,
    point: data.point,
    allOdds: data.allOdds.sort((a, b) => b.price - a.price),
  }))
}

/**
 * Compare odds across all markets for an event
 */
export function compareAllMarkets(event: OddsEvent): {
  h2h: ReturnType<typeof findBestOdds>
  spreads: ReturnType<typeof findBestOdds>
  totals: ReturnType<typeof findBestOdds>
} {
  return {
    h2h: findBestOdds(event, 'h2h'),
    spreads: findBestOdds(event, 'spreads'),
    totals: findBestOdds(event, 'totals'),
  }
}

/**
 * Calculate arbitrage opportunities
 */
export function findArbitrageOpportunities(
  event: OddsEvent,
  marketType: string = 'h2h'
): {
  hasArbitrage: boolean
  profit?: number
  bets?: { team: string; bookmaker: string; price: number; stake: number }[]
} {
  const bestOdds = findBestOdds(event, marketType)
  
  if (bestOdds.length < 2) {
    return { hasArbitrage: false }
  }

  // Convert American odds to decimal for calculation
  const toDecimal = (american: number) => {
    return american > 0 ? american / 100 + 1 : 100 / Math.abs(american) + 1
  }

  const decimalOdds = bestOdds.map((odd) => ({
    ...odd,
    decimal: toDecimal(odd.bestPrice),
  }))

  const impliedProbability = decimalOdds.reduce((sum, odd) => sum + 1 / odd.decimal, 0)

  if (impliedProbability < 1) {
    const totalStake = 100
    const profit = totalStake * (1 / impliedProbability - 1)

    const bets = decimalOdds.map((odd) => ({
      team: odd.team,
      bookmaker: odd.bookmaker,
      price: odd.bestPrice,
      stake: totalStake / (impliedProbability * odd.decimal),
    }))

    return {
      hasArbitrage: true,
      profit: profit,
      bets,
    }
  }

  return { hasArbitrage: false }
}

/**
 * Get odds movement history (stub for future implementation)
 */
export async function getOddsMovement(
  eventId: string,
  hoursBack: number = 24
): Promise<
  {
    timestamp: string
    bookmaker: string
    market: string
    odds: { name: string; price: number }[]
  }[]
> {
  const supabase = await createClient()

  const startTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000)

  const { data, error } = await supabase
    .from('odds_cache')
    .select('*')
    .eq('event_id', eventId)
    .gte('created_at', startTime.toISOString())
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    timestamp: row.created_at,
    bookmaker: row.bookmaker,
    market: row.market,
    odds: (row.odds_data as any).outcomes || [],
  }))
}

/**
 * Clean up expired cache entries
 */
export async function cleanupExpiredCache(): Promise<number> {
  const supabase = await createClient()

  const { error, count } = await supabase
    .from('odds_cache')
    .delete()
    .lt('expires_at', new Date().toISOString())

  if (error) {
    console.error('[v0] Error cleaning up cache:', error)
    throw error
  }

  console.log('[v0] Cleaned up', count, 'expired cache entries')
  return count ?? 0
}
