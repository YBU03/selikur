'use client'
import { useRole } from '@/lib/roles'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ShoppingCart, Target, Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCatalog, useSalesBuckets, useProfile, useSchedules, useLists, defaultProfile, variantLabel, qk, useInvalidate } from '@/lib/queries'
import { forecastAll, forecastAccuracy, type StockStatus } from '@/lib/forecast'
import { nextSchedule } from '@/lib/reminders'
import { num, pct, rupiah, unitLabel, tgl } from '@/lib/format'
import { Button, Card, Chip, EmptyState, Input, Loading, MoneyInput, NumberInput, PageHeader, Segmented, Select, Sheet, StockBadge, Thumb, cx, ButtonLink } from '@/components/ui'
import { useToast, errMsg } from '@/components/Toast'
import CreateListSheet from '@/components/CreateListSheet'

export default function ForecastPage() {
  const router = useRouter()
  const toast = useToast()
  const invalidate = useInvalidate()
  const { data: profile } = useProfile()
  const prof = profile ?? defaultProfile
  const { data: products, isPending } = useCatalog()
  const { data: buckets } = useSalesBuckets()
  const { data: schedules } = useSchedules()
  const { data: lists } = useLists()

  const [coverage, setCoverage] = useState<number>(Number(prof.coverage_weeks))
  const [method, setMethod] = useState(prof.forecast_method)
  const { isAdmin } = useRole()
  const [filter, setFilter] = useState<StockStatus | 'all'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [qtyOverride, setQtyOverride] = useState<Record<string, number>>({})
  const [sheet, setSheet] = useState(false)

  useEffect(() => {
    setCoverage(Number(prof.coverage_weeks))
    setMethod(prof.forecast_method)
  }, [prof.coverage_weeks, prof.forecast_method])

  const forecasts = useMemo(
    () => forecastAll(products ?? [], buckets ?? new Map(), { ...prof, forecast_method: method }, coverage),
    [products, buckets, prof, method, coverage],
  )
  const accuracy = useMemo(() => forecastAccuracy(forecasts, method), [forecasts, method])

  useEffect(() => {
    setSelected(new Set(forecasts.filter((f) => f.need > 0).map((f) => f.variant.id)))
  }, [forecasts])

  const shown = forecasts.filter((f) => filter === 'all' || f.status === filter)
  const counts = { all: forecasts.length, kritis: 0, perlu: 0, aman: 0 } as Record<string, number>
  forecasts.forEach((f) => counts[f.status]++)
  const qtyOf = (id: string, need: number) => qtyOverride[id] ?? need
  const picked = forecasts.filter((f) => selected.has(f.variant.id) && qtyOf(f.variant.id, f.need) > 0)
  const total = picked.reduce((s, f) => s + qtyOf(f.variant.id, f.need) * f.variant.buy_price, 0)
  const noData = forecasts.length > 0 && forecasts.every((f) => f.basis === 'kosong')

  return (
    <div>
      <PageHeader title="Forecast Kebutuhan" subtitle="Rata-rata penjualan → jumlah kulakan" back="/" />

      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <NumberInput label="Minggu cakupan" hint="sampai belanja berikut" value={coverage} step={0.5} min={0.5} onChange={(n) => setCoverage(Math.max(0.5, n))} compact />
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink-700">Metode</span>
            <Segmented
              value={method}
              onChange={setMethod}
              options={[
                { value: 'sma', label: 'Rata-rata' },
                { value: 'wma', label: 'Berbobot' },
              ]}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 font-semibold text-brand-700">
            <Target className="size-3.5" /> Akurasi minggu lalu: {accuracy == null ? 'belum cukup data' : `selisih ${pct(accuracy)}`}
          </span>
          {Number(prof.seasonal_factor) !== 1 && (
            <span className="rounded-full bg-sun-50 px-2.5 py-1 font-semibold text-sun-700">
              Musiman ×{num(prof.seasonal_factor, 2)} {prof.seasonal_label ?? ''}
            </span>
          )}
        </div>
        <p className="flex gap-1.5 text-xs text-ink-500">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Kebutuhan = forecast/minggu × minggu cakupan + stok minimum − stok, dibulatkan ke satuan beli.
        </p>
      </Card>

      {noData && (
        <div className="mt-3 rounded-2xl bg-sun-50 px-4 py-3 text-sm text-sun-700">
          Belum ada data penjualan. <Link href="/penjualan" className="font-semibold underline">Input penjualan</Link> atau isi perkiraan jual/minggu di tiap varian.
        </div>
      )}

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
        {(['all', 'kritis', 'perlu', 'aman'] as const).map((s) => (
          <Chip key={s} active={filter === s} onClick={() => setFilter(s)}>
            {s === 'all' ? 'Semua' : s === 'kritis' ? 'Kritis' : s === 'perlu' ? 'Perlu Kulak' : 'Aman'} <span className="opacity-60">{counts[s]}</span>
          </Chip>
        ))}
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-2 lg:gap-3 2xl:grid-cols-3">
        {isPending && <Loading />}
        {!isPending && forecasts.length === 0 && (
          <EmptyState title="Belum ada produk aktif" text="Tambahkan produk & varian dulu." action={<ButtonLink href="/produk/baru" size="sm">Tambah produk</ButtonLink>} />
        )}
        {shown.map((f) => {
          const id = f.variant.id
          const on = selected.has(id)
          const qty = qtyOf(id, f.need)
          return (
            <div key={id} className={cx('rounded-3xl bg-white p-3 shadow-soft ring-1 transition', on ? 'ring-brand-300' : 'ring-ink-100')}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const n = new Set(selected)
                    if (on) n.delete(id)
                    else n.add(id)
                    setSelected(n)
                  }}
                  className={cx('flex size-6 shrink-0 items-center justify-center rounded-lg border-2 transition', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300')}
                  aria-label="Pilih"
                >
                  {on && <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 5 5 9-10" /></svg>}
                </button>
                <Thumb path={f.variant.photo ?? f.product.photos[0]} size={46} />
                <Link href={`/produk/detail?id=${f.product.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{variantLabel(f.product, f.variant)}</p>
                  <p className="text-xs text-ink-500">
                    Stok {num(f.variant.stock)} · {num(f.weekly, 1)}/mg{f.basis === 'manual' ? ' (manual)' : f.basis === 'kosong' ? ' (tanpa data)' : ''}
                    {f.weeksLeft != null && ` · cukup ${num(f.weeksLeft, 1)} mg`}
                  </p>
                </Link>
                <StockBadge status={f.status} />
              </div>
              {on && (
                <div className="mt-2.5 flex items-center gap-3 border-t border-ink-100 pt-2.5">
                  <div className="w-36">
                    <NumberInput compact value={qty} step={Math.max(1, f.variant.unit_size)} onChange={(n) => setQtyOverride({ ...qtyOverride, [id]: n })} />
                  </div>
                  <div className="flex-1 text-right text-xs text-ink-500">
                    <p>{unitLabel(qty, f.variant.unit, f.variant.unit_size)}</p>
                    {isAdmin && <p className="font-semibold text-ink-800">{rupiah(qty * f.variant.buy_price)}</p>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {isAdmin && picked.length > 0 && (
        <div className="sticky bottom-28 z-10 mt-4">
          <Button block size="lg" onClick={() => setSheet(true)}>
            <ShoppingCart className="size-5" /> Buat daftar belanja · {picked.length} item · {rupiah(total)}
          </Button>
        </div>
      )}

      <CreateListSheet
        open={sheet}
        onClose={() => setSheet(false)}
        total={total}
        defaultBudget={prof.default_budget}
        schedules={(schedules ?? []).filter((s) => !(lists ?? []).some((l) => l.schedule_id === s.id))}
        nextDate={nextSchedule(schedules)?.date}
        onCreate={async ({ title, budget, scheduleId }) => {
          try {
            const { data: list, error } = await supabase
              .from('shopping_lists')
              .insert({ title, budget: budget || null, schedule_id: scheduleId || null })
              .select()
              .single()
            if (error) throw error
            const rows = picked.map((f, i) => ({
              list_id: list.id,
              variant_id: f.variant.id,
              supplier_id: f.product.supplier_id,
              qty_planned: qtyOf(f.variant.id, f.need),
              price_planned: f.variant.buy_price,
              sort_order: i,
            }))
            const { error: e2 } = await supabase.from('shopping_items').insert(rows)
            if (e2) throw e2
            if (coverage !== Number(prof.coverage_weeks) || method !== prof.forecast_method)
              await supabase.from('store_settings').update({ coverage_weeks: coverage, forecast_method: method }).eq('id', 1)
            await invalidate(qk.lists, qk.profile)
            toast('Daftar belanja dibuat')
            router.push(`/belanja/detail?id=${list.id}`)
          } catch (e) {
            toast(errMsg(e), 'error')
          }
        }}
      />
    </div>
  )
}

