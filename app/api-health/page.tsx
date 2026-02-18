'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';

interface SportResult {
  sport: string;
  apiKey: string;
  status: 'success' | 'no_games' | 'error';
  eventCount?: number;
  httpStatus?: number;
  apiUrl?: string;
  error?: string;
}

interface DiagnosticsResponse {
  configured: boolean;
  apiKeyPrefix?: string;
  timestamp: string;
  summary: {
    total: number;
    success: number;
    noGames: number;
    errors: number;
  };
  results: SportResult[];
  recommendations: string[];
}

function deriveOverallHealth(summary: DiagnosticsResponse['summary']): string {
  if (summary.errors === summary.total) return 'critical';
  if (summary.errors > 0 || summary.success === 0) return 'degraded';
  return 'healthy';
}

export default function APIHealthDashboard() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/odds/test');
      const data = await response.json();
      setDiagnostics(data);
      setLastRun(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Diagnostics error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'healthy':
        return <Badge className="bg-green-600">Healthy</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-600">Degraded</Badge>;
      case 'critical':
        return <Badge className="bg-red-600">Critical</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getStatusIcon = (status: string, eventCount?: number) => {
    if (status === 'error') {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
    if (status === 'no_games' || eventCount === 0) {
      return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
    return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-balance">Sports API Health Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Monitor connectivity and availability across all sports APIs
          </p>
        </div>
        <Button
          onClick={runDiagnostics}
          disabled={loading}
          className="flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Run Diagnostics
        </Button>
      </div>

      {lastRun && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Clock className="h-4 w-4" />
          Last run: {lastRun}
        </div>
      )}

      {loading && !diagnostics && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Running comprehensive diagnostics...</p>
        </div>
      )}

      {diagnostics && (
        <>
          {/* Overall Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Overall Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {getHealthBadge(deriveOverallHealth(diagnostics.summary))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Sports Online</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {diagnostics.summary.success} / {diagnostics.summary.total}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Games</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {diagnostics.results.reduce((sum, r) => sum + (r.eventCount || 0), 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Off-Season</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {diagnostics.summary.noGames} sport{diagnostics.summary.noGames !== 1 ? 's' : ''}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          {diagnostics.recommendations.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
                <CardDescription>Actions to improve API health</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {diagnostics.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-primary mt-0.5">{'•'}</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Sport Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {diagnostics.results.map((result) => (
              <Card key={result.apiKey} className="relative">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{result.sport}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {result.apiKey}
                      </CardDescription>
                    </div>
                    {getStatusIcon(result.status, result.eventCount)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Games Available</p>
                      <p className="font-semibold text-lg">{result.eventCount ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">HTTP Status</p>
                      <p className="font-semibold text-lg">{result.httpStatus ?? '--'}</p>
                    </div>
                  </div>

                  {result.status === 'no_games' && (
                    <div className="pt-3 border-t">
                      <p className="text-xs text-yellow-600 font-medium">No Games</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        This sport may be out of season or have no scheduled games right now.
                      </p>
                    </div>
                  )}

                  {result.error && (
                    <div className="pt-3 border-t">
                      <p className="text-xs text-red-500 font-medium">Error</p>
                      <p className="text-xs text-muted-foreground mt-1 text-pretty">
                        {result.error}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
