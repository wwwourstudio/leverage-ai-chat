'use client';

import { useState, useRef } from 'react';
import { Upload, X, Loader2, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/toast-provider';

interface TSVUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sport: 'mlb' | 'nfl';
  lastUploadDate?: string;
  isLoading?: boolean;
  onUploadSuccess?: () => void;
}

export function TSVUploadDialog({
  isOpen,
  onClose,
  sport,
  lastUploadDate,
  isLoading: externalLoading,
  onUploadSuccess,
}: TSVUploadDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  if (!isOpen) return null;

  const sportLabel = sport === 'mlb' ? 'MLB (NFBC)' : 'NFL (NFFC)';
  const sportUrl = sport === 'mlb' 
    ? 'https://nfc.shgn.com/adp/baseball'
    : 'https://nfc.shgn.com/adp/football';

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    if (!file.name.endsWith('.tsv') && !file.type.includes('text')) {
      toast.error('Please upload a TSV file');
      return;
    }

    setIsLoading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sport', sport);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', async () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          toast.success(`${response.playerCount} players imported from ${file.name}`);
          setUploadProgress(0);
          setIsLoading(false);
          onUploadSuccess?.();
          onClose();
        } else {
          const error = JSON.parse(xhr.responseText);
          toast.error(error.error || 'Upload failed');
          setIsLoading(false);
        }
      });

      xhr.addEventListener('error', () => {
        toast.error('Upload failed');
        setIsLoading(false);
      });

      xhr.open('POST', '/api/adp/upload');
      xhr.send(formData);
    } catch (error) {
      console.error('[v0] TSV Upload Error:', error);
      toast.error('Failed to upload TSV file');
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never uploaded';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Lightbox Container */}
      <div className="relative w-full sm:w-full max-w-md mx-4 sm:mx-0 rounded-t-2xl sm:rounded-2xl bg-[oklch(0.09_0.012_280)] border border-[oklch(0.18_0.016_280)] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 sm:zoom-in-95">
        {/* Header */}
        <div className="relative px-6 pt-4 pb-3 bg-gradient-to-br from-blue-600/75 via-indigo-700/55 to-blue-900/35 flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-black text-white">Upload {sportLabel} ADP</h2>
            <p className="text-sm text-blue-100/80 mt-0.5">From {sportUrl}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading || externalLoading}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Last Upload Info */}
          {lastUploadDate && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
              <Calendar className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="text-sm text-emerald-200">
                Last uploaded: <span className="font-semibold">{formatDate(lastUploadDate)}</span>
              </span>
            </div>
          )}

          {/* File Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'relative p-6 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer',
              isDragging
                ? 'bg-blue-500/20 border-blue-400 scale-105'
                : 'bg-[oklch(0.10_0.01_280)] border-[oklch(0.20_0.01_280)] hover:border-blue-500/50 hover:bg-blue-500/5',
              isLoading || externalLoading ? 'opacity-50 cursor-not-allowed' : ''
            )}
            onClick={() => !isLoading && !externalLoading && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".tsv,.txt"
              onChange={handleFileSelect}
              disabled={isLoading || externalLoading}
              className="hidden"
              aria-label="TSV file input"
            />

            <div className="flex flex-col items-center justify-center gap-2">
              {isLoading || externalLoading ? (
                <>
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                  <p className="text-sm font-semibold text-white">
                    {uploadProgress > 0 && uploadProgress < 100
                      ? `Uploading... ${Math.round(uploadProgress)}%`
                      : 'Processing...'}
                  </p>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-blue-400" />
                  <p className="text-sm font-semibold text-white">Drag TSV file here or click to browse</p>
                  <p className="text-xs text-[oklch(0.42_0.01_280)]">Accepts .tsv or .txt files</p>
                </>
              )}
            </div>
          </div>

          {/* Info Box */}
          <div className="px-3 py-3 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-1.5">
            <p className="text-xs font-semibold text-blue-200 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              How to get the file:
            </p>
            <ol className="text-xs text-blue-100/80 space-y-1 ml-5 list-decimal">
              <li>Visit <span className="font-mono text-blue-300">{sportUrl}</span></li>
              <li>Copy the ADP board table (select all → copy)</li>
              <li>Paste into Excel or Google Sheets</li>
              <li>Export as TSV/CSV</li>
              <li>Upload the file here</li>
            </ol>
          </div>

          {/* Features */}
          <div className="space-y-2 pt-2">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span className="text-xs text-[oklch(0.42_0.01_280)]">Shared across all users in real-time</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span className="text-xs text-[oklch(0.42_0.01_280)]">Secure & persistent storage</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span className="text-xs text-[oklch(0.42_0.01_280)]">Replaces automatic scraping</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[oklch(0.07_0.01_280)] border-t border-[oklch(0.15_0.01_280)] flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading || externalLoading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-[oklch(0.12_0.01_280)] border border-[oklch(0.20_0.01_280)] text-sm font-semibold text-[oklch(0.46_0.01_280)] hover:text-white hover:bg-[oklch(0.15_0.01_280)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
