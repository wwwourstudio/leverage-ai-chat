'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Zap,
  Database,
  BarChart3,
  Shield,
} from 'lucide-react';
import Link from 'next/link';

interface ServiceCheck {
  name: string;
  endpoint: string;
  status: 'checking' | 'healthy' | 'degraded' | 'unhealthy';
  latency: number | null;
  message: string;
  icon: React.ElementType;
}

const SERVICES: Omit<ServiceCheck, 'status' | 'latency' | 'message'>[] = [
  { name: 'AI Analysis (Grok)', endpoint: '/api/analyze', icon: Zap },
  { name: 'Insights API', endpoint: '/api/insights', icon: Database },
  { name: 'Cards Generator', endpoint: '/api/cards', icon: BarChart3 },
  { name: 'Live Odds API', endpoint: '/api/odds', icon: Activity },
];

function StatusIcon({ status }: { status: ServiceCheck['status'] }) {
  switch (status) {
    case 'healthy':
      return <CheckCircle className="h-5 w-5 text-emerald-400" />;
    case 'degraded':
      return <AlertTriangle className="h-5 w-5 text-amber-400" />;
    case 'unhealthy':
      return <XCircle className="h-5 w-5 text-red-400" />;
    default:
      return <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />;
  }
}

export default function APIHealthPage() {
  const [services, setServices] = useState<ServiceCheck[]>(
    SERVICES.map((s) => ({ ...s, status: 'checking', latency: null, message: 'Checking...' }))
  );
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkService = useCallback(
    async (service: (typeof SERVICES)[number]): Promise<ServiceCheck> => {
      const start = performance.now();
      try {
        const isPost = service.endpoint === '/api/analyze' || service.endpoint === '/api/cards' || service.endpoint === '/api/odds';

        const res = await fetch(service.endpoint, {
          method: isPost ? 'POST' : 'GET',
          headers: isPost ? { 'Content-Type': 'application/json' } : undefined,
          body: isPost
            ? JSON.stringify(
                service.endpoint === '/api/analyze'
                  ? { userMessage: 'health check', context: {} }
                  : service.endpoint === '/api/cards'
                    ? { category: 'betting', limit: 1 }
                    : { sport: 'basketball_nba', marketType: 'h2h' }
              )
            : undefined,
          signal: AbortSignal.timeout(15000),
        });

        const latency = Math.round(performance.now() - start);
        const ct = res.headers.get('content-type') || '';

        if (!res.ok) {
          const body = ct.includes('application/json') ? await res.json().catch(() => null) : null;
          const msg = body?.error || body?.message || `HTTP ${res.status}`;
          return { ...service, status: 'degraded', latency, message: msg };
        }

        if (!ct.includes('application/json')) {
          return { ...service, status: 'degraded', latency, message: 'Non-JSON response' };
        }

        const data = await res.json();
        if (data.success === false && data.error) {
          return { ...service, status: 'degraded', latency, message: data.error };
        }

        return { ...service, status: 'healthy', latency, message: 'Operational' };
      } catch (err) {
        const latency = Math.round(performance.now() - start);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { ...service, status: 'unhealthy', latency, message };
      }
    },
    []
  );

  const runChecks = useCallback(async () => {
    setIsRefreshing(true);
    setServices(SERVICES.map((s) => ({ ...s, status: 'checking', latency: null, message: 'Checking...' })));

    const results = await Promise.all(SERVICES.map(checkService));
    setServices(results);
    setLastChecked(new Date());
    setIsRefreshing(false);
  }, [checkService]);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  const overallStatus = services.every((s) => s.status === 'healthy')
    ? 'healthy'
    : services.some((s) => s.status === 'unhealthy')
      ? 'unhealthy'
      : services.some((s) => s.status === 'degraded')
        ? 'degraded'
        : 'checking';

  const overallLabel =
    overallStatus === 'healthy'
      ? 'All Systems Operational'
      : overallStatus === 'degraded'
        ? 'Partial Degradation'
        : overallStatus === 'unhealthy'
          ? 'Service Disruption'
          : 'Checking...';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-4">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to home</span>
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">API Health</h1>
          </div>
          <button
            onClick={runChecks}
            disabled={isRefreshing}
            className="ml-auto flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8 space-y-8">
        {/* Overall Status Banner */}
        <div
          className={`flex items-center gap-4 rounded-2xl border p-6 ${
            overallStatus === 'healthy'
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : overallStatus === 'degraded'
                ? 'border-amber-500/30 bg-amber-500/5'
                : overallStatus === 'unhealthy'
                  ? 'border-red-500/30 bg-red-500/5'
                  : 'border-border bg-card'
          }`}
        >
          <StatusIcon status={overallStatus} />
          <div>
            <p className="font-medium text-foreground">{overallLabel}</p>
            {lastChecked && (
              <p className="text-xs text-muted-foreground">
                Last checked {lastChecked.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        {/* Service List */}
        <div className="space-y-3">
          {services.map((service) => (
            <div
              key={service.name}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <service.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm">{service.name}</p>
                <p className="text-xs text-muted-foreground truncate">{service.message}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {service.latency !== null && (
                  <span className="text-xs font-mono text-muted-foreground">
                    {service.latency}ms
                  </span>
                )}
                <StatusIcon status={service.status} />
              </div>
            </div>
          ))}
        </div>

        {/* Endpoint Reference */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <h2 className="text-sm font-medium text-foreground">Endpoint Reference</h2>
          <div className="space-y-2">
            {SERVICES.map((s) => (
              <div key={s.endpoint} className="flex items-center gap-3 text-xs">
                <code className="rounded bg-secondary px-2 py-1 font-mono text-muted-foreground">
                  {s.endpoint}
                </code>
                <span className="text-muted-foreground">{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
