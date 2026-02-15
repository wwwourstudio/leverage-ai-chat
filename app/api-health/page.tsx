'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';

interface SportResult {
  sport: string;
  sportKey: string;
  status: string;
  gamesAvailable: number;
  responseTime: number;
  apiStatus?: number;
  remainingRequests?: string;
  usedRequests?: string;
  error?: string;
  sampleGame?: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    commenceTime: string;
  };
}

interface DiagnosticsResponse {
  success: boolean;
  summary: {
    overallHealth: string;
    totalSportsTested: number;
    successfulSports: number;
    failedSports: number;
    totalGamesAvailable: number;
    totalDiagnosticTime: number;
    timestamp: string;
  };
  results: SportResult[];
  recommendations: string[];
}

export default function APIHealthDashboard() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/odds/diagnostics');
      const data = await response.json();
      setDiagnostics(data);
      setLastRun(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('[v0] Diagnostics error:', error);
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

  const getStatusIcon = (status: string, gamesAvailable: number) => {
    if (status === 'error') {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
    if (gamesAvailable === 0) {
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
                  {getHealthBadge(diagnostics.summary.overallHealth)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Sports Online</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {diagnostics.summary.successfulSports} / {diagnostics.summary.totalSportsTested}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Games</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{diagnostics.summary.totalGamesAvailable}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Diagnostic Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{diagnostics.summary.totalDiagnosticTime}ms</div>
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
                      <span className="text-primary mt-0.5">•</span>
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
              <Card key={result.sportKey} className="relative">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{result.sport}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {result.sportKey}
                      </CardDescription>
                    </div>
                    {getStatusIcon(result.status, result.gamesAvailable)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Games Available</p>
                      <p className="font-semibold text-lg">{result.gamesAvailable}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Response Time</p>
                      <p className="font-semibold text-lg">{result.responseTime}ms</p>
                    </div>
                  </div>

                  {result.status === 'success' && result.remainingRequests && (
                    <div className="pt-3 border-t">
                      <p className="text-xs text-muted-foreground">API Quota</p>
                      <p className="text-sm font-medium mt-1">
                        {result.remainingRequests} requests remaining
                      </p>
                    </div>
                  )}

                  {result.sampleGame && (
                    <div className="pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-1">Sample Game</p>
                      <p className="text-xs font-medium text-pretty">
                        {result.sampleGame.awayTeam} @ {result.sampleGame.homeTeam}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(result.sampleGame.commenceTime).toLocaleString()}
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
