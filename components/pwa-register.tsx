'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker for PWA support.
 * Renders nothing — purely a side-effect component mounted in the root layout.
 */
export function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })

        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          if (!worker) return

          worker.addEventListener('statechange', () => {
            if (
              worker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // A new version is available — could show a toast here if desired
              console.log('[PWA] New version available. Refresh to update.')
            }
          })
        })
      } catch (err) {
        console.warn('[PWA] Service worker registration failed:', err)
      }
    }

    // Defer registration until after page load to avoid competing with
    // critical resources on the initial paint.
    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
    }
  }, [])

  return null
}
