import {
  Activity, Award, BarChart3, DollarSign, Layers, Medal,
  MessageSquare, PieChart, ShoppingCart, Sparkles, Target,
  TrendingUp, Trophy, Users, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface PromptItem {
  label: string;
  icon: LucideIcon;
  category: string;
  query?: string;
}

export const platformPrompts: Record<string, PromptItem[]> = {
  all: [
    { label: 'Cross-platform arbitrage opportunities', icon: Sparkles, category: 'all' },
    { label: "Today's best value plays across all platforms", icon: TrendingUp, category: 'all' },
    { label: 'Correlated bets: DFS + betting + Kalshi', icon: Layers, category: 'all' },
    { label: "AI model predictions for tonight's games", icon: Activity, category: 'all' }
  ],
  betting: [
    { label: 'NBA picks with best odds tonight', icon: TrendingUp, category: 'betting' },
    { label: 'Live arbitrage alerts across sportsbooks', icon: Zap, category: 'betting' },
    { label: 'Player props with edge (MLB/NBA/NFL)', icon: Target, category: 'betting' },
    { label: 'Sharp money movement analysis', icon: Activity, category: 'betting' },
    { label: 'Parlay builder with EV+ legs', icon: Medal, category: 'betting' }
  ],
  fantasy: [
    { label: 'NFBC draft strategy for my pick position', icon: Trophy, category: 'fantasy' },
    { label: 'Auction value targets and sleepers', icon: ShoppingCart, category: 'fantasy' },
    { label: 'Best ball stacking strategy for NFFC', icon: Award, category: 'fantasy' },
    { label: 'ADP risers and fallers this week', icon: TrendingUp, category: 'fantasy' },
    { label: 'Salary cap week optimization', icon: DollarSign, category: 'fantasy' }
  ],
  dfs: [
    { label: 'DFS NFL optimal lineups for DraftKings', icon: Award, category: 'dfs' },
    { label: 'FanDuel NBA value plays under $5K', icon: DollarSign, category: 'dfs' },
    { label: 'Showdown captain picks with leverage', icon: Medal, category: 'dfs' },
    { label: 'Low ownership tournament stacks', icon: Users, category: 'dfs' },
    { label: 'MLB pitcher-stacks correlation builder', icon: Layers, category: 'dfs' }
  ],
  kalshi: [
    { label: 'Trending',     icon: TrendingUp,  category: 'kalshi', query: 'Show me trending Kalshi prediction markets right now' },
    { label: 'Politics',     icon: Activity,    category: 'kalshi', query: 'Show me Politics prediction markets on Kalshi' },
    { label: 'Sports',       icon: Trophy,      category: 'kalshi', query: 'Show me Sports prediction markets on Kalshi' },
    { label: 'Culture',      icon: Sparkles,    category: 'kalshi', query: 'Show me Culture prediction markets on Kalshi' },
    { label: 'Crypto',       icon: BarChart3,   category: 'kalshi', query: 'Show me Crypto prediction markets on Kalshi' },
    { label: 'Climate',      icon: Activity,    category: 'kalshi', query: 'Show me Climate prediction markets on Kalshi' },
    { label: 'Economics',    icon: DollarSign,  category: 'kalshi', query: 'Show me Economics prediction markets on Kalshi' },
    { label: 'Mentions',     icon: MessageSquare, category: 'kalshi', query: 'Show me top Mentions markets on Kalshi' },
    { label: 'Companies',    icon: Layers,      category: 'kalshi', query: 'Show me Companies prediction markets on Kalshi' },
    { label: 'Financials',   icon: PieChart,    category: 'kalshi', query: 'Show me Financials prediction markets on Kalshi' },
    { label: 'Tech & Science', icon: Zap,       category: 'kalshi', query: 'Show me Tech & Science prediction markets on Kalshi' },
  ]
};

export const sportBettingPrompts: Record<string, PromptItem[]> = {
  nfl: [
    { label: 'NFL best lines and spreads this week', icon: TrendingUp, category: 'betting' },
    { label: 'NFL player props with sharp edge',     icon: Target,     category: 'betting' },
    { label: 'NFL sharp money movement & steam',     icon: Activity,   category: 'betting' },
    { label: 'NFL arbitrage across sportsbooks',     icon: Zap,        category: 'betting' },
    { label: 'NFL parlay builder with EV+ legs',     icon: Medal,      category: 'betting' },
  ],
  nba: [
    { label: 'NBA picks with best odds tonight',     icon: TrendingUp, category: 'betting' },
    { label: 'NBA player props with edge tonight',   icon: Target,     category: 'betting' },
    { label: 'NBA live arbitrage alerts',            icon: Zap,        category: 'betting' },
    { label: 'NBA sharp money movement analysis',    icon: Activity,   category: 'betting' },
    { label: 'NBA parlay builder with EV+ legs',     icon: Medal,      category: 'betting' },
  ],
  mlb: [
    { label: 'MLB best run lines tonight',           icon: TrendingUp, category: 'betting' },
    { label: 'MLB pitcher props with edge',          icon: Target,     category: 'betting' },
    { label: 'MLB first-5 innings sharp plays',      icon: Activity,   category: 'betting' },
    { label: 'MLB arbitrage across sportsbooks',     icon: Zap,        category: 'betting' },
    { label: 'MLB same-game parlay builder',         icon: Medal,      category: 'betting' },
  ],
  nhl: [
    { label: 'NHL best moneylines tonight',          icon: TrendingUp, category: 'betting' },
    { label: 'NHL player props with edge',           icon: Target,     category: 'betting' },
    { label: 'NHL puck line sharp plays',            icon: Activity,   category: 'betting' },
    { label: 'NHL live arbitrage alerts',            icon: Zap,        category: 'betting' },
    { label: 'NHL period-by-period betting angles',  icon: Medal,      category: 'betting' },
  ],
  'ncaa-football': [
    { label: 'College football best lines this week',     icon: TrendingUp, category: 'betting' },
    { label: 'NCAAF player props with edge',              icon: Target,     category: 'betting' },
    { label: 'College football sharp line moves',         icon: Activity,   category: 'betting' },
    { label: 'NCAAF arbitrage opportunities',             icon: Zap,        category: 'betting' },
    { label: 'College football totals with weather edge', icon: Medal,      category: 'betting' },
  ],
  'ncaa-basketball': [
    { label: "Men's college basketball best lines tonight", icon: TrendingUp, category: 'betting' },
    { label: 'NCAAB player props with edge',                icon: Target,     category: 'betting' },
    { label: 'College basketball sharp money plays',        icon: Activity,   category: 'betting' },
    { label: 'NCAAB arbitrage across sportsbooks',          icon: Zap,        category: 'betting' },
    { label: 'College basketball parlay builder',           icon: Medal,      category: 'betting' },
  ],
  'ncaa-basketball-w': [
    { label: "Women's college basketball best lines tonight", icon: TrendingUp, category: 'betting' },
    { label: 'NCAAW player props with edge',                  icon: Target,     category: 'betting' },
    { label: "Women's basketball sharp money plays",          icon: Activity,   category: 'betting' },
    { label: 'NCAAW arbitrage across sportsbooks',            icon: Zap,        category: 'betting' },
    { label: "Women's college basketball parlay builder",     icon: Medal,      category: 'betting' },
  ],
};

export const sportFantasyPrompts: Record<string, PromptItem[]> = {
  nfl: [
    { label: 'NFL waiver wire priorities this week', icon: TrendingUp,  category: 'fantasy' },
    { label: 'NFL start/sit decisions this week',    icon: Trophy,      category: 'fantasy' },
    { label: 'NFL trade value analysis',             icon: ShoppingCart, category: 'fantasy' },
    { label: 'NFL best ball stacking strategy',      icon: Award,       category: 'fantasy' },
    { label: 'NFL ADP risers and fallers',           icon: Activity,    category: 'fantasy' },
  ],
  nba: [
    { label: 'NBA fantasy pickups this week',         icon: TrendingUp,  category: 'fantasy' },
    { label: 'NBA trade value analysis',              icon: ShoppingCart, category: 'fantasy' },
    { label: 'NBA streaming targets by category',     icon: Trophy,      category: 'fantasy' },
    { label: 'NBA injury impact on roster',           icon: Activity,    category: 'fantasy' },
    { label: 'NBA schedule analysis this week',       icon: Award,       category: 'fantasy' },
  ],
  mlb: [
    { label: 'MLB waiver wire SP/RP targets',       icon: TrendingUp, category: 'fantasy' },
    { label: 'MLB hitter and pitcher streamers',    icon: Trophy,     category: 'fantasy' },
    { label: 'MLB IL pickup opportunities',         icon: Activity,   category: 'fantasy' },
    { label: 'MLB matchup-based start/sit',         icon: Award,      category: 'fantasy' },
  ],
  nhl: [
    { label: 'NHL fantasy pickups this week',             icon: TrendingUp,  category: 'fantasy' },
    { label: 'NHL power-play unit streaming targets',     icon: Trophy,      category: 'fantasy' },
    { label: 'NHL trade value analysis',                  icon: ShoppingCart, category: 'fantasy' },
    { label: 'NHL goalie start/sit decisions',            icon: Award,       category: 'fantasy' },
    { label: 'NHL back-to-back schedule impact',          icon: Activity,    category: 'fantasy' },
  ],
  'ncaa-football': [
    { label: 'NCAAF fantasy waiver wire targets',   icon: TrendingUp,  category: 'fantasy' },
    { label: 'College football start/sit decisions', icon: Trophy,     category: 'fantasy' },
    { label: 'NCAAF trade value analysis',          icon: ShoppingCart, category: 'fantasy' },
    { label: 'College football ADP risers/fallers', icon: Activity,    category: 'fantasy' },
    { label: 'NCAAF breakout player targets',       icon: Award,       category: 'fantasy' },
  ],
  'ncaa-basketball': [
    { label: "Men's college basketball fantasy pickups this week", icon: TrendingUp,  category: 'fantasy' },
    { label: 'NCAAB streaming targets and streaming options',      icon: Trophy,      category: 'fantasy' },
    { label: 'NCAAB trade value analysis',                         icon: ShoppingCart, category: 'fantasy' },
    { label: 'College basketball injury updates',                  icon: Activity,    category: 'fantasy' },
    { label: 'NCAAB matchup-based start/sit',                      icon: Award,       category: 'fantasy' },
  ],
  'ncaa-basketball-w': [
    { label: "Women's college basketball fantasy pickups this week", icon: TrendingUp,  category: 'fantasy' },
    { label: 'NCAAW streaming targets and options',                  icon: Trophy,      category: 'fantasy' },
    { label: 'NCAAW trade value analysis',                           icon: ShoppingCart, category: 'fantasy' },
    { label: "Women's college basketball injury updates",            icon: Activity,    category: 'fantasy' },
    { label: 'NCAAW matchup-based start/sit',                        icon: Award,       category: 'fantasy' },
  ],
};

export const sportDFSPrompts: Record<string, PromptItem[]> = {
  nfl: [
    { label: 'NFL DFS optimal lineups for DraftKings', icon: Award,      category: 'dfs' },
    { label: 'NFL FanDuel value plays this week',       icon: DollarSign, category: 'dfs' },
    { label: 'NFL showdown captain picks with leverage', icon: Medal,     category: 'dfs' },
    { label: 'NFL low-ownership GPP stacks',            icon: Users,      category: 'dfs' },
    { label: 'NFL QB-receiver correlation stacks',      icon: Layers,     category: 'dfs' },
  ],
  nba: [
    { label: 'NBA DFS optimal lineups for DraftKings', icon: Award,      category: 'dfs' },
    { label: 'NBA FanDuel value plays under $5K',       icon: DollarSign, category: 'dfs' },
    { label: 'NBA showdown captain picks',              icon: Medal,      category: 'dfs' },
    { label: 'NBA pace-up game stacks',                 icon: Users,      category: 'dfs' },
    { label: 'NBA low-ownership tournament plays',      icon: Layers,     category: 'dfs' },
  ],
  mlb: [
    { label: 'MLB DFS optimal lineups for DraftKings', icon: Award,      category: 'dfs' },
    { label: 'MLB pitcher stacks correlation builder',  icon: Layers,     category: 'dfs' },
    { label: 'MLB FanDuel value plays tonight',         icon: DollarSign, category: 'dfs' },
    { label: 'MLB low-ownership GPP plays',             icon: Users,      category: 'dfs' },
    { label: 'MLB weather-impacted lineup adjustments', icon: Medal,      category: 'dfs' },
  ],
  nhl: [
    { label: 'NHL DFS optimal lineups for DraftKings', icon: Award,      category: 'dfs' },
    { label: 'NHL power-play unit stacks',              icon: Layers,     category: 'dfs' },
    { label: 'NHL FanDuel value plays tonight',         icon: DollarSign, category: 'dfs' },
    { label: 'NHL low-ownership GPP plays',             icon: Users,      category: 'dfs' },
    { label: 'NHL goalie plays and fades',              icon: Medal,      category: 'dfs' },
  ],
  'ncaa-football': [
    { label: 'NCAAF DFS optimal lineups for DraftKings',   icon: Award,      category: 'dfs' },
    { label: 'College football FanDuel value plays',        icon: DollarSign, category: 'dfs' },
    { label: 'NCAAF showdown captain picks',                icon: Medal,      category: 'dfs' },
    { label: 'College football low-ownership GPP stacks',   icon: Users,      category: 'dfs' },
    { label: 'NCAAF QB-receiver correlation stacks',        icon: Layers,     category: 'dfs' },
  ],
  'ncaa-basketball': [
    { label: "Men's college basketball DFS optimal lineups for DraftKings", icon: Award,      category: 'dfs' },
    { label: 'NCAAB FanDuel value plays',                                    icon: DollarSign, category: 'dfs' },
    { label: 'NCAAB showdown captain picks',                                 icon: Medal,      category: 'dfs' },
    { label: 'College basketball low-ownership GPP plays',                   icon: Users,      category: 'dfs' },
    { label: 'NCAAB pace-up game stacks',                                    icon: Layers,     category: 'dfs' },
  ],
  'ncaa-basketball-w': [
    { label: "Women's college basketball DFS optimal lineups for DraftKings", icon: Award,      category: 'dfs' },
    { label: 'NCAAW FanDuel value plays',                                      icon: DollarSign, category: 'dfs' },
    { label: 'NCAAW showdown captain picks',                                   icon: Medal,      category: 'dfs' },
    { label: "Women's basketball low-ownership GPP plays",                     icon: Users,      category: 'dfs' },
    { label: 'NCAAW pace-up game stacks',                                      icon: Layers,     category: 'dfs' },
  ],
};

export const kalshiTopicPrompts: Record<string, PromptItem[]> = {
  Trending: [
    { label: 'What trending Kalshi market has the best edge right now?', icon: TrendingUp, category: 'kalshi' },
    { label: 'Biggest volume moves in the last 24 hours',                icon: Activity,   category: 'kalshi' },
    { label: 'Highest liquidity trending contract today',                icon: BarChart3,  category: 'kalshi' },
    { label: 'Cross-market arbitrage vs trending Kalshi markets',        icon: Zap,        category: 'kalshi' },
  ],
  Politics: [
    { label: '2026 midterm election contracts with market inefficiencies', icon: Activity,   category: 'kalshi' },
    { label: 'Best value on Senate seat prediction markets',               icon: TrendingUp, category: 'kalshi' },
    { label: 'Governor race contract pricing analysis',                    icon: Target,     category: 'kalshi' },
    { label: 'Political market portfolio hedging strategy',                icon: Layers,     category: 'kalshi' },
  ],
  Sports: [
    { label: 'Best value on sports Kalshi contracts vs sportsbooks', icon: TrendingUp, category: 'kalshi' },
    { label: 'Championship winner contract pricing analysis',         icon: Trophy,     category: 'kalshi' },
    { label: 'MVP award prediction market value',                     icon: Award,      category: 'kalshi' },
    { label: 'Sports Kalshi vs DraftKings arbitrage opportunities',   icon: Zap,        category: 'kalshi' },
  ],
  Culture: [
    { label: 'Best value on awards season Kalshi contracts',    icon: Sparkles, category: 'kalshi' },
    { label: 'Oscars / Grammy contract pricing inefficiencies', icon: Award,    category: 'kalshi' },
    { label: 'Celebrity event market analysis right now',       icon: Activity, category: 'kalshi' },
    { label: 'Entertainment prediction market portfolio strategy', icon: Layers, category: 'kalshi' },
  ],
  Crypto: [
    { label: 'Bitcoin price milestone contract analysis',    icon: TrendingUp, category: 'kalshi' },
    { label: 'ETF approval prediction market pricing',       icon: BarChart3,  category: 'kalshi' },
    { label: 'Cross-market crypto vs Kalshi arbitrage',      icon: Zap,        category: 'kalshi' },
    { label: 'Altcoin milestone contract value opportunities', icon: DollarSign, category: 'kalshi' },
  ],
  Climate: [
    { label: 'Hurricane season contract analysis',                      icon: Activity,   category: 'kalshi' },
    { label: 'Temperature record market value vs NOAA forecasts',       icon: TrendingUp, category: 'kalshi' },
    { label: 'Climate event prediction market pricing',                 icon: BarChart3,  category: 'kalshi' },
    { label: 'Best value climate contracts this month',                 icon: Target,     category: 'kalshi' },
  ],
  Economics: [
    { label: 'Fed rate decision contract analysis',          icon: DollarSign, category: 'kalshi' },
    { label: 'CPI / inflation prediction market pricing',    icon: TrendingUp, category: 'kalshi' },
    { label: 'Jobs report contract value opportunities',     icon: BarChart3,  category: 'kalshi' },
    { label: 'GDP prediction market edge vs consensus',      icon: Activity,   category: 'kalshi' },
  ],
  Mentions: [
    { label: 'Top social media mention contract opportunities', icon: Activity,   category: 'kalshi' },
    { label: 'Celebrity brand mention market analysis',         icon: Sparkles,   category: 'kalshi' },
    { label: 'News volume prediction market edge',              icon: TrendingUp, category: 'kalshi' },
    { label: 'Best value mentions markets right now',           icon: Target,     category: 'kalshi' },
  ],
  Companies: [
    { label: 'Earnings announcement contract pricing',      icon: DollarSign, category: 'kalshi' },
    { label: 'M&A announcement prediction market analysis', icon: TrendingUp, category: 'kalshi' },
    { label: 'CEO departure market probability assessment', icon: Activity,   category: 'kalshi' },
    { label: 'Company milestone contract value opportunities', icon: Target,  category: 'kalshi' },
  ],
  Financials: [
    { label: 'S&P 500 milestone prediction market analysis',          icon: TrendingUp, category: 'kalshi' },
    { label: 'Interest rate futures vs Kalshi contract pricing',      icon: DollarSign, category: 'kalshi' },
    { label: 'Treasury yield prediction market value',                icon: BarChart3,  category: 'kalshi' },
    { label: 'Stock market milestone contract portfolio strategy',    icon: Layers,     category: 'kalshi' },
  ],
  'Tech & Science': [
    { label: 'AI company milestone contract analysis',        icon: Zap,        category: 'kalshi' },
    { label: 'Tech earnings prediction market value',         icon: TrendingUp, category: 'kalshi' },
    { label: 'Space launch success prediction market pricing', icon: Activity,  category: 'kalshi' },
    { label: 'Scientific breakthrough contract opportunities', icon: Sparkles,  category: 'kalshi' },
  ],
};

export const sportAllPrompts: Record<string, PromptItem[]> = {
  mlb: [
    { label: 'MLB best bets and value plays today',          icon: TrendingUp, category: 'all' },
    { label: 'MLB player props with edge tonight',           icon: Target,     category: 'all' },
    { label: 'MLB DFS optimal lineups for DraftKings',       icon: Award,      category: 'all' },
    { label: 'MLB arbitrage across sportsbooks',             icon: Zap,        category: 'all' },
  ],
  nba: [
    { label: 'NBA best bets and spreads tonight',            icon: TrendingUp, category: 'all' },
    { label: 'NBA player props with edge tonight',           icon: Target,     category: 'all' },
    { label: 'NBA DFS optimal lineups for DraftKings',       icon: Award,      category: 'all' },
    { label: 'NBA arbitrage across sportsbooks',             icon: Zap,        category: 'all' },
  ],
  nfl: [
    { label: 'NFL best bets and spreads this week',          icon: TrendingUp, category: 'all' },
    { label: 'NFL player props with sharp edge',             icon: Target,     category: 'all' },
    { label: 'NFL DFS optimal lineups for DraftKings',       icon: Award,      category: 'all' },
    { label: 'NFL arbitrage across sportsbooks',             icon: Zap,        category: 'all' },
  ],
  nhl: [
    { label: 'NHL best bets and puck lines tonight',         icon: TrendingUp, category: 'all' },
    { label: 'NHL player props with edge tonight',           icon: Target,     category: 'all' },
    { label: 'NHL DFS optimal lineups for DraftKings',       icon: Award,      category: 'all' },
    { label: 'NHL arbitrage across sportsbooks',             icon: Zap,        category: 'all' },
  ],
  'ncaa-football': [
    { label: 'NCAAF best bets and spreads this week',        icon: TrendingUp, category: 'all' },
    { label: 'NCAAF sharp money movement analysis',          icon: Activity,   category: 'all' },
    { label: 'NCAAF DFS optimal lineups',                    icon: Award,      category: 'all' },
    { label: 'NCAAF arbitrage opportunities',                icon: Zap,        category: 'all' },
  ],
  'ncaa-basketball': [
    { label: "Men's college basketball best bets tonight",   icon: TrendingUp, category: 'all' },
    { label: 'NCAAB sharp money movement analysis',          icon: Activity,   category: 'all' },
    { label: 'NCAAB DFS optimal lineups',                    icon: Award,      category: 'all' },
    { label: 'NCAAB arbitrage opportunities',                icon: Zap,        category: 'all' },
  ],
  'ncaa-basketball-w': [
    { label: "Women's college basketball best bets tonight", icon: TrendingUp, category: 'all' },
    { label: 'NCAAW sharp money movement analysis',          icon: Activity,   category: 'all' },
    { label: 'NCAAW DFS optimal lineups',                    icon: Award,      category: 'all' },
    { label: 'NCAAW arbitrage opportunities',                icon: Zap,        category: 'all' },
  ],
};

// Sport-selection pills — shown when a category tab is active but no sport has been chosen.
// query strings start with the sport name so extractSport() reliably detects them.
export const sportSelectionBettingPrompts: PromptItem[] = [
  { label: 'NBA Odds Tonight',      icon: TrendingUp, category: 'betting', query: 'NBA basketball betting odds and lines tonight' },
  { label: 'NFL Odds',              icon: Activity,   category: 'betting', query: 'NFL football betting odds and best lines this week' },
  { label: 'MLB Odds',              icon: Target,     category: 'betting', query: 'MLB baseball betting odds and run lines tonight' },
  { label: 'NHL Odds',              icon: Zap,        category: 'betting', query: 'NHL hockey betting odds and puck lines tonight' },
  { label: "Men's NCAAB Odds",      icon: Award,      category: 'betting', query: "NCAAB men's college basketball betting odds tonight" },
  { label: "Women's NCAAW Odds",    icon: Award,      category: 'betting', query: "NCAAW women's college basketball betting odds tonight" },
  { label: 'UFC/MMA Odds',          icon: Medal,      category: 'betting', query: 'UFC MMA fight odds and best bets this weekend' },
];

export const sportSelectionFantasyPrompts: PromptItem[] = [
  { label: 'NFL Fantasy', icon: Trophy,     category: 'fantasy', query: 'NFL fantasy football waiver wire and start sit advice this week' },
  { label: 'NBA Fantasy', icon: TrendingUp, category: 'fantasy', query: 'NBA fantasy basketball pickups and trade value this week' },
  { label: 'MLB Fantasy', icon: Target,     category: 'fantasy', query: 'MLB fantasy baseball waiver wire and streamer targets this week' },
  { label: 'NHL Fantasy', icon: Medal,      category: 'fantasy', query: 'NHL fantasy hockey pickups and power-play targets this week' },
];

export const sportSelectionDFSPrompts: PromptItem[] = [
  { label: 'NBA DFS Tonight', icon: Award,      category: 'dfs', query: 'NBA DFS optimal lineups and value plays for DraftKings tonight' },
  { label: 'NFL DFS',         icon: Medal,      category: 'dfs', query: 'NFL DFS optimal lineups and GPP stacks for DraftKings this week' },
  { label: 'MLB DFS',         icon: DollarSign, category: 'dfs', query: 'MLB DFS optimal lineups and pitcher stacks for DraftKings tonight' },
];

export function getHardcodedQuickActions(
  selectedCategory: string,
  selectedSport: string,
  selectedKalshiTopic: string,
): PromptItem[] {
  if (selectedCategory === 'kalshi' && selectedKalshiTopic && kalshiTopicPrompts[selectedKalshiTopic]) {
    return kalshiTopicPrompts[selectedKalshiTopic];
  }
  if (selectedSport) {
    if (selectedCategory === 'betting' && sportBettingPrompts[selectedSport]) return sportBettingPrompts[selectedSport];
    if (selectedCategory === 'fantasy' && sportFantasyPrompts[selectedSport]) return sportFantasyPrompts[selectedSport];
    if (selectedCategory === 'dfs'     && sportDFSPrompts[selectedSport])     return sportDFSPrompts[selectedSport];
    if (selectedCategory === 'all'     && sportAllPrompts[selectedSport])     return sportAllPrompts[selectedSport];
  }
  if (!selectedSport) {
    if (selectedCategory === 'betting') return sportSelectionBettingPrompts;
    if (selectedCategory === 'fantasy') return sportSelectionFantasyPrompts;
    if (selectedCategory === 'dfs')     return sportSelectionDFSPrompts;
  }
  return platformPrompts[selectedCategory] ?? platformPrompts.all;
}
