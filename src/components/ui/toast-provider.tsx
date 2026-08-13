'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { playToastSound } from '@/lib/ui/toast-sound'

export type ToastKind = 'success' | 'error' | 'info'

export type ToastInput = {
  title: string
  description?: string
  kind?: ToastKind
  durationMs?: number
}

type ToastItem = {
  id: number
  title: string
  description?: string
  kind: ToastKind
  durationMs: number
}

type ToastContextValue = {
  push: (input: ToastInput) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION_MS = 3200

function kindStyles(kind: ToastKind) {
  if (kind === 'success') {
    return {
      bar: 'bg-emerald-500',
      panel: 'border-emerald-200 bg-white',
      title: 'text-emerald-900',
      icon: 'text-emerald-600',
    }
  }
  if (kind === 'error') {
    return {
      bar: 'bg-red-500',
      panel: 'border-red-200 bg-white',
      title: 'text-red-900',
      icon: 'text-red-600',
    }
  }
  return {
    bar: 'bg-slate-500',
    panel: 'border-slate-200 bg-white',
    title: 'text-slate-900',
    icon: 'text-slate-600',
  }
}

function ToastIcon({ kind }: { kind: ToastKind }) {
  if (kind === 'success') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.78-9.72a.75.75 0 00-1.06-1.06L9 10.94 7.28 9.22a.75.75 0 10-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l4.25-4.25z"
          clipRule="evenodd"
        />
      </svg>
    )
  }
  if (kind === 'error') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
          clipRule="evenodd"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem
  onDismiss: (id: number) => void
}) {
  const styles = kindStyles(toast.kind)

  useEffect(() => {
    if (toast.durationMs <= 0) return
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.durationMs)
    return () => window.clearTimeout(timer)
  }, [toast.durationMs, toast.id, onDismiss])

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex w-[min(100vw-2rem,22rem)] overflow-hidden rounded-xl border shadow-lg ${styles.panel}`}
    >
      <div className={`w-1.5 shrink-0 ${styles.bar}`} />
      <div className="flex min-w-0 flex-1 items-start gap-3 px-3.5 py-3">
        <span className={`mt-0.5 shrink-0 ${styles.icon}`}>
          <ToastIcon kind={toast.kind} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${styles.title}`}>{toast.title}</p>
          {toast.description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{toast.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="알림 닫기"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback((input: ToastInput) => {
    idRef.current += 1
    const id = idRef.current
    const kind = input.kind ?? 'info'
    playToastSound(kind)
    setToasts((current) => [
      ...current.slice(-4),
      {
        id,
        title: input.title,
        description: input.description,
        kind,
        durationMs: input.durationMs ?? DEFAULT_DURATION_MS,
      },
    ])
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (title, description) => push({ title, description, kind: 'success' }),
      error: (title, description) => push({ title, description, kind: 'error', durationMs: 4500 }),
      info: (title, description) => push({ title, description, kind: 'info' }),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[200] flex max-h-[calc(100dvh-2rem)] flex-col gap-2 overflow-y-auto sm:right-6 sm:top-6">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
