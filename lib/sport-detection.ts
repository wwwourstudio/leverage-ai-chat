/**
 * Sport detection utilities — keyword tables + inference functions.
 * Extracted from app/page-client.tsx so they can be reused and tested independently.
 */

import { getSeasonInfo } from '@/lib/seasonal-context';
import { sportToApi } from '@/lib/constants';
import { isDev as getIsDev } from '@/lib/config';

// ─── Sport keyword tables ─────────────────────────────────────────────────────
// Checked in order: league acronym → sport-specific terms → team names.
// History inheritance only fires when the current message has NO match here.

const MLB_KEYWORDS = [
  // League / generic
  'mlb', 'baseball', 'adp',
  // Positions
  ' 1b', ' 2b', ' 3b', ' ss', ' of', ' sp', ' rp', ' dh', ' lf', ' cf', ' rf',
  '(1b)', '(2b)', '(3b)', '(ss)', '(of)', '(sp)', '(rp)', '(dh)', '(lf)', '(cf)', '(rf)',
  // Terms
  'pitcher', 'pitching', 'batter', 'batting', 'strikeout', 'strikeouts', 'home run', 'home runs',
  'era', 'whip', 'ops', 'slugging', 'bullpen', 'closer', 'reliever', 'rotation',
  'waiver wire', 'starting pitcher', 'starting pitchers', 'innings pitched',
  'batting average', 'on-base', 'stolen base', 'rbi', 'statcast', 'exit velocity',
  'spin rate', 'launch angle', 'park factor', 'savant',
  // Baseball-specific prop market keywords — unambiguous identifiers of MLB prop queries
  'hits o/u', 'hits over', 'hits under',
  'home run o/u', 'home runs o/u', 'hr o/u',
  'strikeouts o/u', 'ks o/u', 'k o/u',
  'total bases o/u', 'tb o/u',
  'rbis o/u', 'rbi o/u',
  'stolen bases o/u',
  'batter prop', 'pitcher prop', 'pitcher ks',
  'first pitch', 'no-hitter', 'perfect game', 'immaculate inning',
  // All 30 MLB teams
  'yankees', 'red sox', 'blue jays', 'rays', 'orioles',
  'white sox', 'guardians', 'tigers', 'royals', 'twins',
  'astros', 'rangers', 'mariners', 'athletics', 'angels',
  'braves', 'mets', 'phillies', 'marlins', 'nationals',
  'cubs', 'cardinals', 'brewers', 'reds', 'pirates',
  'dodgers', 'giants', 'padres', 'diamondbacks', 'rockies',
  // Common team abbreviations used in player analysis cards
  ' nyy', ' bos', ' tor', ' tb', ' bal',
  ' cws', ' cle', ' det', ' kc', ' min',
  ' hou', ' tex', ' sea', ' ath', ' laa',
  ' atl', ' nym', ' phi', ' mia', ' wsh',
  ' chc', ' stl', ' mil', ' cin', ' pit',
  ' lad', ' sf', ' sd', ' ari', ' col',
  '(nyy)', '(bos)', '(tor)', '(tb)', '(bal)',
  '(cws)', '(cle)', '(det)', '(kc)', '(min)',
  '(hou)', '(tex)', '(sea)', '(ath)', '(laa)',
  '(atl)', '(nym)', '(phi)', '(mia)', '(wsh)',
  '(chc)', '(stl)', '(mil)', '(cin)', '(pit)',
  '(lad)', '(sf)', '(sd)', '(ari)', '(col)',
];

const NBA_KEYWORDS = [
  // League / generic
  'nba', 'basketball',
  // Positions (use word boundary pattern — avoid false matches like "pgs")
  ' pg', ' sg', ' sf', ' pf',
  '(pg)', '(sg)', '(sf)', '(pf)',
  // Terms
  'points prop', 'assists prop', 'rebounds prop', 'three-pointer', '3-pointer',
  'triple double', 'double double', 'nba prop', 'nba odds', 'nba bet',
  'field goal', 'free throw', 'plus/minus', 'plus minus',
  // All 30 NBA teams
  'celtics', 'nets', 'knicks', 'sixers', '76ers', 'raptors',
  'bulls', 'cavaliers', 'pistons', 'pacers', 'bucks',
  'hawks', 'hornets', 'heat', 'magic', 'wizards',
  'nuggets', 'timberwolves', 'thunder', 'trail blazers', 'blazers', 'jazz',
  'warriors', 'clippers', 'lakers', 'suns', 'kings',
  'mavericks', 'mavs', 'rockets', 'grizzlies', 'pelicans', 'spurs',
  // Team abbreviations in parenthetical card format e.g. "Tatum (BOS)"
  '(bos)', '(bkn)', '(nyk)', '(phi)', '(tor)',
  '(chi)', '(cle)', '(det)', '(ind)', '(mil)',
  '(atl)', '(cha)', '(mia)', '(orl)', '(was)',
  '(den)', '(min)', '(okc)', '(por)', '(uta)',
  '(gsw)', '(lac)', '(lal)', '(phx)', '(sac)',
  '(dal)', '(hou)', '(mem)', '(nop)', '(sas)',
  // Well-known players whose names alone signal NBA
  'jokic', 'lebron', 'curry', 'giannis', 'luka', 'doncic', 'embiid',
  'tatum', 'jayson', 'durant', 'westbrook', 'harden', 'lillard',
  'butler', 'booker', 'davis', 'adebayo', 'mitchell', 'morant',
];

const NFL_KEYWORDS = [
  // League / generic
  'nfl', 'football',
  // Positions
  ' qb', ' wr', ' rb', ' te', ' k ', ' def',
  '(qb)', '(wr)', '(rb)', '(te)', '(k)', '(def)',
  // Terms
  'touchdown', 'passing yards', 'rushing yards', 'receiving yards',
  'fantasy lineup', 'start sit', 'flex play', 'flex pick',
  'cornerback', 'wide receiver', 'running back', 'tight end', 'quarterback',
  'nfl prop', 'nfl odds', 'super bowl', 'playoff seed',
  // All 32 NFL teams
  'patriots', 'dolphins', 'jets', 'bills',
  'ravens', 'bengals', 'browns', 'steelers',
  'titans', 'colts', 'texans', 'jaguars',
  'chiefs', 'raiders', 'chargers', 'broncos',
  'cowboys', 'eagles', 'giants', 'commanders',
  'bears', 'lions', 'packers',
  'vikings', 'falcons', 'panthers', 'saints', 'buccaneers',
  'rams', 'seahawks', 'cardinals', '49ers',
  // Common abbreviations
  ' mia', ' nyj', ' buf',
  ' bal', ' cin', ' cle',
  ' ten', ' ind', ' hou', ' jax',
  ' kc', ' lv', ' lac', ' den',
  ' dal', ' phi', ' nyg',
  ' chi', ' det', ' gb', ' min',
  ' atl', ' tb',
  ' lar', ' ari', ' sf',
  '(ne)', '(mia)', '(nyj)', '(buf)',
  '(bal)', '(cin)', '(cle)', '(pit)',
  '(ten)', '(ind)', '(hou)', '(jax)',
  '(kc)', '(lv)', '(lac)', '(den)',
  '(dal)', '(phi)', '(nyg)', '(was)',
  '(chi)', '(det)', '(gb)', '(min)',
  '(atl)', '(car)', '(no)', '(tb)',
  '(lar)', '(sea)', '(ari)', '(sf)',
  // Well-known players
  'mahomes', 'lamar', 'burrow', 'allen', 'hurts', 'purdy',
  'waddle', 'jaylen waddle', 'garrett wilson', 'davante', 'stefon diggs',
  'kelce', 'mccaffrey', 'henry', 'chubb', 'ekeler',
];

const NHL_KEYWORDS = [
  'nhl', 'hockey',
  ' lw', ' rw', ' d ',
  '(lw)', '(rw)', '(d)',
  'goalie', 'goaltender', 'power play', 'penalty kill', 'faceoff',
  'goals against', 'save percentage', 'stanley cup',
  'bruins', 'sabres', 'red wings', 'panthers', 'canadiens',
  'senators', 'lightning', 'maple leafs', 'hurricanes', 'blue jackets',
  'devils', 'islanders', 'rangers', 'flyers', 'penguins',
  'coyotes', 'blackhawks', 'avalanche', 'stars', 'wild',
  'predators', 'blues', 'jets', 'ducks', 'flames', 'oilers',
  'kings', 'sharks', 'golden knights', 'canucks', 'kraken',
];

// ─────────────────────────────────────────────────────────────────────────────

export function detectSportFromText(text: string): string | null {
  const t = text.toLowerCase();
  // Kalshi is a prediction market platform — queries on it never need sports-odds routing.
  if (t.includes('kalshi') || t.includes('prediction market')) return null;
  // NFBC/NFFC must come first — TSV data can contain "nba" inside player names
  if (t.includes('nfbc') || t.includes('nffc') || t.includes('nfbkc') || t.includes('tgfbi')) return 'mlb';
  // ── NCAA must be checked BEFORE generic sport terms ─────────────────────────
  if (t.includes('ncaaw') || t.includes('wncaab') || t.includes("women's college basketball") || t.includes("womens college basketball")) return 'ncaaw';
  if (t.includes('ncaab') || t.includes('college basketball') || t.includes("men's college basketball")) return 'ncaab';
  if (t.includes('ncaaf') || t.includes('college football')) return 'ncaaf';
  if (t.includes('ncaa')) {
    if (t.includes('women') && t.includes('basketball')) return 'ncaaw';
    if (t.includes('basketball')) return 'ncaab';
    if (t.includes('football')) return 'ncaaf';
    return null;
  }
  // Check league acronyms first (fastest, most reliable)
  if (t.includes('nba') || t.includes('basketball')) return 'nba';
  if (t.includes('nfl') || t.includes('football')) return 'nfl';
  if (t.includes('mlb') || t.includes('baseball')) return 'mlb';
  if (t.includes('nhl') || t.includes('hockey')) return 'nhl';
  // ── Position-first disambiguation ────────────────────────────────────────────
  // MLB positions unique to baseball (sp, rp, cp, 1b, 2b, 3b, ss, dh, lf, cf, rf):
  if (/(?:^|[\s(])(?:sp|rp|cp|1b|2b|3b|ss|dh|lf|cf|rf)(?:[\s).,]|$)/.test(t)) return 'mlb';
  // "OF" and "C" (catcher) are ambiguous — only match when preceded by a 2-3 char team abbr:
  if (/(?:^|[\s(])[a-z]{2,3}\s+(?:of|c)(?:[\s).,]|$)/.test(t)) return 'mlb';
  // NBA positions (pg, sg, pf — unique):
  if (/(?:^|[\s(])(?:pg|sg|pf)(?:[\s).,]|$)/.test(t)) return 'nba';
  // NFL positions (qb, wr, rb, te — unique):
  if (/(?:^|[\s(])(?:qb|wr|rb|te)(?:[\s).,]|$)/.test(t)) return 'nfl';
  // ── Known MLB player names ───────────────────────────────────────────────────
  if ([
    'schwarber', 'bryce harper', 'castellanos', 'trea turner', 'alec bohm',
    'realmuto', 'aaron nola', 'zack wheeler', 'ranger suarez', 'ranger suárez',
    'ohtani', 'shohei', 'acuña', 'acuna', 'juan soto',
    'freddie freeman', 'mookie betts', 'tatis', 'yordan alvarez',
    'corbin burnes', 'gerrit cole', 'spencer strider',
    'lindor', 'devers', 'vlad guerrero', 'wander franco',
    'elly de la cruz', 'elly de la', 'de la cruz',
    'bleday', 'jj bleday',
    'gunnar henderson', 'bobby witt', 'corey seager',
    'adley rutschman', 'julio rodriguez', 'pete alonso',
    'paul skenes', 'jackson merrill', 'jackson holliday',
    'wyatt langford', 'cj abrams', 'josh lowe',
    'michael harris', 'james outman', 'jarren duran',
    'jose altuve', 'will smith', 'kyle tucker',
  ].some(p => t.includes(p))) return 'mlb';
  // Deep scan: team names, positions, sport-specific terms.
  if (NBA_KEYWORDS.some(k => t.includes(k))) return 'nba';
  // For NFL vs MLB, score both and pick the winner
  const nflCount = NFL_KEYWORDS.filter(k => t.includes(k)).length;
  const mlbCount = MLB_KEYWORDS.filter(k => t.includes(k)).length;
  if (nflCount > 0 || mlbCount > 0) {
    return mlbCount >= nflCount ? 'mlb' : 'nfl';
  }
  if (NHL_KEYWORDS.some(k => t.includes(k))) return 'nhl';
  return null;
}

// Regression guard
if (getIsDev()) {
  console.assert(
    detectSportFromText('Kyle Schwarber HR prop') === 'mlb',
    '[v0] detectSportFromText regression: "Kyle Schwarber HR prop" should return "mlb"',
  );
}

export function extractSport(
  message: string,
  conversationHistory?: Array<{ role: string; content: string }>,
): string | null {
  console.log('[v0] Extracting sport from:', message);

  const direct = detectSportFromText(message);
  if (direct) {
    console.log('[v0] Detected sport:', direct.toUpperCase());
    return direct;
  }

  const contextualKeywords = [
    'this game', 'that game', 'the game', 'same game',
    'this match', 'that match', 'the match', 'same match',
    'these props', 'those props', 'these players', 'those players',
    'this parlay', 'that parlay', 'for this', 'for that',
    'correlated', 'same-game', 'sgp',
    'this player prop', 'this prop', 'that prop',
    'historical hit rate', 'hit rate', 'prop hit rate',
    'this lineup', 'this slate', 'this pick', 'that pick',
    'for this player', 'for that player',
  ];
  const hasContextualReference = contextualKeywords.some(k => message.toLowerCase().includes(k));

  if ((conversationHistory && conversationHistory.length > 0) || hasContextualReference) {
    if (hasContextualReference) {
      console.log('[v0] Contextual reference detected, checking conversation history...');
    } else {
      console.log('[v0] No sport in current message, checking conversation history...');
    }
    if (conversationHistory) {
      for (let i = conversationHistory.length - 1; i >= Math.max(0, conversationHistory.length - 5); i--) {
        const historicalMsg = conversationHistory[i];
        if (historicalMsg?.content) {
          const historicalSport = detectSportFromText(historicalMsg.content);
          if (historicalSport) {
            const seasonInfo = getSeasonInfo(sportToApi(historicalSport));
            if (!seasonInfo.isInSeason) {
              console.log(`[v0] Skipping inherited sport '${historicalSport}' — currently offseason`);
              continue;
            }
            console.log('[v0] Inherited sport from conversation history:', historicalSport.toUpperCase());
            return historicalSport;
          }
        }
      }
    }
  }

  console.log('[v0] No specific sport detected');
  return null;
}

export function extractSportFromText(text: string): string | null {
  return detectSportFromText(text);
}

export function extractMarketType(message: string): string | null {
  const msgLower = message.toLowerCase();
  if (msgLower.includes('spread')) return 'spreads';
  if (msgLower.includes('total') || msgLower.includes('over') || msgLower.includes('under')) return 'totals';
  if (msgLower.includes('moneyline') || msgLower.includes('ml')) return 'h2h';
  if (msgLower.includes('prop')) return 'player_props';
  return 'h2h';
}

export function extractPlatform(message: string): string | null {
  const msgLower = message.toLowerCase();
  if (msgLower.includes('draftkings') || msgLower.includes('dk')) return 'draftkings';
  if (msgLower.includes('fanduel') || msgLower.includes('fd')) return 'fanduel';
  if (msgLower.includes('kalshi')) return 'kalshi';
  if (msgLower.includes('nfbc') || msgLower.includes('nffc')) return 'fantasy';
  return null;
}
