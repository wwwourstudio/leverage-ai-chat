'use client';

import type { RefObject } from 'react';
import { TrendingUp, CheckCheck, AlertCircle, Info, RotateCcw, Sparkles, CheckCircle } from 'lucide-react';
import { CardLayout } from '@/components/data-cards/CardLayout';
import { DatabaseStatusBanner } from '@/components/database-status-banner';
import { AIProgressIndicator } from '@/components/ai-progress-indicator';
import { KalshiBettingBanner } from '@/components/chat';
import { SourcesPanel } from '@/components/chat';
import { MessageActionsToolbar } from '@/components/chat';
import { WelcomeScreen } from '@/components/index/WelcomeScreen';
import { MessageContent } from '@/components/index/MessageContent';
import { MessageAttachments } from '@/components/index/MessageAttachments';
import { DetailedAnalysisLayout, type DetailedAnalysisData } from '@/components/index/DetailedAnalysisLayout';
import type { Message } from '@/app/types/chat';
import { GROK_VOICE_STORAGE_KEY, GROK_VOICE_DEFAULT } from '@/lib/constants';
import { speakText, stopVoice } from '@/lib/voice-player';
import { cardsToSpeech } from '@/lib/card-speech';

interface ChatMessageListProps {
  messages: Message[];
  isTyping: boolean;
  verifyStage: 'analyzing' | 'reverifying';
  editingMessageIndex: number | null;
  editingContent: string;
  speakingMessageId: string | null;
  setSpeakingMessageId: (id: string | null) => void;
  kalshiBettingBannerVisible: boolean;
  setKalshiBettingBannerVisible: (v: boolean) => void;
  editTextareaRef: RefObject<HTMLTextAreaElement | null>;
  onEditContentChange: (val: string) => void;
  adjustEditTextareaHeight: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  selectedCategory: string;
  onGenerateResponse: (query: string) => void;
  onFollowUp: (action: 'correlated' | 'metrics', cardData?: any) => void;
  onEditMessage: (index: number) => void;
  onSaveEdit: (index: number) => void;
  onCancelEdit: () => void;
  onCopyMessage: (msg: any) => void;
  onRegenerateResponse: (index: number) => void;
  onVote: (index: number, direction: 'up' | 'down') => void;
}

export function ChatMessageList({
  messages, isTyping, verifyStage,
  editingMessageIndex, editingContent, speakingMessageId, setSpeakingMessageId,
  kalshiBettingBannerVisible, setKalshiBettingBannerVisible,
  editTextareaRef, onEditContentChange, adjustEditTextareaHeight, onKeyDown,
  selectedCategory, onGenerateResponse, onFollowUp,
  onEditMessage, onSaveEdit, onCancelEdit, onCopyMessage, onRegenerateResponse, onVote,
}: ChatMessageListProps) {
  return (
    <div
      className="flex-1 min-h-0 overflow-y-auto px-4 py-6 custom-scrollbar scroll-smooth"
      aria-live="polite"
      aria-label="Conversation"
      role="log"
      style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}
    >
      <div className="max-w-5xl xl:max-w-6xl mx-auto space-y-6">
        <DatabaseStatusBanner />
        <KalshiBettingBanner visible={kalshiBettingBannerVisible} onDismiss={() => setKalshiBettingBannerVisible(false)} />

        {messages.length === 0 ? (
          <WelcomeScreen onPromptSelect={(q) => onGenerateResponse(q)} />
        ) : (
          messages.map((message: any, index: any) => {
            const prevMessage = index > 0 ? messages[index - 1] : null;
            const isGrouped = prevMessage && prevMessage.role === message.role;

            return (
              <div
                key={message.id ?? `msg-${index}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn ${isGrouped ? 'mt-1.5' : 'mt-5'}`}
              >
                <div className={message.role === 'user' ? 'max-w-[85%] md:max-w-[75%]' : 'w-full max-w-4xl lg:max-w-3xl'}>
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2.5 mb-2.5 flex-wrap">
                      <div className="relative w-7 h-7 shrink-0" role="img" aria-label="Leverage AI">
                        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 opacity-20 blur-sm" />
                        <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-md shadow-blue-500/25">
                          <TrendingUp className="w-3.5 h-3.5 text-white" aria-hidden="true" />
                        </div>
                      </div>
                      <span className="text-xs font-black tracking-tight text-white">Leverage<span className="text-blue-400"> AI</span></span>
                      {message.sources && message.sources.length > 0 && !message.isWelcome && (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-md">
                          <CheckCheck className="w-2.5 h-2.5 text-blue-400" />
                          <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider">Live Data</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    className={`relative group/message ${
                      message.role === 'user'
                        ? 'rounded-2xl rounded-tr-sm px-5 py-3.5 bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/25 w-fit max-w-[85%] ml-auto'
                        : message.isError
                          ? 'rounded-2xl rounded-tl-sm px-5 py-4 bg-red-950/20 text-foreground border border-red-800/40 border-l-2 border-l-red-500/60 shadow-lg shadow-black/30'
                          : message.isPartial
                            ? 'rounded-2xl rounded-tl-sm px-5 py-4 bg-gradient-to-br from-[var(--bg-overlay)] via-[var(--bg-elevated)]/50 to-[var(--bg-overlay)] text-foreground border border-[var(--border-subtle)] border-l-2 border-l-amber-500/60 shadow-lg shadow-black/30'
                            : 'rounded-2xl rounded-tl-sm px-5 py-4 bg-gradient-to-br from-[var(--bg-overlay)] via-[var(--bg-elevated)]/50 to-[var(--bg-overlay)] text-foreground border border-[var(--border-subtle)] shadow-lg shadow-black/30'
                    }`}
                  >
                    {editingMessageIndex === index ? (
                      <div className="space-y-3">
                        <textarea
                          ref={editTextareaRef}
                          value={editingContent}
                          onChange={(e: any) => {
                            onEditContentChange(e.target.value);
                            adjustEditTextareaHeight();
                          }}
                          onKeyDown={onKeyDown}
                          placeholder={
                            selectedCategory === 'all' ? "Ask about sports betting, fantasy, DFS, or prediction markets..." :
                            selectedCategory === 'betting' ? "e.g. 'Best value plays for tonight's games'" :
                            selectedCategory === 'fantasy' ? "e.g. 'NFBC draft strategy for pick 3'" :
                            selectedCategory === 'dfs' ? "e.g. 'Optimal GPP stack for tonight'" :
                            "e.g. 'Weather-correlated Kalshi markets'"
                          }
                          className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none text-[13px] leading-relaxed resize-none min-h-[44px] max-h-[200px] pr-2"
                          rows={1}
                          disabled={isTyping}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onSaveEdit(index)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Save & Regenerate
                          </button>
                          <button
                            onClick={onCancelEdit}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface)] text-white rounded-lg text-xs font-bold transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {message.role === 'assistant' && message.isPending && (
                          <div className="space-y-2.5 py-1" aria-label="Loading response" aria-busy="true">
                            <div className="h-2.5 w-48 rounded-full bg-white/10 animate-pulse" />
                            <div className="h-2.5 w-64 rounded-full bg-white/10 animate-pulse [animation-delay:150ms]" />
                            <div className="h-2.5 w-36 rounded-full bg-white/10 animate-pulse [animation-delay:300ms]" />
                          </div>
                        )}
                        {message.role === 'assistant' && message.isError && (
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-red-800/30">
                            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            <span className="text-xs text-red-400 font-medium">Response failed</span>
                          </div>
                        )}
                        {message.role === 'assistant' && message.isPartial && (
                          <div className="flex items-center gap-2 mb-2">
                            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="text-xs text-amber-400">Partial response</span>
                          </div>
                        )}
                        {!message.isPending && (message.content.includes('__DETAILED_ANALYSIS__') ? (
                          (() => {
                            const match = message.content.match(/__DETAILED_ANALYSIS__([\s\S]+)__END_ANALYSIS__/);
                            if (!match) return <p className="text-sm leading-relaxed font-medium">{message.content}</p>;
                            let analysisData: DetailedAnalysisData;
                            try {
                              analysisData = JSON.parse(match[1]);
                            } catch {
                              return <p className="text-sm leading-relaxed font-medium">{message.content.replace(/__DETAILED_ANALYSIS__[\s\S]*?__END_ANALYSIS__/, '').trim()}</p>;
                            }
                            return (
                              <DetailedAnalysisLayout
                                data={analysisData}
                                isTyping={isTyping}
                                onFollowUp={onFollowUp}
                              />
                            );
                          })()
                        ) : (
                          <div className={(!message.isPending && message.isStreaming) ? 'content-streaming' : undefined}>
                            <MessageContent content={message.content} />
                          </div>
                        ))}

                        <MessageAttachments attachments={message.attachments} />

                        {message.editHistory && message.editHistory.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                            <details className="text-xs text-[var(--text-faint)]">
                              <summary className="cursor-pointer hover:text-[var(--text-muted)] flex items-center gap-1.5">
                                <RotateCcw className="w-3 h-3" />
                                Edited {message.editHistory.length} time{message.editHistory.length !== 1 ? 's' : ''}
                              </summary>
                            </details>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {message.role === 'assistant' && message.cards && message.cards.length > 0 && (
                    <CardLayout
                      cards={message.cards}
                      aiInsight={message.content}
                      messageIndex={index}
                      trustScore={message.trustMetrics?.finalConfidence}
                      trustLevel={message.trustMetrics?.trustLevel}
                      onAsk={(q: string) => onGenerateResponse(q)}
                    />
                  )}

                  <SourcesPanel
                    role={message.role}
                    isWelcome={message.isWelcome}
                    sources={message.sources}
                    trustMetrics={message.trustMetrics}
                    modelUsed={message.modelUsed}
                    processingTime={message.processingTime}
                  />

                  <MessageActionsToolbar
                    message={message}
                    index={index}
                    editingMessageIndex={editingMessageIndex}
                    speakingMessageId={speakingMessageId}
                    onEdit={onEditMessage}
                    onVote={onVote}
                    onRegenerate={onRegenerateResponse}
                    onSpeak={(id, msgContent) => {
                      const cards = (message as any).cards;
                      const text = msgContent + (cards?.length ? '\n\n' + cardsToSpeech(cards) : '');
                      const voice_id = typeof window !== 'undefined'
                        ? (localStorage.getItem(GROK_VOICE_STORAGE_KEY) ?? GROK_VOICE_DEFAULT)
                        : GROK_VOICE_DEFAULT;
                      setSpeakingMessageId(id);
                      speakText(text, { voice_id, onEnd: () => setSpeakingMessageId(null) });
                    }}
                    onStopSpeak={() => { stopVoice(); setSpeakingMessageId(null); }}
                    onCopy={onCopyMessage}
                  />
                </div>
              </div>
            );
          })
        )}

        {isTyping && !messages.some((m: Message) => m.isPending || m.isStreaming) && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/50 animate-pulse">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 space-y-3">
              <div className="bg-gradient-to-br from-[var(--bg-overlay)] to-[var(--bg-overlay)] backdrop-blur-xl rounded-2xl px-5 py-4 border border-[var(--border-subtle)] shadow-2xl">
                <AIProgressIndicator stage={verifyStage} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
