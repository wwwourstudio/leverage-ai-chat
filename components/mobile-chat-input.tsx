'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Paperclip, X, FileText, ImageIcon, Mic, MicOff, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoiceInput } from '@/lib/hooks/use-voice-input';
import { GROK_VOICE_STORAGE_KEY, GROK_VOICE_DEFAULT } from '@/lib/constants';

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
  /** Latest assistant message text — played via TTS when voice mode is on */
  lastAssistantMessage?: string;
}

export function MobileChatInput({
  onSend,
  disabled,
  placeholder = 'Ask about betting opportunities...',
  lastAssistantMessage,
}: MobileChatInputProps) {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<MobileFileAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevMessageRef = useRef<string | undefined>(undefined);

  // Persist voice mode preference
  useEffect(() => {
    const stored = localStorage.getItem('leverage_voice_mode');
    if (stored === '1') setVoiceMode(true);
  }, []);

  const toggleVoiceMode = useCallback(() => {
    setVoiceMode(v => {
      const next = !v;
      localStorage.setItem('leverage_voice_mode', next ? '1' : '0');
      return next;
    });
  }, []);

  // Auto-speak when a new assistant message arrives and voice mode is on
  useEffect(() => {
    if (!voiceMode || !lastAssistantMessage) return;
    if (lastAssistantMessage === prevMessageRef.current) return;
    prevMessageRef.current = lastAssistantMessage;

    const voice = localStorage.getItem(GROK_VOICE_STORAGE_KEY) ?? GROK_VOICE_DEFAULT;
    // Strip markdown symbols before speaking
    const clean = lastAssistantMessage
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/#+\s/g, '')
      .replace(/`(.+?)`/g, '$1')
      .slice(0, 600);

    setIsSpeaking(true);
    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clean, voice }),
    })
      .then(r => {
        if (!r.ok) throw new Error('TTS failed');
        return r.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          setIsSpeaking(false);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          setIsSpeaking(false);
        };
        audio.play();
      })
      .catch(() => setIsSpeaking(false));
  }, [voiceMode, lastAssistantMessage]);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const processFile = useCallback(async (file: File): Promise<MobileFileAttachment | null> => {
    const isImage = file.type.startsWith('image/');
    const isText = file.type === 'text/csv' || file.type === 'text/plain' || file.type === 'application/json'
      || file.name.endsWith('.csv') || file.name.endsWith('.txt') || file.name.endsWith('.json')
      || file.name.endsWith('.pdf');

    if (!isImage && !isText) return null;

    const attachment: MobileFileAttachment = {
      id: crypto.randomUUID(),
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

  // Voice input — fills the text field from speech recognition
  const { isRecording, isSupported: micSupported, toggle: toggleMic } = useVoiceInput(
    useCallback((transcript: string) => {
      setInput(prev => prev ? `${prev} ${transcript}` : transcript);
    }, []),
  );

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
        'border-t border-[var(--border-subtle)] bg-[var(--bg-overlay)]/95 backdrop-blur-xl p-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] transition-all',
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
            <p className="text-xs font-bold text-blue-300">Drop files here</p>
          </div>
        </div>
      )}

      {/* File previews */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {files.map(file => (
            <div
              key={file.id}
              className="flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg"
            >
              {file.type === 'image' ? (
                <ImageIcon className="w-3 h-3 text-blue-400 shrink-0" />
              ) : (
                <FileText className="w-3 h-3 text-blue-400 shrink-0" />
              )}
              <span className="text-[10px] font-semibold text-foreground/80 max-w-[80px] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(file.id)}
                className="text-[var(--text-faint)] hover:text-red-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.csv,.txt,.json,.pdf,text/csv,text/plain,application/json,application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Attach */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="p-2 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] transition-colors flex-shrink-0 disabled:opacity-50"
          aria-label="Attach file"
        >
          <Paperclip className="w-4 h-4 text-[var(--text-muted)]" />
        </button>

        {/* Text input */}
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
            placeholder={isRecording ? 'Listening…' : (isDragOver ? 'Drop files here...' : placeholder)}
            disabled={disabled}
            className={cn(
              'w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-[13px] leading-tight text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all overflow-x-auto whitespace-nowrap',
              isRecording && 'border-red-500/50 ring-2 ring-red-500/30',
            )}
          />
        </div>

        {/* Mic button — voice input */}
        {micSupported && (
          <button
            type="button"
            onClick={toggleMic}
            disabled={disabled}
            className={cn(
              'p-2 rounded-xl flex-shrink-0 transition-all',
              isRecording
                ? 'bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse'
                : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-white',
            )}
            aria-label={isRecording ? 'Stop recording' : 'Voice input'}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        )}

        {/* Voice mode / speaking indicator */}
        <button
          type="button"
          onClick={isSpeaking ? stopSpeaking : toggleVoiceMode}
          className={cn(
            'p-2 rounded-xl flex-shrink-0 transition-all',
            isSpeaking
              ? 'bg-blue-500/20 border border-blue-500/40 text-blue-400 animate-pulse'
              : voiceMode
              ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-400'
              : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-white',
          )}
          aria-label={isSpeaking ? 'Stop speaking' : voiceMode ? 'Voice mode on (tap to off)' : 'Enable voice mode'}
          title={isSpeaking ? 'Tap to stop' : voiceMode ? 'Voice mode on' : 'Enable Grok voice'}
        >
          <Volume2 className="w-4 h-4" />
        </button>

        {/* Send */}
        <button
          type="submit"
          disabled={(!input.trim() && files.length === 0) || disabled}
          className="p-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/35 disabled:shadow-none flex-shrink-0"
          aria-label="Send message"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </form>
    </div>
  );
}
