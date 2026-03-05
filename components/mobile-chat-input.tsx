'use client';

import { useState, useRef, useCallback } from 'react';
import { Send, Paperclip, X, FileText, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileFileAttachment {
  id: string;
  name: string;
  type: 'image' | 'text';
  size: number;
  url?: string;
  textContent?: string;
}

interface MobileChatInputProps {
  onSend: (message: string, files?: MobileFileAttachment[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MobileChatInput({
  onSend,
  disabled,
  placeholder = 'Ask about betting opportunities...',
}: MobileChatInputProps) {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<MobileFileAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const processFile = useCallback(async (file: File): Promise<MobileFileAttachment | null> => {
    const isImage = file.type.startsWith('image/');
    const isText = file.type === 'text/csv' || file.type === 'text/plain' || file.type === 'application/json'
      || file.name.endsWith('.csv') || file.name.endsWith('.txt') || file.name.endsWith('.json')
      || file.name.endsWith('.pdf');

    if (!isImage && !isText) return null;

    const attachment: MobileFileAttachment = {
      id: `${Date.now()}-${Math.random()}`,
      name: file.name,
      type: isImage ? 'image' : 'text',
      size: file.size,
    };

    if (isImage) {
      attachment.url = URL.createObjectURL(file);
    } else {
      const text = await file.text().catch(() => '');
      attachment.textContent = text.slice(0, 5000);
    }

    return attachment;
  }, []);

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const results = await Promise.all(Array.from(fileList).map(processFile));
    const valid = results.filter((f): f is MobileFileAttachment => f !== null);
    setFiles(prev => [...prev, ...valid]);
  }, [processFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = '';
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const f = prev.find(f => f.id === id);
      if (f?.url) URL.revokeObjectURL(f.url);
      return prev.filter(f => f.id !== id);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && files.length === 0) || disabled) return;
    onSend(input.trim(), files.length > 0 ? files : undefined);
    setInput('');
    setFiles([]);
  };

  // Drag-and-drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragOver(false);
  };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  return (
    <div
      className={cn(
        'border-t border-[oklch(0.22_0.02_280)] bg-[oklch(0.10_0.01_280)]/95 backdrop-blur-xl p-3 transition-all',
        isDragOver && 'border-blue-500/50 bg-blue-950/20',
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-t-2xl bg-blue-900/20 border-2 border-dashed border-blue-500/50 pointer-events-none">
          <div className="text-center">
            <Paperclip className="w-6 h-6 text-blue-400 mx-auto mb-1" />
            <p className="text-sm font-bold text-blue-300">Drop files here</p>
          </div>
        </div>
      )}

      {/* File previews */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {files.map(file => (
            <div
              key={file.id}
              className="flex items-center gap-1.5 px-2 py-1 bg-[oklch(0.16_0.015_280)] border border-[oklch(0.22_0.02_280)] rounded-lg"
            >
              {file.type === 'image' ? (
                <ImageIcon className="w-3 h-3 text-blue-400 shrink-0" />
              ) : (
                <FileText className="w-3 h-3 text-emerald-400 shrink-0" />
              )}
              <span className="text-[10px] font-semibold text-gray-300 max-w-[80px] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(file.id)}
                className="text-gray-600 hover:text-red-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.csv,.txt,.json,.pdf,text/csv,text/plain,application/json,application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="p-2.5 rounded-xl bg-[oklch(0.16_0.015_280)] hover:bg-[oklch(0.20_0.02_280)] transition-colors flex-shrink-0 disabled:opacity-50"
          aria-label="Attach file"
        >
          <Paperclip className="w-4.5 h-4.5 text-gray-400" />
        </button>

        <div className="flex-1 relative min-w-0">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={isDragOver ? 'Drop files here...' : placeholder}
            disabled={disabled}
            className="w-full bg-[oklch(0.16_0.015_280)] border border-[oklch(0.22_0.02_280)] rounded-xl px-3 py-2.5 text-gray-100 placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all overflow-x-auto whitespace-nowrap"
          />
        </div>

        <button
          type="submit"
          disabled={(!input.trim() && files.length === 0) || disabled}
          className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          aria-label="Send message"
        >
          <Send className="w-4.5 h-4.5 text-white" />
        </button>
      </form>

      <div className="flex items-center gap-2 mt-1.5 px-0.5">
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span>AI Online</span>
        </div>
        <span className="ml-auto text-[10px] text-slate-600">Drop files or tap <Paperclip className="w-2.5 h-2.5 inline" /></span>
      </div>
    </div>
  );
}
