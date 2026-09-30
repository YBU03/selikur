'use client'
import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'

type Kind = 'success' | 'error' | 'info'
interface T {
  id: number
  kind: Kind
  text: string
}
const Ctx = createContext<(text: string, kind?: Kind) => void>(() => {})

export function useToast() {
  return useContext(Ctx)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<T[]>([])
  const push = useCallback((text: string, kind: Kind = 'success') => {
    const id = Date.now() + Math.random()
    setItems((s) => [...s, { id, kind, text }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3200)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className="animate-sheet pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-2xl bg-ink-900/95 px-4 py-3 text-sm font-medium text-white shadow-lift backdrop-blur"
          >
            {t.kind === 'success' && <CheckCircle2 className="size-4.5 shrink-0 text-leaf-400" />}
            {t.kind === 'error' && <AlertCircle className="size-4.5 shrink-0 text-sun-400" />}
            {t.kind === 'info' && <Info className="size-4.5 shrink-0 text-brand-200" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function errMsg(e: unknown) {
  const m = (e as { message?: string })?.message ?? String(e)
  if (/fetch|network/i.test(m)) return 'Tidak ada koneksi internet'
  if (/duplicate key/i.test(m)) return 'Data dengan nama itu sudah ada'
  return m
}
