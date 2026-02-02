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
 * Find best odds across bookmakers
 */
export function findBestOdds(event: OddsEvent, market: string = 'h2h'): {
  team: string
  bestPrice: number
  bookmaker: string
}[] {
  const bestOdds = new Map<string, { price: number; bookmaker: string }>()

  event.bookmakers.forEach((bookmaker) => {
    const targetMarket = bookmaker.markets.find((m) => m.key === market)
    if (!targetMarket) return

    targetMarket.outcomes.forEach((outcome) => {
      const existing = bestOdds.get(outcome.name)
      if (!existing || outcome.price > existing.price) {
        bestOdds.set(outcome.name, {
          price: outcome.price,
          bookmaker: bookmaker.title,
        })
      }
    })
  })

  return Array.from(bestOdds.entries()).map(([team, { price, bookmaker }]) => ({
    team,
    bestPrice: price,
    bookmaker,
  }))
}
