'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Send, X, Paperclip, FileText, ImageIcon, Bookmark, Sparkles } from 'lucide-react';

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
}: ChatInputProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height as content grows (max ~6 lines / 160px)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
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
        <div className="mb-2.5 flex flex-wrap gap-2">
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-[oklch(0.12_0.012_280)] border border-[oklch(0.22_0.018_280)] rounded-xl hover:border-[oklch(0.30_0.025_260)] transition-colors"
            >
              {file.type === 'image'
                ? <ImageIcon className="w-3 h-3 text-emerald-400 shrink-0" />
                : <FileText className="w-3 h-3 text-teal-400 shrink-0" />}
              <span className="text-xs font-medium text-white/75 max-w-[100px] truncate">{file.name}</span>
              <span className="text-[10px] text-[oklch(0.40_0.01_280)]">{(file.size / 1024).toFixed(0)}KB</span>
              <button onClick={() => onSaveFile(file)} className="p-0.5 rounded hover:bg-emerald-900/40 transition-colors" title="Save">
                <Bookmark className="w-3 h-3 text-[oklch(0.40_0.01_280)] hover:text-emerald-400" />
              </button>
              <button onClick={() => onRemoveFile(file.id)} className="p-0.5 rounded hover:bg-red-900/30 transition-colors" title="Remove">
                <X className="w-3 h-3 text-[oklch(0.40_0.01_280)] hover:text-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drag-and-drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-2xl transition-all duration-200 ${isDragOver ? 'ring-2 ring-emerald-500/50' : ''}`}
      >
        {isDragOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-emerald-500/50 bg-emerald-500/5 pointer-events-none">
            <div className="flex flex-col items-center gap-1.5">
              <Paperclip className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-300">Drop files here</span>
              <span className="text-xs text-emerald-400/60">Images, CSV, TSV, TXT, JSON</span>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg,image/gif,image/webp,text/csv,.tsv,text/tab-separated-values,text/plain,.txt,.json,application/json,.pdf,application/pdf"
            multiple
            onChange={onFileUpload}
            className="hidden"
          />

          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => { if (e.target.value.length <= MAX_CHARS) onInputChange(e.target.value); }}
              onKeyDown={handleKeyDown}
              placeholder={defaultPlaceholder}
              disabled={isTyping}
              className="w-full resize-none bg-[oklch(0.12_0.012_280)] border border-[oklch(0.20_0.018_280)] hover:border-[oklch(0.28_0.022_280)] focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 rounded-2xl px-4 py-3 md:px-5 md:pr-28 text-sm font-medium text-white placeholder-[oklch(0.38_0.01_280)] focus:outline-none transition-all shadow-inner leading-relaxed overflow-hidden"
              style={{ minHeight: '48px', maxHeight: '160px' }}
            />
            {/* Desktop: attach + char counter */}
            <div className="hidden md:flex absolute right-3.5 bottom-2.5 items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 hover:bg-[oklch(0.18_0.015_280)] rounded-lg transition-colors"
                title="Attach file"
                disabled={isTyping}
              >
                <Paperclip className="w-3.5 h-3.5 text-[oklch(0.42_0.01_280)] hover:text-emerald-400 transition-colors" />
              </button>
              {nearLimit && (
                <span className={`text-[11px] font-bold tabular-nums ${overLimit ? 'text-red-400' : 'text-amber-400'}`}>
                  {charsLeft}
                </span>
              )}
            </div>
          </div>

          {/* Send / Stop */}
          {isTyping ? (
            <button
              type="button"
              onClick={onStopGeneration}
              className="shrink-0 flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white rounded-2xl px-4 md:px-6 font-semibold transition-all active:scale-95 shadow-lg shadow-red-900/25"
              style={{ minHeight: '48px' }}
            >
              <X className="w-4 h-4" />
              <span className="hidden md:inline text-sm">Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={(!input.trim() && uploadedFiles.length === 0) || overLimit}
              className="shrink-0 relative flex items-center gap-2 bg-gradient-to-br from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-[oklch(0.16_0.01_280)] disabled:to-[oklch(0.14_0.01_280)] disabled:cursor-not-allowed text-white rounded-2xl px-4 md:px-6 font-semibold transition-all duration-200 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30 disabled:shadow-none active:scale-95 disabled:hover:scale-100 overflow-hidden group/send"
              style={{ minHeight: '48px' }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover/send:translate-x-full transition-transform duration-500 pointer-events-none" />
              <Send className="w-4 h-4 relative z-10" />
              <span className="hidden md:inline text-sm relative z-10">Analyze</span>
            </button>
          )}
        </form>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between mt-2 px-0.5">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="sm:hidden p-1.5 rounded-lg bg-[oklch(0.12_0.012_280)] border border-[oklch(0.20_0.018_280)] hover:border-[oklch(0.28_0.022_280)] active:scale-95 transition-all"
          disabled={isTyping}
        >
          <Paperclip className="w-3.5 h-3.5 text-[oklch(0.42_0.01_280)]" />
        </button>

        <p className="hidden sm:block text-[10px] font-medium text-[oklch(0.36_0.008_280)] tracking-wide">
          Betting · Fantasy · DFS · Kalshi · Real-time AI
        </p>

        <div className="flex items-center gap-2 ml-auto">
          {input.length > 0 && (
            <span className="hidden md:inline text-[10px] text-[oklch(0.35_0.008_280)]">
              ⇧ Enter for new line
            </span>
          )}
          <button
            onClick={onOpenStripe}
            className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all cursor-pointer hover:opacity-90 ${
              creditsRemaining <= 3
                ? 'text-amber-400 bg-amber-500/10 border-amber-500/25'
                : 'text-[oklch(0.42_0.01_280)] bg-[oklch(0.12_0.012_280)] border-[oklch(0.20_0.018_280)] hover:border-[oklch(0.28_0.022_280)]'
            }`}
          >
            <Sparkles className="w-2.5 h-2.5" />
            <span>{creditsRemaining} {creditsRemaining === 1 ? 'credit' : 'credits'}</span>
          </button>

          <div className="flex items-center gap-1.5 text-[10px] font-medium text-[oklch(0.38_0.008_280)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
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
