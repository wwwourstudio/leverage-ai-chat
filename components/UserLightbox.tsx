'use client';

import { useState, useEffect } from 'react';
import { X, LogOut, Save, Loader2, CheckCircle, Bot, ChevronDown } from 'lucide-react';
import { SPORT_KEYS } from '@/lib/constants';
import { useToast } from '@/components/toast-provider';

interface UserLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  user: { name: string; email: string; avatar?: string } | null;
  onLogout: () => void;
  onInstructionsChange: (instructions: string) => void;
}

const STORAGE_KEY = 'leverage_custom_instructions';
const MAX_CHARS = 2000;

const TEMPLATES = [
  { label: 'Sharp Bettor', text: 'Sharp bettor, 2–4% Kelly stakes, prioritize ATS value and closing-line value.' },
  { label: 'DFS GPP', text: 'DFS GPP player on DraftKings — high-upside stacks, prefer <30% ownership plays.' },
  { label: 'Fantasy PPR', text: 'Season-long fantasy, PPR scoring — favor high-target-share receivers and workhorse RBs.' },
  { label: 'Prop Hunter', text: 'Player prop specialist — track line movement, fade heavily-public overs, seek steam moves.' },
  { label: 'Kalshi Trader', text: 'Kalshi trader — analyze cross-market correlation, size by EV and market liquidity.' },
  { label: 'Conservative', text: 'Conservative bettor — flat 1-unit stakes, no parlays, value-only, avoid -300 favorites.' },
];

const SPORT_NAMES = Object.values(SPORT_KEYS).map(s => s.NAME);

export function UserLightbox({ isOpen, onClose, user, onLogout, onInstructionsChange }: UserLightboxProps) {
  const toast = useToast();
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Betting profile state
  const [primarySport, setPrimarySport] = useState(SPORT_NAMES[0]);
  const [riskTolerance, setRiskTolerance] = useState<'Conservative' | 'Medium' | 'Aggressive'>('Medium');
  const [stakeStyle, setStakeStyle] = useState('Flat');

  // Load saved instructions on open
  useEffect(() => {
    if (!isOpen) return;

    if (user) {
      // Authenticated — load from API
      setLoading(true);
      fetch('/api/user/instructions')
        .then(r => r.json())
        .then(data => {
          const val = data.instructions ?? '';
          setInstructions(val);
          onInstructionsChange(val);
        })
        .catch(() => {
          // Fallback to localStorage
          const stored = localStorage.getItem(STORAGE_KEY) || '';
          setInstructions(stored);
          onInstructionsChange(stored);
        })
        .finally(() => setLoading(false));
    } else {
      // Unauthenticated — use localStorage
      const stored = localStorage.getItem(STORAGE_KEY) || '';
      setInstructions(stored);
      onInstructionsChange(stored);
    }
  }, [isOpen, user?.email]);

  const appendText = (text: string) => {
    setInstructions(prev => {
      const separator = prev.trim() ? ' ' : '';
      const next = (prev + separator + text).slice(0, MAX_CHARS);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    // Always save to localStorage as fallback
    localStorage.setItem(STORAGE_KEY, instructions);
    onInstructionsChange(instructions);

    if (user) {
      try {
        await fetch('/api/user/instructions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instructions }),
        });
      } catch {
        // localStorage already saved — Supabase is best-effort
      }
    }

    setSaved(true);
    toast.success('Instructions saved — Grok 4 will follow these on every query');
    setTimeout(() => setSaved(false), 2500);
    setSaving(false);
  };

  const handleAddProfile = () => {
    appendText(`[Profile: ${primarySport} · ${riskTolerance} risk · ${stakeStyle} staking]`);
  };

  const handleLogout = async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    onLogout();
    onClose();
  };

  if (!isOpen) return null;

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg mx-4 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{user?.name || 'Guest'}</h2>
              <p className="text-sm text-gray-500">{user?.email || 'Not signed in'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-500 hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Custom Instructions */}
        <div className="p-6 flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 mb-1">
            <Bot className="w-4 h-4 text-blue-400" />
            <label className="text-sm font-semibold text-white">Custom AI Instructions</label>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Tell Grok 4 how to respond — betting style, preferred sports, stake sizes, or anything it should always know about you. These are injected as system-level directives so the AI treats them as top-priority context.
          </p>

          {/* Quick-fill template chips */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {TEMPLATES.map(t => (
              <button
                key={t.label}
                onClick={() => appendText(t.text)}
                className="px-2.5 py-1 rounded-full bg-gray-800 hover:bg-blue-900/60 border border-gray-700 hover:border-blue-600/60 text-xs text-gray-300 hover:text-blue-300 transition-all"
              >
                + {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              <span className="ml-2 text-sm text-gray-400">Loading your instructions…</span>
            </div>
          ) : (
            <textarea
              value={instructions}
              onChange={e => setInstructions(e.target.value.slice(0, MAX_CHARS))}
              maxLength={MAX_CHARS}
              placeholder={`Examples:\n• Sharp bettor, 2–4% Kelly stakes, prioritize ATS value\n• Always give me closing line value analysis\n• I play DraftKings GPPs, prefer high-upside plays\n• Focus on NBA player props, especially over/unders`}
              rows={6}
              className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
            />
          )}
          <p className="text-xs text-gray-600 mt-1.5">{instructions.length} / {MAX_CHARS} characters</p>

          {/* Betting Profile quick-set */}
          <details className="mt-4 group">
            <summary className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-400 hover:text-gray-200 transition-colors select-none list-none">
              <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
              Betting Profile (quick-set)
            </summary>
            <div className="mt-3 p-4 bg-gray-950/60 border border-gray-800 rounded-xl space-y-3">
              {/* Primary Sport */}
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-400 w-28 shrink-0">Primary sport</label>
                <select
                  value={primarySport}
                  onChange={e => setPrimarySport(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                >
                  {SPORT_NAMES.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              {/* Risk Tolerance */}
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-400 w-28 shrink-0">Risk tolerance</label>
                <div className="flex gap-2">
                  {(['Conservative', 'Medium', 'Aggressive'] as const).map(r => (
                    <label key={r} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="risk"
                        value={r}
                        checked={riskTolerance === r}
                        onChange={() => setRiskTolerance(r)}
                        className="accent-blue-500"
                      />
                      <span className="text-xs text-gray-300">{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Stake Style */}
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-400 w-28 shrink-0">Stake style</label>
                <select
                  value={stakeStyle}
                  onChange={e => setStakeStyle(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                >
                  <option>Flat</option>
                  <option>Kelly</option>
                  <option>% Bankroll</option>
                </select>
              </div>

              <button
                onClick={handleAddProfile}
                className="mt-1 text-xs px-3 py-1.5 rounded-lg bg-blue-900/40 hover:bg-blue-800/60 border border-blue-700/50 text-blue-300 hover:text-blue-200 transition-all"
              >
                Add to instructions ↑
              </button>
            </div>
          </details>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-900/50 text-red-400 hover:bg-red-900/20 hover:border-red-700/50 text-sm font-semibold transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>

          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-bold transition-all"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Instructions'}
          </button>
        </div>
      </div>
    </div>
  );
}
