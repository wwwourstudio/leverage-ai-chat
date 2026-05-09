'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';

export interface ModalState {
  showLoginModal: boolean;
  showSignupModal: boolean;
  showUserLightbox: boolean;
  showSettingsLightbox: boolean;
  showAlertsLightbox: boolean;
  showWatchlistLightbox: boolean;
  showStripeLightbox: boolean;
  showPurchaseModal: boolean;
  showSubscriptionModal: boolean;
  showCommandPalette: boolean;
  showLimitNotification: boolean;
  setShowLoginModal: Dispatch<SetStateAction<boolean>>;
  setShowSignupModal: Dispatch<SetStateAction<boolean>>;
  setShowUserLightbox: Dispatch<SetStateAction<boolean>>;
  setShowSettingsLightbox: Dispatch<SetStateAction<boolean>>;
  setShowAlertsLightbox: Dispatch<SetStateAction<boolean>>;
  setShowWatchlistLightbox: Dispatch<SetStateAction<boolean>>;
  setShowStripeLightbox: Dispatch<SetStateAction<boolean>>;
  setShowPurchaseModal: Dispatch<SetStateAction<boolean>>;
  setShowSubscriptionModal: Dispatch<SetStateAction<boolean>>;
  setShowCommandPalette: Dispatch<SetStateAction<boolean>>;
  setShowLimitNotification: Dispatch<SetStateAction<boolean>>;
}

export function useModalState(): ModalState {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showUserLightbox, setShowUserLightbox] = useState(false);
  const [showSettingsLightbox, setShowSettingsLightbox] = useState(false);
  const [showAlertsLightbox, setShowAlertsLightbox] = useState(false);
  const [showWatchlistLightbox, setShowWatchlistLightbox] = useState(false);
  const [showStripeLightbox, setShowStripeLightbox] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showLimitNotification, setShowLimitNotification] = useState(false);

  return {
    showLoginModal, setShowLoginModal,
    showSignupModal, setShowSignupModal,
    showUserLightbox, setShowUserLightbox,
    showSettingsLightbox, setShowSettingsLightbox,
    showAlertsLightbox, setShowAlertsLightbox,
    showWatchlistLightbox, setShowWatchlistLightbox,
    showStripeLightbox, setShowStripeLightbox,
    showPurchaseModal, setShowPurchaseModal,
    showSubscriptionModal, setShowSubscriptionModal,
    showCommandPalette, setShowCommandPalette,
    showLimitNotification, setShowLimitNotification,
  };
}
