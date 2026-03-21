'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker for PWA support.
 * Renders nothing — purely a side-effect component mounted in the root layout.
 *
 * SW update strategy:
 *  - We do NOT auto-call skipWaiting() in the SW install event (that causes a
 *    multi-tab "update storm" where every open tab simultaneously re-fires all
 *    page-load API calls).
 *  - Instead, once a new SW is installed we post SKIP_WAITING so takeover
 *    happens in a controlled, single-tab-initiated way.
 *  - A module-level flag prevents multiple mounted instances (e.g. StrictMode
 *    double-mount) from registering twice in the same page lifetime.
 */

let _registered = false

export function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    if (_registered) return
    _registered = true

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          // updateViaCache: 'none' forces the browser to always re-fetch sw.js
          // rather than serving it from the HTTP cache. Without this, a stale
          // cached sw.js can delay update detection by up to 24 hours.
          updateViaCache: 'none',
        })

        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          if (!worker) return

          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version installed and waiting. Trigger takeover immediately
              // by posting SKIP_WAITING — the SW is listening for this message.
              // This replaces the old self.skipWaiting() in the install handler
              // which fired for every open tab simultaneously.
              console.log('[PWA] New version ready — activating.')
              worker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })
      } catch (err) {
        console.warn('[PWA] Service worker registration failed:', err)
      }
    }

    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
    }
  }, [])

  return null
}
