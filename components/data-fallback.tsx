'use client';

import React from 'react';
import { AlertCircle, Database, RefreshCw, WifiOff } from 'lucide-react';

interface DataFallbackProps {
  error?: string;
  retry?: () => void;
  type?: 'network' | 'parse' | 'timeout' | 'unavailable';
}

export function DataFallback({ error, retry, type = 'unavailable' }: DataFallbackProps) {
  const config = {
    network: {
      icon: WifiOff,
      title: 'Connection Issue',
      message: 'Unable to reach the data source. Please check your network connection.',
      color: 'orange'
    },
    parse: {
      icon: AlertCircle,
      title: 'Data Format Error',
      message: 'Received invalid data format from the server. The service may be updating.',
      color: 'yellow'
    },
    timeout: {
      icon: Database,
      title: 'Request Timeout',
      message: 'The request took too long to complete. The service may be experiencing high load.',
      color: 'red'
    },
    unavailable: {
      icon: Database,
      title: 'Service Temporarily Unavailable',
      message: 'We\'re having trouble fetching live data right now.',
      color: 'blue'
    }
  };

  const { icon: Icon, title, message, color } = config[type];

  return (
    <div className={`bg-gradient-to-br from-${color}-900/10 to-${color}-800/10 border border-${color}-500/20 rounded-xl p-6`}>
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 bg-${color}-500/20 rounded-full flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 text-${color}-400`} />
        </div>
        <div className="flex-1">
          <h4 className={`font-semibold text-${color}-400 mb-1`}>{title}</h4>
          <p className="text-sm text-gray-300 mb-3">{message}</p>
          
          {error && (
            <details className="mb-3">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                Error details
              </summary>
              <pre className="mt-2 text-xs bg-black/30 p-2 rounded overflow-auto max-h-24 text-gray-400">
                {error}
              </pre>
            </details>
          )}

          {retry && (
            <button
              onClick={retry}
              className={`text-sm bg-${color}-600 hover:bg-${color}-700 text-white rounded-lg px-4 py-2 flex items-center gap-2 transition`}
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          )}

          <p className="text-xs text-gray-500 mt-3">
            Using cached or default data while we resolve this issue.
          </p>
        </div>
      </div>
    </div>
  );
}
