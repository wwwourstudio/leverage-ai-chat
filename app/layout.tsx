import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { ToastProvider } from '@/components/toast-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Unified AI Platform - Sports Betting • Fantasy • DFS • Kalshi',
  description: 'All-in-one AI-powered platform for sports betting, NFC fantasy football (NFBC/NFFC/NFBKC), DFS lineup optimization, and Kalshi financial prediction markets. Real-time odds analysis, draft strategy, auction values, and market insights.',
  generator: 'v0.app',
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
    apple: '/apple-icon.png',
  },
  // Performance optimization: fonts are automatically optimized by Next.js
  other: {
    'font-optimization': 'display=swap, preload, subset=latin, adjustFontFallback',
  },
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
      </body>
    </html>
  )
}
