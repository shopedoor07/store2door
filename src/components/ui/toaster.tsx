'use client';

import { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'destructive';
}

let listeners: Array<(toast: Toast) => void> = [];
let toastCount = 0;

export function toast({ title, description, variant = 'default' }: Omit<Toast, 'id'>) {
  const id = String(++toastCount);
  const t: Toast = { id, title, description, variant };
  listeners.forEach((l) => l(t));
  return id;
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Toast) => {
    setToasts((prev) => [...prev, t]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== t.id));
    }, 4000);
  }, []);

  useEffect(() => {
    listeners.push(addToast);
    return () => {
      listeners = listeners.filter((l) => l !== addToast);
    };
  }, [addToast]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 max-w-sm w-full px-4 sm:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm transition-all animate-in slide-in-from-bottom-5 ${
            t.variant === 'destructive'
              ? 'border-destructive/50 bg-destructive/90 text-white'
              : t.variant === 'success'
              ? 'border-emerald-500/50 bg-emerald-600/90 text-white'
              : 'border-border bg-card/95 text-card-foreground'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && <p className="text-xs mt-1 opacity-90">{t.description}</p>}
            </div>
            <button onClick={() => removeToast(t.id)} className="shrink-0 opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
