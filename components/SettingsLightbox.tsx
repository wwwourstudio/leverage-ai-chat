'use client';

import { useState, useEffect } from 'react';
import { X, User, Bell, Shield, Palette, Save, Loader2, CheckCircle, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface SettingsLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  user: { name: string; email: string; avatar?: string } | null;
  onUserUpdate?: (user: { name: string; email: string; avatar?: string }) => void;
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

export function SettingsLightbox({ isOpen, onClose, user, onUserUpdate }: SettingsLightboxProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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

      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_id', session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setFullName(profileData.full_name || '');
        if (profileData.notification_preferences) {
          setNotificationPrefs(profileData.notification_preferences);
        }
      }

      // Load settings
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', profileData?.id)
        .single();

      if (settingsData) {
        setSettings({
          preferred_books: settingsData.preferred_books || [],
          preferred_sports: settingsData.preferred_sports || ['NBA', 'NFL'],
          bankroll: settingsData.bankroll || 0,
          risk_tolerance: settingsData.risk_tolerance || 'medium',
          notifications_enabled: settingsData.notifications_enabled ?? true,
          dark_mode: settingsData.dark_mode ?? true,
        });
      }
    } catch (err) {
      console.error('[Settings] Failed to load:', err);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || !profile) {
        setSaving(false);
        return;
      }

      // Update profile
      await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          notification_preferences: notificationPrefs,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      // Upsert settings
      await supabase
        .from('user_settings')
        .upsert({
          id: profile.id,
          user_id: profile.id,
          preferred_books: settings.preferred_books,
          preferred_sports: settings.preferred_sports,
          bankroll: settings.bankroll,
          risk_tolerance: settings.risk_tolerance,
          notifications_enabled: settings.notifications_enabled,
          dark_mode: settings.dark_mode,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      // Update parent state
      if (onUserUpdate) {
        onUserUpdate({ name: fullName, email: user?.email || '', avatar: user?.avatar });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('[Settings] Failed to save:', err);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[85vh] mx-4 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
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
        <div className="flex border-b border-gray-800">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'text-blue-400 border-blue-400 bg-blue-500/5'
                  : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-gray-800/50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
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
                    <span className="text-2xl font-black text-blue-400">{profile?.credits ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl border border-gray-800">
                    <div>
                      <p className="text-sm font-semibold text-white">Subscription</p>
                      <p className="text-xs text-gray-500">{profile?.subscription_tier === 'premium' ? 'Active premium plan' : 'Free tier'}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      profile?.subscription_tier === 'premium'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}>
                      {profile?.subscription_tier === 'premium' ? 'Premium' : 'Free'}
                    </span>
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
                      <button
                        onClick={() => setNotificationPrefs(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          notificationPrefs[item.key] ? 'bg-blue-600' : 'bg-gray-700'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          notificationPrefs[item.key] ? 'translate-x-6' : 'translate-x-0.5'
                        }`} />
                      </button>
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
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-gray-300 hover:border-gray-600 text-sm font-semibold transition-all"
          >
            Cancel
          </button>
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
