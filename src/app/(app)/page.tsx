'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useMemo } from 'react'
import { differenceInCalendarDays, parseISO, startOfMonth, subMonths } from 'date-fns'
import { Camera, CalendarClock, ChevronRight, LineChart, ClipboardList, BarChart3, Settings, TrendingUp, TrendingDown, AlertTriangle, Sparkles, Percent } from 'lucide-react'
import { useCatalog, useSalesBuckets, useProfile, useSchedules, useLists, defaultProfile, variantLabel } from '@/lib/queries'
import { forecastAll } from '@/lib/forecast'
import { nextSchedule } from '@/lib/reminders'
import { rupiah, num, tglPanjang, pct } from '@/lib/format'
import StarterImport from '@/components/StarterImport'
import { Card, SectionTitle, StockBadge, Thumb, Skeleton, cx } from '@/components/ui'

export default function Beranda() {
  const { data: profile } = useProfile()
  const { data: products, isPending } = useCatalog()
  const { data: buckets } = useSalesBuckets()
  const { data: schedules } = useSchedules()
  const { data: lists } = useLists()
  const p = profile ?? defaultProfile

  const forecasts = useMemo(() => forecastAll(products ?? [], buckets ?? new Map(), p), [products, buckets, p])
  const kritis = forecasts.filter((f) => f.status === 'kritis')
  const perlu = forecasts.filter((f) => f.status !== 'aman')
  const estCost = perlu.reduce((s, f) => s + f.need * f.variant.buy_price, 0)
  const candidates = (products ?? []).filter((x) => x.status === 'candidate').length
  const active = (products ?? []).filter((x) => x.status === 'active').length

  const done = new Set((lists ?? []).filter((l) => l.status === 'done' && l.schedule_id).map((l) => l.schedule_id!))
  const next = nextSchedule(schedules, done)
  const nextList = next ? lists?.find((l) => l.schedule_id === next.schedule.id && l.status !== 'done') : undefined
  const daysTo = next ? differenceInCalendarDays(parseISO(next.date), new Date()) : null

  const thisMonth = startOfMonth(new Date())
  const lastMonth = subMonths(thisMonth, 1)
  const spent = (from: Date, to: Date) =>
    (lists ?? [])
      .filter((l) => l.status === 'done' && l.completed_at && parseISO(l.completed_at) >= from && parseISO(l.completed_at) < to)
      .reduce((s, l) => s + Number(l.actual_total), 0)
  const spentNow = spent(thisMonth, new Date(8640000000000000))
  const spentPrev = spent(lastMonth, thisMonth)
  const change = spentPrev > 0 ? (spentNow - spentPrev) / spentPrev : null
  const activeList = lists?.find((l) => l.status === 'in_progress')

  const hour = new Date().getHours()
  const greet = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 19 ? 'Selamat sore' : 'Selamat malam'

  return (
    <div className="pt-[max(env(safe-area-inset-top),1rem)]">
      <header className="mb-5 flex items-center gap-3">
        <Image src="/logo-mark.png" alt="" width={44} height={44} className="rounded-2xl shadow-soft ring-1 ring-ink-100" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-500">{greet},</p>
          <p className="truncate text-lg font-bold tracking-tight">{p.store_name}</p>
        </div>
        <Link href="/pengaturan" aria-label="Pengaturan" className="inline-flex size-10 items-center justify-center rounded-full text-ink-700 hover:bg-ink-100">
          <Settings className="size-5" />
        </Link>
      </header>

      {!isPending && (products ?? []).length === 0 && (
        <div className="mb-4">
          <StarterImport />
        </div>
      )}

      {activeList && (
        <Link href={`/belanja/detail?id=${activeList.id}&mode=belanja`} className="mb-4 flex items-center gap-3 rounded-3xl bg-leaf-500 px-4 py-3 text-white shadow-lift">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-white" />
          </span>
          <span className="flex-1 text-sm font-semibold">Belanja sedang berjalan: {activeList.title}</span>
          <ChevronRight className="size-5" />
        </Link>
      )}

      {/* Hero kebutuhan kulakan */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-5 text-white shadow-lift">
        <div className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-leaf-500/30 blur-2xl" />
        <svg className="pointer-events-none absolute right-4 bottom-4 h-16 w-28 text-leaf-400/40" viewBox="0 0 120 60" fill="none">
          <rect x="10" y="38" width="14" height="18" rx="3" fill="currentColor" />
          <rect x="34" y="26" width="14" height="30" rx="3" fill="currentColor" />
          <rect x="58" y="14" width="14" height="42" rx="3" fill="currentColor" />
          <path d="M8 30 C40 28 70 10 110 4" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        </svg>
        <p className="text-sm font-medium text-brand-100">Kebutuhan kulakan</p>
        {isPending ? (
          <Skeleton className="mt-2 h-9 w-40 bg-white/10" />
        ) : (
          <p className="mt-1 text-3xl font-extrabold tracking-tight tabular-nums">{rupiah(estCost)}</p>
        )}
        <div className="mt-3 flex gap-2 text-xs font-semibold">
          <span className="rounded-full bg-red-500/90 px-2.5 py-1">{kritis.length} kritis</span>
          <span className="rounded-full bg-sun-500/90 px-2.5 py-1">{perlu.length - kritis.length} perlu kulak</span>
          <span className="rounded-full bg-white/15 px-2.5 py-1">{forecasts.length - perlu.length} aman</span>
        </div>
        <Link href="/forecast" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-800 transition active:scale-95">
          Lihat forecast & buat daftar <ChevronRight className="size-4" />
        </Link>
      </div>

      {/* Tombol kamera besar */}
      <Link
        href="/tangkap"
        className="mt-4 flex items-center gap-4 rounded-[2rem] bg-gradient-to-r from-sun-400 to-sun-600 p-4 text-white shadow-sun transition active:scale-[0.99]"
      >
        <span className="flex size-14 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30">
          <Camera className="size-7" strokeWidth={2.2} />
        </span>
        <span className="flex-1">
          <span className="block text-lg font-bold">Foto Produk Baru</span>
          <span className="block text-sm text-white/85">Catat temuan di pasar — bisa tanpa sinyal</span>
        </span>
        <ChevronRight className="size-6" />
      </Link>

      {/* Jadwal berikutnya */}
      <SectionTitle action={<Link href="/jadwal" className="text-sm font-semibold text-brand-700">Kalender</Link>}>Jadwal belanja</SectionTitle>
      {next ? (
        <Card className="flex items-center gap-4">
          <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-50 text-brand-800">
            <span className="text-[11px] font-semibold uppercase">{tglPanjang(next.date, 'MMM')}</span>
            <span className="text-xl leading-none font-extrabold">{tglPanjang(next.date, 'd')}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{next.schedule.title}</p>
            <p className="truncate text-sm text-ink-500">
              {daysTo === 0 ? 'Hari ini' : daysTo === 1 ? 'Besok' : `${daysTo} hari lagi`}
              {next.schedule.location ? ` · ${next.schedule.location}` : ''}
            </p>
            {kritis.length > 0 && daysTo !== null && daysTo <= 3 && (
              <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-600">
                <AlertTriangle className="size-3.5" /> {kritis.length} varian kritis sebelum jadwal
              </p>
            )}
          </div>
          {nextList ? (
            <Link href={`/belanja/detail?id=${nextList.id}`} className="rounded-full bg-brand-700 px-3.5 py-2 text-sm font-semibold text-white">
              Daftar
            </Link>
          ) : (
            <Link href="/forecast" className="rounded-full bg-brand-50 px-3.5 py-2 text-sm font-semibold text-brand-800">
              Siapkan
            </Link>
          )}
        </Card>
      ) : (
        <Link href="/jadwal?baru=1">
          <Card className="flex items-center gap-3 text-ink-600">
            <CalendarClock className="size-5 text-brand-600" />
            <span className="flex-1 text-sm">Belum ada jadwal. Atur jadwal kulakan agar tidak lupa.</span>
            <ChevronRight className="size-5 text-ink-400" />
          </Card>
        </Link>
      )}

      {/* Statistik */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Link href="/rekap">
          <Card className="h-full">
            <p className="text-xs font-medium text-ink-500">Belanja bulan ini</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{rupiah(spentNow)}</p>
            {change != null && (
              <p className={cx('mt-0.5 flex items-center gap-1 text-xs font-semibold', change > 0 ? 'text-sun-600' : 'text-leaf-600')}>
                {change > 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                {pct(Math.abs(change))} vs bln lalu
              </p>
            )}
          </Card>
        </Link>
        <Link href="/produk">
          <Card className="h-full">
            <p className="text-xs font-medium text-ink-500">Katalog</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{num(active)} aktif</p>
            {candidates > 0 && (
              <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-sun-600">
                <Sparkles className="size-3.5" /> {candidates} kandidat
              </p>
            )}
          </Card>
        </Link>
      </div>

      {/* Varian kritis */}
      {perlu.length > 0 && (
        <>
          <SectionTitle action={<Link href="/forecast" className="text-sm font-semibold text-brand-700">Semua</Link>}>Perlu perhatian</SectionTitle>
          <Card className="divide-y divide-ink-100 p-0">
            {perlu.slice(0, 5).map((f) => (
              <Link key={f.variant.id} href={`/produk/detail?id=${f.product.id}`} className="flex items-center gap-3 px-4 py-3">
                <Thumb path={f.variant.photo ?? f.product.photos[0]} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{variantLabel(f.product, f.variant)}</p>
                  <p className="text-xs text-ink-500">
                    Stok {num(f.variant.stock)} · butuh <b className="text-ink-800">{num(f.need)}</b>
                  </p>
                </div>
                <StockBadge status={f.status} />
              </Link>
            ))}
          </Card>
        </>
      )}

      <SectionTitle>Menu cepat</SectionTitle>
      <div className="grid grid-cols-4 gap-2">
        {[
          { href: '/penjualan', icon: ClipboardList, label: 'Input Jual', tone: 'bg-brand-50 text-brand-700' },
          { href: '/forecast', icon: LineChart, label: 'Forecast', tone: 'bg-leaf-500/10 text-leaf-600' },
          { href: '/harga', icon: Percent, label: 'Harga Jual', tone: 'bg-sun-50 text-sun-600' },
          { href: '/rekap', icon: BarChart3, label: 'Rekap', tone: 'bg-ink-100 text-ink-700' },
        ].map((m) => (
          <Link key={m.href} href={m.href} className="flex flex-col items-center gap-1.5 rounded-2xl py-2 transition active:scale-95">
            <span className={cx('flex size-13 items-center justify-center rounded-2xl', m.tone)}>
              <m.icon className="size-6" />
            </span>
            <span className="text-xs font-semibold text-ink-700">{m.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
