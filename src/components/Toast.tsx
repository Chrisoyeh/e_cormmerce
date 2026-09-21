import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle className="w-4 h-4 shrink-0" />,
  error:   <XCircle    className="w-4 h-4 shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 shrink-0" />,
  info:    <Info       className="w-4 h-4 shrink-0" />,
};

const STYLES: Record<ToastVariant, string> = {
  success: 'bg-emerald-600 text-white',
  error:   'bg-rose-600 text-white',
  warning: 'bg-amber-500 text-slate-900',
  info:    'bg-[#2D346C] text-white',
};

function ToastItem({ item, onDismiss }: { item: Toast; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = React.useState(false);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(item.id), 250);
  }, [item.id, onDismiss]);

  React.useEffect(() => {
    const t = setTimeout(dismiss, item.duration ?? 4000);
    return () => clearTimeout(t);
  }, [dismiss, item.duration]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold max-w-sm w-full pointer-events-auto transition-all duration-250
        ${STYLES[item.variant]}
        ${exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0 animate-fade-in'}
      `}
    >
      {ICONS[item.variant]}
      <span className="flex-1 leading-snug">{item.message}</span>
      <button
        onClick={dismiss}
        className="opacity-70 hover:opacity-100 transition cursor-pointer ml-1"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, variant: ToastVariant = 'info', duration = 4000) => {
    const id = `toast-${++counter.current}`;
    setToasts(prev => [...prev.slice(-3), { id, message, variant, duration }]);
  }, []);

  const ctx: ToastContextValue = {
    toast: addToast,
    success: (m, d) => addToast(m, 'success', d),
    error:   (m, d) => addToast(m, 'error', d),
    warning: (m, d) => addToast(m, 'warning', d),
    info:    (m, d) => addToast(m, 'info', d),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Toast stack — bottom-right corner */}
      <div
        aria-label="Notifications"
        className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none"
        id="toast-container"
      >
        {toasts.map(t => (
          <ToastItem key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
