import type { InsightCard } from '@/lib/cards-generator';

export interface ImageAttachment {
  name: string;
  base64: string;
  mimeType: string;
}

export interface AnalyzeContext {
  sport?: string | null;
  marketType?: string | null;
  platform?: string | null;
  isSportsQuery?: boolean;
  isPoliticalMarket?: boolean;
  hasFantasyIntent?: boolean;
  hasBettingIntent?: boolean;
  oddsData?: any;
  noGamesAvailable?: boolean;
  noGamesMessage?: string;
  previousMessages?: Array<{ role: string; content: string }>;
  kalshiSubcategory?: string;
  selectedCategory?: string;
  oddsKeyMissing?: boolean;
  leagueSize?: number;
  leagueScoringFormat?: string;
  hasPlayerIntent?: boolean;
  playerName?: string;
}

export interface AnalyzeRequestBody {
  userMessage: string;
  existingCards?: InsightCard[];
  customInstructions?: string;
  imageAttachments?: ImageAttachment[];
  deepThink?: boolean;
  context?: AnalyzeContext;
}

export interface SportDetectionResult {
  inferredSport: string | undefined;
  isMLBQuery: boolean;
  hasADPIntent: boolean;
  hasStartSitIntent: boolean;
  hasMLBProjectionIntent: boolean;
  hasHRPredictionIntent: boolean;
  hasKalshiToolIntent: boolean;
  isMLBStatcastMode: boolean;
  expectsStatcastJSON: boolean;
  category: string;
  isAmbiguous: boolean;
  needsFantasySport: boolean;
  needsDFSSport: boolean;
  needsBettingSport: boolean;
  hasPropsIntentEarly: boolean;
  hasKellyIntentEarly: boolean;
  hasLineMovementIntent: boolean;
  hasPropsToolIntent: boolean;
  rawQueryLower: string;
}

export interface EnrichmentResult {
  enrichedPrompt: string;
  kalshiSportsFallbackMarkets: any[] | null;
  kalshiPromptMarkets: any[] | null;
  serverFetchedOdds: boolean;
  noLiveGamesDetected: boolean;
  statcastInjected: boolean;
}

export interface ToolResultsOutput {
  pendingADPCard: InsightCard | null;
  pendingADPUploadCard: InsightCard | null;
  pendingStatcastCard: InsightCard | null;
  pendingHRPredictionCard: InsightCard | null;
  pendingDFSSlateCard: InsightCard | null;
  pendingDFSGamesCard: InsightCard | null;
  pendingDFSLineupCard: InsightCard | null;
  skipStatcastJSON: boolean;
}
