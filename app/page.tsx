import { PageLoader } from './page-loader';
import type { ServerDataProps } from '@/app/types/chat';

export const dynamic = 'force-dynamic';

async function getServerData(): Promise<ServerDataProps> {
  const base: ServerDataProps = {
    initialCards: [],
    initialInsights: null,
    userSession: null,
    serverTime: new Date().toISOString(),
    missingKeys: [],
    envErrors: [],
    dataSourcesUsed: [],
    fetchErrors: [],
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prefer service-role key (bypasses RLS); fall back to anon key (public read is enough)
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log('[SSR] Initial cards result: 0 cards (Supabase not configured)');
    return base;
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey, { db: { schema: 'api' } });

    console.log('[SSR] Fetching initial cards...');

    // Primary: rows that haven't expired yet
    let { data: rows, error } = await supabase
      .from('live_odds_cache')
      .select('sport_key, home_team, away_team, commence_time, bookmakers')
      .gt('expires_at', new Date().toISOString())
      .order('commence_time', { ascending: true })
      .limit(12);

    // Fallback: any row cached in the last 30 minutes (stale-while-revalidate pattern —
    // the 5-minute expires_at is a write TTL, not a read gate for SSR)
    if ((!rows || rows.length === 0) && !error) {
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      ({ data: rows, error } = await supabase
        .from('live_odds_cache')
        .select('sport_key, home_team, away_team, commence_time, bookmakers')
        .gt('cached_at', thirtyMinsAgo)
        .order('commence_time', { ascending: true })
        .limit(12));
    }

    if (error) {
      console.error('[SSR] live_odds_cache query error:', error.message);
      return base;
    }

    if (!rows || rows.length === 0) {
      console.log('[SSR] Initial cards result: 0 cards (cache empty)');
      return base;
    }

    // Group rows by sport so we call oddsEventsToBettingCards once per sport
    const bySport: Record<string, Array<{ home_team: string; away_team: string; commence_time: string; bookmakers: unknown[] }>> = {};
    for (const row of rows) {
      const sport = row.sport_key as string;
      if (!bySport[sport]) bySport[sport] = [];
      bySport[sport].push({
        home_team: row.home_team as string,
        away_team: row.away_team as string,
        commence_time: row.commence_time as string,
        bookmakers: Array.isArray(row.bookmakers) ? row.bookmakers : [],
      });
    }

    const { oddsEventsToBettingCards } = await import('@/lib/cards-generator');
    const cards: unknown[] = [];
    for (const [sport, events] of Object.entries(bySport)) {
      const sportCards = oddsEventsToBettingCards(events as any[], sport, 4);
      cards.push(...sportCards);
      if (cards.length >= 8) break;
    }

    console.log(`[SSR] Initial cards result: ${cards.length} cards`);
    return { ...base, initialCards: cards as Record<string, unknown>[] };
  } catch (err) {
    console.error('[SSR] getServerData error:', err instanceof Error ? err.message : String(err));
    return base;
  }
}

export default async function Page() {
  const serverData = await getServerData();
  return <PageLoader serverData={serverData} />;
}
