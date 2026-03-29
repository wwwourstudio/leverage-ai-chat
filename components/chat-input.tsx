'use client';

import { memo, useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import { Send, X, Paperclip, FileText, ImageIcon, Bookmark, Sparkles, Brain, Zap, Square } from 'lucide-react';
import { useToast } from '@/components/toast-provider';

interface FileAttachment {
  id: string;
  name: string;
  type: 'image' | 'csv' | 'text' | 'json';
  url: string;
  size: number;
  data?: { headers: string[]; rows: string[][] } | null;
  textContent?: string | null;
  imageBase64?: string | null;
  mimeType?: string | null;
}

interface ChatInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isTyping: boolean;
  onStopGeneration: () => void;
  uploadedFiles: FileAttachment[];
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (id: string) => void;
  onSaveFile: (file: FileAttachment) => void;
  onFileDrop: (files: FileList) => Promise<FileAttachment[]>;
  onFilesAdded: (files: FileAttachment[]) => void;
  creditsRemaining: number;
  onOpenStripe: () => void;
  lastUserQuery: string;
  selectedCategory: string;
  placeholder?: string;
  deepThink?: boolean;
  onToggleDeepThink?: () => void;
  systemStatus?: 'ok' | 'degraded' | 'down';
}

const MAX_CHARS = 2000;

export const ChatInput = memo(function ChatInput({
  input,
  onInputChange,
  onSubmit,
  isTyping,
  onStopGeneration,
  uploadedFiles,
  onFileUpload,
  onRemoveFile,
  onSaveFile,
  onFileDrop,
  onFilesAdded,
  creditsRemaining,
  onOpenStripe,
  lastUserQuery,
  selectedCategory,
  placeholder,
  deepThink = false,
  onToggleDeepThink,
  systemStatus = 'ok',
}: ChatInputProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  // Auto-resize textarea as content grows (max ~6 lines / 160px)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    });
  }, [input]);

  const defaultPlaceholder = placeholder ?? (lastUserQuery
    ? `Follow up on your ${
        lastUserQuery.toLowerCase().includes('nba') ? 'NBA' :
        lastUserQuery.toLowerCase().includes('nfl') ? 'NFL' :
        lastUserQuery.toLowerCase().includes('kalshi') ? 'Kalshi' :
        lastUserQuery.toLowerCase().includes('dfs') ? 'DFS' :
        lastUserQuery.toLowerCase().includes('fantasy') ? 'fantasy' : 'sports'
      } analysis or ask something new...`
    : selectedCategory === 'fantasy'
      ? 'Ask about draft picks, waiver wire, ADP values...'
      : selectedCategory === 'dfs'
        ? 'Build a DFS lineup, find value plays, compare salaries...'
        : selectedCategory === 'kalshi'
          ? 'Ask about prediction markets, implied odds, edge...'
          : 'Ask about betting odds, fantasy, DFS, or Kalshi markets...');

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as FormEvent);
    }
  }, [onSubmit]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragEnter = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
  }, []);
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = await onFileDrop(e.dataTransfer.files);
    if (dropped.length > 0) onFilesAdded(dropped);
  }, [onFileDrop, onFilesAdded]);

  const charsLeft = MAX_CHARS - input.length;
  const nearLimit = charsLeft <= 200;
  const overLimit = charsLeft < 0;
  const charProgress = Math.min(input.length / MAX_CHARS, 1);
  const RING_R = 6;
  const RING_CIRC = 2 * Math.PI * RING_R;
  const ringOffset = RING_CIRC * (1 - charProgress);
  const ringColor = overLimit ? '#f87171' : nearLimit ? '#fb923c' : input.length > MAX_CHARS * 0.75 ? '#facc15' : 'rgba(255,255,255,0.2)';

  const canSubmit = (input.trim().length > 0 || uploadedFiles.length > 0) && !overLimit;

  return (
    <>
      {/* File attachment previews */}
      {uploadedFiles.length > 0 && (
        <div className="mb-2 space-y-2">
          <div className="flex flex-wrap gap-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl group/file hover:border-[var(--border-hover)] transition-colors"
              >
                {file.type === 'image'
                  ? <ImageIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  : <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                <span className="text-xs font-medium text-foreground/80 max-w-[120px] truncate">{file.name}</span>
                <span className="text-[10px] text-[var(--text-faint)]">{(file.size / 1024).toFixed(1)} KB</span>
                <button
                  onClick={() => { onSaveFile(file); toast.success('File saved to profile'); }}
                  className="p-0.5 rounded hover:bg-blue-900/40 transition-colors"
                  title="Save to profile"
                >
                  <Bookmark className="w-3 h-3 text-[var(--text-muted)] hover:text-blue-400" />
                </button>
                <button
                  onClick={() => onRemoveFile(file.id)}
                  className="p-0.5 rounded hover:bg-white/10 transition-colors"
                  title="Remove"
                >
                  <X className="w-3 h-3 text-[var(--text-muted)] hover:text-red-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input container */}
      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="relative"
      >
        {isDragOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-blue-500/60 bg-blue-500/10 pointer-events-none">
            <div className="flex flex-col items-center gap-1">
              <Paperclip className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-semibold text-blue-300">Drop files here</span>
              <span className="text-xs text-blue-400/70">Images, CSV, TSV, TXT, JSON</span>
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/jpg,image/gif,image/webp,text/csv,.tsv,text/tab-separated-values,text/plain,.txt,.json,application/json,.pdf,application/pdf"
          multiple
          onChange={onFileUpload}
          className="hidden"
        />

        {/* Unified pill: [textarea] [attach | ring | send] */}
        <form
          onSubmit={onSubmit}
          className={`flex items-end rounded-2xl border transition-all duration-200 shadow-sm overflow-hidden ${
            isDragOver
              ? 'border-blue-500/60 bg-blue-500/5'
              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[oklch(0.28_0.02_280)] focus-within:border-[oklch(0.38_0.06_260)] focus-within:shadow-[0_0_0_1px_oklch(0.38_0.06_260/0.25)]'
          }`}
        >
          {/* Textarea — grows from 44px up to 160px */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => {
              if (e.target.value.length <= MAX_CHARS + 10) onInputChange(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder={defaultPlaceholder}
            disabled={isTyping}
            className="flex-1 resize-none bg-transparent pl-4 pr-2 py-[11px] font-medium text-foreground placeholder-[var(--text-faint)] focus:outline-none text-sm leading-relaxed overflow-hidden disabled:opacity-60"
            style={{ minHeight: '44px', maxHeight: '160px', height: '44px' }}
          />

          {/* Right controls — always anchored to bottom of the pill */}
          <div className="flex items-center gap-1 pr-2 pb-[7px] shrink-0 self-end">
            {/* Attach */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl hover:bg-[oklch(0.18_0.01_280)] transition-colors disabled:opacity-40"
              title="Attach image or file"
              disabled={isTyping}
            >
              <Paperclip className="w-4 h-4 text-[var(--text-muted)] hover:text-blue-400 transition-colors" />
            </button>

            {/* Char progress ring — only visible approaching limit */}
            {input.length > MAX_CHARS * 0.65 && (
              <svg className="-rotate-90 w-5 h-5 shrink-0" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r={RING_R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
                <circle
                  cx="8" cy="8" r={RING_R}
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="2.5"
                  strokeDasharray={RING_CIRC}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.2s, stroke 0.2s' }}
                />
              </svg>
            )}

            {/* Send / Stop */}
            {isTyping ? (
              <button
                type="button"
                onClick={onStopGeneration}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[oklch(0.22_0.02_280)] hover:bg-[oklch(0.26_0.02_280)] border border-[oklch(0.30_0.02_280)] rounded-xl text-[var(--text-muted)] text-sm font-semibold transition-all active:scale-95"
              >
                <Square className="w-3 h-3 fill-current" />
                <span className="hidden sm:inline">Stop</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSubmit}
                className="relative flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-br from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:from-[oklch(0.18_0.01_280)] disabled:to-[oklch(0.16_0.01_280)] disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-blue-900/40 hover:shadow-blue-900/60 disabled:shadow-none active:scale-95 disabled:hover:scale-100 group/send overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 -translate-x-full group-hover/send:translate-x-full transition-transform duration-500 pointer-events-none" />
                <Send className="w-3.5 h-3.5 relative z-10" />
                <span className="hidden sm:inline relative z-10">Analyze</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between mt-2 px-0.5">
        {/* Left: Think Harder */}
        <div className="flex items-center gap-2">
          {onToggleDeepThink && (
            <button
              type="button"
              onClick={onToggleDeepThink}
              disabled={isTyping}
              title={deepThink ? 'Think Harder ON — deeper reasoning. Click to disable.' : 'Think Harder — enables deeper step-by-step analysis'}
              className={`flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 border active:scale-95 ${
                deepThink
                  ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 shadow-[0_0_8px_oklch(0.5_0.2_270/0.2)]'
                  : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-indigo-500/40 hover:text-indigo-400'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Brain className={`w-3.5 h-3.5 ${deepThink ? 'text-indigo-300' : ''}`} />
              <span className="hidden sm:inline">Think Harder</span>
              {deepThink && <Zap className="w-2.5 h-2.5 text-indigo-400 hidden sm:block" />}
            </button>
          )}
        </div>

        {/* Center: category hints */}
        <p className="hidden sm:block text-[10px] font-semibold text-[var(--text-faint)] tracking-wide">
          Betting · Fantasy · DFS · Kalshi · Real-time AI
        </p>

        {/* Right: credits */}
        <div className="flex items-center gap-2 ml-auto sm:ml-0">
          {input.length > 0 && (
            <span className="hidden md:inline text-[10px] text-[var(--text-faint)]">
              Shift+Enter for new line
            </span>
          )}
          <button
            onClick={onOpenStripe}
            className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border transition-all cursor-pointer hover:opacity-80 ${
              creditsRemaining <= 3
                ? 'text-orange-400 bg-orange-500/10 border-orange-500/30'
                : 'text-[var(--text-muted)] bg-[var(--bg-overlay)] border-[var(--border-subtle)]'
            }`}
          >
            <Sparkles className="w-2.5 h-2.5" />
            <span>{creditsRemaining} {creditsRemaining === 1 ? 'credit' : 'credits'}</span>
          </button>
        </div>
      </div>
    </>
  );
});

export type { FileAttachment, ChatInputProps };
