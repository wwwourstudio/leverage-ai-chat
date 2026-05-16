'use client';

import dynamic from 'next/dynamic';
import { CreditModals } from '@/components/index/CreditModals';
import { CommandPalette } from '@/components/CommandPalette';
import type { Chat } from '@/lib/hooks/useChatList';
import type { FileAttachment } from '@/lib/hooks/useFileHandling';
import { useModalState } from '@/lib/hooks/useModalState';
import { useUserStore } from '@/lib/store/user-store';
import { useAppStore } from '@/lib/store/app-store';

const AuthModals = dynamic(() => import('@/components/AuthModals').then(m => ({ default: m.AuthModals })), { ssr: false });
const UserLightbox = dynamic(() => import('@/components/UserLightbox').then(m => ({ default: m.UserLightbox })), { ssr: false });
const SettingsLightbox = dynamic(() => import('@/components/SettingsLightbox').then(m => ({ default: m.SettingsLightbox })), { ssr: false });
const AlertsLightbox = dynamic(() => import('@/components/AlertsLightbox').then(m => ({ default: m.AlertsLightbox })), { ssr: false });
const WatchlistLightbox = dynamic(() => import('@/components/WatchlistLightbox').then(m => ({ default: m.WatchlistLightbox })), { ssr: false });
const StripeLightbox = dynamic(() => import('@/components/StripeLightbox').then(m => ({ default: m.StripeLightbox })), { ssr: false });

interface ChatModalsProps {
  creditsRemaining: number;
  addCredits: (n: number) => void;
  chats: Chat[];
  activeChat: string;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onLogout: () => void;
  onAttachFile: (file: FileAttachment) => void;
  onOpenStripe: () => void;
  onPlayerClick: (...args: any[]) => void;
  onCardClick: (...args: any[]) => void;
  voiceIsActive: boolean;
  voiceOverlay: React.ReactNode;
}

export function ChatModals({
  creditsRemaining, addCredits,
  chats, activeChat, onSelectChat, onNewChat,
  onLogout, onAttachFile, onOpenStripe,
  onPlayerClick, onCardClick,
  voiceIsActive, voiceOverlay,
}: ChatModalsProps) {
  const {
    showPurchaseModal, setShowPurchaseModal,
    showSubscriptionModal, setShowSubscriptionModal,
    showStripeLightbox, setShowStripeLightbox,
    showLoginModal, setShowLoginModal,
    showSignupModal, setShowSignupModal,
    showUserLightbox, setShowUserLightbox,
    showSettingsLightbox, setShowSettingsLightbox,
    showAlertsLightbox, setShowAlertsLightbox,
    showWatchlistLightbox, setShowWatchlistLightbox,
    showCommandPalette, setShowCommandPalette,
  } = useModalState();

  const { user, setIsLoggedIn, setUser, purchaseAmount, setPurchaseAmount, setAlertCount, setCustomInstructions } = useUserStore();
  const { setSidebarOpen } = useAppStore();

  return (
    <>
      <CreditModals
        showPurchase={showPurchaseModal}
        purchaseAmount={purchaseAmount}
        setPurchaseAmount={setPurchaseAmount}
        onClosePurchase={() => setShowPurchaseModal(false)}
        onStripeCheckout={() => setShowStripeLightbox(true)}
        onLogin={() => setShowLoginModal(true)}
        showSubscription={showSubscriptionModal}
        onCloseSubscription={() => setShowSubscriptionModal(false)}
        onStripeSubscription={() => setShowStripeLightbox(true)}
      />

      <AuthModals
        showLoginModal={showLoginModal}
        showSignupModal={showSignupModal}
        setShowLoginModal={setShowLoginModal}
        setShowSignupModal={setShowSignupModal}
        setIsLoggedIn={setIsLoggedIn}
        setUser={setUser}
      />

      <UserLightbox
        isOpen={showUserLightbox}
        onClose={() => setShowUserLightbox(false)}
        user={user}
        onLogout={onLogout}
        onInstructionsChange={setCustomInstructions}
        onAttachFile={(file: any) => onAttachFile({ ...file, url: '' })}
      />

      <SettingsLightbox
        isOpen={showSettingsLightbox}
        onClose={() => setShowSettingsLightbox(false)}
        user={user}
        onUserUpdate={setUser}
        onOpenStripe={onOpenStripe}
        creditsRemaining={creditsRemaining}
      />

      <AlertsLightbox
        isOpen={showAlertsLightbox}
        onClose={() => setShowAlertsLightbox(false)}
        onAlertsCountChange={setAlertCount}
      />

      <WatchlistLightbox
        isOpen={showWatchlistLightbox}
        onClose={() => setShowWatchlistLightbox(false)}
        onPlayerClick={onPlayerClick}
        onCardClick={onCardClick}
      />

      <CommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        chats={chats}
        activeChat={activeChat}
        onSelectChat={(id) => { onSelectChat(id); setSidebarOpen(false); }}
        onNewChat={() => { onNewChat(); setSidebarOpen(false); }}
        onOpenSettings={() => setShowSettingsLightbox(true)}
      />

      <StripeLightbox
        isOpen={showStripeLightbox}
        onClose={() => setShowStripeLightbox(false)}
        onCreditsAdded={addCredits}
        creditsRemaining={creditsRemaining}
        userEmail={user?.email}
      />

      {voiceIsActive && voiceOverlay}
    </>
  );
}
