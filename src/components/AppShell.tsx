'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Package, Camera, ShoppingBasket, LayoutGrid, CloudOff, RefreshCw } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { onOutboxChange, flush } from '@/lib/outbox'
import { cx, Spinner } from './ui'
import { useReminders } from '@/lib/reminders'

const tabs = [
  { href: '/', label: 'Beranda', icon: Home, match: (p: string) => p === '/' },
  { href: '/produk', label: 'Produk', icon: Package, match: (p: string) => p.startsWith('/produk') },
  { href: '/tangkap', label: 'Foto', icon: Camera, fab: true, match: (p: string) => p.startsWith('/tangkap') },
  { href: '/belanja', label: 'Belanja', icon: ShoppingBasket, match: (p: string) => p.startsWith('/belanja') },
  {
    href: '/menu',
    label: 'Lainnya',
    icon: LayoutGrid,
    match: (p: string) => ['/menu', '/forecast', '/penjualan', '/jadwal', '/rekap', '/pengaturan'].some((x) => p.startsWith(x)),
  },
]

export function BottomNav() {
  const path = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 pb-[var(--safe-bottom)]">
      <div className="mx-auto max-w-xl px-3 pb-3">
        <div className="flex items-end justify-around rounded-[1.75rem] bg-white/95 px-2 pt-2 pb-2 shadow-[0_-2px_30px_-8px_rgb(8_62_50/0.18)] ring-1 ring-ink-100 backdrop-blur-xl">
          {tabs.map((t) => {
            const active = t.match(path)
            const Icon = t.icon
            if (t.fab)
              return (
                <Link key={t.href} href={t.href} aria-label="Foto produk baru" className="-mt-7 flex flex-col items-center">
                  <span className="flex size-15 items-center justify-center rounded-full bg-gradient-to-br from-sun-400 to-sun-600 text-white shadow-sun ring-4 ring-white transition active:scale-95">
                    <Icon className="size-7" strokeWidth={2.2} />
                  </span>
                  <span className="mt-1 text-[11px] font-semibold text-sun-600">{t.label}</span>
                </Link>
              )
            return (
              <Link key={t.href} href={t.href} className="flex w-16 flex-col items-center gap-1 py-1">
                <span className={cx('flex h-8 w-12 items-center justify-center rounded-full transition', active ? 'bg-brand-50 text-brand-700' : 'text-ink-400')}>
                  <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className={cx('text-[11px] font-semibold', active ? 'text-brand-800' : 'text-ink-400')}>{t.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

function StatusBar() {
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  useEffect(() => {
    setOnline(navigator.onLine)
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    const unsub = onOutboxChange(setPending)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
      unsub()
    }
  }, [])
  if (online && pending === 0) return null
  return (
    <div className="sticky top-0 z-40 -mx-4 flex items-center justify-center gap-2 bg-ink-900 px-4 py-1.5 text-xs font-medium text-white">
      {!online ? (
        <>
          <CloudOff className="size-3.5" /> Offline — data tersimpan di HP{pending ? `, ${pending} perubahan menunggu sinkron` : ''}
        </>
      ) : (
        <button onClick={() => flush()} className="flex items-center gap-2">
          <RefreshCw className="size-3.5 animate-spin" /> Menyinkronkan {pending} perubahan…
        </button>
      )}
    </div>
  )
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const qc = useQueryClient()
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_OUT') qc.clear()
    })
    return () => sub.subscription.unsubscribe()
  }, [qc])

  useEffect(() => {
    if (session === null) router.replace('/masuk')
  }, [session, router])

  if (!session)
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-7" />
      </div>
    )
  return <>{children}</>
}

function Reminders() {
  useReminders()
  return null
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <Reminders />
      <div className="pb-nav mx-auto min-h-dvh max-w-xl px-4">
        <StatusBar />
        {children}
      </div>
      <BottomNav />
    </AuthGuard>
  )
}
