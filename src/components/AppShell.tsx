'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Home, Package, Camera, ShoppingBasket, LayoutGrid, CloudOff, RefreshCw, Hourglass, ShieldX, LogOut, Lock, LineChart, ClipboardList, Percent, CalendarDays, BarChart3, Users, Settings } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { onOutboxChange, flush } from '@/lib/outbox'
import { Button, cx, Spinner } from './ui'
import { useMe, useProfile } from '@/lib/queries'
import { ROLE_LABEL } from '@/lib/types'
import { useRole } from '@/lib/roles'
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
    match: (p: string) => ['/menu', '/forecast', '/penjualan', '/jadwal', '/rekap', '/pengaturan', '/harga', '/pengguna'].some((x) => p.startsWith(x)),
  },
]

const PREFETCH = ['/', '/produk', '/belanja', '/menu', '/forecast', '/penjualan', '/harga', '/jadwal', '/rekap', '/pengaturan', '/tangkap']

/**
 * Path aktif yang langsung berpindah saat tab diketuk (sebelum halaman baru
 * selesai dimuat), supaya navigasi terasa instan. Rute utama juga di-prefetch
 * saat browser senggang.
 */
function useNavPath() {
  const path = usePathname()
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  useEffect(() => setPending(null), [path])
  useEffect(() => {
    const run = () => PREFETCH.forEach((h) => router.prefetch(h))
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number }
    if (w.requestIdleCallback) w.requestIdleCallback(run)
    else setTimeout(run, 1200)
  }, [router])
  return { path: pending ?? path, go: (href: string) => href !== path && setPending(href) }
}

export function BottomNav() {
  const { path, go } = useNavPath()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 pb-[var(--safe-bottom)] lg:hidden">
      <div className="mx-auto max-w-xl px-3 pb-3">
        <div className="flex items-end justify-around rounded-[1.75rem] bg-white px-2 pt-2 pb-2 shadow-[0_-2px_30px_-8px_rgb(8_62_50/0.18)] ring-1 ring-ink-100">
          {tabs.map((t) => {
            const active = t.match(path)
            const Icon = t.icon
            if (t.fab)
              return (
                <Link key={t.href} href={t.href} onClick={() => go(t.href)} aria-label="Foto produk baru" className="-mt-7 flex flex-col items-center">
                  <span className="flex size-15 items-center justify-center rounded-full bg-gradient-to-br from-sun-400 to-sun-600 text-white shadow-sun ring-4 ring-white transition active:scale-95">
                    <Icon className="size-7" strokeWidth={2.2} />
                  </span>
                  <span className="mt-1 text-[11px] font-semibold text-sun-600">{t.label}</span>
                </Link>
              )
            return (
              <Link key={t.href} href={t.href} onClick={() => go(t.href)} className="flex w-16 flex-col items-center gap-1 py-1">
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
    <div className="sticky top-0 z-40 -mx-4 flex items-center lg:-mx-8 justify-center gap-2 bg-ink-900 px-4 py-1.5 text-xs font-medium text-white">
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
      if (event === 'SIGNED_IN') void qc.invalidateQueries({ queryKey: ['me'] })
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
  return <MemberGate>{children}</MemberGate>
}

/** Akun baru harus disetujui admin sebelum bisa melihat data toko. */
function MemberGate({ children }: { children: React.ReactNode }) {
  const { data: me, isPending, refetch, isFetching, error } = useMe()
  const router = useRouter()
  if (isPending && !me)
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-7" />
      </div>
    )
  if (me?.status === 'approved') return <>{children}</>
  const offline = !me && !!error
  const pending = !offline && (!me || me.status === 'pending')
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-brand-900 to-brand-700 px-6 text-center text-white">
      <div className="rounded-[1.75rem] bg-white p-2.5 shadow-lift">
        <Image src="/logo-mark.png" alt="Selikur" width={64} height={64} className="rounded-2xl" />
      </div>
      <div className="mt-6 flex size-14 items-center justify-center rounded-2xl bg-white/15">
        {offline ? <CloudOff className="size-7" /> : pending ? <Hourglass className="size-7" /> : <ShieldX className="size-7" />}
      </div>
      <h1 className="mt-4 text-2xl font-extrabold">{offline ? 'Gagal memuat akun' : pending ? 'Menunggu persetujuan' : 'Akses tidak aktif'}</h1>
      <p className="mt-2 max-w-xs text-brand-100">
        {offline
          ? 'Periksa koneksi internet lalu coba lagi.'
          : pending
          ? `Halo ${me?.full_name ?? ''}, akun kamu sudah terdaftar. Minta admin toko menyetujui akunmu di menu Kelola Pengguna.`
          : me?.status === 'rejected'
            ? 'Pendaftaran akun ini ditolak admin. Hubungi admin toko jika ini keliru.'
            : 'Akun ini dinonaktifkan admin. Hubungi admin toko untuk mengaktifkan kembali.'}
      </p>
      {me?.email && <p className="mt-3 rounded-full bg-white/10 px-3 py-1 text-sm">{me.email}</p>}
      <div className="mt-8 flex w-full max-w-xs flex-col gap-2">
        <Button variant="accent" loading={isFetching} onClick={() => refetch()}>
          <RefreshCw className="size-4" /> Cek lagi
        </Button>
        <Button
          variant="ghost"
          className="text-white hover:bg-white/10"
          onClick={async () => {
            await supabase.auth.signOut()
            router.replace('/masuk')
          }}
        >
          <LogOut className="size-4" /> Keluar
        </Button>
      </div>
    </div>
  )
}

/** Bungkus halaman yang hanya boleh dibuka admin / super admin. */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useRole()
  if (loading) return <Spinner className="mx-auto mt-20 size-7" />
  if (!isAdmin)
    return (
      <div className="flex flex-col items-center px-6 pt-24 text-center">
        <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">
          <Lock className="size-7" />
        </div>
        <p className="font-semibold">Khusus admin</p>
        <p className="mt-1 max-w-xs text-sm text-ink-500">Halaman ini hanya bisa dibuka Admin atau Super Admin.</p>
        <Link href="/" className="mt-4 text-sm font-semibold text-brand-700">
          Kembali ke Beranda
        </Link>
      </div>
    )
  return <>{children}</>
}

function Reminders() {
  useReminders()
  return null
}

type SideItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; admin?: boolean; match?: (p: string) => boolean }

const sideGroups: { title: string; admin?: boolean; items: SideItem[] }[] = [
  {
    title: 'Utama',
    items: [
      { href: '/', label: 'Beranda', icon: Home, match: (p) => p === '/' },
      { href: '/produk', label: 'Katalog produk', icon: Package },
      { href: '/tangkap', label: 'Foto produk baru', icon: Camera },
    ],
  },
  {
    title: 'Perencanaan',
    items: [
      { href: '/forecast', label: 'Forecast', icon: LineChart },
      { href: '/penjualan', label: 'Penjualan', icon: ClipboardList },
      { href: '/harga', label: 'Harga & promo', icon: Percent, admin: true },
    ],
  },
  {
    title: 'Belanja',
    items: [
      { href: '/belanja', label: 'Daftar belanja', icon: ShoppingBasket },
      { href: '/jadwal', label: 'Jadwal', icon: CalendarDays },
      { href: '/rekap', label: 'Rekap & laporan', icon: BarChart3, admin: true },
    ],
  },
  {
    title: 'Admin',
    admin: true,
    items: [
      { href: '/pengguna', label: 'Kelola pengguna', icon: Users, admin: true },
      { href: '/pengaturan', label: 'Pengaturan', icon: Settings, admin: true },
    ],
  },
]

/** Navigasi samping untuk layar lebar (desktop / tablet landscape). */
function Sidebar() {
  const { path, go } = useNavPath()
  const router = useRouter()
  const { isAdmin, me } = useRole()
  const { data: store } = useProfile()
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-gradient-to-b from-brand-900 to-brand-800 text-white lg:flex">
      <Link href="/" className="flex items-center gap-3 px-5 pt-6 pb-5">
        <span className="rounded-2xl bg-white p-1.5 shadow-lift">
          <Image src="/logo-mark.png" alt="" width={36} height={36} className="rounded-xl" />
        </span>
        <span className="min-w-0">
          <span className="block text-lg leading-tight font-extrabold tracking-tight">Selikur</span>
          <span className="block truncate text-xs text-brand-200">{store?.store_name ?? 'Kulakan cerdas'}</span>
        </span>
      </Link>
      <Link
        href="/tangkap"
        className="mx-4 mb-4 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sun-400 to-sun-600 py-3 text-sm font-bold shadow-sun transition hover:brightness-105"
      >
        <Camera className="size-4.5" /> Foto produk
      </Link>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {sideGroups
          .filter((g) => !g.admin || isAdmin)
          .map((g) => (
            <div key={g.title}>
              <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-brand-300 uppercase">{g.title}</p>
              {g.items
                .filter((it) => !it.admin || isAdmin)
                .map((it) => {
                  const active = it.match ? it.match(path) : path.startsWith(it.href)
                  const I = it.icon
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      onClick={() => go(it.href)}
                      className={cx(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                        active ? 'bg-white text-brand-900 shadow-soft' : 'text-brand-100 hover:bg-white/10 hover:text-white',
                      )}
                    >
                      <I className="size-4.5" /> {it.label}
                    </Link>
                  )
                })}
            </div>
          ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-semibold">{me?.full_name ?? me?.email}</p>
        <p className="truncate text-xs text-brand-200">{me ? ROLE_LABEL[me.role] : ''}</p>
        <button
          onClick={async () => {
            await supabase.auth.signOut()
            router.replace('/masuk')
          }}
          className="mt-3 flex items-center gap-2 text-xs font-semibold text-brand-200 hover:text-white"
        >
          <LogOut className="size-3.5" /> Keluar
        </button>
      </div>
    </aside>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <Reminders />
      <Sidebar />
      <div className="lg:pl-64">
        <div className="pb-nav mx-auto min-h-dvh max-w-xl px-4 lg:max-w-7xl lg:px-8 lg:pb-12">
          <StatusBar />
          {children}
        </div>
      </div>
      <BottomNav />
    </AuthGuard>
  )
}
