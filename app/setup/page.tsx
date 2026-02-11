'use client';

import { useState } from 'react';
import { CheckCircle, AlertCircle, Database, Loader2 } from 'lucide-react';

export default function SetupPage() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const checkDatabase = async () => {
    setStatus('checking');
    setMessage('Checking database schema...');
    
    try {
      const response = await fetch('/api/health/database');
      const data = await response.json();
      
      if (data.status === 'healthy') {
        setStatus('success');
        setMessage('Database is configured correctly!');
      } else {
        setStatus('error');
        setMessage('Database tables need to be created. Please run the SQL migration in Supabase.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Failed to check database status.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <Database className="w-8 h-8 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Database Setup</h1>
        </div>

        <div className="space-y-4 mb-6">
          <p className="text-slate-300">
            Before using the platform, you need to set up the database schema.
          </p>
          
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-2">Setup Instructions:</h3>
            <ol className="text-sm text-slate-400 space-y-2 list-decimal list-inside">
              <li>Open your Supabase Dashboard</li>
              <li>Navigate to SQL Editor</li>
              <li>Copy the contents of <code className="text-blue-400">/scripts/setup-database.sql</code></li>
              <li>Paste and run the SQL script</li>
              <li>Return here and click "Check Database"</li>
            </ol>
          </div>
        </div>

        <button
          onClick={checkDatabase}
          disabled={status === 'checking'}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          {status === 'checking' ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <Database className="w-5 h-5" />
              Check Database
            </>
          )}
        </button>

        {status === 'success' && (
          <div className="mt-4 flex items-start gap-3 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-green-400 font-semibold">Success!</p>
              <p className="text-slate-300 text-sm">{message}</p>
              <a href="/" className="text-blue-400 hover:text-blue-300 text-sm underline mt-2 inline-block">
                Go to Application →
              </a>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-4 flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-semibold">Setup Required</p>
              <p className="text-slate-300 text-sm">{message}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
