'use client';

import { useState, useEffect } from 'react';
import { X, LogOut, Save, Loader2, CheckCircle, Bot, ChevronDown, Paperclip, FileText, ImageIcon, Trash2, Volume2, Play } from 'lucide-react';
import { SPORT_KEYS, GROK_VOICES, GROK_VOICE_STORAGE_KEY, GROK_VOICE_DEFAULT, type GrokVoiceId } from '@/lib/constants';
import { useToast } from '@/components/toast-provider';

const SAVED_FILES_KEY = 'leverage_saved_files';

export interface SavedFile {
  id: string;
  name: string;
  type: 'image' | 'csv' | 'text' | 'json';
  size: number;
  data?: { headers: string[]; rows: string[][] } | null;
  textContent?: string | null;
  savedAt: string;
}

interface UserLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  user: { name: string; email: string; avatar?: string } | null;
  onLogout: () => void;
  onInstructionsChange: (instructions: string) => void;
  onAttachFile?: (file: SavedFile) => void;
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

export function UserLightbox({ isOpen, onClose, user, onLogout, onInstructionsChange, onAttachFile }: UserLightboxProps) {
  const toast = useToast();
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Betting profile state
  const [primarySport, setPrimarySport] = useState<string>(SPORT_NAMES[0]);
  const [riskTolerance, setRiskTolerance] = useState<'Conservative' | 'Medium' | 'Aggressive'>('Medium');
  const [stakeStyle, setStakeStyle] = useState('Flat');

  // Saved files state
  const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);

  // Grok voice selection
  const [grokVoice, setGrokVoice] = useState<GrokVoiceId>(GROK_VOICE_DEFAULT);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(GROK_VOICE_STORAGE_KEY);
    if (stored && GROK_VOICES.some(v => v.id === stored)) {
      setGrokVoice(stored as GrokVoiceId);
    }
  }, []);

  const handleVoiceSelect = (id: GrokVoiceId) => {
    setGrokVoice(id);
    localStorage.setItem(GROK_VOICE_STORAGE_KEY, id);
  };

  const handleVoicePreview = async (voiceId: string) => {
    if (previewingVoice) return;
    setPreviewingVoice(voiceId);
    const sample = "Sharp money is moving on the over. Here's what the line movement is telling us.";
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sample, voice: voiceId }),
      });
      if (!res.ok) throw new Error('TTS error');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); setPreviewingVoice(null); };
      audio.onerror = () => { URL.revokeObjectURL(url); setPreviewingVoice(null); };
      audio.play();
    } catch {
      setPreviewingVoice(null);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    try {
      const raw = localStorage.getItem(SAVED_FILES_KEY);
      setSavedFiles(raw ? JSON.parse(raw) : []);
    } catch {
      setSavedFiles([]);
    }
  }, [isOpen]);

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
    setInstructions((prev: any) => {
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
    // Hard-navigate to clear all in-memory state
    setTimeout(() => { window.location.href = '/'; }, 150);
  };

  const handleDeleteSavedFile = (id: string) => {
    const updated = savedFiles.filter((f: any) => f.id !== id);
    setSavedFiles(updated);
    localStorage.setItem(SAVED_FILES_KEY, JSON.stringify(updated));
  };

  const handleAttachFile = (file: SavedFile) => {
    onAttachFile?.(file);
    onClose();
    toast.success(`"${file.name}" attached to your message`);
  };

  if (!isOpen) return null;

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-backdrop-in"
      onClick={onClose}
    >
      <div
        className="relative w-full md:max-w-lg max-h-[90vh] md:max-h-[85vh] md:mx-4 bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-slide-up md:animate-scale-in"
        onClick={(e: any) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-subtle)] flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-foreground text-xl font-bold shrink-0">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{user?.name || 'Guest'}</h2>
              <p className="text-sm text-[var(--text-faint)]">{user?.email || 'Not signed in'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors text-[var(--text-faint)] hover:text-[var(--text-muted)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Custom Instructions */}
        <div className="p-6 flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 mb-1">
            <Bot className="w-4 h-4 text-blue-400" />
            <label className="text-sm font-semibold text-foreground">Custom AI Instructions</label>
          </div>
          <p className="text-xs text-[var(--text-faint)] mb-3">
            Tell Grok 4 how to respond — betting style, preferred sports, stake sizes, or anything it should always know about you. These are injected as system-level directives so the AI treats them as top-priority context.
          </p>

          {/* Quick-fill template chips */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {TEMPLATES.map(t => (
              <button
                key={t.label}
                onClick={() => appendText(t.text)}
                className="px-2.5 py-1 rounded-full bg-[var(--bg-surface)] hover:bg-blue-900/60 border border-[var(--border-subtle)] hover:border-blue-600/60 text-xs text-[var(--text-muted)] hover:text-blue-300 transition-all"
              >
                + {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              <span className="ml-2 text-sm text-[var(--text-muted)]">Loading your instructions…</span>
            </div>
          ) : (
            <textarea
              value={instructions}
              onChange={(e: any) => setInstructions(e.target.value.slice(0, MAX_CHARS))}
              maxLength={MAX_CHARS}
              placeholder={`Examples:\n• Sharp bettor, 2–4% Kelly stakes, prioritize ATS value\n• Always give me closing line value analysis\n• I play DraftKings GPPs, prefer high-upside plays\n• Focus on NBA player props, especially over/unders`}
              rows={6}
              className="w-full px-4 py-3 bg-background border border-[var(--border-subtle)] rounded-xl text-foreground placeholder-[var(--text-faint)] text-sm focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
            />
          )}
          <p className="text-xs text-[var(--text-faint)] mt-1.5">{instructions.length} / {MAX_CHARS} characters</p>

          {/* Betting Profile quick-set */}
          <details className="mt-4 group">
            <summary className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--text-muted)] hover:text-foreground transition-colors select-none list-none">
              <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
              Betting Profile (quick-set)
            </summary>
            <div className="mt-3 p-4 bg-[var(--bg-overlay)]/60 border border-[var(--border-subtle)] rounded-xl space-y-3">
              {/* Primary Sport */}
              <div className="flex items-center gap-3">
                <label className="text-xs text-[var(--text-muted)] w-28 shrink-0">Primary sport</label>
                <select
                  value={primarySport}
                  onChange={(e: any) => setPrimarySport(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-sm text-foreground focus:outline-none focus:border-blue-500/50"
                >
                  {SPORT_NAMES.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              {/* Risk Tolerance */}
              <div className="flex items-center gap-3">
                <label className="text-xs text-[var(--text-muted)] w-28 shrink-0">Risk tolerance</label>
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
                      <span className="text-xs text-[var(--text-muted)]">{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Stake Style */}
              <div className="flex items-center gap-3">
                <label className="text-xs text-[var(--text-muted)] w-28 shrink-0">Stake style</label>
                <select
                  value={stakeStyle}
                  onChange={(e: any) => setStakeStyle(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-sm text-foreground focus:outline-none focus:border-blue-500/50"
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

          {/* Saved Files */}
          <details className="mt-4 group">
            <summary className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--text-muted)] hover:text-foreground transition-colors select-none list-none">
              <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
              Saved Files
              {savedFiles.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-900/50 text-blue-300 text-[10px] font-black">{savedFiles.length}</span>
              )}
            </summary>
            <div className="mt-3 p-4 bg-[var(--bg-overlay)]/60 border border-[var(--border-subtle)] rounded-xl space-y-2">
              {savedFiles.length === 0 ? (
                <p className="text-xs text-[var(--text-faint)] text-center py-2">
                  No saved files. Attach a file to a message and click the bookmark icon to save it here.
                </p>
              ) : (
                savedFiles.map((file: any) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-overlay)]/60 border border-[var(--border-subtle)] hover:border-[var(--border-hover)] transition-all"
                  >
                    {file.type === 'image' ? (
                      <ImageIcon className="w-4 h-4 text-blue-400 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{file.name}</p>
                      <p className="text-[10px] text-[var(--text-faint)]">
                        {(file.size / 1024).toFixed(1)} KB · {new Date(file.savedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleAttachFile(file)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-900/40 hover:bg-blue-800/60 border border-blue-700/50 text-[10px] font-bold text-blue-300 hover:text-blue-200 transition-all"
                      >
                        <Paperclip className="w-3 h-3" />
                        Attach
                      </button>
                      <button
                        onClick={() => handleDeleteSavedFile(file.id)}
                        className="p-1 rounded-md hover:bg-red-900/30 text-[var(--text-faint)] hover:text-red-400 transition-all"
                        title="Delete saved file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </details>

          {/* Grok Voice */}
          <details className="mt-4 group" open>
            <summary className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--text-muted)] hover:text-foreground transition-colors select-none list-none">
              <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
              <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
              Grok Voice
              <span className="ml-auto text-[10px] font-normal text-indigo-400">
                {GROK_VOICES.find(v => v.id === grokVoice)?.name ?? 'Alloy'}
              </span>
            </summary>
            <div className="mt-3 p-4 bg-[var(--bg-overlay)]/60 border border-[var(--border-subtle)] rounded-xl">
              <p className="text-[11px] text-[var(--text-faint)] mb-3">
                Choose the voice Grok uses when reading responses aloud. Enable voice mode in the chat input to hear replies automatically.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {GROK_VOICES.map(v => (
                  <button
                    key={v.id}
                    onClick={() => handleVoiceSelect(v.id as GrokVoiceId)}
                    className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      grokVoice === v.id
                        ? 'bg-indigo-500/15 border-indigo-500/50 text-foreground'
                        : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-hover)] hover:text-foreground'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black leading-none mb-0.5">{v.name}</p>
                      <p className="text-[9px] text-[var(--text-faint)] leading-none">{v.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); handleVoicePreview(v.id); }}
                      className={`shrink-0 p-1 rounded-lg transition-colors ${
                        previewingVoice === v.id
                          ? 'bg-indigo-500/20 text-indigo-300 animate-pulse'
                          : 'hover:bg-[var(--bg-elevated)] text-[var(--text-faint)] hover:text-indigo-300'
                      }`}
                      aria-label={`Preview ${v.name}`}
                      title="Preview voice"
                    >
                      <Play className="w-3 h-3" />
                    </button>
                    {grokVoice === v.id && (
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </details>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-[var(--border-subtle)]">
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
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-[var(--bg-surface)] disabled:text-[var(--text-faint)] text-foreground text-sm font-bold transition-all"
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
