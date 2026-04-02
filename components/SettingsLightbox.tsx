'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import {
  X, User, Bell, Sliders, Sparkles, Save, Loader2, CheckCircle,
  TrendingUp, CreditCard, Trophy, RotateCcw, Mail, Smartphone,
  Activity, BarChart3, Target, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/toast-provider';
import { API_ENDPOINTS, SETTINGS_SPORTSBOOKS, SETTINGS_SPORTS, TIER_LABELS, RISK_CONFIG, THEME_CONFIG } from '@/lib/constants';

// ── Toggle Switch ──────────────────────────────────────────────────────────
function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40',
        checked ? 'bg-blue-600' : 'bg-[var(--bg-elevated)]',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span className={cn(
        'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200',
        checked ? 'translate-x-5' : 'translate-x-0',
      )} />
    </button>
  );
}

// ── Avatar with initials fallback ──────────────────────────────────────────
function Avatar({ name, avatar, size = 'md' }: { name: string; avatar?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  const sizeClass = size === 'lg' ? 'w-16 h-16 text-xl' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-12 h-12 text-sm';
  if (avatar) {
    return <img src={avatar} alt={name} className={cn(sizeClass, 'rounded-full object-cover ring-2 ring-[var(--border-subtle)]')} />;
  }
  return (
    <div className={cn(sizeClass, 'rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-black text-white ring-2 ring-[var(--border-subtle)]')}>
      {initials}
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex-1 min-w-0 p-3 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] text-center">
      <div className={cn('text-lg font-black tabular-nums', accent ?? 'text-foreground')}>{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)] mt-0.5 truncate">{label}</div>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────
interface ProfileData {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  subscription_tier: string;
  credits_remaining: number;
  member_since: string | null;
}

interface PreferencesData {
  tracked_sports: string[];
  preferred_books: string[];
  bankroll: number;
  risk_tolerance: string;
  theme: string;
  email_notifications: boolean;
  push_notifications: boolean;
  odds_alerts: boolean;
  line_movement_alerts: boolean;
  arbitrage_alerts: boolean;
  custom_instructions: string;
}

interface StatsData {
  total_analyses: number;
  wins: number;
  losses: number;
  roi: number;
  favorite_sport: string | null;
  favorite_book: string | null;
}

interface AiSuggestion {
  id: string;
  icon: string;
  title: string;
  description: string;
  action?: { field: string; value: unknown };
}

type SettingsTab = 'account' | 'preferences' | 'notifications' | 'aicoach';


const NOTIFICATION_CONFIG = [
  { key: 'email_notifications'  as const, label: 'Email Notifications',  desc: 'Alerts and reports via email',          icon: Mail,       color: 'text-blue-400',   iconBg: 'bg-blue-500/15' },
  { key: 'push_notifications'   as const, label: 'Push Notifications',   desc: 'Browser push notifications',            icon: Smartphone, color: 'text-purple-400', iconBg: 'bg-purple-500/15' },
  { key: 'odds_alerts'          as const, label: 'Odds Change Alerts',   desc: 'Notified when odds shift ≥ 0.5 pts',    icon: TrendingUp, color: 'text-orange-400', iconBg: 'bg-orange-500/15' },
  { key: 'line_movement_alerts' as const, label: 'Line Movement',        desc: 'Track sharp money and steam moves',      icon: Activity,   color: 'text-cyan-400',   iconBg: 'bg-cyan-500/15' },
  { key: 'arbitrage_alerts'     as const, label: 'Arbitrage Alerts',     desc: 'Real-time cross-book arb opportunities', icon: Zap,        color: 'text-violet-400',  iconBg: 'bg-violet-500/15' },
];

const DEFAULT_PREFS: PreferencesData = {
  tracked_sports: ['NBA', 'NFL'], preferred_books: [], bankroll: 0,
  risk_tolerance: 'medium', theme: 'dark',
  email_notifications: true, push_notifications: false,
  odds_alerts: true, line_movement_alerts: true, arbitrage_alerts: true,
  custom_instructions: '',
};

const DEFAULT_STATS: StatsData = {
  total_analyses: 0, wins: 0, losses: 0, roi: 0,
  favorite_sport: null, favorite_book: null,
};

// ── Props ──────────────────────────────────────────────────────────────────
interface SettingsLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  user: { name: string; email: string; avatar?: string } | null;
  onUserUpdate?: (user: { name: string; email: string; avatar?: string }) => void;
  onOpenStripe?: () => void;
  creditsRemaining?: number;
}

// ── Main Component ─────────────────────────────────────────────────────────
export function SettingsLightbox({ isOpen, onClose, user, onUserUpdate, onOpenStripe, creditsRemaining }: SettingsLightboxProps) {
  const toast = useToast();
  const { setTheme } = useTheme();
  const [activeTab, setActiveTab]           = useState<SettingsTab>('account');
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [saved, setSaved]                   = useState(false);
  const [saveError, setSaveError]           = useState<string | null>(null);
  const [isGuest, setIsGuest]               = useState(false);

  const [name, setName]                     = useState(user?.name ?? '');
  const [profileData, setProfileData]       = useState<ProfileData | null>(null);
  const [stats, setStats]                   = useState<StatsData>(DEFAULT_STATS);
  const [prefs, setPrefs]                   = useState<PreferencesData>(DEFAULT_PREFS);

  const [suggestions, setSuggestions]       = useState<AiSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError]     = useState<string | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    setLoading(true);
    setSaveError(null);
    try {
      const res = await fetch(API_ENDPOINTS.SETTINGS);
      if (!res.ok) {
        if (res.status === 401) {
          setIsGuest(true);
          try {
            const stored = localStorage.getItem('leverage_guest_prefs');
            if (stored) {
              const parsed = JSON.parse(stored);
              if (parsed.name)  setName(parsed.name);
              if (parsed.prefs) {
                setPrefs({ ...DEFAULT_PREFS, ...parsed.prefs });
                setTheme(parsed.prefs?.theme ?? 'dark');
              }
            }
          } catch { /* ignore */ }
          setLoading(false);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success) {
        setIsGuest(false);
        setProfileData(data.profile);
        setName(data.profile.name ?? user?.name ?? '');
        setPrefs({ ...DEFAULT_PREFS, ...data.preferences });
        setStats({ ...DEFAULT_STATS, ...data.stats });
        setTheme(data.preferences?.theme ?? 'dark');
      }
    } catch (err) {
      console.error('[Settings] loadSettings error:', err);
    }
    setLoading(false);
  }, [user?.name]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('account');
      setSuggestions([]);
      setSuggestError(null);
      loadSettings();
    }
  }, [isOpen, loadSettings]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      if (isGuest) {
        localStorage.setItem('leverage_guest_prefs', JSON.stringify({ name, prefs }));
        onUserUpdate?.({ name, email: user?.email ?? '', avatar: user?.avatar });
        setSaved(true);
        toast.success('Settings saved');
        setTimeout(() => setSaved(false), 2000);
        setSaving(false);
        return;
      }
      const res = await fetch(API_ENDPOINTS.SETTINGS, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ...prefs }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Save failed');
      onUserUpdate?.({ name, email: user?.email ?? '', avatar: user?.avatar });
      setSaved(true);
      toast.success('Settings saved');
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      console.error('[Settings] handleSave error:', err);
      setSaveError(err?.message || 'Failed to save settings');
    }
    setSaving(false);
  };

  // ── AI Coach ──────────────────────────────────────────────────────────────
  const handleGetSuggestions = async () => {
    setSuggestLoading(true);
    setSuggestError(null);
    try {
      const res = await fetch(API_ENDPOINTS.SETTINGS_SUGGEST, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stats,
          preferences: prefs,
          subscription_tier: profileData?.subscription_tier ?? 'free',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuggestions(data.suggestions ?? []);
      } else {
        setSuggestError(data.error || 'Unable to generate suggestions');
      }
    } catch {
      setSuggestError('AI service unavailable');
    }
    setSuggestLoading(false);
  };

  const applySuggestion = (s: AiSuggestion) => {
    if (!s.action) return;
    const { field, value } = s.action;
    setPrefs((p: any) => ({ ...p, [field]: value }));
    toast.success(`Applied: ${s.title}`);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const toggleArrayItem = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];

  const tierInfo = TIER_LABELS[profileData?.subscription_tier ?? 'free'] ?? TIER_LABELS.free;
  const isPaid   = !!profileData?.subscription_tier && profileData.subscription_tier !== 'free';

  const formatMemberSince = (iso: string | null) => {
    if (!iso) return null;
    try { return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
    catch { return null; }
  };

  const roiDisplay = stats.roi > 0 ? `+${stats.roi.toFixed(1)}%` : `${stats.roi.toFixed(1)}%`;
  const roiColor   = stats.roi > 0 ? 'text-blue-500' : stats.roi < 0 ? 'text-red-500' : 'text-[var(--text-muted)]';

  const kellyTip = () => {
    if (!prefs.bankroll) return null;
    const pct = prefs.risk_tolerance === 'conservative' ? 0.02 : prefs.risk_tolerance === 'aggressive' ? 0.08 : 0.04;
    return `Kelly suggests ≤ $${(prefs.bankroll * pct).toFixed(0)}/bet at ${prefs.risk_tolerance} risk`;
  };

  const tabs: { id: SettingsTab; label: string; icon: typeof User }[] = [
    { id: 'account',       label: 'Account',       icon: User },
    { id: 'preferences',   label: 'Preferences',   icon: Sliders },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'aicoach',       label: 'AI Coach',      icon: Sparkles },
  ];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-backdrop-in"
      onClick={onClose}
    >
      <div
        className="relative w-full md:max-w-2xl max-h-[92vh] md:max-h-[88vh] md:mx-4 bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-slide-up md:animate-scale-in"
        onClick={(e: any) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            {loading ? (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            ) : (
              <Avatar name={name || user?.name || 'User'} avatar={profileData?.avatar ?? user?.avatar} />
            )}
            <div>
              <h2 className="text-base font-black text-foreground leading-tight">
                {name || user?.name || 'Settings'}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border', tierInfo.bg, tierInfo.color)}>
                  {tierInfo.label}
                </span>
                {isGuest && <span className="text-[10px] text-[var(--text-faint)] font-semibold">Guest</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors text-[var(--text-faint)] hover:text-[var(--text-muted)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Tab Nav ────────────────────────────────────────────────────── */}
        <div className="flex border-b border-[var(--border-subtle)]">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors',
                activeTab === tab.id
                  ? 'text-foreground bg-blue-500/5'
                  : 'text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]/40',
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
              {activeTab === tab.id && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* ════════════ ACCOUNT ════════════ */}
              {activeTab === 'account' && (
                <div className="space-y-5">
                  {/* Profile fields */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <Avatar name={name || 'User'} avatar={profileData?.avatar ?? user?.avatar} size="lg" />
                      <div className="flex-1 min-w-0">
                        <label className="block text-[10px] font-bold text-[var(--text-faint)] mb-1.5 uppercase tracking-wider">Display Name</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e: any) => setName(e.target.value)}
                          placeholder="Your name"
                          className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-foreground placeholder-[var(--text-faint)] text-sm focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--text-faint)] mb-1.5 uppercase tracking-wider">Email</label>
                      <input
                        type="email"
                        value={user?.email ?? ''}
                        disabled
                        className="w-full px-3 py-2 bg-[var(--bg-overlay)]/60 border border-[var(--border-subtle)] rounded-lg text-[var(--text-faint)] text-sm cursor-not-allowed"
                      />
                    </div>
                    {formatMemberSince(profileData?.member_since ?? null) && (
                      <p className="text-xs text-[var(--text-faint)]">
                        Member since <span className="text-[var(--text-muted)] font-semibold">{formatMemberSince(profileData?.member_since ?? null)}</span>
                      </p>
                    )}
                  </div>

                  {/* Stats */}
                  {stats.total_analyses > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] mb-2">Your Stats</p>
                      <div className="flex gap-2">
                        <StatCard label="Analyses" value={stats.total_analyses} />
                        <StatCard label="Record"   value={`${stats.wins}W–${stats.losses}L`} />
                        <StatCard label="ROI"      value={roiDisplay} accent={roiColor} />
                        {stats.favorite_sport && <StatCard label="Fav Sport" value={stats.favorite_sport} />}
                      </div>
                    </div>
                  )}

                  {/* Credits */}
                  <div className="flex items-center justify-between p-4 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">Credits Balance</p>
                        <p className="text-xs text-[var(--text-faint)]">Used for AI analyses</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-black text-blue-400 tabular-nums">
                        {creditsRemaining ?? profileData?.credits_remaining ?? 0}
                      </span>
                      <button
                        onClick={() => { onClose(); onOpenStripe?.(); }}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
                      >
                        Buy
                      </button>
                    </div>
                  </div>

                  {/* Subscription */}
                  <div className="flex items-center justify-between p-4 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center">
                        <Trophy className="w-4 h-4 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">Subscription</p>
                        <p className="text-xs text-[var(--text-faint)]">
                          {isPaid ? 'Active premium plan' : 'Upgrade for unlimited access'}
                        </p>
                      </div>
                    </div>
                    {isPaid ? (
                      <span className={cn('px-3 py-1 rounded-full text-xs font-bold border capitalize', tierInfo.bg, tierInfo.color)}>
                        {tierInfo.label}
                      </span>
                    ) : (
                      <button
                        onClick={() => { onClose(); onOpenStripe?.(); }}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-xs font-bold transition-all"
                      >
                        Upgrade →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ════════════ PREFERENCES ════════════ */}
              {activeTab === 'preferences' && (
                <div className="space-y-6">
                  {/* Sports */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Preferred Sports</label>
                      <span className="text-[10px] text-[var(--text-faint)]">{prefs.tracked_sports.length} selected</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {SETTINGS_SPORTS.map(sport => {
                        const active = prefs.tracked_sports.includes(sport);
                        return (
                          <button
                            key={sport}
                            onClick={() => setPrefs((p: any) => ({ ...p, tracked_sports: toggleArrayItem(p.tracked_sports, sport) }))}
                            className={cn(
                              'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                              active
                                ? 'bg-blue-600/15 text-blue-400 border-blue-500/40'
                                : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:border-[var(--border-hover)]',
                            )}
                          >
                            {active && '✓ '}{sport}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sportsbooks */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Preferred Sportsbooks</label>
                      <span className="text-[10px] text-[var(--text-faint)]">{prefs.preferred_books.length} selected</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {SETTINGS_SPORTSBOOKS.map(book => {
                        const active = prefs.preferred_books.includes(book);
                        return (
                          <button
                            key={book}
                            onClick={() => setPrefs((p: any) => ({ ...p, preferred_books: toggleArrayItem(p.preferred_books, book) }))}
                            className={cn(
                              'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                              active
                                ? 'bg-blue-600/15 text-blue-400 border-blue-500/40'
                                : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:border-[var(--border-hover)]',
                            )}
                          >
                            {book}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bankroll */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] mb-2">Bankroll</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] text-sm font-bold pointer-events-none">$</span>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={prefs.bankroll || ''}
                        onChange={(e: any) => setPrefs((p: any) => ({ ...p, bankroll: parseFloat(e.target.value) || 0 }))}
                        placeholder="0"
                        className="w-full pl-7 pr-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-foreground placeholder-[var(--text-faint)] text-sm focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                    {kellyTip() && (
                      <p className="text-[10px] text-[var(--text-faint)] mt-1.5 flex items-center gap-1">
                        <Target className="w-3 h-3" /> {kellyTip()}
                      </p>
                    )}
                  </div>

                  {/* Risk Tolerance */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] mb-2">Risk Tolerance</label>
                    <div className="flex gap-2">
                      {RISK_CONFIG.map(r => {
                        const active = prefs.risk_tolerance === r.value;
                        return (
                          <button
                            key={r.value}
                            onClick={() => setPrefs((p: any) => ({ ...p, risk_tolerance: r.value }))}
                            className={cn(
                              'flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-semibold transition-all',
                              active ? cn(r.bg, r.border, r.color) : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:border-[var(--border-hover)]',
                            )}
                          >
                            <span className="text-lg">{r.emoji}</span>
                            <span>{r.label}</span>
                            <span className={cn('text-[9px] font-normal', active ? 'opacity-80' : 'text-[var(--text-faint)]')}>{r.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Theme */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] mb-2">Theme</label>
                    <div className="flex gap-2">
                      {THEME_CONFIG.map(t => {
                        const active = prefs.theme === t.value;
                        return (
                          <button
                            key={t.value}
                            onClick={() => { setPrefs((p: any) => ({ ...p, theme: t.value })); setTheme(t.value); }}
                            className={cn(
                              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-xs font-semibold transition-all',
                              active
                                ? 'bg-blue-600/15 text-blue-400 border-blue-500/40'
                                : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:border-[var(--border-hover)]',
                            )}
                          >
                            <span>{t.emoji}</span>{t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ════════════ NOTIFICATIONS ════════════ */}
              {activeTab === 'notifications' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs text-[var(--text-faint)]">
                      <span className="text-foreground font-bold">
                        {NOTIFICATION_CONFIG.filter(n => prefs[n.key]).length}
                      </span>{' '}of {NOTIFICATION_CONFIG.length} active
                    </p>
                    <button
                      onClick={() => {
                        const allOn = NOTIFICATION_CONFIG.every(n => prefs[n.key]);
                        setPrefs((p: any) => ({
                          ...p,
                          ...Object.fromEntries(NOTIFICATION_CONFIG.map(n => [n.key, !allOn])),
                        }));
                      }}
                      className="text-[10px] text-blue-500 hover:text-blue-600 font-semibold transition-colors"
                    >
                      {NOTIFICATION_CONFIG.every(n => prefs[n.key]) ? 'Disable all' : 'Enable all'}
                    </button>
                  </div>

                  {NOTIFICATION_CONFIG.map(item => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.key}
                        className="flex items-center gap-4 p-4 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] hover:border-[var(--border-hover)] transition-colors"
                      >
                        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', item.iconBg)}>
                          <Icon className={cn('w-4 h-4', item.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{item.label}</p>
                          <p className="text-xs text-[var(--text-faint)] truncate">{item.desc}</p>
                        </div>
                        <ToggleSwitch
                          checked={prefs[item.key]}
                          onChange={(v: any) => setPrefs((p: any) => ({ ...p, [item.key]: v }))}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ════════════ AI COACH ════════════ */}
              {activeTab === 'aicoach' && (
                <div className="space-y-5">
                  {/* Stats grid */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] mb-2">Your Betting Profile</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)]">
                        <div className="flex items-center gap-1.5 mb-1">
                          <BarChart3 className="w-3 h-3 text-blue-400" />
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Analyses</span>
                        </div>
                        <p className="text-2xl font-black text-foreground tabular-nums">{stats.total_analyses}</p>
                      </div>
                      <div className="p-3 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)]">
                        <div className="flex items-center gap-1.5 mb-1">
                          <TrendingUp className="w-3 h-3 text-blue-400" />
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-faint)]">ROI</span>
                        </div>
                        <p className={cn('text-2xl font-black tabular-nums', roiColor)}>{roiDisplay}</p>
                      </div>
                      <div className="p-3 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)]">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Target className="w-3 h-3 text-yellow-400" />
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Record</span>
                        </div>
                        <p className="text-xl font-black text-foreground">
                          <span className="text-blue-500">{stats.wins}W</span>
                          <span className="text-[var(--text-faint)] mx-1">–</span>
                          <span className="text-red-500">{stats.losses}L</span>
                        </p>
                      </div>
                      <div className="p-3 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)]">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Trophy className="w-3 h-3 text-purple-400" />
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Top Sport</span>
                        </div>
                        <p className="text-xl font-black text-foreground">{stats.favorite_sport ?? '—'}</p>
                      </div>
                    </div>
                  </div>

                  {/* AI Suggestions */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">AI Recommendations</p>
                      {suggestions.length > 0 && !suggestLoading && (
                        <button
                          onClick={handleGetSuggestions}
                          className="flex items-center gap-1 text-[10px] text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" /> Refresh
                        </button>
                      )}
                    </div>

                    {!suggestLoading && suggestions.length === 0 && (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-3">
                          <Sparkles className="w-6 h-6 text-purple-400" />
                        </div>
                        <p className="text-sm font-semibold text-[var(--text-muted)] mb-1">Get personalized tips</p>
                        <p className="text-xs text-[var(--text-faint)] mb-4 max-w-xs mx-auto leading-relaxed">
                          AI analyzes your profile and stats to suggest setting optimizations.
                        </p>
                        {suggestError && <p className="text-xs text-red-400 mb-3">{suggestError}</p>}
                        <button
                          onClick={handleGetSuggestions}
                          disabled={suggestLoading || isGuest}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:bg-[var(--bg-elevated)] disabled:bg-none disabled:text-[var(--text-faint)] text-white text-sm font-bold transition-all"
                        >
                          <Sparkles className="w-4 h-4" />
                          {isGuest ? 'Sign in to use AI Coach' : 'Get AI Suggestions'}
                        </button>
                      </div>
                    )}

                    {suggestLoading && (
                      <div className="flex items-center justify-center py-10 gap-3">
                        <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                        <span className="text-sm text-[var(--text-faint)]">Analyzing your profile…</span>
                      </div>
                    )}

                    {!suggestLoading && suggestions.length > 0 && (
                      <div className="space-y-3">
                        {suggestions.map((s: any) => (
                          <div
                            key={s.id}
                            className="p-4 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] hover:border-purple-500/30 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-xl flex-shrink-0 mt-0.5">{s.icon}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-foreground">{s.title}</p>
                                <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{s.description}</p>
                              </div>
                              {s.action && (
                                <button
                                  onClick={() => applySuggestion(s)}
                                  className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 text-xs font-bold border border-purple-500/30 transition-colors"
                                >
                                  Apply
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--border-subtle)]">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-muted)] hover:border-[var(--border-hover)] text-sm font-semibold transition-all flex-shrink-0"
            >
              Cancel
            </button>
            {saveError && (
              <span className="text-xs text-red-400 truncate max-w-[200px]">{saveError}</span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-[var(--bg-elevated)] disabled:text-[var(--text-faint)] text-white text-sm font-bold transition-all"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
