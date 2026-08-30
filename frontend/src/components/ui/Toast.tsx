import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/cn'

type ToastTone = 'success' | 'error' | 'info'

interface Toast {
  id: number
  tone: ToastTone
  message: string
}

interface ToastContextValue {
  push: (message: string, tone?: ToastTone) => void
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const TONE_STYLES: Record<ToastTone, { className: string; icon: ReactNode }> = {
  success: {
    className: 'border-emerald-500/35 bg-emerald-500/12 text-emerald-100',
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden />,
  },
  error: {
    className: 'border-red-500/40 bg-red-500/12 text-red-100',
    icon: <AlertTriangle className="h-4 w-4 text-red-300" aria-hidden />,
  },
  info: {
    className: 'border-cyan-400/35 bg-cyan-400/12 text-cyan-50',
    icon: <Info className="h-4 w-4 text-cyan-300" aria-hidden />,
  },
}

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = nextId++
      setToasts((current) => [...current.slice(-3), { id, tone, message }])
      window.setTimeout(() => dismiss(id), 5000)
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (message: string) => push(message, 'success'),
      error: (message: string) => push(message, 'error'),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-5 right-5 z-100 flex w-[min(22rem,calc(100vw-2.5rem))] flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] shadow-card backdrop-blur-md animate-fade-up',
              TONE_STYLES[toast.tone].className,
            )}
          >
            <span className="mt-0.5 shrink-0">{TONE_STYLES[toast.tone].icon}</span>
            <p className="min-w-0 flex-1 break-words">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded-md p-1 opacity-60 transition hover:bg-white/10 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside <ToastProvider>')
  return context
}
