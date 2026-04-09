'use client';

/**
 * AddToHomeBanner
 *
 * Mobile-only banner that prompts users to add Leverage AI to their home screen.
 * - Android/Chrome: uses the `beforeinstallprompt` event to trigger the native
 *   install dialog.
 * - iOS/Safari: shows manual "Share → Add to Home Screen" instructions.
 * - Dismissed state is persisted in localStorage.
 * - Renders in the normal document flow so it pushes the layout up — it is NOT
 *   fixed/absolute, so nothing is obscured.
 */

import { useEffect, useState, useCallback } from 'react';
import { X, Share, Plus } from 'lucide-react';

const DISMISS_KEY = 'leverage_a2hs_dismissed';

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return (
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

export function AddToHomeBanner() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    // Only on mobile viewports
    if (window.innerWidth > 768) return;
    // Already installed as PWA
    if (isInStandaloneMode()) return;
    // User dismissed before
    if (localStorage.getItem(DISMISS_KEY)) return;

    const iosDevice = isIOS();
    setIos(iosDevice);

    if (!iosDevice) {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShow(true);
      };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    } else {
      // iOS: show instructions immediately (no install event)
      setShow(true);
    }
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShow(false);
        localStorage.setItem(DISMISS_KEY, '1');
      }
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, '1');
  }, []);

  if (!show) return null;

  return (
    <div className="w-full bg-gradient-to-r from-blue-950 via-indigo-950 to-[var(--bg-overlay)] border-b border-blue-800/40 px-4 py-3 flex items-center gap-3">
      {/* App icon */}
      <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="Leverage AI" className="w-6 h-6" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-black text-white whitespace-nowrap">LEVERAGE AI</p>
        {ios ? (
          <p className="text-[10px] text-[var(--text-muted)] leading-snug mt-0.5">
            Tap <Share className="inline w-3 h-3 mx-0.5 -mt-0.5" /> then <strong className="text-white/70">Add to Home Screen</strong>
          </p>
        ) : (
          <p className="text-[10px] text-[var(--text-muted)] leading-snug mt-0.5">
            Add to home screen for the full app experience
          </p>
        )}
      </div>

      {/* Install button (Android) or indicator (iOS) */}
      {!ios && (
        <button
          onClick={handleInstall}
          className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      )}

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="shrink-0 p-1.5 rounded-lg text-[var(--text-faint)] hover:text-white hover:bg-[var(--bg-elevated)] transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
