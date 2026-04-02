'use client';

import { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle, ExternalLink, FileText } from 'lucide-react';

interface ADPUploadModalProps {
  sport: 'mlb' | 'nfl';
  onSuccess?: (count: number) => void;
}

export function ADPUploadModal({ sport, onSuccess }: ADPUploadModalProps) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [count, setCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const label = sport === 'mlb' ? 'NFBC Baseball' : 'NFFC Football';
  const downloadUrl = sport === 'mlb'
    ? 'https://nfc.shgn.com/adp/baseball'
    : 'https://nfc.shgn.com/adp/football';

  async function handleFile(file: File) {
    setStatus('uploading');
    setMessage('');

    const form = new FormData();
    form.append('file', file);
    form.append('sport', sport);

    try {
      const res = await fetch('/api/adp/upload', { method: 'POST', body: form });
      const json = await res.json() as { success: boolean; count?: number; message?: string; error?: string };

      if (json.success && json.count) {
        setStatus('success');
        setCount(json.count);
        setMessage(json.message ?? '');
        onSuccess?.(json.count);
      } else {
        setStatus('error');
        setMessage(json.error ?? 'Upload failed');
      }
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  return (
    <div
      className="group relative bg-gradient-to-br from-violet-600/80 via-purple-700/60 to-violet-900/40 rounded-2xl p-5 border border-[var(--border-subtle)] hover:border-violet-500/40 transition-all duration-300 shadow-lg"
      onDragOver={(e: any) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-violet-300/70">
            {sport.toUpperCase()} · ADP Data
          </span>
          <h3 className="text-sm font-black text-white mt-0.5">Upload {label} ADP</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Download the TSV file from {label}, then upload it here to power AI draft analysis for all users.
          </p>
        </div>
        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-violet-500/15 text-violet-300 border border-violet-500/20 uppercase tracking-wider flex-shrink-0">
          UPLOAD
        </span>
      </div>

      {/* Step 1 — Download link */}
      <div className="bg-black/20 rounded-lg p-3 mb-3">
        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Step 1 — Download the TSV</p>
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          {downloadUrl.replace('https://', '')}
        </a>
        <p className="text-[10px] text-[var(--text-faint)] mt-1">
          On the page, click the <span className="text-foreground/80 font-semibold">Download</span> button to get the TSV file.
        </p>
      </div>

      {/* Step 2 — Upload area */}
      <div className="bg-black/20 rounded-lg p-3 mb-3">
        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Step 2 — Upload the file</p>

        {status === 'idle' && (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full border border-dashed border-violet-500/40 hover:border-violet-400/70 rounded-lg p-4 flex flex-col items-center gap-2 text-center transition-colors cursor-pointer bg-violet-500/5 hover:bg-violet-500/10"
          >
            <Upload className="w-5 h-5 text-violet-400" />
            <span className="text-xs text-foreground/80">Click to select TSV file, or drag &amp; drop here</span>
            <span className="text-[10px] text-[var(--text-faint)]">.tsv or .csv accepted</span>
          </button>
        )}

        {status === 'uploading' && (
          <div className="flex items-center gap-3 p-3">
            <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="text-xs text-foreground/80">Parsing and importing players…</span>
          </div>
        )}

        {status === 'success' && (
          <div className="flex items-start gap-2.5 p-2">
            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-green-400">
                {count.toLocaleString()} players imported
              </p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                ADP data is now live. Re-ask your draft question to get updated rankings.
              </p>
              <button
                onClick={() => { setStatus('idle'); if (fileRef.current) fileRef.current.value = ''; }}
                className="text-[10px] text-violet-400 hover:text-violet-300 mt-1 underline"
              >
                Upload again
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-start gap-2.5 p-2">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-red-400">Upload failed</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5 break-words">{message}</p>
              <button
                onClick={() => { setStatus('idle'); if (fileRef.current) fileRef.current.value = ''; }}
                className="text-[10px] text-violet-400 hover:text-violet-300 mt-1 underline"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".tsv,.csv,text/tab-separated-values,text/csv,text/plain"
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1.5 mt-1">
        <FileText className="w-3 h-3 text-[var(--text-faint)]" />
        <span className="text-[9px] text-[var(--text-faint)]">
          Uploads are shared — one person uploads, everyone benefits
        </span>
      </div>
    </div>
  );
}
