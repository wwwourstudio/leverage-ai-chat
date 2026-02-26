import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ToastProvider } from '@/components/toast-provider'
import './globals.css'

// Optimized font loading with display swap and subset for performance
const geistSans = Geist({
  subsets: ['latin'],
  display: 'swap', // Prevents FOIT (Flash of Invisible Text)
  variable: '--font-geist-sans',
  preload: true,
  fallback: ['system-ui', '-apple-system', 'sans-serif'],
  adjustFontFallback: true, // Minimizes layout shift
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-mono',
  preload: true,
  fallback: ['Menlo', 'Monaco', 'Courier New', 'monospace'],
  adjustFontFallback: true,
})

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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        <ToastProvider>
          {children}
        </ToastProvider>
        <Analytics />
      </body>
    </html>
  )
}
