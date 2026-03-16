'use client';

import { useEffect, useCallback, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LightboxMetric { label: string; value: string }
export interface LightboxSection { title: string; metrics: LightboxMetric[] }

interface AnalysisLightboxProps {
  open: boolean;
  onClose: () => void;
  title: string;
  sections: LightboxSection[];
  /** e.g. 'text-blue-400' */
  accentText?: string;
  /** e.g. 'bg-blue-500/10' */
  accentBg?: string;
  /** e.g. 'border-blue-500/30' */
  accentBorder?: string;
  /** Raw data object shown in Copy JSON button */
  rawData?: unknown;
}

/**
 * Shared analysis lightbox used by StatcastCard and MLBProjectionCard.
 * Standardizes the breakdown overlay pattern — max-w-2xl, keyboard Escape, grid metrics.
 */
export function AnalysisLightbox({
  open,
  onClose,
  title,
  sections,
  accentText = 'text-blue-400',
  accentBg = 'bg-blue-500/10',
  accentBorder = 'border-blue-500/30',
  rawData,
}: AnalysisLightboxProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleCopy = useCallback(() => {
    if (!rawData) return;
    navigator.clipboard.writeText(JSON.stringify(rawData, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [rawData]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — Full Breakdown`}
    >
      {/* Dim overlay */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className={cn(
          'relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-[oklch(0.07_0.01_280)] border shadow-2xl',
          accentBorder,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[oklch(0.18_0.015_280)] shrink-0">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-white leading-tight truncate">{title}</h3>
            <p className={cn('text-[9px] font-extrabold uppercase tracking-widest mt-0.5', accentText)}>
              Full Breakdown · Press Esc to close
            </p>
          </div>
          <div className="flex items-center gap-2 ml-3 shrink-0">
            {!!rawData && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[oklch(0.14_0.015_280)] hover:bg-[oklch(0.18_0.015_280)] text-[oklch(0.55_0.01_280)] hover:text-white text-[10px] font-bold transition-colors border border-[oklch(0.20_0.015_280)]"
              >
                {copied ? '✓ Copied' : 'Copy JSON'}
              </button>
            )}
            <button
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7 rounded-full bg-[oklch(0.14_0.015_280)] text-[oklch(0.55_0.01_280)] hover:text-white hover:bg-[oklch(0.20_0.015_280)] transition-colors"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {sections.map((section, i) => (
            <div key={i}>
              <h4 className={cn('text-[10px] font-extrabold uppercase tracking-widest mb-2', accentText)}>
                {section.title}
              </h4>
              <div className={cn('rounded-xl border grid grid-cols-2 divide-y divide-x divide-[oklch(0.14_0.01_280)] overflow-hidden', accentBg, accentBorder)}>
                {section.metrics?.map((m, j) => (
                  <div key={j} className="flex items-center justify-between px-3 py-2 bg-[oklch(0.09_0.01_280)]">
                    <span className="text-[10px] text-[oklch(0.52_0.01_280)] truncate pr-2">{m.label}</span>
                    <span className="text-[10px] font-black text-white whitespace-nowrap">{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {sections.length === 0 && (
            <p className="text-sm text-[oklch(0.42_0.01_280)] text-center py-6">No breakdown data available.</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-[oklch(0.18_0.015_280)] shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className={cn('px-4 py-2 rounded-xl hover:opacity-90 text-sm font-bold transition-opacity border', accentBg, accentBorder, accentText)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
