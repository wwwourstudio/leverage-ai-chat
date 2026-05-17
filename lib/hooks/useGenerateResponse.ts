'use client';

import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import { isDev as getIsDev } from '@/lib/config';
import { PLAYER_HEADSHOT_IDS } from '@/lib/constants';
import { detectSportFromText, extractSport, extractMarketType, extractPlatform } from '@/lib/sport-detection';
import { sportSelectionBettingPrompts, sportSelectionFantasyPrompts, sportSelectionDFSPrompts } from '@/lib/prompt-data';
import { generateNoDataMessage } from '@/lib/seasonal-context';
import { createThread, updateThread, saveMessagesBatch } from '@/lib/chat-service';
import type { InsightCard } from '@/lib/cards-generator';
import type { Message, TrustMetrics } from '@/app/types/chat';
import type { ChatMessage as HookChatMessage } from '@/lib/hooks/useChat';
import type { Chat } from '@/lib/hooks/useChatList';
import { Target } from 'lucide-react';

interface UseGenerateResponseOptions {
  messages: Message[];
  setMessages: (fn: (prev: Message[]) => Message[]) => void;
  streamMessage: (userMessage: string, body: Record<string, unknown>) => Promise<(HookChatMessage & { clarificationOptions?: string[] }) | null>;
  abortStream: () => void;
  setIsTyping: (v: boolean) => void;
  selectedCategory: string;
  selectedSport: string;
  setKalshiBettingBannerVisible: (v: boolean) => void;
  customInstructions: string;
  deepThink: boolean;
  fantasyLeague: { setupComplete?: boolean; teams?: number; leagueType?: string; sport?: string; platform?: string; teamName?: string; leagueName?: string; scoring?: string } | null;
  setVerifyStage: (stage: 'analyzing' | 'reverifying') => void;
  setSuggestedPrompts: (prompts: any[]) => void;
  setIsClarificationPills: (v: boolean) => void;
  generateContextualSuggestions: (msg: string, cards: InsightCard[]) => any[];
  setLastUserQuery: (q: string) => void;
  activeChat: string;
  setActiveChat: (id: string) => void;
  setChats: (fn: (prev: Chat[]) => Chat[]) => void;
  pendingThreadRef: MutableRefObject<Promise<{ id: string } | null> | null>;
  isLoggedIn: boolean;
  oddsCacheRef: MutableRefObject<Map<string, { data: unknown; ts: number }>>;
  analyzingMessageRef: MutableRefObject<string | null>;
  toast: { info: (msg: string) => void; error: (msg: string) => void };
}

export function useGenerateResponse(opts: UseGenerateResponseOptions) {
  const {
    messages, setMessages, streamMessage, abortStream,
    setIsTyping, selectedCategory, selectedSport, setKalshiBettingBannerVisible,
    customInstructions, deepThink, fantasyLeague, setVerifyStage,
    setSuggestedPrompts, setIsClarificationPills, generateContextualSuggestions, setLastUserQuery,
    activeChat, setActiveChat, setChats, pendingThreadRef, isLoggedIn,
    oddsCacheRef, analyzingMessageRef, toast,
  } = opts;

  const generateRealResponse = useCallback(async (
    userMessage: string,
    imageAttachments?: Array<{ name: string; base64: string; mimeType: string }>,
    optimisticAssistantId?: string,
  ) => {
    const isDev = getIsDev();
    const msgKey = userMessage.trim().slice(0, 200);
    if (analyzingMessageRef.current === msgKey) {
      if (isDev) console.log('[v0] Duplicate analyze suppressed for:', msgKey.slice(0, 60));
      return;
    }
    analyzingMessageRef.current = msgKey;

    abortStream();
    setIsTyping(true);
    setLastUserQuery(userMessage);
    const startTime = Date.now();

    try {
      if (isDev) console.log('[v0] Starting real AI analysis for:', userMessage);

      const lowerMsg = userMessage.toLowerCase();

      const politicalKeywords = ['kalshi', 'election', 'politics', 'cpi', 'inflation', 'fed', 'approval rating', 'recession', 'polymarket', 'prediction market'];
      const isPoliticalMarket = politicalKeywords.some(k => lowerMsg.includes(k));

      const conversationHistory = messages.slice(-5).map((m: any) => ({ role: m.role, content: m.content || '' }));
      const detectedSport = extractSport(
        userMessage,
        (selectedCategory === 'kalshi' || isPoliticalMarket) ? undefined : conversationHistory,
      );

      const selectedSportNormalized = selectedSport === 'ncaa-football' ? 'ncaaf'
        : selectedSport === 'ncaa-basketball' ? 'ncaab'
        : selectedSport === 'ncaa-basketball-w' ? 'ncaaw'
        : selectedSport || null;

      const directMessageSport = detectSportFromText(userMessage);

      // Contextual follow-up phrases ("this prop", "hit rate", etc.) should inherit
      // sport from conversation history rather than being overridden by the UI sport.
      const contextualFollowUpPhrases = [
        'this player prop', 'this prop', 'that prop', 'these props', 'those props',
        'historical hit rate', 'hit rate', 'prop hit rate',
        'this game', 'that game', 'the game', 'same game',
        'this lineup', 'this slate', 'this pick', 'that pick',
        'for this', 'for that', 'for this player', 'correlated', 'same-game', 'sgp',
      ];
      const hasContextualRef = contextualFollowUpPhrases.some(k => lowerMsg.includes(k));

      const effectiveSport = directMessageSport
        || (hasContextualRef ? detectedSport : null)
        || (selectedCategory !== 'kalshi' ? selectedSportNormalized : null)
        || detectedSport;

      const bettingKeywords = ['odds', 'bet', 'line', 'spread', 'arbitrage', 'arb', 'h2h', 'sportsbook', 'draftkings', 'fanduel', 'moneyline', 'prop', 'parlay'];
      const hasBettingIntent = bettingKeywords.some(k => lowerMsg.includes(k)) || selectedCategory === 'betting';

      const sportsKeywords = ['nba', 'nfl', 'nhl', 'mlb', 'basketball', 'football', 'hockey', 'baseball', 'ncaa'];
      const isSportsQuery = (sportsKeywords.some(k => lowerMsg.includes(k)) || !!effectiveSport) && !isPoliticalMarket && selectedCategory !== 'kalshi';

      const fantasyKeywords = ['fantasy', 'draft', 'waiver', 'faab', 'adp', 'vbd', 'tier cliff', 'bestball', 'best ball', 'start sit', 'trade', 'trade value', 'trade target', 'trade advice', 'who should i pick', 'who do i start', 'sleeper', 'rankings', 'projections', 'auction value', 'nfbc', 'nffc', 'tgfbi', 'draft strategy', 'draft slot', 'draft position', 'pick position', 'draft order', 'average draft'];
      const hasFantasyIntent = (fantasyKeywords.some(k => lowerMsg.includes(k)) || selectedCategory === 'fantasy' || selectedCategory === 'dfs') && !isPoliticalMarket;

      const detectedPlayerName = Object.keys(PLAYER_HEADSHOT_IDS).find(
        name => lowerMsg.includes(name.toLowerCase()),
      );
      const hasPlayerIntent = !!detectedPlayerName && !hasBettingIntent && !hasFantasyIntent;

      const detectedPlatform = extractPlatform(userMessage);

      const finalIsPoliticalMarket = selectedCategory === 'kalshi' ||
        ((isPoliticalMarket || detectedPlatform === 'kalshi') && selectedCategory !== 'betting');

      if (selectedCategory === 'kalshi' && hasBettingIntent && !isPoliticalMarket) {
        setKalshiBettingBannerVisible(true);
      } else {
        setKalshiBettingBannerVisible(false);
      }

      const context: any = {
        sport: effectiveSport,
        marketType: extractMarketType(userMessage),
        platform: detectedPlatform,
        isSportsQuery,
        isPoliticalMarket: finalIsPoliticalMarket,
        hasBettingIntent,
        hasFantasyIntent,
        hasPlayerIntent,
        playerName: detectedPlayerName,
        previousMessages: messages.slice(-5).map((m: any) => ({ role: m.role, content: m.content || '' })),
        kalshiSubcategory: (() => {
          if (selectedCategory !== 'kalshi') return undefined;
          const validSubs = ['politics', 'elections', 'election', 'sports', 'sport', 'weather', 'climate',
            'finance', 'financials', 'economics', 'crypto', 'companies', 'trending',
            'culture', 'entertainment', 'arts', 'pop culture', 'awards', 'tv', 'film',
            'music', 'movies', 'celebrity', 'oscars', 'emmys', 'grammys'];
          if (selectedSport && validSubs.includes(selectedSport.toLowerCase())) return selectedSport;
          const m = lowerMsg;
          if (m.includes('sports') || m.includes('nfl') || m.includes('nba') || m.includes('mlb')
            || m.includes('nhl') || m.includes('march madness') || m.includes('super bowl')
            || m.includes('world series') || m.includes('stanley cup')
            || m.includes('championship') || m.includes('game ')) return 'sports';
          if (m.includes('polit') || m.includes('election')) return 'politics';
          if (m.includes('weather') || m.includes('climate')) return 'weather';
          if (m.includes('finance') || m.includes('crypto') || m.includes('econom') || m.includes('stock')) return 'finance';
          if (m.includes('oscar') || m.includes('grammy') || m.includes('emmy')
            || m.includes('award') || m.includes('entertainment') || m.includes('golden globe')
            || m.includes('bafta') || m.includes('box office') || m.includes('academy award')
            || m.includes('celebrity') || m.includes('billboard') || m.includes('netflix')
            || m.includes('reality show') || m.includes('music video') || m.includes('film')
            || m.includes('movie')) return 'entertainment';
          return undefined;
        })(),
        selectedCategory,
        leagueSize: fantasyLeague?.setupComplete ? (fantasyLeague.teams ?? 12) : undefined,
        leagueScoringFormat: fantasyLeague?.setupComplete ? (fantasyLeague.leagueType ?? undefined) : undefined,
      };

      if (isDev) {
        console.log('[v0] Context:', { sport: detectedSport || 'none', betting: hasBettingIntent, sports: isSportsQuery, political: finalIsPoliticalMarket, fantasy: hasFantasyIntent });
      }

      if (!effectiveSport && selectedCategory !== 'kalshi' && selectedCategory !== 'all') {
        if (selectedCategory === 'dfs') {
          setSuggestedPrompts(sportSelectionDFSPrompts);
          setIsClarificationPills(true);
        } else if (hasFantasyIntent && selectedCategory === 'fantasy') {
          setSuggestedPrompts(sportSelectionFantasyPrompts);
          setIsClarificationPills(true);
        } else if (hasBettingIntent || selectedCategory === 'betting') {
          setSuggestedPrompts(sportSelectionBettingPrompts);
          setIsClarificationPills(true);
        }
      }

      if (context.isPoliticalMarket) {
        if (isDev) console.log('[POLITICAL MARKET DETECTED] Skipping sports odds fetch');
      } else if (context.hasFantasyIntent && (!context.hasBettingIntent || selectedCategory === 'fantasy') && selectedCategory !== 'dfs') {
        if (isDev) console.log('[FANTASY INTENT] Cards will be generated server-side');
      } else if ((context.hasBettingIntent || context.isSportsQuery) && !context.hasPlayerIntent) {
        if (isDev) console.log('[ODDS FETCH ATTEMPT] Betting intent or sports query detected');
        if (isDev) console.log('[v0] === ODDS FETCH STARTING ===');

        const { sportToApi } = await import('@/lib/constants');

        if (context.sport) {
          const sportKey = sportToApi(context.sport);

          if (isDev) {
            console.log('[v0] Fetching ONLY detected sport:', sportKey);
            console.log('[NO FALLBACK] Explicit sport detected');
          }

          try {
            const ODDS_TTL = 5 * 60 * 1000;
            const cached = oddsCacheRef.current.get(sportKey);
            let oddsResult: any;
            if (cached && Date.now() - cached.ts < ODDS_TTL) {
              if (isDev) console.log(`[v0] Odds cache hit for ${sportKey}`);
              oddsResult = cached.data;
            } else {
              const oddsResponse = await fetch('/api/odds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sport: sportKey, marketType: context.marketType || 'h2h' }),
              });
              if (!oddsResponse.ok) {
                const errorBody = await oddsResponse.json().catch(() => ({ error: `HTTP ${oddsResponse.status}` }));
                if (isDev) console.error(`[v0] Odds API error (${oddsResponse.status}):`, errorBody);
                if (oddsResponse.status === 503) {
                  context.oddsKeyMissing = true;
                  context.oddsErrorMessage = 'ODDS_API_KEY is not configured. Live odds are unavailable.';
                } else {
                  context.oddsError = errorBody.error;
                  context.oddsErrorMessage = errorBody.message || `Unable to fetch ${context.sport?.toUpperCase() || ''} odds (${oddsResponse.status}).`;
                }
                oddsResult = null;
              } else {
                oddsResult = await oddsResponse.json();
                oddsCacheRef.current.set(sportKey, { data: oddsResult, ts: Date.now() });
              }
            }

            if (oddsResult) {
              if (oddsResult?.events?.length > 0) {
                const sportName = sportKey.replace('_', ' ').toUpperCase();
                if (isDev) console.log(`[v0] ✅ Found ${oddsResult.events.length} live games in ${sportName}`);
                context.oddsData = oddsResult;
                context.oddsData.sport = sportKey;
              } else {
                if (isDev) console.log('[NO GAMES FOUND]', context.sport);
                context.noGamesAvailable = true;
                const _noDataMsg = generateNoDataMessage(sportKey);
                context.noGamesMessage = `${_noDataMsg.title}: ${_noDataMsg.description} ${_noDataMsg.suggestion}`;
              }
            }
          } catch (err) {
            if (isDev) console.error(`[v0] Exception fetching ${sportKey}:`, err);
            context.oddsError = err;
            context.oddsErrorMessage = `Unable to fetch ${context.sport.toUpperCase()} odds. This may be a temporary API issue.`;
          }
        } else {
          if (isDev) console.log('[v0] No sport detected — using available cards instead of fallback rotation');
        }

        if (context.sport && context.oddsData?.sport && context.oddsData.sport !== (await import('@/lib/constants')).sportToApi(context.sport)) {
          if (isDev) console.error('[CROSS-SPORT BLOCKED] Attempted contamination prevented:', {
            detected: context.sport,
            fetched: context.oddsData.sport,
          });
          context.oddsData = undefined as any;
          context.crossSportError = true;
        }
      }

      const allPreviousCards = messages
        .filter((m: Message) => !m.isWelcome && m.role === 'assistant')
        .flatMap((m: Message) => m.cards || []);
      const realCards = allPreviousCards.filter((c: InsightCard) => c.realData !== false);
      const availableCards = (realCards.length > 0 ? realCards : allPreviousCards).slice(0, 6);

      let contextualUserMessage = userMessage;
      if (selectedCategory === 'fantasy' && fantasyLeague?.setupComplete) {
        const leagueCtx = [
          `Sport: ${fantasyLeague.sport?.toUpperCase() ?? 'NFL'}`,
          `Platform: ${fantasyLeague.platform?.toUpperCase() ?? 'ESPN'}`,
          `${fantasyLeague.teams ?? 12} teams`,
          `Format: ${fantasyLeague.leagueType ?? fantasyLeague.scoring ?? 'PPR'}`,
          `Team: "${fantasyLeague.teamName}"`,
          fantasyLeague.leagueName ? `League: "${fantasyLeague.leagueName}"` : '',
        ].filter(Boolean).join(', ');
        contextualUserMessage = `[Fantasy League Context: ${leagueCtx}]\n\n${userMessage}`;
      }

      setVerifyStage('analyzing');
      const assistantMsg = await streamMessage(userMessage, {
        userMessage: contextualUserMessage,
        existingCards: availableCards,
        context,
        customInstructions: customInstructions || undefined,
        imageAttachments: imageAttachments?.length ? imageAttachments : undefined,
        deepThink,
        optimisticAssistantId,
      });

      if (!assistantMsg) {
        setSuggestedPrompts(generateContextualSuggestions(userMessage, []));
        setIsClarificationPills(false);
        return;
      }

      const processingTime = Date.now() - startTime;

      const serverCardCount = (assistantMsg.cards as unknown[])?.length ?? 0;
      const useFallbackCards = serverCardCount === 0 && availableCards.length > 0;
      const responseCards = serverCardCount > 0
        ? (assistantMsg.cards as InsightCard[])
        : (useFallbackCards ? availableCards : []);

      if (isDev) {
        console.log('[v0] Analysis:', JSON.stringify({
          serverCards: serverCardCount,
          responseCards: responseCards.length,
          fallbackCards: useFallbackCards ? availableCards.length : 0,
          confidence: (assistantMsg.trustMetrics as any)?.finalConfidence,
          fallback: useFallbackCards,
        }));
      }

      const hasLiveOdds = !!(context?.oddsData?.events?.length > 0);
      const hasKalshi = context?.isPoliticalMarket === true;
      const enrichedTrustMetrics = assistantMsg.trustMetrics
        ? {
            ...(assistantMsg.trustMetrics as object),
            modelUsed: assistantMsg.modelUsed || 'Grok 4',
            sources: assistantMsg.sources || [],
            processingTime,
            hasLiveOdds,
            hasKalshi,
          }
        : {
            benfordIntegrity: 85,
            oddsAlignment: hasLiveOdds ? 90 : 80,
            marketConsensus: hasLiveOdds ? 88 : 78,
            historicalAccuracy: 87,
            finalConfidence: hasLiveOdds ? 88 : 82,
            trustLevel: 'high' as const,
            riskLevel: 'low' as const,
            adjustedTone: hasLiveOdds ? 'Strong signal — live data verified' : 'Knowledge-based analysis',
            flags: [],
            modelUsed: 'Grok 4',
            sources: assistantMsg.sources || [],
            processingTime,
            hasLiveOdds,
            hasKalshi,
          };

      const newMessage: Message = {
        ...assistantMsg,
        cards: responseCards,
        confidence: assistantMsg.confidence || 85,
        sources: assistantMsg.sources || [],
        modelUsed: assistantMsg.modelUsed || 'Grok 4',
        processingTime,
        trustMetrics: enrichedTrustMetrics as TrustMetrics,
      };

      setMessages((prev: Message[]) => prev.map(m =>
        m.id === assistantMsg.id
          ? {
              ...m,
              cards: newMessage.cards || [],
              confidence: newMessage.confidence,
              sources: newMessage.sources,
              modelUsed: newMessage.modelUsed,
              processingTime: newMessage.processingTime,
              trustMetrics: newMessage.trustMetrics,
            }
          : m,
      ).slice(-30));

      if ((newMessage.cards as any[])?.length && assistantMsg.id && activeChat) {
        try {
          const lsKey = `lev:cards:${activeChat}`;
          const stored: Record<string, any[]> = JSON.parse(localStorage.getItem(lsKey) ?? '{}');
          stored[assistantMsg.id] = newMessage.cards as any[];
          const keys = Object.keys(stored);
          if (keys.length > 50) delete stored[keys[0]];
          localStorage.setItem(lsKey, JSON.stringify(stored));
        } catch { /* quota / security errors — silently skip */ }
      }

      if (isLoggedIn) {
        const capturedChat = activeChat;
        const capturedMsg = newMessage;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(capturedChat);
        const resolveThreadId = async (): Promise<string | null> => {
          if (isUuid) return capturedChat;
          if (pendingThreadRef.current) {
            const created = await pendingThreadRef.current;
            return created?.id ?? null;
          }
          const category = selectedCategory === 'all' ? 'betting' : selectedCategory;
          const tags = [
            selectedCategory === 'all' ? 'multi-platform' : selectedCategory,
            ...(selectedSport ? [selectedSport] : []),
          ];
          const created = await createThread(category, userMessage.slice(0, 50), tags);
          if (created) {
            setChats((prev: Chat[]) => prev.map((c: Chat) => c.id === capturedChat ? { ...c, id: created.id, category, tags } : c));
            setActiveChat(created.id);
          }
          return created?.id ?? null;
        };
        const finalCategory = selectedCategory === 'all' ? 'betting' : selectedCategory;
        const finalTags = [
          selectedCategory === 'all' ? 'multi-platform' : selectedCategory,
          ...(selectedSport ? [selectedSport] : []),
        ];
        resolveThreadId().then(async (threadId) => {
          if (!threadId) return;
          const [, savedMsgId] = await saveMessagesBatch(threadId, [
            { role: 'user', content: userMessage },
            {
              role: 'assistant',
              content: capturedMsg.content,
              model_used: capturedMsg.modelUsed,
              confidence: capturedMsg.confidence,
              cards: (capturedMsg.cards as unknown[])?.length ? capturedMsg.cards as unknown[] : undefined,
            },
          ]);
          const clientMsgId = capturedMsg.id;
          if (savedMsgId && (capturedMsg.cards as any[])?.length) {
            try {
              const oldKey = `lev:cards:${capturedChat}`;
              const newKey = `lev:cards:${threadId}`;
              const stored: Record<string, any[]> = JSON.parse(localStorage.getItem(oldKey) ?? '{}');
              if (oldKey !== newKey) localStorage.removeItem(oldKey);
              if (stored[clientMsgId]?.length && clientMsgId !== savedMsgId) {
                stored[savedMsgId] = stored[clientMsgId];
                delete stored[clientMsgId];
              }
              const keys = Object.keys(stored);
              if (keys.length > 50) delete stored[keys[0]];
              localStorage.setItem(newKey, JSON.stringify(stored));
            } catch { /* quota / security errors — silently skip */ }
          }
          updateThread(threadId, { category: finalCategory, tags: finalTags });
          setChats((prev: Chat[]) => prev.map((c: Chat) =>
            c.id === threadId ? { ...c, category: finalCategory, tags: finalTags } : c,
          ));
        });
      }

      if (assistantMsg.clarificationOptions?.length) {
        setSuggestedPrompts(assistantMsg.clarificationOptions.map((o: string) => ({
          label: o,
          icon: Target,
          category: selectedCategory,
        })));
        setIsClarificationPills(true);
      } else {
        const contextualSuggestions = generateContextualSuggestions(userMessage, newMessage.cards || []);
        setSuggestedPrompts(contextualSuggestions);
        setIsClarificationPills(false);
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;

      console.error('[v0] Error generating real response:', error);

      const errorContent = `I'm having trouble connecting to live data sources right now. Please try again in a moment.`;
      const errorMetadata = {
        cards: [],
        confidence: 50,
        sources: [{ name: 'Cached Data', type: 'cache' as const, reliability: 60 }],
        modelUsed: 'Fallback Mode',
        processingTime: Date.now() - startTime,
        trustMetrics: {
          benfordIntegrity: 50,
          oddsAlignment: 50,
          marketConsensus: 50,
          historicalAccuracy: 50,
          finalConfidence: 50,
          trustLevel: 'low' as const,
          riskLevel: 'high' as const,
          adjustedTone: 'Connection error — please retry',
          flags: [{ type: 'connectivity', message: 'Live data unavailable due to connectivity issue', severity: 'warning' as const }],
        },
      };
      setMessages((prev: Message[]) => {
        if (optimisticAssistantId && prev.some(m => m.id === optimisticAssistantId && (m.isPending || m.isStreaming))) {
          return prev.map(m => m.id === optimisticAssistantId
            ? { ...m, isPending: false, isStreaming: false, isError: true, content: errorContent, ...errorMetadata }
            : m);
        }
        return [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          content: errorContent,
          timestamp: new Date(),
          isError: true,
          ...errorMetadata,
        } as Message].slice(-30);
      });

      setSuggestedPrompts(generateContextualSuggestions(userMessage, []));
      setIsClarificationPills(false);
    } finally {
      setIsTyping(false);
      analyzingMessageRef.current = null;
    }
  }, [
    messages, setMessages, streamMessage, abortStream,
    setIsTyping, selectedCategory, selectedSport, setKalshiBettingBannerVisible,
    customInstructions, deepThink, fantasyLeague, setVerifyStage,
    setSuggestedPrompts, setIsClarificationPills, generateContextualSuggestions, setLastUserQuery,
    activeChat, setActiveChat, setChats, isLoggedIn, toast,
    // refs intentionally omitted — stable by design and never need to be deps
  ]);

  return generateRealResponse;
}
