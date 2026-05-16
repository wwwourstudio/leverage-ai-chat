'use client';

import { ChatInput, RateLimitNotification, FantasyLeagueContextBar } from '@/components/chat';
import { SuggestedPrompts } from '@/components/suggested-prompts';
import { FantasyLeagueSetup } from '@/components/index/FantasyLeagueSetup';
import type { FileAttachment } from '@/lib/hooks/useFileHandling';
import type { Chat } from '@/lib/hooks/useChatList';
import type { Message } from '@/app/types/chat';
import type { PromptItem } from '@/lib/prompt-data';
import { useAppStore } from '@/lib/store/app-store';
import { useUserStore } from '@/lib/store/user-store';
import { useFantasyStore } from '@/lib/store/fantasy-store';
import { useModalState } from '@/lib/hooks/useModalState';

interface ChatInputSectionProps {
  // Input
  input: string;
  setInput: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isTyping: boolean;
  onStopGeneration: () => void;
  // Files
  uploadedFiles: FileAttachment[];
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (name: string) => void;
  onSaveFile: (file: FileAttachment) => void;
  onFileDrop: (files: FileList) => Promise<FileAttachment[]>;
  onFilesAdded: (files: FileAttachment[]) => void;
  // Credits
  creditsRemaining: number;
  onOpenStripe: () => void;
  // Context
  lastUserQuery: string;
  getRateLimitData: () => { resetTime: number };
  // Suggested prompts
  messages: Message[];
  suggestedPrompts: PromptItem[];
  quickActions: PromptItem[];
  isClarificationPills: boolean;
  onPromptClick: (text: string) => void;
  onWelcomeAction: (query: string) => void;
  setChats: (fn: (prev: Chat[]) => Chat[]) => void;
  activeChat: string;
  // Voice
  voiceConvState: string;
  voiceConvSupported: boolean;
  onActivateVoice: () => void;
  lastAssistantMessage: string | undefined;
}

export function ChatInputSection({
  input, setInput, onSubmit, isTyping, onStopGeneration,
  uploadedFiles, onFileUpload, onRemoveFile, onSaveFile, onFileDrop, onFilesAdded,
  creditsRemaining, onOpenStripe,
  lastUserQuery, getRateLimitData,
  messages, suggestedPrompts, quickActions, isClarificationPills,
  onPromptClick, onWelcomeAction, setChats, activeChat,
  voiceConvState, voiceConvSupported, onActivateVoice, lastAssistantMessage,
}: ChatInputSectionProps) {
  const { selectedCategory, selectedSport, deepThink, toggleDeepThink, systemStatus, selectCategory } = useAppStore();
  const { isLoggedIn } = useUserStore();
  const { fantasyLeague, setFantasyLeague, fantasySetupData, setFantasySetupData, fantasySetupStep, setFantasySetupStep, resetSetup } = useFantasyStore();
  const { showLimitNotification, setShowLimitNotification } = useModalState();

  return (
    <div className="relative border-t border-[var(--border-subtle)] bg-gradient-to-b from-background to-black px-4 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-xl">
      <div className="absolute inset-0 bg-gradient-to-t from-blue-600/5 via-transparent to-transparent pointer-events-none" />

      <RateLimitNotification
        visible={showLimitNotification}
        resetTimeMs={getRateLimitData().resetTime}
        onDismiss={() => setShowLimitNotification(false)}
      />

      <div className="relative max-w-5xl xl:max-w-6xl mx-auto">
        {selectedCategory === 'fantasy' && !fantasyLeague?.setupComplete && (
          <FantasyLeagueSetup
            fantasySetupData={fantasySetupData}
            fantasySetupStep={fantasySetupStep}
            setFantasySetupData={setFantasySetupData as any}
            setFantasySetupStep={setFantasySetupStep as any}
            isLoggedIn={isLoggedIn}
            onSave={(league) => {
              setFantasyLeague(league);
              resetSetup();
            }}
          />
        )}

        <FantasyLeagueContextBar
          visible={selectedCategory === 'fantasy' && !!fantasyLeague?.setupComplete && isLoggedIn}
          teamName={fantasyLeague?.teamName}
          sport={fantasyLeague?.sport}
          platform={fantasyLeague?.platform}
          teams={fantasyLeague?.teams}
          leagueType={fantasyLeague?.leagueType}
          scoring={fantasyLeague?.scoring}
          onReset={() => { setFantasyLeague(null); localStorage.removeItem('leverage_fantasy_league'); }}
        />

        <SuggestedPrompts
          showWelcomeGrid={messages.length === 1 && !!messages[0]?.isWelcome && suggestedPrompts.length === 0 && selectedCategory === 'all'}
          onWelcomeAction={onWelcomeAction}
          onCategorySelect={selectCategory}
          suggestedPrompts={suggestedPrompts}
          quickActions={quickActions}
          hasMessages={messages.length > 1}
          lastUserQuery={lastUserQuery}
          selectedCategory={selectedCategory}
          selectedSport={selectedSport}
          clarificationMode={isClarificationPills}
          onPromptClick={onPromptClick}
        />

        <ChatInput
          input={input}
          onInputChange={setInput}
          onSubmit={onSubmit}
          isTyping={isTyping}
          onStopGeneration={onStopGeneration}
          uploadedFiles={uploadedFiles}
          onFileUpload={onFileUpload}
          onRemoveFile={onRemoveFile}
          onSaveFile={onSaveFile}
          onFileDrop={onFileDrop}
          onFilesAdded={onFilesAdded as any}
          creditsRemaining={creditsRemaining}
          onOpenStripe={onOpenStripe}
          lastUserQuery={lastUserQuery}
          selectedCategory={selectedCategory}
          deepThink={deepThink}
          onToggleDeepThink={toggleDeepThink}
          systemStatus={systemStatus}
          voiceConvState={voiceConvState as any}
          voiceConvSupported={voiceConvSupported}
          onActivateVoice={onActivateVoice}
          lastAssistantMessage={lastAssistantMessage}
        />
      </div>
    </div>
  );
}
