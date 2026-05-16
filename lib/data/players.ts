/**
 * Player last-name → sport lookup.
 * Only includes names that are (a) unique enough to not produce false positives
 * and (b) frequently used in sports betting / fantasy queries.
 * Used as a server-side fallback when the client sends no sport context.
 */
export const PLAYER_SPORT_MAP: Record<string, string> = {
  // ── NFL ──────────────────────────────────────────────────────────────────
  mahomes: 'nfl', kelce: 'nfl', hurts: 'nfl', burrow: 'nfl',
  prescott: 'nfl', purdy: 'nfl', stroud: 'nfl', stafford: 'nfl',
  mccaffrey: 'nfl', ekeler: 'nfl', diggs: 'nfl', metcalf: 'nfl',
  kupp: 'nfl', rodgers: 'nfl', lafleur: 'nfl', belichick: 'nfl',
  // NFL skill players frequently queried for DFS / fantasy start-sit
  barkley: 'nfl', saquon: 'nfl',
  'derrick henry': 'nfl', pollard: 'nfl',
  hill: 'nfl', lamb: 'nfl', 'ceedee lamb': 'nfl',
  jefferson: 'nfl', chase: 'nfl',
  adams: 'nfl', thielen: 'nfl', pickens: 'nfl', lazard: 'nfl',
  'josh allen': 'nfl', 'lamar jackson': 'nfl',
  andrews: 'nfl', hockenson: 'nfl',
  // ── NBA ──────────────────────────────────────────────────────────────────
  curry: 'nba', doncic: 'nba', embiid: 'nba', tatum: 'nba',
  durant: 'nba', jokic: 'nba', harden: 'nba', lillard: 'nba',
  morant: 'nba', wembanyama: 'nba', brunson: 'nba', siakam: 'nba',
  giannis: 'nba',   // first name — unique enough
  // ── MLB ──────────────────────────────────────────────────────────────────
  ohtani: 'mlb', trout: 'mlb', acuna: 'mlb', betts: 'mlb',
  devers: 'mlb', lindor: 'mlb', verlander: 'mlb', glasnow: 'mlb',
  kershaw: 'mlb', goldschmidt: 'mlb', arenado: 'mlb', machado: 'mlb',
  degrom: 'mlb', scherzer: 'mlb', soto: 'mlb', alvarez: 'mlb',
  freedman: 'mlb', correa: 'mlb', bogaerts: 'mlb', semien: 'mlb',
  // MLB 2026 stars — force-lock against NBA/generic fallback
  judge: 'mlb', witt: 'mlb', raleigh: 'mlb', skubal: 'mlb',
  skenes: 'mlb', crochet: 'mlb', caminero: 'mlb', kurtz: 'mlb',
  henderson: 'mlb', ramirez: 'mlb', wheeler: 'mlb', burnes: 'mlb',
  cole: 'mlb', snell: 'mlb', rodon: 'mlb',
  // ── NHL ──────────────────────────────────────────────────────────────────
  mcdavid: 'nhl', crosby: 'nhl', mackinnon: 'nhl', ovechkin: 'nhl',
  draisaitl: 'nhl', marner: 'nhl', hedman: 'nhl', pastrnak: 'nhl',
  gaudreau: 'nhl', stamkos: 'nhl', karlsson: 'nhl', panarin: 'nhl',
} as const;

/**
 * Sport-specific statistical terms → sport.
 * Applied when no team name or player name resolves the sport.
 * Ordered from most specific (multi-word) to least specific (single word).
 */
export const STAT_SPORT_MAP: Array<{ term: string; sport: string }> = [
  // NFL (most specific first)
  { term: 'run defense', sport: 'nfl' },
  { term: 'rush defense', sport: 'nfl' },
  { term: 'red zone targets', sport: 'nfl' },
  { term: 'snap count', sport: 'nfl' },
  { term: 'offensive line', sport: 'nfl' },
  { term: 'running back', sport: 'nfl' },
  { term: 'wide receiver', sport: 'nfl' },
  { term: 'tight end', sport: 'nfl' },
  { term: 'backup rb', sport: 'nfl' },
  { term: 'passing yards', sport: 'nfl' },
  { term: 'rushing yards', sport: 'nfl' },
  { term: 'receiving yards', sport: 'nfl' },
  { term: 'passer rating', sport: 'nfl' },
  { term: 'qb rating', sport: 'nfl' },
  { term: 'touchdown passes', sport: 'nfl' },
  { term: 'fantasy football', sport: 'nfl' },
  // MLB
  { term: 'earned run average', sport: 'mlb' },
  { term: 'batting average', sport: 'mlb' },
  { term: 'home run', sport: 'mlb' },
  { term: 'stolen base', sport: 'mlb' },
  { term: 'strikeout', sport: 'mlb' },
  { term: 'on-base', sport: 'mlb' },
  { term: 'whip', sport: 'mlb' },
  { term: 'bullpen', sport: 'mlb' },
  { term: 'closer', sport: 'mlb' },
  // NBA
  { term: 'three-pointer', sport: 'nba' },
  { term: 'three pointer', sport: 'nba' },
  { term: 'free throw', sport: 'nba' },
  { term: 'per game', sport: 'nba' },   // "points per game", "assists per game" etc.
  // NHL
  { term: 'save percentage', sport: 'nhl' },
  { term: 'goals against', sport: 'nhl' },
  { term: 'power play', sport: 'nhl' },
  { term: 'penalty kill', sport: 'nhl' },
  { term: 'goalie saves', sport: 'nhl' },
] as const;

// Player Headshot IDs — used to build photo URLs for top players
// NBA: https://cdn.nba.com/headshots/nba/latest/260x190/{id}.png
// NFL (ESPN): https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/{id}.png&w=96&h=70
// MLB: https://img.mlbstatic.com/mlb-photos/image/upload/w_213,q_auto:best/v1/people/{id}/headshot/67/current
export const PLAYER_HEADSHOT_IDS: Record<string, { id: string; sport: 'nba' | 'nfl' | 'mlb' | 'nhl' }> = {
  // NBA
  'LeBron James':            { id: '2544',    sport: 'nba' },
  'Stephen Curry':           { id: '201939',  sport: 'nba' },
  'Kevin Durant':            { id: '201142',  sport: 'nba' },
  'Giannis Antetokounmpo':   { id: '203507',  sport: 'nba' },
  'Jayson Tatum':            { id: '1628369', sport: 'nba' },
  'Luka Doncic':             { id: '1629029', sport: 'nba' },
  'Anthony Davis':           { id: '203076',  sport: 'nba' },
  'Nikola Jokic':            { id: '203999',  sport: 'nba' },
  'Devin Booker':            { id: '1626164', sport: 'nba' },
  'Joel Embiid':             { id: '203954',  sport: 'nba' },
  'Damian Lillard':          { id: '203081',  sport: 'nba' },
  'Kawhi Leonard':           { id: '202695',  sport: 'nba' },
  'Anthony Edwards':         { id: '1630162', sport: 'nba' },
  'Shai Gilgeous-Alexander': { id: '1628983', sport: 'nba' },
  'Donovan Mitchell':        { id: '1628378', sport: 'nba' },
  'Trae Young':              { id: '1629027', sport: 'nba' },
  'Bam Adebayo':             { id: '1628389', sport: 'nba' },
  'De\'Aaron Fox':           { id: '1628368', sport: 'nba' },
  'Tyrese Haliburton':       { id: '1630169', sport: 'nba' },
  'Victor Wembanyama':       { id: '1641705', sport: 'nba' },
  'Chet Holmgren':           { id: '1631096', sport: 'nba' },
  'Paolo Banchero':          { id: '1631094', sport: 'nba' },
  'Karl-Anthony Towns':      { id: '1626157', sport: 'nba' },
  'Jaylen Brown':            { id: '1627759', sport: 'nba' },
  'Ja Morant':               { id: '1629630', sport: 'nba' },
  // NFL (ESPN IDs)
  'Patrick Mahomes':         { id: '3139477', sport: 'nfl' },
  'Josh Allen':              { id: '3918298', sport: 'nfl' },
  'Lamar Jackson':           { id: '3916387', sport: 'nfl' },
  'Joe Burrow':              { id: '4259545', sport: 'nfl' },
  'Justin Jefferson':        { id: '4262921', sport: 'nfl' },
  'Tyreek Hill':             { id: '3054211', sport: 'nfl' },
  'Travis Kelce':            { id: '2576336', sport: 'nfl' },
  'Christian McCaffrey':     { id: '3054236', sport: 'nfl' },
  'Saquon Barkley':          { id: '3929630', sport: 'nfl' },
  'CeeDee Lamb':             { id: '4241478', sport: 'nfl' },
  'Ja\'Marr Chase':          { id: '4429795', sport: 'nfl' },
  'Derrick Henry':           { id: '3054220', sport: 'nfl' },
  'Justin Herbert':          { id: '4038941', sport: 'nfl' },
  'Davante Adams':           { id: '2971618', sport: 'nfl' },
  'Stefon Diggs':            { id: '2976499', sport: 'nfl' },
  'Cooper Kupp':             { id: '3116406', sport: 'nfl' },
  'Sauce Gardner':           { id: '4569618', sport: 'nfl' },
  'Micah Parsons':           { id: '4427366', sport: 'nfl' },
  // MLB (official MLB Stats API player IDs)
  'Shohei Ohtani':           { id: '660271',  sport: 'mlb' },
  'Mike Trout':              { id: '545361',  sport: 'mlb' },
  'Freddie Freeman':         { id: '518692',  sport: 'mlb' },
  'Aaron Judge':             { id: '592450',  sport: 'mlb' },
  'Manny Machado':           { id: '592518',  sport: 'mlb' },
  'Juan Soto':               { id: '665742',  sport: 'mlb' },
  'Mookie Betts':            { id: '605141',  sport: 'mlb' },
  'Fernando Tatis Jr.':      { id: '665487',  sport: 'mlb' },
  'Fernando Tatis Jr':       { id: '665487',  sport: 'mlb' },
  'Ronald Acuna Jr.':        { id: '660670',  sport: 'mlb' },
  'Ronald Acuna Jr':         { id: '660670',  sport: 'mlb' },
  'Julio Rodriguez':         { id: '677594',  sport: 'mlb' },
  'Vladimir Guerrero Jr.':   { id: '665489',  sport: 'mlb' },
  'Vladimir Guerrero Jr':    { id: '665489',  sport: 'mlb' },
  'Bryce Harper':            { id: '547180',  sport: 'mlb' },
  'Yordan Alvarez':          { id: '670541',  sport: 'mlb' },
  'Pete Alonso':             { id: '624413',  sport: 'mlb' },
  'Gerrit Cole':             { id: '543037',  sport: 'mlb' },
  // Expanded MLB headshot coverage — matches MLB_PROJECTIONS_2025 & NFBC static players
  'Bobby Witt Jr.':          { id: '677951',  sport: 'mlb' },
  'Bobby Witt Jr':           { id: '677951',  sport: 'mlb' },
  'Kyle Tucker':             { id: '663739',  sport: 'mlb' },
  'Corbin Carroll':          { id: '682998',  sport: 'mlb' },
  'Randy Arozarena':         { id: '668227',  sport: 'mlb' },
  'Elly De La Cruz':         { id: '682829',  sport: 'mlb' },
  'Jose Ramirez':            { id: '608070',  sport: 'mlb' },
  'Corey Seager':            { id: '608369',  sport: 'mlb' },
  'Gunnar Henderson':        { id: '683002',  sport: 'mlb' },
  'Trea Turner':             { id: '607208',  sport: 'mlb' },
  'Matt Olson':              { id: '621566',  sport: 'mlb' },
  'Christian Walker':        { id: '572233',  sport: 'mlb' },
  'Jose Altuve':             { id: '514888',  sport: 'mlb' },
  'Marcus Semien':           { id: '543760',  sport: 'mlb' },
  'Ozzie Albies':            { id: '645277',  sport: 'mlb' },
  'Jeff McNeil':             { id: '657108',  sport: 'mlb' },
  'Austin Riley':            { id: '663586',  sport: 'mlb' },
  'Rafael Devers':           { id: '646240',  sport: 'mlb' },
  'Nolan Arenado':           { id: '571448',  sport: 'mlb' },
  'Adley Rutschman':         { id: '668939',  sport: 'mlb' },
  'Will Smith':              { id: '669257',  sport: 'mlb' },
  'William Contreras':       { id: '661388',  sport: 'mlb' },
  'Sean Murphy':             { id: '669004',  sport: 'mlb' },
  'Cal Raleigh':             { id: '663728',  sport: 'mlb' },
  'Garrett Crochet':         { id: '680694',  sport: 'mlb' },
  'Carlos Rodon':            { id: '607074',  sport: 'mlb' },
  'Spencer Strider':         { id: '675911',  sport: 'mlb' },
  'Zac Gallen':              { id: '668678',  sport: 'mlb' },
  'Logan Webb':              { id: '657277',  sport: 'mlb' },
  'Dylan Cease':             { id: '656302',  sport: 'mlb' },
  'Corbin Burnes':           { id: '669203',  sport: 'mlb' },
  'Max Fried':               { id: '608331',  sport: 'mlb' },
  'Yoshinobu Yamamoto':      { id: '808982',  sport: 'mlb' },
  'Sandy Alcantara':         { id: '645261',  sport: 'mlb' },
  'Shane McClanahan':        { id: '663459',  sport: 'mlb' },
  'Edwin Diaz':              { id: '621242',  sport: 'mlb' },
  'Ryan Helsley':            { id: '658668',  sport: 'mlb' },
  'Josh Hader':              { id: '623352',  sport: 'mlb' },
  'Felix Bautista':          { id: '676801',  sport: 'mlb' },
  'Devin Williams':          { id: '642099',  sport: 'mlb' },
  'Zack Wheeler':            { id: '554430',  sport: 'mlb' },
  'Hunter Brown':            { id: '686613',  sport: 'mlb' },
  'Emmanuel Clase':          { id: '667670',  sport: 'mlb' },
  'Paul Skenes':             { id: '694973',  sport: 'mlb' },
  'Jackson Chourio':         { id: '694192',  sport: 'mlb' },
  'Jackson Merrill':         { id: '694197',  sport: 'mlb' },
  'CJ Abrams':               { id: '682928',  sport: 'mlb' },
  'Tarik Skubal':            { id: '669373',  sport: 'mlb' },
  'Blake Snell':             { id: '605483',  sport: 'mlb' },
} as const;

/** Build a player headshot URL from the PLAYER_HEADSHOT_IDS lookup */
export function getPlayerHeadshotUrl(playerName: string): string | null {
  const entry = PLAYER_HEADSHOT_IDS[playerName];
  if (!entry) return null;
  if (entry.sport === 'nba') {
    return `https://cdn.nba.com/headshots/nba/latest/260x190/${entry.id}.png`;
  }
  if (entry.sport === 'nfl') {
    return `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${entry.id}.png&w=96&h=70&scale=crop&location=origin&transparent=true`;
  }
  if (entry.sport === 'mlb') {
    return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png,w_213,q_auto:best/v1/people/${entry.id}/headshot/67/current`;
  }
  return null;
}
