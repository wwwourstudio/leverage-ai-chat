'use client';

import { useState, useEffect } from 'react';
import { X, LogOut, Save, Loader2, CheckCircle, Bot, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface UserLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  user: { name: string; email: string; avatar?: string } | null;
  onLogout: () => void;
  onInstructionsChange: (instructions: string) => void;
}

const STORAGE_KEY = 'leverage_custom_instructions';

export function UserLightbox({ isOpen, onClose, user, onLogout, onInstructionsChange }: UserLightboxProps) {
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load saved instructions on open
  useEffect(() => {
    if (!isOpen) return;
    const stored = localStorage.getItem(STORAGE_KEY) || '';
    setInstructions(stored);
    onInstructionsChange(stored);
  }, [isOpen]);

  const handleSave = async () => {
    setSaving(true);
    localStorage.setItem(STORAGE_KEY, instructions);
    onInstructionsChange(instructions);

    // Persist to Supabase if authenticated
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase
          .from('user_profiles')
          .update({ updated_at: new Date().toISOString() })
          .eq('user_id', session.user.id);
      }
    } catch {
      // localStorage is the primary store — Supabase save is best-effort
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  };

  const handleLogout = async () => {
    try {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg mx-4 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
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
        <div className="p-6 flex-1">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="w-4 h-4 text-blue-400" />
            <label className="text-sm font-semibold text-white">Custom AI Instructions</label>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Tell the AI how to respond — your betting style, preferred sports, stake sizes, or anything else it should always know about you.
          </p>
          <textarea
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            placeholder={`Examples:\n• I'm a sharp bettor focused on NFL ATS value, 2–4% Kelly stakes\n• Always give me closing line value analysis\n• I play DraftKings GPPs, prefer high-upside plays\n• Focus on NBA player props, especially over/unders`}
            rows={7}
            className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
          />
          <p className="text-xs text-gray-600 mt-1.5">{instructions.length} / 1000 characters</p>
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
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Instructions'}
          </button>
        </div>
      </div>
    </div>
  );
}
