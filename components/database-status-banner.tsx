'use client';

import React, { useEffect, useState } from 'react';
import { Database, AlertCircle, CheckCircle2, ExternalLink, X, Loader2 } from 'lucide-react';

interface DatabaseStatusBannerProps {
  onDismiss?: () => void;
}

export function DatabaseStatusBanner({ onDismiss }: DatabaseStatusBannerProps) {
  const [status, setStatus] = useState<'checking' | 'connected' | 'missing-schema' | 'error'>('checking');
  const [dismissed, setDismissed] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    checkDatabaseStatus();
  }, []);

  const checkDatabaseStatus = async () => {
    try {
      const response = await fetch('/api/insights').catch(err => {
        console.warn('[v0] Database status check failed:', err);
        return null;
      });
      
      if (!response || !response.ok) {
        // API route doesn't exist (404) or other non-2xx — treat as client-only mode
        setStatus('connected');
        setMessage('Running in client-only mode');
        setTimeout(() => {
          setDismissed(true);
        }, 2000);
        return;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        // Route exists but returned HTML (e.g. dev error page) — treat as client-only
        setStatus('connected');
        setMessage('Running in client-only mode');
        setTimeout(() => { setDismissed(true); }, 2000);
        return;
      }

      let data: Record<string, unknown>;
      try {
        data = await response.json();
      } catch {
        // Body wasn't valid JSON despite Content-Type header — treat as client-only
        setStatus('connected');
        setMessage('Running in client-only mode');
        setTimeout(() => { setDismissed(true); }, 2000);
        return;
      }
      
      if (data.setupRequired) {
        setStatus('missing-schema');
        setMessage(data.message || 'Database tables need to be created');
      } else if (data.success) {
        setStatus('connected');
        setMessage('Database connected and ready');
        // Auto-dismiss success message after 3 seconds
        setTimeout(() => {
          setDismissed(true);
        }, 3000);
      } else {
        setStatus('error');
        setMessage(data.message || 'Unable to connect to database');
      }
    } catch (error) {
      console.error('[v0] Database status check error:', error);
      // Gracefully handle missing API routes
      setStatus('connected');
      setMessage('Running in client-only mode');
      setTimeout(() => {
        setDismissed(true);
      }, 2000);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismiss) {
      onDismiss();
    }
  };

  if (dismissed || status === 'connected') {
    return null;
  }

  const getBannerStyles = () => {
    switch (status) {
      case 'checking':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'missing-schema':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'error':
        return 'bg-red-500/10 border-red-500/20 text-red-400';
      default:
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'checking':
        return <Loader2 className="w-5 h-5 animate-spin" />;
      case 'missing-schema':
        return <AlertCircle className="w-5 h-5" />;
      case 'error':
        return <AlertCircle className="w-5 h-5" />;
      default:
        return <Database className="w-5 h-5" />;
    }
  };

  return (
    <div className={`relative rounded-2xl border p-4 mb-6 ${getBannerStyles()}`}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="font-semibold">
                {status === 'checking' && 'Checking database connection...'}
                {status === 'missing-schema' && 'Database Setup Required'}
                {status === 'error' && 'Database Connection Issue'}
              </div>
              <div className="text-sm opacity-90">{message}</div>
              
              {status === 'missing-schema' && (
                <div className="space-y-3 pt-2">
                  <div className="text-sm">
                    <p className="mb-2">Quick setup (2 minutes):</p>
                    <ol className="list-decimal list-inside space-y-1 opacity-80">
                      <li>Open Supabase SQL Editor</li>
                      <li>Copy contents from <code className="bg-black/30 px-1.5 py-0.5 rounded">/scripts/setup-database.sql</code></li>
                      <li>Paste and run in SQL Editor</li>
                      <li>Refresh this page</li>
                    </ol>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <a
                      href="https://eybrsbslfyknmpyhkosz.supabase.co/project/eybrsbslfyknmpyhkosz/sql/new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg text-sm font-medium transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open Supabase SQL Editor
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.origin + '/SETUP_DATABASE_INSTRUCTIONS.md');
                      }}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Database className="w-4 h-4" />
                      View Setup Instructions
                    </button>
                  </div>
                </div>
              )}

              {status === 'error' && (
                <div className="text-sm opacity-80 pt-2">
                  <p>Please check:</p>
                  <ul className="list-disc list-inside space-y-1 mt-1">
                    <li>Supabase environment variables are set</li>
                    <li>Database connection is active</li>
                    <li>RLS policies are configured</li>
                  </ul>
                </div>
              )}
            </div>
            
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 hover:bg-black/20 rounded-lg transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
