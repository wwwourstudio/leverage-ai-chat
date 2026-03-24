'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Send, X, Paperclip, FileText, ImageIcon, Bookmark, Sparkles, Brain } from 'lucide-react';

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
}

const MAX_CHARS = 2000;

export function ChatInput({
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
}: ChatInputProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height as content grows (max ~6 lines / 160px)
  // Wrap in RAF to avoid forced reflow (write then synchronous layout read)
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

  // Enter = submit, Shift+Enter = newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as FormEvent);
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = await onFileDrop(e.dataTransfer.files);
    if (dropped.length > 0) onFilesAdded(dropped);
  };

  const charsLeft = MAX_CHARS - input.length;
  const nearLimit = charsLeft <= 200;
  const overLimit = charsLeft < 0;

  return (
    <>
      {/* File attachment previews */}
      {uploadedFiles.length > 0 && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center gap-2">
            <Paperclip className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} attached
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl group/file hover:border-[var(--border-hover)] transition-colors"
              >
                {file.type === 'image'
                  ? <ImageIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  : <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                <span className="text-xs font-medium text-foreground/80 max-w-[120px] truncate">{file.name}</span>
                <span className="text-[10px] text-[var(--text-faint)]">{(file.size / 1024).toFixed(1)} KB</span>
                <button
                  onClick={() => onSaveFile(file)}
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

      {/* Drag-and-drop + form */}
      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-2xl transition-all duration-200 ${isDragOver ? 'ring-2 ring-blue-500/60 bg-blue-500/5' : ''}`}
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

        <form onSubmit={onSubmit} className="flex items-center gap-2 md:gap-3">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg,image/gif,image/webp,text/csv,.tsv,text/tab-separated-values,text/plain,.txt,.json,application/json,.pdf,application/pdf"
            multiple
            onChange={onFileUpload}
            className="hidden"
          />

          {/* Textarea wrapper */}
          <div className="flex-1 relative rounded-2xl transition-all duration-200">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                if (e.target.value.length <= MAX_CHARS) onInputChange(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              placeholder={defaultPlaceholder}
              disabled={isTyping}
              className="w-full resize-none bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[oklch(0.28_0.02_280)] focus:border-[oklch(0.38_0.06_260)] rounded-2xl px-3 py-2.5 md:px-5 md:pr-28 font-medium text-foreground placeholder-[var(--text-faint)] focus:outline-none transition-colors backdrop-blur-sm shadow-inner text-sm leading-relaxed overflow-hidden"
              style={{ minHeight: '44px', maxHeight: '160px', height: '44px' }}
            />

            {/* Attach + char counter — desktop only, inside input */}
            <div className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 items-center gap-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 hover:bg-[var(--bg-elevated)] rounded-lg transition-colors border-none bg-transparent"
                title="Attach image or CSV file"
                disabled={isTyping}
              >
                <Paperclip className="w-4 h-4 text-[var(--text-muted)] hover:text-blue-400 transition-colors" />
              </button>
              {nearLimit && (
                <span className={`text-xs font-semibold tabular-nums ${overLimit ? 'text-red-400' : 'text-orange-400'}`}>
                  {charsLeft}
                </span>
              )}
            </div>
          </div>

          {/* Deep Think toggle */}
          {onToggleDeepThink && (
            <button
              type="button"
              onClick={onToggleDeepThink}
              disabled={isTyping}
              title={deepThink ? 'Deep Think ON — uses Grok 4 for complex analysis. Click to disable.' : 'Deep Think — uses Grok 4 for step-by-step reasoning'}
              className={`shrink-0 p-2.5 rounded-xl transition-all duration-200 border ${
                deepThink
                  ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-300 shadow-[0_0_12px_oklch(0.5_0.2_270/0.3)]'
                  : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-indigo-500/40 hover:text-indigo-400'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              style={{ height: '44px', width: '44px' }}
            >
              <Brain className="w-4 h-4 mx-auto" />
            </button>
          )}

          {/* Send / Stop */}
          {isTyping ? (
            <button
              type="button"
              onClick={onStopGeneration}
              className="shrink-0 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white rounded-2xl px-3 md:px-7 transition-all duration-200 shadow-lg shadow-red-900/30 flex items-center gap-2 font-semibold active:scale-95"
              style={{ height: '44px' }}
            >
              <X className="w-4 h-4" />
              <span className="hidden md:inline text-sm">Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={(!input.trim() && uploadedFiles.length === 0) || overLimit}
              className="shrink-0 relative bg-gradient-to-br from-[oklch(0.32_0.09_260)] to-[oklch(0.26_0.07_270)] hover:from-[oklch(0.28_0.12_155)] hover:to-[oklch(0.24_0.10_160)] disabled:from-[var(--bg-elevated)] disabled:to-[var(--bg-surface)] disabled:cursor-not-allowed text-white rounded-2xl px-3 md:px-7 transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-[0_0_20px_oklch(0.45_0.18_155/0.4)] disabled:shadow-none flex items-center gap-2 font-semibold overflow-hidden active:scale-95 disabled:hover:scale-100 group/send"
              style={{ height: '44px' }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 -translate-x-full group-hover/send:translate-x-full transition-transform duration-600 pointer-events-none" />
              <Send className="w-4 h-4 relative z-10" />
              <span className="hidden md:inline text-sm relative z-10">Analyze</span>
            </button>
          )}
        </form>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between mt-2 px-1">
        {/* Mobile attach */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="sm:hidden shrink-0 p-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] active:scale-95 transition-all"
          title="Attach file"
          disabled={isTyping}
        >
          <Paperclip className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        </button>

        <p className="hidden sm:block text-[10px] font-semibold text-[var(--text-faint)] tracking-wide">
          Betting · Fantasy · DFS · Kalshi · Real-time AI
        </p>

        <div className="flex items-center gap-2 ml-auto">
          {/* Shift+Enter hint — only visible while typing */}
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

          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-faint)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <span className="hidden sm:inline">All systems operational</span>
            <span className="sm:hidden">Online</span>
          </div>
        </div>
      </div>
    </>
  );
}

export type { FileAttachment, ChatInputProps };
