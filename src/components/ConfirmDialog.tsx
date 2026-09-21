import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setPending({ ...options, resolve });
    });
  }, []);

  const handleRespond = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {pending && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => handleRespond(false)}
          id="confirm-dialog-overlay"
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-2xl max-w-sm w-full mx-4 p-6 space-y-5 animate-fade-in"
            onClick={e => e.stopPropagation()}
            id="confirm-dialog-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`p-2.5 rounded-2xl ${pending.variant === 'danger' ? 'bg-rose-100 dark:bg-rose-950 text-rose-600' : 'bg-amber-100 dark:bg-amber-950 text-amber-600'}`}>
                  {pending.variant === 'danger'
                    ? <Trash2 className="w-5 h-5" />
                    : <AlertTriangle className="w-5 h-5" />
                  }
                </span>
                <h2 id="confirm-title" className="font-bold text-slate-900 dark:text-white text-base leading-tight">
                  {pending.title ?? (pending.variant === 'danger' ? 'Confirm Delete' : 'Confirm Action')}
                </h2>
              </div>
              <button
                onClick={() => handleRespond(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer mt-0.5"
                aria-label="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Description */}
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {pending.description}
            </p>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                id="confirm-cancel-btn"
                onClick={() => handleRespond(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                {pending.cancelLabel ?? 'Cancel'}
              </button>
              <button
                id="confirm-ok-btn"
                onClick={() => handleRespond(true)}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition cursor-pointer ${
                  pending.variant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-amber-500 hover:bg-amber-600'
                }`}
              >
                {pending.confirmLabel ?? (pending.variant === 'danger' ? 'Delete' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
