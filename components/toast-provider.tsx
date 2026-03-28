'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    timerRef.current = setTimeout(() => onRemove(toast.id), 3000);
    return () => clearTimeout(timerRef.current);
  }, [toast.id, onRemove]);

  const borderColor =
    toast.type === 'success' ? 'border-l-blue-500' :
    toast.type === 'error'   ? 'border-l-red-500' :
                               'border-l-blue-500';

  const iconChar =
    toast.type === 'success' ? '✓' :
    toast.type === 'error'   ? '✕' : 'ℹ';

  const iconColor =
    toast.type === 'success' ? 'text-blue-400' :
    toast.type === 'error'   ? 'text-red-400' : 'text-blue-400';

  return (
    <div
      className={`flex items-start gap-3 pl-4 pr-4 py-3 rounded-xl bg-[oklch(0.16_0.02_280)] border border-[oklch(0.25_0.02_280)] border-l-4 ${borderColor} shadow-xl animate-fade-in-up min-w-[260px] max-w-[360px]`}
      role="alert"
    >
      <span className={`text-sm font-bold mt-0.5 shrink-0 ${iconColor}`}>{iconChar}</span>
      <p className="text-sm text-gray-200 leading-snug">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="ml-auto shrink-0 text-gray-600 hover:text-gray-300 transition-colors text-lg leading-none"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  const [container, setContainer] = useState<Element | null>(null);

  useEffect(() => {
    // Create a dedicated mount point instead of using document.body directly.
    // This avoids hydration mismatches caused by Next.js streaming SSR markers
    // that already live inside document.body when React tries to reconcile.
    const div = document.createElement('div');
    document.body.appendChild(div);
    setContainer(div);
    return () => {
      document.body.removeChild(div);
    };
  }, []);

  if (!container) return null;
  return createPortal(
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onRemove={onRemove} />
        </div>
      ))}
    </div>,
    container
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++nextId;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const value: ToastContextValue = {
    addToast,
    success: useCallback((msg: string) => addToast(msg, 'success'), [addToast]),
    error:   useCallback((msg: string) => addToast(msg, 'error'),   [addToast]),
    info:    useCallback((msg: string) => addToast(msg, 'info'),     [addToast]),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
