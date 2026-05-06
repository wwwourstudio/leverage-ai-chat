'use client';

import { useState } from 'react';

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
  setShowLoginModal: (v: boolean) => void;
  setShowSignupModal: (v: boolean) => void;
  setShowUserLightbox: (v: boolean) => void;
  setShowSettingsLightbox: (v: boolean) => void;
  setShowAlertsLightbox: (v: boolean) => void;
  setShowWatchlistLightbox: (v: boolean) => void;
  setShowStripeLightbox: (v: boolean) => void;
  setShowPurchaseModal: (v: boolean) => void;
  setShowSubscriptionModal: (v: boolean) => void;
  setShowCommandPalette: (v: boolean) => void;
  setShowLimitNotification: (v: boolean) => void;
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
