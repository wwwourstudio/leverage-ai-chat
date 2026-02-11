'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2, Database, Play } from 'lucide-react';

export default function AdminSetupPage() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'running' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [details, setDetails] = useState<any>(null);

  const checkDatabaseStatus = async () => {
    setStatus('checking');
    setMessage('Checking database status...');
    
    try {
      const res = await fetch('/api/health/database');
      const data = await res.json();
      
      setDetails(data);
      
      if (data.tablesExist) {
        setStatus('success');
        setMessage('Database is already set up! All tables exist.');
      } else {
        setStatus('idle');
        setMessage('Database needs setup. Click "Run Migration" to create tables.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Failed to check database status');
      console.error(error);
    }
  };

  const runMigration = async () => {
    setStatus('running');
    setMessage('Running database migration...');
    
    try {
      const res = await fetch('/api/admin/run-migration', {
        method: 'POST'
      });
      
      const data = await res.json();
      
      if (data.success) {
        setStatus('success');
        setMessage(`Migration completed successfully! Created ${data.tablesCreated || 7} tables.`);
        setDetails(data);
      } else {
        setStatus('error');
        setMessage(data.error || 'Migration failed');
        setDetails(data);
      }
    } catch (error: any) {
      setStatus('error');
      setMessage(`Migration failed: ${error.message}`);
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-white mb-2">Database Setup</h1>
          <p className="text-slate-400">Initialize your Leverage AI database schema</p>
        </div>

        <Card className="bg-slate-900/50 border-slate-800 p-6 mb-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Database className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white mb-2">Database Migration</h2>
              <p className="text-slate-400 text-sm">
                This will create all required tables, indexes, views, functions, and RLS policies for your application.
              </p>
            </div>
          </div>

          <div className="flex gap-3 mb-6">
            <Button
              onClick={checkDatabaseStatus}
              disabled={status === 'checking' || status === 'running'}
              variant="outline"
              className="border-slate-700 hover:bg-slate-800"
            >
              {status === 'checking' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Database className="w-4 h-4 mr-2" />
              )}
              Check Status
            </Button>

            <Button
              onClick={runMigration}
              disabled={status === 'checking' || status === 'running' || status === 'success'}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {status === 'running' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Run Migration
            </Button>
          </div>

          {message && (
            <div className={`
              p-4 rounded-lg flex items-start gap-3
              ${status === 'success' ? 'bg-green-500/10 border border-green-500/20' : ''}
              ${status === 'error' ? 'bg-red-500/10 border border-red-500/20' : ''}
              ${status === 'checking' || status === 'running' ? 'bg-blue-500/10 border border-blue-500/20' : ''}
              ${status === 'idle' ? 'bg-slate-800/50 border border-slate-700' : ''}
            `}>
              {status === 'success' && <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />}
              {status === 'error' && <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />}
              {(status === 'checking' || status === 'running') && <Loader2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5 animate-spin" />}
              
              <div className="flex-1">
                <p className={`font-medium ${
                  status === 'success' ? 'text-green-400' :
                  status === 'error' ? 'text-red-400' :
                  'text-slate-300'
                }`}>
                  {message}
                </p>
                
                {details && (
                  <pre className="mt-2 text-xs text-slate-400 overflow-auto max-h-96">
                    {JSON.stringify(details, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </Card>

        <Card className="bg-slate-900/50 border-slate-800 p-6">
          <h3 className="text-lg font-bold text-white mb-4">What gets created:</h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span><strong className="text-slate-300">7 Tables:</strong> ai_response_trust, ai_audit_log, odds_benford_baselines, validation_thresholds, live_odds_cache, app_config, user_profiles</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span><strong className="text-slate-300">23 Indexes:</strong> For optimized query performance</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span><strong className="text-slate-300">3 Views:</strong> Aggregated metrics and analytics</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span><strong className="text-slate-300">4 Functions:</strong> Auto-cleanup and statistics updates</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span><strong className="text-slate-300">RLS Policies:</strong> Row-level security for all tables</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span><strong className="text-slate-300">Seed Data:</strong> Default configuration values</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
