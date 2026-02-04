'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HealthStatus {
  status: string;
  ready: boolean;
  integrations: {
    supabase: { configured: boolean; missing: string[] };
    grokAI: { configured: boolean; missing: string[] };
    oddsAPI: { configured: boolean; missing: string[] };
  };
  database: {
    connected: boolean;
    tables: Record<string, boolean>;
    allTablesExist: boolean;
    message: string;
  };
  summary: {
    criticalIssues: number;
    warnings: number;
    message: string;
  };
}

export function SystemStatusBanner() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/health');
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
      const data = await response.json();
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check system status');
      console.error('[v0] Health check error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-red-400 mb-1">System Status Check Failed</h3>
            <p className="text-sm text-red-300/80 mb-3">{error}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={checkHealth}
                className="h-8 text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1.5" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!health) {
    return null;
  }

  // Only show banner if there are issues
  const hasIssues = !health.ready || !health.database.allTablesExist || health.summary.criticalIssues > 0;
  
  if (!hasIssues) {
    return null;
  }

  const statusIcon = health.status === 'healthy' ? (
    <CheckCircle className="w-5 h-5 text-green-400" />
  ) : (
    <AlertTriangle className="w-5 h-5 text-yellow-400" />
  );

  const bgColor = health.status === 'healthy' 
    ? 'bg-green-500/10 border-green-500/20' 
    : 'bg-yellow-500/10 border-yellow-500/20';

  const textColor = health.status === 'healthy' ? 'text-green-400' : 'text-yellow-400';

  return (
    <div className={`${bgColor} border rounded-lg p-4 mb-4`}>
      <div className="flex items-start gap-3">
        {statusIcon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className={`text-sm font-semibold ${textColor}`}>
              Configuration Required
            </h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpanded(!expanded)}
              className="h-6 text-xs"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
          
          <p className="text-sm text-foreground/70 mb-3">
            {health.summary.message}
          </p>

          {!health.database.allTablesExist && (
            <div className="bg-background/30 rounded p-3 mb-3">
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-400" />
                Database Tables Missing
              </p>
              <p className="text-xs text-foreground/60 mb-2">
                {health.database.message}
              </p>
              <div className="text-xs space-y-1">
                {Object.entries(health.database.tables).map(([table, exists]) => (
                  <div key={table} className="flex items-center gap-2">
                    {exists ? (
                      <CheckCircle className="w-3 h-3 text-green-400" />
                    ) : (
                      <XCircle className="w-3 h-3 text-red-400" />
                    )}
                    <span className={exists ? 'text-green-400' : 'text-red-400'}>
                      {table}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {expanded && (
            <>
              <div className="space-y-2 mb-3 text-xs">
                <div>
                  <p className="font-medium mb-1">Integration Status:</p>
                  <div className="space-y-1 ml-2">
                    <StatusItem 
                      name="Supabase" 
                      configured={health.integrations.supabase.configured}
                      missing={health.integrations.supabase.missing}
                    />
                    <StatusItem 
                      name="Grok AI" 
                      configured={health.integrations.grokAI.configured}
                      missing={health.integrations.grokAI.missing}
                    />
                    <StatusItem 
                      name="Odds API" 
                      configured={health.integrations.oddsAPI.configured}
                      missing={health.integrations.oddsAPI.missing}
                    />
                  </div>
                </div>

                <div className="bg-background/30 rounded p-3">
                  <p className="font-medium mb-2">Quick Fixes:</p>
                  <ol className="list-decimal list-inside space-y-1 text-foreground/70">
                    <li>Open Supabase SQL Editor</li>
                    <li>Run the migration file: <code className="text-xs bg-background/50 px-1 rounded">supabase/migrations/20260201_trust_integrity_system.sql</code></li>
                    <li>Set environment variables in Vercel dashboard</li>
                    <li>Refresh this page</li>
                  </ol>
                </div>

                <div className="bg-background/30 rounded p-3">
                  <p className="font-medium mb-2">Common Issues:</p>
                  <ul className="list-disc list-inside space-y-1 text-foreground/70">
                    <li><strong>Fetch Failed:</strong> Database tables not created - run migration</li>
                    <li><strong>Permission Denied:</strong> Check Row Level Security policies in Supabase</li>
                    <li><strong>Connection Error:</strong> Verify Supabase URL and anon key in env vars</li>
                    <li><strong>Network Issues:</strong> Check internet connection and Supabase service status</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={checkHealth}
                  className="h-8 text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1.5" />
                  Recheck Status
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="h-8 text-xs"
                >
                  <a href="/SETUP_GUIDE.md" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3 h-3 mr-1.5" />
                    Setup Guide
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="h-8 text-xs"
                >
                  <a href="/DEPLOYMENT_TROUBLESHOOTING.md" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3 h-3 mr-1.5" />
                    Troubleshooting
                  </a>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusItem({ 
  name, 
  configured, 
  missing 
}: { 
  name: string; 
  configured: boolean; 
  missing: string[];
}) {
  return (
    <div className="flex items-start gap-2">
      {configured ? (
        <CheckCircle className="w-3 h-3 text-green-400 mt-0.5" />
      ) : (
        <XCircle className="w-3 h-3 text-red-400 mt-0.5" />
      )}
      <div className="flex-1">
        <span className={configured ? 'text-green-400' : 'text-red-400'}>
          {name}
        </span>
        {!configured && missing.length > 0 && (
          <div className="text-foreground/50 text-[10px] ml-1">
            Missing: {missing.join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}
