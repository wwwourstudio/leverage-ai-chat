'use client'

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0a0a0a] px-6 text-center">
      {/* No-signal icon */}
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-white/40"
          aria-hidden="true"
        >
          <line x1="2" y1="2" x2="22" y2="22" />
          <path d="M8.5 16.5a5 5 0 0 1 7 0" />
          <path d="M5 13a10 10 0 0 1 5.17-2.88" />
          <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
          <path d="M13.5 16.5a5 5 0 0 0-3.5 1.46" />
          <path d="M12 20h.01" />
        </svg>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">You&apos;re offline</h1>
        <p className="max-w-sm text-sm text-white/50">
          Leverage AI needs an internet connection to fetch live odds and run AI
          analysis. Check your Wi-Fi or mobile data and try again.
        </p>
      </div>

      <button
        onClick={() => window.location.reload()}
        className="rounded-lg bg-white/10 px-5 py-2.5 text-sm font-medium text-white ring-1 ring-white/10 transition-colors hover:bg-white/20 active:bg-white/30"
      >
        Try again
      </button>
    </div>
  )
}
