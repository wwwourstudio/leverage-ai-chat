'use client';

import dynamic from 'next/dynamic';
import { CreditModals } from '@/components/index/CreditModals';
import { CommandPalette } from '@/components/CommandPalette';
import type { Chat } from '@/lib/hooks/useChatList';
import type { FileAttachment } from '@/lib/hooks/useFileHandling';

const AuthModals = dynamic(() => import('@/components/AuthModals').then(m => ({ default: m.AuthModals })), { ssr: false });
const UserLightbox = dynamic(() => import('@/components/UserLightbox').then(m => ({ default: m.UserLightbox })), { ssr: false });
const SettingsLightbox = dynamic(() => import('@/components/SettingsLightbox').then(m => ({ default: m.SettingsLightbox })), { ssr: false });
const AlertsLightbox = dynamic(() => import('@/components/AlertsLightbox').then(m => ({ default: m.AlertsLightbox })), { ssr: false });
const WatchlistLightbox = dynamic(() => import('@/components/WatchlistLightbox').then(m => ({ default: m.WatchlistLightbox })), { ssr: false });
const StripeLightbox = dynamic(() => import('@/components/StripeLightbox').then(m => ({ default: m.StripeLightbox })), { ssr: false });

interface ChatModalsProps {
  // Credit modals
  showPurchaseModal: boolean;
  purchaseAmount: string;
  setPurchaseAmount: (v: string) => void;
  setShowPurchaseModal: (v: boolean) => void;
  showSubscriptionModal: boolean;
  setShowSubscriptionModal: (v: boolean) => void;
  setShowStripeLightbox: (v: boolean) => void;
  setShowLoginModal: (v: boolean) => void;
  // Auth modals
  showLoginModal: boolean;
  showSignupModal: boolean;
  setShowSignupModal: (v: boolean) => void;
  setIsLoggedIn: (v: boolean) => void;
  setUser: (u: { name: string; email: string; avatar?: string } | null) => void;
  // User lightbox
  showUserLightbox: boolean;
  setShowUserLightbox: (v: boolean) => void;
  user: { name: string; email: string; avatar?: string } | null;
  onLogout: () => void;
  onInstructionsChange: (v: string) => void;
  onAttachFile: (file: FileAttachment) => void;
  // Settings
  showSettingsLightbox: boolean;
  setShowSettingsLightbox: (v: boolean) => void;
  onUserUpdate: (u: { name: string; email: string; avatar?: string } | null) => void;
  onOpenStripe: () => void;
  creditsRemaining: number;
  // Alerts
  showAlertsLightbox: boolean;
  setShowAlertsLightbox: (v: boolean) => void;
  setAlertCount: (n: number) => void;
  // Watchlist
  showWatchlistLightbox: boolean;
  setShowWatchlistLightbox: (v: boolean) => void;
  onPlayerClick: (...args: any[]) => void;
  onCardClick: (...args: any[]) => void;
  // Command palette
  showCommandPalette: boolean;
  setShowCommandPalette: (v: boolean) => void;
  chats: Chat[];
  activeChat: string;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  setSidebarOpen: (v: boolean) => void;
  // Stripe
  showStripeLightbox: boolean;
  addCredits: (n: number) => void;
  // Voice overlay
  voiceIsActive: boolean;
  voiceOverlay: React.ReactNode;
}

export function ChatModals({
  showPurchaseModal, purchaseAmount, setPurchaseAmount, setShowPurchaseModal,
  showSubscriptionModal, setShowSubscriptionModal, setShowStripeLightbox, setShowLoginModal,
  showLoginModal, showSignupModal, setShowSignupModal, setIsLoggedIn, setUser,
  showUserLightbox, setShowUserLightbox, user, onLogout, onInstructionsChange, onAttachFile,
  showSettingsLightbox, setShowSettingsLightbox, onUserUpdate, onOpenStripe, creditsRemaining,
  showAlertsLightbox, setShowAlertsLightbox, setAlertCount,
  showWatchlistLightbox, setShowWatchlistLightbox, onPlayerClick, onCardClick,
  showCommandPalette, setShowCommandPalette, chats, activeChat, onSelectChat, onNewChat, setSidebarOpen,
  showStripeLightbox, addCredits,
  voiceIsActive, voiceOverlay,
}: ChatModalsProps) {
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
        onInstructionsChange={onInstructionsChange}
        onAttachFile={(file: any) => onAttachFile({ ...file, url: '' })}
      />

      <SettingsLightbox
        isOpen={showSettingsLightbox}
        onClose={() => setShowSettingsLightbox(false)}
        user={user}
        onUserUpdate={onUserUpdate}
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
