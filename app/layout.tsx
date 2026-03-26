import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { ToastProvider } from '@/components/toast-provider'
import { PWARegister } from '@/components/pwa-register'
import { GlobalErrorSuppressor } from '@/components/global-error-suppressor'
import './globals.css'

export const metadata: Metadata = {
  title: 'Unified AI Platform - Sports Betting • Fantasy • DFS • Kalshi',
  description: 'All-in-one AI-powered platform for sports betting, NFC fantasy football (NFBC/NFFC/NFBKC), DFS lineup optimization, and Kalshi financial prediction markets. Real-time odds analysis, draft strategy, auction values, and market insights.',
  generator: 'v0.app',
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    siteName: 'Leverage AI',
    title: 'Leverage AI — Sports Betting • Fantasy • DFS • Kalshi',
    description: 'AI-powered sports intelligence: live odds, DFS lineup optimizer, fantasy draft strategy, and Kalshi prediction markets — all in one platform.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Leverage AI — Powered by Grok AI',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Leverage AI — Sports Betting • Fantasy • DFS • Kalshi',
    description: 'AI-powered sports intelligence: live odds, DFS optimizer, fantasy strategy, and Kalshi markets.',
    images: ['/og-image.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Leverage AI',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  // Performance optimization: fonts are automatically optimized by Next.js
  other: {
    'font-optimization': 'display=swap, preload, subset=latin, adjustFontFallback',
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark`}>
      <body className="font-sans antialiased">
        <ToastProvider>
          {children}
        </ToastProvider>
        <Analytics />
        <SpeedInsights />
        <PWARegister />
        <GlobalErrorSuppressor />
      </body>
    </html>
  )
}
