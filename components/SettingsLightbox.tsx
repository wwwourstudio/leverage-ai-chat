'use client';

import { useState, useEffect } from 'react';
import { X, User, Bell, Shield, Palette, Save, Loader2, CheckCircle, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/toast-provider';

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${checked ? 'bg-blue-600' : 'bg-gray-700'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

interface SettingsLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  user: { name: string; email: string; avatar?: string } | null;
  onUserUpdate?: (user: { name: string; email: string; avatar?: string }) => void;
  onOpenStripe?: () => void;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string;
  subscription_tier: string;
  credits: number;
  notification_preferences: {
    email: boolean;
    push: boolean;
    odds_alerts: boolean;
    line_movement: boolean;
    arbitrage: boolean;
  };
}

interface UserSettings {
  preferred_books: string[];
  preferred_sports: string[];
  bankroll: number;
  risk_tolerance: string;
  notifications_enabled: boolean;
  dark_mode: boolean;
}

type SettingsTab = 'profile' | 'notifications' | 'preferences';

const SPORTSBOOKS = ['DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'PointsBet', 'BetRivers', 'Barstool', 'WynnBET'];
const SPORTS = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF', 'EPL', 'MLS', 'UFC', 'Tennis'];
const RISK_LEVELS = ['conservative', 'medium', 'aggressive'];

export function SettingsLightbox({ isOpen, onClose, user, onUserUpdate, onOpenStripe }: SettingsLightboxProps) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings>({
    preferred_books: [],
    preferred_sports: ['NBA', 'NFL'],
    bankroll: 0,
    risk_tolerance: 'medium',
    notifications_enabled: true,
    dark_mode: true,
  });
  const [notificationPrefs, setNotificationPrefs] = useState({
    email: true,
    push: true,
    odds_alerts: true,
    line_movement: true,
    arbitrage: true,
  });
  const [fullName, setFullName] = useState(user?.name || '');

  useEffect(() => {
    if (isOpen) {
      loadProfileAndSettings();
    }
  }, [isOpen]);

  const loadProfileAndSettings = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }

      // Load profile from user_profiles
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setFullName(profileData.display_name || '');
      }

      // Load preferences from user_preferences
      const { data: prefsData } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (prefsData) {
        if (prefsData.email_notifications !== undefined || prefsData.push_notifications !== undefined) {
          setNotificationPrefs(prev => ({
            ...prev,
            email: prefsData.email_notifications ?? true,
            push: prefsData.push_notifications ?? false,
          }));
        }
        setSettings({
          preferred_books: [],
          preferred_sports: prefsData.tracked_sports || ['NBA', 'NFL'],
          bankroll: 0,
          risk_tolerance: 'medium',
          notifications_enabled: prefsData.email_notifications ?? true,
          dark_mode: prefsData.theme === 'dark',
        });
      }
    } catch (err) {
      console.error('[Settings] Failed to load:', err);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user || !profile) {
        // Guest: persist to localStorage so preferences survive page reload
        const guestPrefs = { fullName, notificationPrefs, settings };
        localStorage.setItem('leverage_guest_prefs', JSON.stringify(guestPrefs));
        if (onUserUpdate && fullName) {
          onUserUpdate({ name: fullName, email: user?.email || '', avatar: user?.avatar });
        }
        setSaved(true);
        toast.success('Settings saved');
        setTimeout(() => setSaved(false), 2000);
        setSaving(false);
        return;
      }

      // Authenticated: persist to Supabase
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          display_name: fullName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (profileError) throw profileError;

      const { error: settingsError } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: profile.user_id || session.user.id,
          tracked_sports: settings.preferred_sports,
          email_notifications: settings.notifications_enabled,
          theme: settings.dark_mode ? 'dark' : 'light',
          default_sport: settings.preferred_sports?.[0] || 'NBA',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (settingsError) throw settingsError;

      if (onUserUpdate) {
        onUserUpdate({ name: fullName, email: user?.email || '', avatar: user?.avatar });
      }

      setSaved(true);
      toast.success('Settings saved');
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      console.error('[Settings] Failed to save:', err);
      setSaveError(err?.message || 'Failed to save. Please try again.');
    }
    setSaving(false);
  };

  const toggleArrayItem = (arr: string[], item: string): string[] => {
    return arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
  };

  if (!isOpen) return null;

  const tabs: { id: SettingsTab; label: string; icon: typeof User }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'preferences', label: 'Preferences', icon: Palette },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[85vh] mx-4 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Settings</h2>
              <p className="text-xs text-gray-500">{profile?.subscription_tier === 'premium' ? 'Premium' : 'Free'} Plan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-500 hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Nav */}
        <div className="relative flex border-b border-gray-800">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'text-white bg-blue-500/5'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-400 mb-2">Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-400 mb-2">Email</label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full px-4 py-3 bg-gray-950/50 border border-gray-800 rounded-xl text-gray-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-600 mt-1">Email cannot be changed here</p>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl border border-gray-800">
                    <div>
                      <p className="text-sm font-semibold text-white">Credits Balance</p>
                      <p className="text-xs text-gray-500">Current available credits</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-black text-blue-400">{profile?.credits ?? 0}</span>
                      <button
                        onClick={() => { onClose(); onOpenStripe?.(); }}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
                      >
                        Buy Credits
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl border border-gray-800">
                    <div>
                      <p className="text-sm font-semibold text-white">Subscription</p>
                      <p className="text-xs text-gray-500">{profile?.subscription_tier === 'premium' ? 'Active premium plan' : 'Free tier — upgrade for unlimited access'}</p>
                    </div>
                    {profile?.subscription_tier === 'premium' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                        Premium
                      </span>
                    ) : (
                      <button
                        onClick={() => { onClose(); onOpenStripe?.(); }}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-xs font-bold transition-all"
                      >
                        Upgrade
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div className="space-y-4">
                  {[
                    { key: 'email' as const, label: 'Email Notifications', desc: 'Receive alerts via email' },
                    { key: 'push' as const, label: 'Push Notifications', desc: 'Browser push notifications' },
                    { key: 'odds_alerts' as const, label: 'Odds Change Alerts', desc: 'Get notified when odds shift significantly' },
                    { key: 'line_movement' as const, label: 'Line Movement', desc: 'Track sharp money and steam moves' },
                    { key: 'arbitrage' as const, label: 'Arbitrage Alerts', desc: 'Instant alerts for arb opportunities' },
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl border border-gray-800">
                      <div>
                        <p className="text-sm font-semibold text-white">{item.label}</p>
                        <p className="text-xs text-gray-500">{item.desc}</p>
                      </div>
                      <ToggleSwitch
                        checked={notificationPrefs[item.key]}
                        onChange={v => setNotificationPrefs(prev => ({ ...prev, [item.key]: v }))}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Preferences Tab */}
              {activeTab === 'preferences' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-400 mb-3">Preferred Sportsbooks</label>
                    <div className="flex flex-wrap gap-2">
                      {SPORTSBOOKS.map(book => (
                        <button
                          key={book}
                          onClick={() => setSettings(prev => ({ ...prev, preferred_books: toggleArrayItem(prev.preferred_books, book) }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            settings.preferred_books.includes(book)
                              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                              : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
                          }`}
                        >
                          {book}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-400 mb-3">Preferred Sports</label>
                    <div className="flex flex-wrap gap-2">
                      {SPORTS.map(sport => (
                        <button
                          key={sport}
                          onClick={() => setSettings(prev => ({ ...prev, preferred_sports: toggleArrayItem(prev.preferred_sports, sport) }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            settings.preferred_sports.includes(sport)
                              ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                              : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
                          }`}
                        >
                          {sport}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-400 mb-2">Bankroll ($)</label>
                    <input
                      type="number"
                      min="0"
                      value={settings.bankroll}
                      onChange={(e) => setSettings(prev => ({ ...prev, bankroll: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-400 mb-3">Risk Tolerance</label>
                    <div className="flex gap-2">
                      {RISK_LEVELS.map(level => (
                        <button
                          key={level}
                          onClick={() => setSettings(prev => ({ ...prev, risk_tolerance: level }))}
                          className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all capitalize ${
                            settings.risk_tolerance === level
                              ? level === 'conservative'
                                ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                                : level === 'medium'
                                ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-500/30'
                                : 'bg-red-600/20 text-red-400 border border-red-500/30'
                              : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-gray-300 hover:border-gray-600 text-sm font-semibold transition-all"
            >
              Cancel
            </button>
            {saveError && (
              <span className="text-xs text-red-400">{saveError}</span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-bold transition-all"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
