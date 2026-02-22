'use client';

import { useState, useEffect } from 'react';
import { X, Bell, Plus, Trash2, AlertTriangle, TrendingUp, Target, Activity, Zap, Loader2, CheckCircle, ToggleLeft, ToggleRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface AlertsLightboxProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserAlert {
  id: string;
  user_id: string;
  alert_type: string;
  sport: string | null;
  team: string | null;
  player: string | null;
  condition: Record<string, any>;
  threshold: number | null;
  is_active: boolean;
  trigger_count: number;
  max_triggers: number;
  last_triggered_at: string | null;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string | null;
}

const ALERT_TYPES = [
  { value: 'odds_change', label: 'Odds Change', icon: TrendingUp, color: 'text-orange-400' },
  { value: 'line_movement', label: 'Line Movement', icon: Activity, color: 'text-blue-400' },
  { value: 'player_prop', label: 'Player Prop', icon: Target, color: 'text-green-400' },
  { value: 'arbitrage', label: 'Arbitrage', icon: Zap, color: 'text-yellow-400' },
  { value: 'kalshi_price', label: 'Kalshi Price', icon: TrendingUp, color: 'text-purple-400' },
  { value: 'game_start', label: 'Game Start', icon: Bell, color: 'text-cyan-400' },
];

const SPORTS = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF', 'EPL', 'MLS', 'UFC'];

export function AlertsLightbox({ isOpen, onClose }: AlertsLightboxProps) {
  const [alerts, setAlerts] = useState<UserAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  // New alert form state
  const [newAlert, setNewAlert] = useState({
    alert_type: 'odds_change',
    sport: '',
    team: '',
    player: '',
    title: '',
    description: '',
    threshold: '',
    max_triggers: '1',
  });

  useEffect(() => {
    if (isOpen) loadAlerts();
  }, [isOpen]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }

      setAuthUserId(session.user.id);

      // Load alerts from user_alerts table (RLS uses auth.uid())
      const { data: alertsData, error: alertsError } = await supabase
        .from('user_alerts')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (alertsError) {
        console.error('[Alerts] Failed to load alerts:', alertsError);
      }

      setAlerts(alertsData || []);
    } catch (err) {
      console.error('[Alerts] Failed to load:', err);
    }
    setLoading(false);
  };

  const handleCreateAlert = async () => {
    if (!authUserId || !newAlert.title) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('user_alerts')
        .insert({
          user_id: authUserId,
          alert_type: newAlert.alert_type,
          sport: newAlert.sport || null,
          team: newAlert.team || null,
          player: newAlert.player || null,
          title: newAlert.title,
          description: newAlert.description || null,
          threshold: newAlert.threshold ? parseFloat(newAlert.threshold) : null,
          max_triggers: parseInt(newAlert.max_triggers) || 1,
          condition: {},
          is_active: true,
        });

      if (error) {
        console.error('[Alerts] Failed to create alert:', error);
      } else {
        setShowCreateForm(false);
        setNewAlert({
          alert_type: 'odds_change',
          sport: '',
          team: '',
          player: '',
          title: '',
          description: '',
          threshold: '',
          max_triggers: '1',
        });
        await loadAlerts();
      }
    } catch (err) {
      console.error('[Alerts] Failed to create:', err);
    }
    setSaving(false);
  };

  const toggleAlert = async (alertId: string, isActive: boolean) => {
    try {
      const supabase = createClient();
      await supabase
        .from('user_alerts')
        .update({ is_active: !isActive, updated_at: new Date().toISOString() })
        .eq('id', alertId);
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_active: !isActive } : a));
    } catch (err) {
      console.error('[Alerts] Toggle failed:', err);
    }
  };

  const deleteAlert = async (alertId: string) => {
    try {
      const supabase = createClient();
      await supabase.from('user_alerts').delete().eq('id', alertId);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err) {
      console.error('[Alerts] Delete failed:', err);
    }
  };

  if (!isOpen) return null;

  const getAlertTypeInfo = (type: string) => ALERT_TYPES.find(t => t.value === type) || ALERT_TYPES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[85vh] mx-4 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Alerts</h2>
              <p className="text-xs text-gray-500">{alerts.filter(a => a.is_active).length} active alerts</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all"
            >
              <Plus className="w-4 h-4" />
              New Alert
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-500 hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Create Form */}
          {showCreateForm && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white">Create New Alert</h3>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">Alert Type</label>
                <div className="flex flex-wrap gap-2">
                  {ALERT_TYPES.map(type => (
                    <button
                      key={type.value}
                      onClick={() => setNewAlert(prev => ({ ...prev, alert_type: type.value }))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        newAlert.alert_type === type.value
                          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                          : 'bg-gray-800 text-gray-400 border border-gray-700'
                      }`}
                    >
                      <type.icon className="w-3 h-3" />
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Title</label>
                  <input
                    type="text"
                    value={newAlert.title}
                    onChange={(e) => setNewAlert(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Lakers spread alert"
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Sport</label>
                  <select
                    value={newAlert.sport}
                    onChange={(e) => setNewAlert(prev => ({ ...prev, sport: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all"
                  >
                    <option value="">Any sport</option>
                    {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Team (optional)</label>
                  <input
                    type="text"
                    value={newAlert.team}
                    onChange={(e) => setNewAlert(prev => ({ ...prev, team: e.target.value }))}
                    placeholder="e.g., Lakers"
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Player (optional)</label>
                  <input
                    type="text"
                    value={newAlert.player}
                    onChange={(e) => setNewAlert(prev => ({ ...prev, player: e.target.value }))}
                    placeholder="e.g., LeBron James"
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={newAlert.description}
                  onChange={(e) => setNewAlert(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Additional notes about this alert"
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCreateAlert}
                  disabled={saving || !newAlert.title}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-bold transition-all"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {saving ? 'Creating...' : 'Create Alert'}
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-5 py-2 rounded-xl border border-gray-700 text-gray-400 hover:text-gray-300 text-sm font-semibold transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : alerts.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Bell className="w-12 h-12 text-gray-700 mb-3" />
              <p className="text-gray-400 font-semibold">No alerts yet</p>
              <p className="text-xs text-gray-600 mt-1">Create your first alert to get notified about odds changes, line movement, and more</p>
            </div>
          ) : (
            /* Alert List */
            alerts.map(alert => {
              const typeInfo = getAlertTypeInfo(alert.alert_type);
              const TypeIcon = typeInfo.icon;
              return (
                <div
                  key={alert.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    alert.is_active
                      ? 'bg-gray-800/30 border-gray-800 hover:border-gray-700'
                      : 'bg-gray-900/50 border-gray-800/50 opacity-60'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    alert.is_active ? 'bg-gray-800' : 'bg-gray-900'
                  }`}>
                    <TypeIcon className={`w-5 h-5 ${typeInfo.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white truncate">{alert.title}</p>
                      {alert.sport && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-gray-400">{alert.sport}</span>
                      )}
                      {alert.trigger_count > 0 && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400">Triggered</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {alert.description || typeInfo.label}
                      {alert.team && ` · ${alert.team}`}
                      {alert.player && ` · ${alert.player}`}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      Created {new Date(alert.created_at).toLocaleDateString()}
                      {alert.trigger_count > 0 && ` · Triggered ${alert.trigger_count}x`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAlert(alert.id, alert.is_active)}
                      className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                      title={alert.is_active ? 'Pause alert' : 'Activate alert'}
                    >
                      {alert.is_active ? (
                        <ToggleRight className="w-6 h-6 text-blue-400" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-gray-600" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteAlert(alert.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-all"
                      title="Delete alert"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
