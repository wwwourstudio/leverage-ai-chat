/**
 * Prompt template system.
 *
 * Provides a typed PromptTemplate interface and a curated set of default
 * templates organized by category. Users can extend this via custom
 * instructions or user-saved templates stored in Supabase.
 */

export interface PromptTemplate {
  id: string;
  label: string;
  /** Short description shown on hover */
  description: string;
  /** One of the app's category identifiers */
  category: 'betting' | 'fantasy' | 'dfs' | 'kalshi' | 'mlb' | 'all';
  /** The actual prompt text to inject into the chat input */
  prompt: string;
}

// ── Default templates ─────────────────────────────────────────────────────────

export const DEFAULT_PROMPT_TEMPLATES: PromptTemplate[] = [
  // Betting
  {
    id: 'best-bets-tonight',
    label: 'Best bets tonight',
    description: 'Get top-value bets across all sports for today',
    category: 'betting',
    prompt: 'What are the best value bets across all sports tonight? Show me the top edges with Kelly criterion sizing.',
  },
  {
    id: 'arbitrage-scan',
    label: 'Arbitrage scan',
    description: 'Find cross-book arbitrage opportunities',
    category: 'betting',
    prompt: 'Scan for current arbitrage opportunities across major sportsbooks. Show guaranteed profit margins and bet amounts.',
  },
  {
    id: 'line-movement-alert',
    label: 'Sharp money moves',
    description: 'Identify significant line movement driven by sharp action',
    category: 'betting',
    prompt: 'Which games today have significant sharp money line movement? I want to tail the wiseguys.',
  },

  // Fantasy
  {
    id: 'waiver-pickups',
    label: 'Waiver wire pickups',
    description: 'Top adds for your fantasy roster',
    category: 'fantasy',
    prompt: 'What are the best waiver wire pickups this week? Focus on players with high upside and low ownership.',
  },
  {
    id: 'trade-analyzer',
    label: 'Trade analyzer',
    description: 'Evaluate a fantasy trade proposal',
    category: 'fantasy',
    prompt: 'Help me analyze this fantasy trade: [describe your trade here]. Who wins and why?',
  },
  {
    id: 'ros-rankings',
    label: 'ROS rankings',
    description: 'Rest-of-season player rankings',
    category: 'fantasy',
    prompt: 'Give me your rest-of-season rankings for [position/sport]. Include injury risk, schedule, and target share.',
  },

  // DFS
  {
    id: 'dfs-lineup',
    label: 'DFS lineup builder',
    description: 'Optimal DFS lineup for tonight',
    category: 'dfs',
    prompt: 'Build me an optimal DFS lineup for DraftKings tonight. Focus on high-upside plays with good value.',
  },
  {
    id: 'gpp-stack',
    label: 'GPP stack strategy',
    description: 'Tournament lineup with correlated stacks',
    category: 'dfs',
    prompt: 'What is the best GPP stack strategy for tonight? I want a contrarian lineup with ceiling upside.',
  },
  {
    id: 'value-plays',
    label: 'Value plays under $5K',
    description: 'Budget-friendly DFS options',
    category: 'dfs',
    prompt: 'What are the best DFS value plays under $5,000 salary tonight? I need to free up salary for premium plays.',
  },

  // Kalshi
  {
    id: 'kalshi-edges',
    label: 'Kalshi market edges',
    description: 'Mispriced prediction market contracts',
    category: 'kalshi',
    prompt: 'Which Kalshi prediction markets currently look mispriced? Show me edges based on actual probabilities vs. market prices.',
  },
  {
    id: 'election-markets',
    label: 'Political market analysis',
    description: 'Election and political Kalshi contracts',
    category: 'kalshi',
    prompt: 'Analyze the current Kalshi election and political markets. Where are the biggest pricing inefficiencies?',
  },

  // MLB
  {
    id: 'statcast-leaders',
    label: 'Statcast leaders',
    description: 'Top performers by advanced metrics',
    category: 'mlb',
    prompt: 'Show me the current Statcast leaders in xwOBA, barrel rate, and hard hit percentage. Who is overperforming or underperforming their metrics?',
  },
  {
    id: 'hr-props',
    label: 'HR prop analysis',
    description: 'Home run prop betting edges',
    category: 'mlb',
    prompt: 'Which MLB home run props have the best edge tonight? Use Statcast exit velocity and barrel rate data.',
  },
  {
    id: 'pitcher-matchups',
    label: 'Pitcher matchup edges',
    description: 'Favorable pitching matchups for bets',
    category: 'mlb',
    prompt: "Analyze tonight's pitcher matchups. Which pitchers have a significant advantage based on opposing lineup xwOBA and platoon splits?",
  },
];

/**
 * Get templates filtered by category. Pass 'all' to get every template.
 */
export function getTemplatesByCategory(category: PromptTemplate['category'] | 'all'): PromptTemplate[] {
  if (category === 'all') return DEFAULT_PROMPT_TEMPLATES;
  return DEFAULT_PROMPT_TEMPLATES.filter((t) => t.category === category || t.category === 'all');
}

/**
 * Get a single template by ID, or undefined if not found.
 */
export function getTemplateById(id: string): PromptTemplate | undefined {
  return DEFAULT_PROMPT_TEMPLATES.find((t) => t.id === id);
}
