'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Bell, Plus, Trash2, TrendingUp, Target, Activity, Zap,
  Loader2, CheckCircle, ToggleLeft, ToggleRight, Sparkles,
  RotateCcw, Filter, AlertCircle, Clock, ChevronRight,
  BarChart2, Mail, MessageSquare, Smartphone, Webhook,
} from 'lucide-react';
import { useToast } from '@/components/toast-provider';
import { SPORT_KEYS } from '@/lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlertsLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  onAlertsCountChange?: (count: number) => void;
}

interface UserAlert {
  id: string;
  user_id: string;
  alert_type: string;
  sport: string | null;
  team: string | null;
  player: string | null;
  condition: Record<string, unknown>;
  threshold: number | null;
  is_active: boolean;
  trigger_count: number;
  max_triggers: number | null;
  last_triggered_at: string | null;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string | null;
  notify_channels?: string[];
}

interface AiSuggestion {
  title: string;
  alert_type: string;
  threshold: number | null;
  description: string | null;
  sport: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALERT_TYPES = [
  { value: 'odds_change',         label: 'Odds Change',    icon: TrendingUp, color: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/30' },
  { value: 'line_movement',       label: 'Line Movement',  icon: Activity,   color: 'text-blue-400',   bg: 'bg-blue-500/15',   border: 'border-blue-500/30'   },
  { value: 'player_prop',         label: 'Player Prop',    icon: Target,     color: 'text-green-400',  bg: 'bg-green-500/15',  border: 'border-green-500/30'  },
  { value: 'arbitrage',           label: 'Arbitrage',      icon: Zap,        color: 'text-yellow-400', bg: 'bg-yellow-500/15', border: 'border-yellow-500/30' },
  { value: 'kalshi_price',        label: 'Kalshi Price',   icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/15', border: 'border-purple-500/30' },
  { value: 'game_start',          label: 'Game Start',     icon: Bell,       color: 'text-cyan-400',   bg: 'bg-cyan-500/15',   border: 'border-cyan-500/30'   },
  { value: 'market_intelligence', label: 'Market Signal',  icon: BarChart2,  color: 'text-indigo-400', bg: 'bg-indigo-500/15', border: 'border-indigo-500/30' },
] as const;

// ─── Delivery channels ────────────────────────────────────────────────────────

const DELIVERY_CHANNELS = [
  { value: 'in_app',  label: 'In-App',  icon: Bell },
  { value: 'email',   label: 'Email',   icon: Mail },
  { value: 'sms',     label: 'SMS',     icon: MessageSquare },
  { value: 'push',    label: 'Push',    icon: Smartphone },
  { value: 'webhook', label: 'Webhook', icon: Webhook },
] as const;

const SPORTS = Object.values(SPORT_KEYS).map(s => s.NAME);

const MAX_TRIGGERS_OPTIONS = [
  { value: '1',    label: '1×' },
  { value: '3',    label: '3×' },
  { value: '5',    label: '5×' },
  { value: '10',   label: '10×' },
  { value: 'null', label: '∞ Unlimited' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getThresholdLabel(alertType: string): string | null {
  switch (alertType) {
    case 'line_movement':
    case 'odds_change':    return 'Min movement (pts)';
    case 'arbitrage':      return 'Min ROI %';
    case 'kalshi_price':   return 'Price threshold (0–100)';
    default:               return null;
  }
}

function getAlertPreview(form: {
  alert_type: string; sport: string; team: string; player: string; threshold: string;
}): string {
  const type = ALERT_TYPES.find(t => t.value === form.alert_type);
  const typeName = type?.label ?? form.alert_type;
  const context = [form.sport, form.team, form.player].filter(Boolean).join(' · ');
  const thresh = form.threshold ? ` ≥ ${form.threshold}` : '';
  return `Fire when ${typeName}${thresh} is detected${context ? ` for ${context}` : ''}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AlertsLightbox({ isOpen, onClose, onAlertsCountChange }: AlertsLightboxProps) {
  const toast = useToast();

  // Tab + filter state
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused'>('all');

  // Data state
  const [alerts, setAlerts] = useState<UserAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Create form state
  const [saving, setSaving] = useState(false);
  const [newAlert, setNewAlert] = useState({
    alert_type: 'odds_change',
    sport: '',
    team: '',
    player: '',
    title: '',
    description: '',
    threshold: '',
    max_triggers: '1',
    notify_channels: ['in_app'] as string[],
  });

  // AI suggestion state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);

  // Inline action state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auth check ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;

    // Reset filter + loading state on every open so the list never appears blank
    // due to stale filterType from a previous session (component stays mounted
    // when the lightbox is "closed" via isOpen=false → return null).
    setFilterType(null);
    setFilterStatus('all');
    setAuthChecked(false);
    setLoading(true);

    const checkAuth = async () => {
      try {
        const res = await fetch('/api/alerts');
        setIsAuthenticated(res.status !== 401);
      } catch {
        setIsAuthenticated(false);
      }
      setAuthChecked(true);
    };

    checkAuth();
  }, [isOpen]);

  // ── Load alerts ─────────────────────────────────────────────────────────────

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alerts');
      if (!res.ok) {
        if (res.status === 401) setIsAuthenticated(false);
        setAlerts([]);
        onAlertsCountChange?.(0);
        return;
      }
      const json = await res.json();
      const data: UserAlert[] = json.data ?? [];
      setAlerts(data);
      onAlertsCountChange?.(data.filter(a => a.is_active).length);
    } catch (err) {
      console.error('[Alerts] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, [onAlertsCountChange]);

  useEffect(() => {
    if (authChecked && isAuthenticated) {
      loadAlerts();
    } else if (authChecked && !isAuthenticated) {
      setLoading(false);
    }
  }, [authChecked, isAuthenticated, loadAlerts]);

  // ── Polling ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated || !isOpen) return;

    const checkAlerts = async () => {
      try {
        const res = await fetch('/api/alerts/check');
        if (!res.ok) return;
        const data = await res.json();
        if (data.triggered?.length > 0) {
          for (const a of data.triggered as { title: string }[]) {
            toast.success(`Alert fired: ${a.title}`);
          }
          await loadAlerts();
        }
      } catch {
        // non-fatal
      }
    };

    pollingRef.current = setInterval(checkAlerts, 60_000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [isAuthenticated, isOpen, loadAlerts, toast]);

  // ── CRUD handlers ────────────────────────────────────────────────────────────

  const handleCreateAlert = async () => {
    if (!newAlert.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newAlert.title.trim(),
          alert_type: newAlert.alert_type,
          sport: newAlert.sport || null,
          team: newAlert.team || null,
          player: newAlert.player || null,
          description: newAlert.description || null,
          threshold: newAlert.threshold ? parseFloat(newAlert.threshold) : null,
          max_triggers: newAlert.max_triggers === 'null' ? null : parseInt(newAlert.max_triggers) || 1,
          notify_channels: newAlert.notify_channels.length > 0 ? newAlert.notify_channels : ['in_app'],
        }),
      });

      if (res.ok) {
        toast.success('Alert created');
        setNewAlert({ alert_type: 'odds_change', sport: '', team: '', player: '', title: '', description: '', threshold: '', max_triggers: '1', notify_channels: ['in_app'] });
        setAiSuggestion(null);
        setActiveTab('list');
        await loadAlerts();
      } else {
        const json = await res.json();
        toast.error(json.error ?? 'Failed to create alert');
      }
    } catch (err) {
      console.error('[Alerts] Create failed:', err);
      toast.error('Failed to create alert');
    } finally {
      setSaving(false);
    }
  };

  const toggleAlert = async (alertId: string, isActive: boolean) => {
    // Optimistic update
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_active: !isActive } : a));
    try {
      const res = await fetch(`/api/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      });
      if (!res.ok) {
        // revert
        setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_active: isActive } : a));
        toast.error('Failed to update alert');
      } else {
        onAlertsCountChange?.(alerts.filter(a => a.id === alertId ? !isActive : a.is_active).length);
      }
    } catch {
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_active: isActive } : a));
    }
  };

  const deleteAlert = async (alertId: string) => {
    setDeletingId(alertId);
    try {
      const res = await fetch(`/api/alerts/${alertId}`, { method: 'DELETE' });
      if (res.ok) {
        const updated = alerts.filter(a => a.id !== alertId);
        setAlerts(updated);
        onAlertsCountChange?.(updated.filter(a => a.is_active).length);
        toast.success('Alert deleted');
      } else {
        toast.error('Failed to delete alert');
      }
    } catch {
      toast.error('Failed to delete alert');
    } finally {
      setDeletingId(null);
    }
  };

  const resetTriggerCount = async (alertId: string) => {
    setResettingId(alertId);
    try {
      const res = await fetch(`/api/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger_count: 0 }),
      });
      if (res.ok) {
        setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, trigger_count: 0, last_triggered_at: null } : a));
        toast.success('Trigger count reset');
      } else {
        toast.error('Failed to reset');
      }
    } catch {
      toast.error('Failed to reset');
    } finally {
      setResettingId(null);
    }
  };

  // ── AI Suggestions ──────────────────────────────────────────────────────────

  const fetchAiSuggestion = async () => {
    if (newAlert.title.trim().length < 3) return;
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const res = await fetch('/api/alerts/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: newAlert.title,
          alert_type: newAlert.alert_type || undefined,
          sport: newAlert.sport || undefined,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setAiSuggestion(json.suggestion);
      } else {
        toast.error('AI suggestion unavailable');
      }
    } catch {
      toast.error('AI suggestion failed');
    } finally {
      setAiLoading(false);
    }
  };

  const applySuggestion = (suggestion: AiSuggestion) => {
    setNewAlert(prev => ({
      ...prev,
      title: suggestion.title || prev.title,
      alert_type: suggestion.alert_type || prev.alert_type,
      threshold: suggestion.threshold != null ? String(suggestion.threshold) : prev.threshold,
      description: suggestion.description || prev.description,
      sport: suggestion.sport || prev.sport,
    }));
    setAiSuggestion(null);
    toast.success('Suggestion applied');
  };

  // ── Derived state ────────────────────────────────────────────────────────────

  const filteredAlerts = alerts.filter(a => {
    if (filterType && a.alert_type !== filterType) return false;
    if (filterStatus === 'active' && !a.is_active) return false;
    if (filterStatus === 'paused' && a.is_active) return false;
    return true;
  });

  const activeCount = alerts.filter(a => a.is_active).length;
  const triggeredCount = alerts.filter(a => a.trigger_count > 0).length;

  const getTypeInfo = (type: string) => ALERT_TYPES.find(t => t.value === type) ?? ALERT_TYPES[0];
  const thresholdLabel = getThresholdLabel(newAlert.alert_type);

  if (!isOpen) return null;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm animate-backdrop-in"
      onClick={onClose}
    >
      <div
        className="relative w-full md:max-w-2xl max-h-[92vh] md:max-h-[88vh] md:mx-4 rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-slide-up md:animate-scale-in"
        style={{ background: 'oklch(0.12 0.015 280)', border: '1px solid oklch(0.22 0.02 280)' }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: '1px solid oklch(0.20 0.02 280)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Alerts</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-gray-500">{alerts.length} total</span>
                {activeCount > 0 && (
                  <>
                    <span className="text-gray-700">·</span>
                    <span className="text-[11px] text-green-400">{activeCount} active</span>
                  </>
                )}
                {triggeredCount > 0 && (
                  <>
                    <span className="text-gray-700">·</span>
                    <span className="text-[11px] text-yellow-400">{triggeredCount} triggered</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab toggle */}
            <div className="flex items-center rounded-lg p-0.5" style={{ background: 'oklch(0.18 0.015 280)' }}>
              <button
                onClick={() => setActiveTab('list')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'list'
                    ? 'bg-white/10 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                My Alerts
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'create'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                New Alert
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-300 transition-colors"
              style={{ background: 'oklch(0.18 0.015 280)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── My Alerts Tab ── */}
          {activeTab === 'list' && (
            <div className="p-5 space-y-4">

              {/* Filter bar */}
              {alerts.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                  {/* Type filters */}
                  {ALERT_TYPES.map(type => {
                    const TypeIcon = type.icon;
                    const active = filterType === type.value;
                    return (
                      <button
                        key={type.value}
                        onClick={() => setFilterType(active ? null : type.value)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                          active ? `${type.bg} ${type.color} border ${type.border}` : 'text-gray-500 hover:text-gray-300'
                        }`}
                        style={active ? {} : { background: 'oklch(0.17 0.015 280)' }}
                      >
                        <TypeIcon className="w-3 h-3" />
                        {type.label}
                      </button>
                    );
                  })}
                  {/* Divider */}
                  <span className="w-px h-4 bg-gray-800" />
                  {/* Status filter */}
                  {(['all', 'active', 'paused'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition-all ${
                        filterStatus === s
                          ? s === 'active' ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                            : s === 'paused' ? 'bg-gray-500/15 text-gray-400 border border-gray-500/30'
                            : 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                      style={filterStatus !== s ? { background: 'oklch(0.17 0.015 280)' } : {}}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Loading */}
              {(!authChecked || loading) ? (
                <div className="flex flex-col items-center justify-center h-52 gap-3">
                  <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
                  <p className="text-sm text-gray-500">{!authChecked ? 'Initializing...' : 'Loading alerts...'}</p>
                </div>

              ) : !isAuthenticated ? (
                <div className="flex flex-col items-center justify-center h-52 text-center gap-3">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'oklch(0.17 0.015 280)' }}>
                    <Bell className="w-7 h-7 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-gray-300 font-semibold">Sign in to use alerts</p>
                    <p className="text-xs text-gray-600 mt-1">Get notified about odds changes, line movement, and more</p>
                  </div>
                </div>

              ) : filteredAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-52 text-center gap-3">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'oklch(0.17 0.015 280)' }}>
                    <Bell className="w-7 h-7 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-gray-300 font-semibold">
                      {alerts.length > 0 ? 'No alerts match your filters' : 'No alerts yet'}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {alerts.length > 0
                        ? 'Try clearing the filters above'
                        : 'Create your first alert to stay ahead of the market'}
                    </p>
                  </div>
                  {alerts.length === 0 && (
                    <button
                      onClick={() => setActiveTab('create')}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all mt-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create First Alert
                    </button>
                  )}
                </div>

              ) : (
                <div className="space-y-2.5">
                  {filteredAlerts.map(alert => {
                    const typeInfo = getTypeInfo(alert.alert_type);
                    const TypeIcon = typeInfo.icon;
                    const isDeleting = deletingId === alert.id;
                    const isResetting = resettingId === alert.id;
                    const hasMaxTriggers = alert.max_triggers != null && alert.max_triggers > 0;
                    const triggerProgress = hasMaxTriggers ? (alert.trigger_count / (alert.max_triggers!)) : null;

                    return (
                      <div
                        key={alert.id}
                        className={`rounded-xl p-4 transition-all ${
                          alert.is_active ? 'opacity-100' : 'opacity-55'
                        }`}
                        style={{ background: 'oklch(0.16 0.015 280)', border: `1px solid oklch(${alert.is_active ? '0.24' : '0.19'} 0.02 280)` }}
                      >
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${typeInfo.bg}`}>
                            <TypeIcon className={`w-4 h-4 ${typeInfo.color}`} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-white">{alert.title}</p>
                              {/* Status badge */}
                              {alert.is_active ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/15 text-green-400">Active</span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-500/20 text-gray-500">Paused</span>
                              )}
                              {alert.trigger_count > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/15 text-yellow-400">
                                  {alert.trigger_count}× triggered
                                </span>
                              )}
                            </div>

                            {/* Meta row */}
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                              {typeInfo.label}
                              {alert.sport && ` · ${alert.sport}`}
                              {alert.team && ` · ${alert.team}`}
                              {alert.player && ` · ${alert.player}`}
                              {alert.description && ` — ${alert.description}`}
                            </p>

                            {/* Trigger progress */}
                            {triggerProgress !== null && (
                              <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'oklch(0.22 0.02 280)' }}>
                                  <div
                                    className={`h-full rounded-full transition-all ${triggerProgress >= 1 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                                    style={{ width: `${Math.min(triggerProgress * 100, 100)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-gray-600 shrink-0">
                                  {alert.trigger_count}/{alert.max_triggers}
                                </span>
                              </div>
                            )}
                            {!hasMaxTriggers && alert.trigger_count > 0 && (
                              <p className="text-[10px] text-gray-600 mt-1">∞ unlimited triggers</p>
                            )}

                            {/* Timestamps */}
                            <div className="flex items-center gap-3 mt-1.5">
                              <p className="text-[10px] text-gray-700">
                                Created {new Date(alert.created_at).toLocaleDateString()}
                              </p>
                              {alert.last_triggered_at && (
                                <p className="flex items-center gap-1 text-[10px] text-gray-600">
                                  <Clock className="w-2.5 h-2.5" />
                                  Last fired {formatRelativeTime(alert.last_triggered_at)}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Reset trigger count */}
                            {alert.trigger_count > 0 && (
                              <button
                                onClick={() => resetTriggerCount(alert.id)}
                                disabled={isResetting}
                                className="p-1.5 rounded-lg text-gray-600 hover:text-blue-400 transition-colors"
                                style={{ background: 'oklch(0.19 0.015 280)' }}
                                title="Reset trigger count"
                              >
                                {isResetting
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <RotateCcw className="w-3.5 h-3.5" />
                                }
                              </button>
                            )}
                            {/* Toggle */}
                            <button
                              onClick={() => toggleAlert(alert.id, alert.is_active)}
                              className="p-1.5 rounded-lg transition-colors"
                              style={{ background: 'oklch(0.19 0.015 280)' }}
                              title={alert.is_active ? 'Pause alert' : 'Activate alert'}
                            >
                              {alert.is_active
                                ? <ToggleRight className="w-5 h-5 text-blue-400" />
                                : <ToggleLeft className="w-5 h-5 text-gray-600" />
                              }
                            </button>
                            {/* Delete */}
                            <button
                              onClick={() => deleteAlert(alert.id)}
                              disabled={isDeleting}
                              className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 transition-colors"
                              style={{ background: 'oklch(0.19 0.015 280)' }}
                              title="Delete alert"
                            >
                              {isDeleting
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />
                              }
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Create Alert Tab ── */}
          {activeTab === 'create' && (
            <div className="p-5 space-y-5">

              {!isAuthenticated ? (
                <div className="flex flex-col items-center justify-center h-52 text-center gap-3">
                  <AlertCircle className="w-10 h-10 text-gray-600" />
                  <p className="text-gray-400 font-semibold">Sign in to create alerts</p>
                </div>
              ) : (
                <>
                  {/* Alert type */}
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2.5 uppercase tracking-wider">Alert Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {ALERT_TYPES.map(type => {
                        const TypeIcon = type.icon;
                        const selected = newAlert.alert_type === type.value;
                        return (
                          <button
                            key={type.value}
                            onClick={() => setNewAlert(prev => ({ ...prev, alert_type: type.value }))}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                              selected
                                ? `${type.bg} ${type.color} border ${type.border}`
                                : 'text-gray-500 hover:text-gray-300 border border-transparent'
                            }`}
                            style={selected ? {} : { background: 'oklch(0.17 0.015 280)' }}
                          >
                            <TypeIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{type.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Title + AI Suggest */}
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Title</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newAlert.title}
                        onChange={e => setNewAlert(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="e.g., Lakers spread moves 2+ points"
                        className="flex-1 px-3 py-2.5 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none transition-all"
                        style={{ background: 'oklch(0.10 0.01 280)', border: '1px solid oklch(0.22 0.02 280)' }}
                        onFocus={e => (e.currentTarget.style.borderColor = 'oklch(0.45 0.18 260)')}
                        onBlur={e => (e.currentTarget.style.borderColor = 'oklch(0.22 0.02 280)')}
                      />
                      <button
                        onClick={fetchAiSuggestion}
                        disabled={aiLoading || newAlert.title.trim().length < 3}
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
                        style={{ background: 'oklch(0.17 0.015 280)', border: '1px solid oklch(0.30 0.08 280)' }}
                        title="Get AI suggestion"
                      >
                        {aiLoading ? <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-purple-400" />}
                        <span className="text-purple-400 hidden sm:block">AI Suggest</span>
                      </button>
                    </div>

                    {/* AI Suggestion card */}
                    {aiSuggestion && (
                      <div className="mt-2.5 p-3 rounded-xl" style={{ background: 'oklch(0.14 0.02 290)', border: '1px solid oklch(0.30 0.08 290)' }}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                            <span className="text-xs font-bold text-purple-300">AI Suggestion</span>
                          </div>
                          <button onClick={() => setAiSuggestion(null)} className="text-gray-600 hover:text-gray-400">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="space-y-1 mb-3">
                          <p className="text-sm font-semibold text-white">{aiSuggestion.title}</p>
                          {aiSuggestion.description && (
                            <p className="text-xs text-gray-400">{aiSuggestion.description}</p>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-400">
                              {ALERT_TYPES.find(t => t.value === aiSuggestion.alert_type)?.label ?? aiSuggestion.alert_type}
                            </span>
                            {aiSuggestion.threshold != null && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-400">
                                Threshold: {aiSuggestion.threshold}
                              </span>
                            )}
                            {aiSuggestion.sport && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-700 text-gray-400">
                                {aiSuggestion.sport}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => applySuggestion(aiSuggestion)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                          Apply Suggestion
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Sport + Team + Player */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Sport</label>
                      <select
                        value={newAlert.sport}
                        onChange={e => setNewAlert(prev => ({ ...prev, sport: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none transition-all"
                        style={{ background: 'oklch(0.10 0.01 280)', border: '1px solid oklch(0.22 0.02 280)' }}
                      >
                        <option value="">Any</option>
                        {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Team</label>
                      <input
                        type="text"
                        value={newAlert.team}
                        onChange={e => setNewAlert(prev => ({ ...prev, team: e.target.value }))}
                        placeholder="e.g., Lakers"
                        className="w-full px-3 py-2.5 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none transition-all"
                        style={{ background: 'oklch(0.10 0.01 280)', border: '1px solid oklch(0.22 0.02 280)' }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Player</label>
                      <input
                        type="text"
                        value={newAlert.player}
                        onChange={e => setNewAlert(prev => ({ ...prev, player: e.target.value }))}
                        placeholder="e.g., LeBron"
                        className="w-full px-3 py-2.5 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none transition-all"
                        style={{ background: 'oklch(0.10 0.01 280)', border: '1px solid oklch(0.22 0.02 280)' }}
                      />
                    </div>
                  </div>

                  {/* Threshold (conditional) */}
                  {thresholdLabel && (
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">
                        {thresholdLabel}
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={newAlert.threshold}
                        onChange={e => setNewAlert(prev => ({ ...prev, threshold: e.target.value }))}
                        placeholder="Leave blank to trigger on any change"
                        className="w-full px-3 py-2.5 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none transition-all"
                        style={{ background: 'oklch(0.10 0.01 280)', border: '1px solid oklch(0.22 0.02 280)' }}
                      />
                    </div>
                  )}

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Notes (optional)</label>
                    <input
                      type="text"
                      value={newAlert.description}
                      onChange={e => setNewAlert(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Any additional context"
                      className="w-full px-3 py-2.5 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none transition-all"
                      style={{ background: 'oklch(0.10 0.01 280)', border: '1px solid oklch(0.22 0.02 280)' }}
                    />
                  </div>

                  {/* Max triggers */}
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Max Triggers</label>
                    <div className="flex gap-2 flex-wrap">
                      {MAX_TRIGGERS_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setNewAlert(prev => ({ ...prev, max_triggers: opt.value }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            newAlert.max_triggers === opt.value
                              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                              : 'text-gray-500 hover:text-gray-300 border border-transparent'
                          }`}
                          style={newAlert.max_triggers !== opt.value ? { background: 'oklch(0.17 0.015 280)' } : {}}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Delivery Channels */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 mb-2">Delivery Channels</p>
                    <div className="flex flex-wrap gap-2">
                      {DELIVERY_CHANNELS.map(ch => {
                        const selected = newAlert.notify_channels.includes(ch.value);
                        const Icon = ch.icon;
                        return (
                          <button
                            key={ch.value}
                            type="button"
                            onClick={() => setNewAlert(prev => ({
                              ...prev,
                              notify_channels: selected
                                ? prev.notify_channels.filter(c => c !== ch.value)
                                : [...prev.notify_channels, ch.value],
                            }))}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                              selected
                                ? 'border-blue-400/60 bg-blue-500/15 text-blue-300'
                                : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600'
                            }`}
                            style={!selected ? { background: 'oklch(0.17 0.015 280)' } : {}}
                          >
                            <Icon className="w-3 h-3" />
                            {ch.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1.5">Email, SMS, and Push require account configuration. Webhook posts to your URL.</p>
                  </div>

                  {/* Preview */}
                  {newAlert.title && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'oklch(0.15 0.015 280)', border: '1px solid oklch(0.21 0.02 280)' }}>
                      <AlertCircle className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      <p className="text-xs text-gray-400">{getAlertPreview(newAlert)}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={handleCreateAlert}
                      disabled={saving || !newAlert.title.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-bold transition-all"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      {saving ? 'Creating...' : 'Create Alert'}
                    </button>
                    <button
                      onClick={() => setActiveTab('list')}
                      className="px-5 py-2.5 rounded-xl text-gray-400 hover:text-gray-300 text-sm font-semibold transition-all"
                      style={{ background: 'oklch(0.17 0.015 280)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
