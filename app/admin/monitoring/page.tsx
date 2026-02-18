'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface HealthStatus {
  status: string;
  timestamp: string;
  services: {
    oddsApi: ServiceCheck;
    supabase: ServiceCheck;
    grokWeather: ServiceCheck;
  };
  environment: {
    hasOddsApiKey: boolean;
    hasSupabaseUrl: boolean;
    hasGrokApiKey: boolean;
  };
}

interface ServiceCheck {
  status: string;
  message: string;
  responseTime?: number;
}

interface OddsStats {
  [sport: string]: {
    totalRecords: number;
    oldestRecord?: string;
    newestRecord?: string;
    uniqueEvents: number;
  };
}

export default function MonitoringPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [oddsStats, setOddsStats] = useState<OddsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchHealth = async () => {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setHealth(data);
    } catch (error) {
      console.error('Failed to fetch health:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/stats');
      const data = await response.json();
      setOddsStats(data.oddsStats);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const refresh = async () => {
    setLoading(true);
    await Promise.all([fetchHealth(), fetchStats()]);
    setLastRefresh(new Date());
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'healthy':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'offline':
      case 'unhealthy':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      online: 'bg-green-100 text-green-800',
      offline: 'bg-red-100 text-red-800',
      unconfigured: 'bg-gray-100 text-gray-800',
      healthy: 'bg-green-100 text-green-800',
      degraded: 'bg-yellow-100 text-yellow-800',
      unhealthy: 'bg-red-100 text-red-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-balance text-4xl font-bold tracking-tight">
              System Monitoring
            </h1>
            <p className="text-muted-foreground">
              Real-time health and statistics dashboard
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
            <Button onClick={refresh} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Overall Status */}
        {health && (
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Overall Status</h2>
                <p className="text-sm text-muted-foreground">
                  {health.timestamp}
                </p>
              </div>
              <Badge className={getStatusBadge(health.status)}>
                {health.status.toUpperCase()}
              </Badge>
            </div>
          </Card>
        )}

        {/* Services Grid */}
        {health && (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Odds API */}
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Odds API</h3>
                  <div
                    className={`h-3 w-3 rounded-full ${getStatusColor(health.services.oddsApi.status)}`}
                  />
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Status: </span>
                    <Badge className={getStatusBadge(health.services.oddsApi.status)}>
                      {health.services.oddsApi.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {health.services.oddsApi.message}
                  </p>
                  {health.services.oddsApi.responseTime && (
                    <p className="text-xs text-muted-foreground">
                      Response time: {health.services.oddsApi.responseTime}ms
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    API Key:{' '}
                    {health.environment.hasOddsApiKey ? '✓ Configured' : '✗ Missing'}
                  </p>
                </div>
              </div>
            </Card>

            {/* Supabase */}
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Supabase Database</h3>
                  <div
                    className={`h-3 w-3 rounded-full ${getStatusColor(health.services.supabase.status)}`}
                  />
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Status: </span>
                    <Badge className={getStatusBadge(health.services.supabase.status)}>
                      {health.services.supabase.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {health.services.supabase.message}
                  </p>
                  {health.services.supabase.responseTime && (
                    <p className="text-xs text-muted-foreground">
                      Response time: {health.services.supabase.responseTime}ms
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    URL:{' '}
                    {health.environment.hasSupabaseUrl ? '✓ Configured' : '✗ Missing'}
                  </p>
                </div>
              </div>
            </Card>

            {/* Grok Weather */}
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Grok Weather</h3>
                  <div
                    className={`h-3 w-3 rounded-full ${getStatusColor(health.services.grokWeather.status)}`}
                  />
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Status: </span>
                    <Badge className={getStatusBadge(health.services.grokWeather.status)}>
                      {health.services.grokWeather.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {health.services.grokWeather.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    API Key:{' '}
                    {health.environment.hasGrokApiKey ? '✓ Configured' : '✗ Missing'}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Database Statistics */}
        {oddsStats && (
          <Card className="p-6">
            <h2 className="mb-4 text-2xl font-semibold">Database Statistics</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Object.entries(oddsStats).map(([sport, stats]) => (
                <div key={sport} className="space-y-2 rounded-lg border p-4">
                  <h3 className="font-semibold uppercase">{sport}</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Records:</span>
                      <span className="font-medium">{stats.totalRecords}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Events:</span>
                      <span className="font-medium">{stats.uniqueEvents}</span>
                    </div>
                    {stats.newestRecord && (
                      <div className="text-xs text-muted-foreground">
                        Latest: {new Date(stats.newestRecord).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Quick Actions */}
        <Card className="p-6">
          <h2 className="mb-4 text-2xl font-semibold">Quick Actions</h2>
          <div className="flex flex-wrap gap-4">
            <Button
              variant="outline"
              onClick={() => window.open('/api/health', '_blank')}
            >
              View Health JSON
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('/api/odds/test', '_blank')}
            >
              Test Odds API
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('/docs/ODDS_API_DEBUGGING_GUIDE.md', '_blank')}
            >
              View Documentation
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
