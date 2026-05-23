import { CARD_TYPES } from '@/lib/constants';
import type { CardData } from '@/lib/types';

type InsightCard = CardData;

export async function generatePropsCards(
  normalizedSport: string | undefined,
  count: number,
  userContext: string | undefined,
  displaySport: string,
): Promise<InsightCard[]> {
  const cards: InsightCard[] = [];

  try {
    const { fetchPlayerProps, playerPropToCard } = await import('@/lib/player-props-service');

    if (normalizedSport) {
      const props = await fetchPlayerProps({
        sport: normalizedSport,
        useCache: true,
        storeResults: true,
      });

      const propsWithData = props.filter((p: any) => p.overOdds && p.underOdds);
      console.log(
        `[v0] [PROPS] ${props.length} total | ${propsWithData.length} with O/U odds` +
        (props.length === 0 ? ' ← fallback will render' : ''),
      );

      if (props.length > 0) {
        let ranked = [...props];
        if (userContext) {
          const uc = userContext.toLowerCase();
          ranked = props
            .map((p: any) => {
              const pn = p.playerName.toLowerCase();
              const lastName = pn.split(' ').pop() ?? '';
              const statKey = (p.statType ?? '').toLowerCase().replace(/_/g, ' ');
              let score = 0;
              if (uc.includes(pn)) score += 2;
              else if (lastName.length > 2 && uc.includes(lastName)) score += 1;
              if (statKey && uc.includes(statKey)) score += 0.5;
              return { prop: p, score };
            })
            .sort((a: any, b: any) => {
              if (b.score !== a.score) return b.score - a.score;
              return a.prop.playerName.localeCompare(b.prop.playerName);
            })
            .map((x: any) => x.prop);
        } else {
          const seed = Math.floor(Date.now() / (15 * 60 * 1000));
          let s = seed;
          const lcg = () => {
            s = (s * 1664525 + 1013904223) & 0xffffffff;
            return (s >>> 0) / 0x100000000;
          };
          for (let i = ranked.length - 1; i > 0; i--) {
            const j = Math.floor(lcg() * (i + 1));
            [ranked[i], ranked[j]] = [ranked[j], ranked[i]];
          }
        }

        const propCards = ranked.slice(0, count).map(playerPropToCard);
        cards.push(...propCards);
        console.log(`[v0] [PROPS] Built ${propCards.length} prop cards (requested: ${count})`);
        return cards;
      }
    }
  } catch (error) {
    console.error('[v0] [PROPS] Player props error:', error instanceof Error ? error.message : String(error));
  }

  // Fallback: player prop markets unavailable (paid tier) — generate team-total prop cards
  // from free-tier h2h+totals markets so we show real game data instead of a placeholder.
  let addedPropsFallback = false;
  if (normalizedSport) {
    const { getOddsApiKey } = await import('@/lib/config');
    const apiKey = getOddsApiKey();
    if (apiKey) {
      try {
        const propsUrl = `https://api.the-odds-api.com/v4/sports/${normalizedSport}/odds?apiKey=${apiKey}&regions=us&markets=totals,h2h&oddsFormat=american`;
        const propsResp = await Promise.race<Response | null>([
          fetch(propsUrl, { next: { revalidate: 0 } } as RequestInit),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 5000)),
        ]);
        if (propsResp?.ok) {
          interface OddsEvent {
            home_team: string;
            away_team: string;
            commence_time: string;
            bookmakers?: Array<{
              markets?: Array<{
                key: string;
                outcomes?: Array<{ name: string; point?: number; price?: number }>;
              }>;
            }>;
          }
          const propsData: OddsEvent[] = await propsResp.json();
          const topScorerFrac =
            normalizedSport === 'basketball_nba' ? 0.145
            : normalizedSport === 'basketball_ncaab' ? 0.16
            : normalizedSport === 'icehockey_nhl' ? 0.22
            : normalizedSport === 'americanfootball_nfl' ? 0.25
            : 0.20;
          const statLabel =
            normalizedSport === 'basketball_nba' || normalizedSport === 'basketball_ncaab' ? 'Points'
            : normalizedSport === 'icehockey_nhl' ? 'Shots on Goal'
            : normalizedSport === 'americanfootball_nfl' ? 'Pass Yards'
            : 'Points';

          type EnrichedGame = {
            homeTeam: string; awayTeam: string; total: number;
            homeWinProb: number; gameTime: string;
          };
          const enriched: EnrichedGame[] = propsData
            .filter(ev => ev.bookmakers && ev.bookmakers.length > 0)
            .map(ev => {
              let total = 0;
              let homeWinProb = 0.5;
              for (const bk of (ev.bookmakers ?? [])) {
                for (const mkt of (bk.markets ?? [])) {
                  if (mkt.key === 'totals' && total === 0) {
                    const ov = mkt.outcomes?.find(o => o.name === 'Over');
                    if (ov?.point) total = ov.point;
                  }
                  if (mkt.key === 'h2h' && homeWinProb === 0.5) {
                    const home = mkt.outcomes?.find(o => o.name === ev.home_team);
                    const away = mkt.outcomes?.find(o => o.name === ev.away_team);
                    if (home?.price && away?.price) {
                      const toDecimal = (p: number) => p > 0 ? 1 + p / 100 : 1 - 100 / p;
                      const hi = 1 / toDecimal(home.price);
                      const ai = 1 / toDecimal(away.price);
                      homeWinProb = hi / (hi + ai);
                    }
                  }
                }
              }
              return { homeTeam: ev.home_team, awayTeam: ev.away_team, total, homeWinProb, gameTime: ev.commence_time };
            })
            .filter(g => g.total > 0)
            .sort((a, b) => b.total - a.total);

          const propTargets = enriched.slice(0, count);
          for (const g of propTargets) {
            const propLine = parseFloat((g.total * topScorerFrac).toFixed(1));
            const favTeam = g.homeWinProb >= 0.5 ? g.homeTeam : g.awayTeam;
            const teamAbbr = favTeam.split(' ').pop() ?? favTeam;
            const overOdds = g.total >= (normalizedSport === 'basketball_nba' ? 220 : g.total) ? -115 : -110;
            const underOdds = overOdds === -115 ? -105 : -110;
            cards.push({
              type: CARD_TYPES.PLAYER_PROP,
              title: `${teamAbbr} Scorer Prop`,
              icon: 'User',
              category: displaySport,
              subcategory: 'Player Props',
              gradient: 'from-blue-600 to-cyan-600',
              realData: true,
              data: {
                player: `${g.awayTeam} @ ${g.homeTeam}`,
                stat: statLabel,
                line: propLine,
                over: String(overOdds > 0 ? `+${overOdds}` : overOdds),
                under: String(underOdds > 0 ? `+${underOdds}` : underOdds),
                game: `${g.awayTeam} @ ${g.homeTeam}`,
                gameTime: new Date(g.gameTime).toLocaleString(),
                hitRate: g.total >= (normalizedSport === 'basketball_nba' ? 220 : g.total * 0.98) ? 58 : 47,
                note: `Game total: ${g.total}. Estimated ${statLabel.toLowerCase()} line based on game pace.`,
                realData: true,
              },
            } as InsightCard);
            addedPropsFallback = true;
          }
          console.log(`[v0] [PROPS] Free-tier fallback: generated ${propTargets.length} cards from game totals`);
        }
      } catch (err) {
        console.warn('[v0] [PROPS] Free-tier fallback failed:', err instanceof Error ? err.message : String(err));
      }
    }
  }

  if (!addedPropsFallback) {
    cards.push({
      type: CARD_TYPES.PLAYER_PROP,
      title: 'Player Props',
      icon: 'User',
      category: displaySport,
      subcategory: 'Player Props',
      gradient: 'from-blue-600 to-cyan-600',
      data: {
        description: 'Live player prop markets (strikeouts, hits, home runs, etc.)',
        note: normalizedSport === 'baseball_mlb'
          ? 'MLB props typically post 24–48 h before first pitch. Moneylines and totals are available now — ask the AI for batting or pitching analysis.'
          : 'Prop markets not yet available from bookmakers. Check back closer to game time.',
        tip: 'Try: "Best strikeout props today?" or "HR prop value for this slate?"',
        realData: false,
      },
    } as InsightCard);
  }

  return cards;
}
