import type { InsightCard } from '@/lib/cards-generator';
import type { FileAttachment } from '@/lib/hooks/useFileHandling';
import type { ChatMessage as HookChatMessage } from '@/lib/hooks/useChat';

export interface APIResponse<T = any> {
  success: boolean;
  error?: string;
  data?: T;
  text?: string;
  cards?: InsightCard[];
  confidence?: number;
  sources?: Array<{
    name: string;
    type: 'database' | 'api' | 'model' | 'cache';
    reliability: number;
    url?: string;
  }>;
  model?: string;
  modelUsed?: string;
  trustMetrics?: TrustMetrics;
  useFallback?: boolean;
  details?: string;
  errorType?: string;
  clarificationNeeded?: boolean;
  clarificationOptions?: string[];
  processingTime?: number;
}

export interface OddsEvent {
  sport_title: string;
  bookmakers?: Array<{
    key: string;
    title: string;
    markets: any[];
  }>;
}

export interface TrustMetrics {
  benfordIntegrity: number;
  oddsAlignment: number;
  marketConsensus: number;
  historicalAccuracy: number;
  finalConfidence: number;
  trustLevel: 'high' | 'medium' | 'low';
  flags?: Array<{
    type: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
  }>;
  riskLevel: 'low' | 'medium' | 'high';
  adjustedTone?: string;
  modelUsed?: string;
  sources?: Array<{ name: string; type: string; reliability: number }>;
  processingTime?: number;
  hasLiveOdds?: boolean;
  hasKalshi?: boolean;
}

export interface Message extends HookChatMessage {
  cards?: InsightCard[];
  trustMetrics?: TrustMetrics;
  attachments?: FileAttachment[];
  voted?: 'up' | 'down';
}

export interface ServerDataResult {
  initialCards: Record<string, unknown>[];
  initialInsights: { stats: Record<string, unknown> | null; preferences: Record<string, unknown> | null } | null;
  userSession: { user: { id: string; email: string | undefined; name: string } } | null;
  serverTime: string;
  missingKeys: string[];
  envErrors: string[];
  dataSourcesUsed: string[];
  fetchErrors: string[];
}

export type ServerDataProps = ServerDataResult;
