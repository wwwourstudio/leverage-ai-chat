'use client';

import { AlertCircle, Database, RefreshCw, WifiOff } from 'lucide-react';

interface DataFallbackProps {
  error?: string;
  retry?: () => void;
  type?: 'network' | 'parse' | 'timeout' | 'unavailable';
}

// Static class maps — prevents Tailwind JIT from purging interpolated class strings
const COLOR_CLASSES = {
  network: {
    wrapper: 'bg-gradient-to-br from-orange-900/10 to-orange-800/10 border border-orange-500/20',
    iconBox: 'w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center flex-shrink-0',
    icon:    'w-5 h-5 text-orange-400',
    title:   'font-semibold text-orange-400 mb-1',
    btn:     'text-sm bg-orange-600 hover:bg-orange-700 text-white rounded-lg px-4 py-2 flex items-center gap-2 transition',
  },
  parse: {
    wrapper: 'bg-gradient-to-br from-yellow-900/10 to-yellow-800/10 border border-yellow-500/20',
    iconBox: 'w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0',
    icon:    'w-5 h-5 text-yellow-400',
    title:   'font-semibold text-yellow-400 mb-1',
    btn:     'text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg px-4 py-2 flex items-center gap-2 transition',
  },
  timeout: {
    wrapper: 'bg-gradient-to-br from-red-900/10 to-red-800/10 border border-red-500/20',
    iconBox: 'w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0',
    icon:    'w-5 h-5 text-red-400',
    title:   'font-semibold text-red-400 mb-1',
    btn:     'text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 flex items-center gap-2 transition',
  },
  unavailable: {
    wrapper: 'bg-gradient-to-br from-blue-900/10 to-blue-800/10 border border-blue-500/20',
    iconBox: 'w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0',
    icon:    'w-5 h-5 text-blue-400',
    title:   'font-semibold text-blue-400 mb-1',
    btn:     'text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center gap-2 transition',
  },
};

const TYPE_CONFIG = {
  network:     { icon: WifiOff,    title: 'Connection Issue',                   message: 'Unable to reach the data source. Please check your network connection.' },
  parse:       { icon: AlertCircle, title: 'Data Format Error',                  message: 'Received invalid data format from the server. The service may be updating.' },
  timeout:     { icon: Database,   title: 'Request Timeout',                    message: 'The request took too long to complete. The service may be experiencing high load.' },
  unavailable: { icon: Database,   title: 'Service Temporarily Unavailable',    message: "We're having trouble fetching live data right now." },
};

export function DataFallback({ error, retry, type = 'unavailable' }: DataFallbackProps) {
  const { icon: Icon, title, message } = TYPE_CONFIG[type];
  const cls = COLOR_CLASSES[type];

  return (
    <div className={`${cls.wrapper} rounded-xl p-6`}>
      <div className="flex items-start gap-4">
        <div className={cls.iconBox}>
          <Icon className={cls.icon} />
        </div>
        <div className="flex-1">
          <h4 className={cls.title}>{title}</h4>
          <p className="text-sm text-foreground/80 mb-3">{message}</p>

          {error && (
            <details className="mb-3">
              <summary className="text-xs text-[var(--text-faint)] cursor-pointer hover:text-[var(--text-muted)]">
                Error details
              </summary>
              <pre className="mt-2 text-xs bg-black/30 p-2 rounded overflow-auto max-h-24 text-[var(--text-muted)]">
                {error}
              </pre>
            </details>
          )}

          {retry && (
            <button onClick={retry} className={cls.btn}>
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          )}

          <p className="text-xs text-[var(--text-faint)] mt-3">
            Using cached or default data while we resolve this issue.
          </p>
        </div>
      </div>
    </div>
  );
}
