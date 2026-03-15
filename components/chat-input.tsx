'use client';

import { useState, useRef, type FormEvent } from 'react';
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

  const defaultPlaceholder = lastUserQuery
    ? `Follow up on your ${lastUserQuery.toLowerCase().includes('nba') ? 'NBA' : lastUserQuery.toLowerCase().includes('nfl') ? 'NFL' : lastUserQuery.toLowerCase().includes('kalshi') ? 'Kalshi' : lastUserQuery.toLowerCase().includes('dfs') ? 'DFS' : lastUserQuery.toLowerCase().includes('fantasy') ? 'fantasy' : 'sports'} analysis or ask something new...`
    : 'Ask about betting odds, fantasy, DFS, or Kalshi markets...';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit(e as unknown as FormEvent);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = await onFileDrop(e.dataTransfer.files);
    if (dropped.length > 0) {
      onFilesAdded(dropped);
    }
  };

  return (
    <>
      {/* File Upload Preview */}
      {uploadedFiles.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Paperclip className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-[var(--text-muted)]">
              {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} attached
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl group/file hover:border-[oklch(0.30_0.02_280)] transition-all"
              >
                {file.type === 'image' ? (
                  <ImageIcon className="w-4 h-4 text-blue-400" />
                ) : (
                  <FileText className="w-4 h-4 text-green-400" />
                )}
                <span className="text-xs font-bold text-white/80 max-w-[120px] truncate">
                  {file.name}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
                {/* Save to profile */}
                <button
                  onClick={() => onSaveFile(file)}
                  className="p-1 hover:bg-blue-900/40 rounded transition-all"
                  title="Save file to profile"
                >
                  <Bookmark className="w-3.5 h-3.5 text-[var(--text-muted)] hover:text-blue-400" />
                </button>
                <button
                  onClick={() => onRemoveFile(file.id)}
                  className="p-1 hover:bg-gray-700/50 rounded transition-all"
                  title="Remove file"
                >
                  <X className="w-3.5 h-3.5 text-[var(--text-muted)] hover:text-red-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drag-and-drop + form wrapper */}
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
              <Paperclip className="w-6 h-6 text-blue-400" />
              <span className="text-sm font-bold text-blue-300">Drop files here</span>
              <span className="text-xs text-blue-400/70">Images, CSV, TXT, JSON</span>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="flex items-end gap-2 md:gap-3">
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg,image/gif,image/webp,text/csv,.tsv,text/tab-separated-values,text/plain,.txt,.json,application/json,.pdf,application/pdf"
            multiple
            onChange={onFileUpload}
            className="hidden"
          />

          {/* Attach button — hidden on mobile (moved to status bar row below) */}

          <div className="flex-1 relative group/input focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:shadow-lg focus-within:shadow-blue-500/10 rounded-2xl transition-all duration-300">
            <input
              type="text"
              value={input}
              onChange={(e: any) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder ?? defaultPlaceholder}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[oklch(0.28_0.02_280)] focus:border-blue-500/40 rounded-2xl px-3 py-2.5 md:px-6 md:pr-32 font-medium text-white placeholder-[var(--text-faint)] focus:outline-none transition-all backdrop-blur-sm shadow-inner text-xs md:text-base"
              disabled={isTyping}
              maxLength={500}
              style={{ minHeight: '44px' }}
            />
            {/* Attach + char count — inside input on desktop only */}
            <div className="hidden md:flex absolute right-5 top-1/2 -translate-y-1/2 items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 hover:bg-[var(--bg-elevated)] rounded-lg transition-all group/attach border-none bg-transparent"
                title="Attach image or CSV file"
                disabled={isTyping}
              >
                <Paperclip className="w-4.5 h-4.5 text-[var(--text-muted)] group-hover/attach:text-blue-400 transition-colors" />
              </button>
              <span className={`text-xs font-bold transition-colors ${input.length > 450 ? 'text-orange-400' : 'text-[var(--text-faint)]'}`}>
                {input.length}/500
              </span>
            </div>
          </div>

          {isTyping ? (
            <button
              type="button"
              onClick={onStopGeneration}
              className="flex-shrink-0 relative bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white rounded-2xl px-3 md:px-8 transition-all duration-300 shadow-xl shadow-red-900/30 flex items-center gap-2.5 font-bold group overflow-hidden active:scale-95"
              style={{ minHeight: '44px' }}
            >
              <X className="w-5 h-5 relative z-10" />
              <span className="hidden md:inline text-sm relative z-10 tracking-wide">Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() && uploadedFiles.length === 0}
              className="flex-shrink-0 relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 disabled:from-[var(--bg-elevated)] disabled:to-[var(--bg-surface)] disabled:cursor-not-allowed text-white rounded-2xl px-3 md:px-8 transition-all duration-300 shadow-xl shadow-blue-500/25 hover:shadow-blue-500/50 disabled:shadow-none flex items-center gap-2.5 font-bold group overflow-hidden active:scale-95 disabled:hover:scale-100"
              style={{ minHeight: '44px' }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <Send className="w-5 h-5 relative z-10" />
              <span className="hidden md:inline text-sm relative z-10 tracking-wide">Analyze</span>
            </button>
          )}
        </form>
      </div>{/* end drag-and-drop wrapper */}

      <div className="flex items-center justify-between mt-2 px-1">
        {/* Mobile: attach button on left; Desktop: label text */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="sm:hidden flex-shrink-0 p-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[oklch(0.30_0.02_280)] active:scale-95 transition-all"
          title="Attach file"
          disabled={isTyping}
        >
          <Paperclip className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        </button>
        <p className="hidden sm:block text-[10px] font-bold text-[var(--text-faint)]">
          Betting • Fantasy • DFS • Kalshi • Real-time AI Analysis
        </p>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={onOpenStripe}
            className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md border transition-all cursor-pointer hover:opacity-80 ${
              creditsRemaining <= 3
                ? 'text-orange-400 bg-orange-500/10 border-orange-500/30'
                : 'text-[var(--text-muted)] bg-[var(--bg-overlay)] border-[var(--border-subtle)]'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>{creditsRemaining} {creditsRemaining === 1 ? 'credit' : 'credits'}</span>
          </button>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-faint)]">
            <div className="relative flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-lg shadow-green-500/50"></div>
              <div className="absolute inset-0 bg-green-400 rounded-full animate-ping"></div>
            </div>
            <span className="hidden sm:inline">All systems operational</span>
            <span className="sm:hidden">Online</span>
          </div>
        </div>
      </div>
    </>
  );
}

export type { FileAttachment, ChatInputProps };
