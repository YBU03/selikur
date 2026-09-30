'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ShoppingCart, Info, Wand2, Eraser } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCatalog, useSuppliers, useSchedules, useLists, useProfile, useSalesBuckets, defaultProfile, qk, useInvalidate } from '@/lib/queries'
import { movingAverage } from '@/lib/forecast'
import { nextSchedule } from '@/lib/reminders'
import { num, rupiah, unitLabel } from '@/lib/format'
import { AdminOnly } from '@/components/AppShell'
import { Button, Card, Chip, EmptyState, Input, Loading, NumberInput, PageHeader, Thumb, cx } from '@/components/ui'
import CreateListSheet from '@/components/CreateListSheet'
import { useToast, errMsg } from '@/components/Toast'

/**
 * Belanja manual: pilih barang & jumlah sendiri — cocok bila penjualan dibaca
 * langsung dari TikTok/marketplace dan belum dicatat di aplikasi.
 */
function BelanjaManual() {
  const router = useRouter()
  const toast = useToast()
  const invalidate = useInvalidate()
  const { data: products, isPending } = useCatalog()
  const { data: suppliers } = useSuppliers()
  const { data: schedules } = useSchedules()
  const { data: lists } = useLists()
  const { data: buckets } = useSalesBuckets()
  const { data: profile } = useProfile()
  const prof = profile ?? defaultProfile
  const [q, setQ] = useState('')
  const [sup, setSup] = useState<string>('all')
  const [onlyLow, setOnlyLow] = useState(false)
  const [qty, setQty] = useState<Record<string, number>>({})
  const [sheet, setSheet] = useState(false)

  const supName = useMemo(() => new Map((suppliers ?? []).map((s) => [s.id, s.name])), [suppliers])
  const list = useMemo(
    () =>
      (products ?? [])
        .filter((p) => p.status !== 'inactive' && p.variants.length && !p._pending)
        .filter((p) => sup === 'all' || (sup === '-' ? !p.supplier_id : p.supplier_id === sup))
        .filter((p) => !q || `${p.name} ${p.variants.map((v) => `${v.name} ${v.sku ?? ''}`).join(' ')}`.toLowerCase().includes(q.toLowerCase()))
        .filter((p) => !onlyLow || p.variants.some((v) => v.stock <= v.min_stock))
        .sort((a, b) => a.name.localeCompare(b.name, 'id')),
    [products, sup, q, onlyLow],
  )

  const allVariants = useMemo(() => (products ?? []).flatMap((p) => p.variants.map((v) => ({ p, v }))), [products])
  const picked = allVariants.filter(({ v }) => (qty[v.id] ?? 0) > 0)
  const total = picked.reduce((s, { v }) => s + (qty[v.id] ?? 0) * v.buy_price, 0)
  const pcs = picked.reduce((s, { v }) => s + (qty[v.id] ?? 0), 0)

  /** Bantuan cepat tanpa data penjualan: isi sampai stok minimum (dibulatkan ke satuan beli). */
  function fillToMin() {
    const next: Record<string, number> = { ...qty }
    let n = 0
    for (const { v } of allVariants) {
      const gap = v.min_stock - v.stock
      if (gap > 0) {
        const size = Math.max(1, v.unit_size)
        next[v.id] = Math.ceil(gap / size) * size
        n++
      }
    }
    setQty(next)
    toast(n ? `${n} varian diisi sampai stok minimum` : 'Semua stok sudah di atas minimum', n ? 'success' : 'info')
  }

  const suppliersUsed = [...new Set((products ?? []).map((p) => p.supplier_id ?? '-'))]

  return (
    <div>
      <PageHeader title="Belanja Manual" subtitle="Pilih barang & jumlah sendiri" back="/belanja" />

      <Card className="flex gap-3 bg-brand-50/60 ring-brand-100">
        <Info className="mt-0.5 size-5 shrink-0 text-brand-700" />
        <p className="text-sm text-ink-700">
          Tidak perlu data penjualan. Cocok kalau kamu membaca penjualan langsung dari TikTok Shop / marketplace. Isi jumlah yang mau dikulak, lalu buat daftar belanja.
          Kalau data penjualan sudah dicatat, kamu tetap bisa pakai <b>Forecast</b> untuk daftar otomatis.
        </p>
      </Card>

      <div className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-ink-400" />
          <Input className="pl-11" placeholder="Cari produk / varian / SKU" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
        <Chip active={sup === 'all'} onClick={() => setSup('all')}>
          Semua supplier
        </Chip>
        {suppliersUsed.map((id) => (
          <Chip key={id} active={sup === id} onClick={() => setSup(id)}>
            {id === '-' ? 'Tanpa supplier' : supName.get(id) ?? 'Supplier'}
          </Chip>
        ))}
        <Chip active={onlyLow} onClick={() => setOnlyLow(!onlyLow)}>
          Stok ≤ minimum
        </Chip>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="soft" onClick={fillToMin}>
          <Wand2 className="size-4" /> Isi sampai stok minimum
        </Button>
        {picked.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setQty({})}>
            <Eraser className="size-4" /> Kosongkan
          </Button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {isPending && <Loading />}
        {!isPending && list.length === 0 && <EmptyState title="Tidak ada produk" text="Ubah pencarian atau filter supplier." />}
        {list.map((p, idx) => (
          <Card key={p.id} className="p-3">
            <div className="mb-2 flex items-center gap-2.5">
              <div className="relative">
                <Thumb path={p.photos[0]} size={40} />
                <span className="absolute -top-1.5 -left-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-700 px-1 text-[10px] font-bold text-white ring-2 ring-white">{idx + 1}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.name}</p>
                <p className="truncate text-xs text-ink-500">
                  {p.supplier_id ? supName.get(p.supplier_id) : 'Tanpa supplier'} · {rupiah(p.variants[0].buy_price)}/pcs
                </p>
              </div>
            </div>
            <div className="divide-y divide-ink-100">
              {p.variants.map((v) => {
                const n = qty[v.id] ?? 0
                const weekly = movingAverage(buckets?.get(v.id) ?? [], prof.forecast_method)
                const low = v.stock <= v.min_stock
                return (
                  <div key={v.id} className={cx('flex items-center gap-3 py-2', n > 0 && 'bg-brand-50/50')}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{v.name}</p>
                      <p className={cx('text-xs', low ? 'font-semibold text-red-600' : 'text-ink-400')}>
                        stok {num(v.stock)}
                        {v.min_stock > 0 && ` / min ${num(v.min_stock)}`}
                        {weekly > 0 && <span className="font-normal text-ink-400"> · laku {num(weekly, 1)}/mg</span>}
                      </p>
                      {n > 0 && v.unit_size > 1 && <p className="text-[11px] text-brand-700">{unitLabel(n, v.unit, v.unit_size)}</p>}
                    </div>
                    <div className="w-32">
                      <NumberInput compact value={n} step={Math.max(1, v.unit_size)} onChange={(x) => setQty({ ...qty, [v.id]: Math.max(0, x) })} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        ))}
      </div>

      {picked.length > 0 && (
        <div className="sticky bottom-28 z-10 mt-4 lg:bottom-6">
          <Button block size="lg" onClick={() => setSheet(true)}>
            <ShoppingCart className="size-5" /> Buat daftar · {picked.length} item · {num(pcs)} pcs · {rupiah(total)}
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
            const rows = picked.map(({ p, v }, i) => ({
              list_id: list.id,
              variant_id: v.id,
              supplier_id: p.supplier_id,
              qty_planned: qty[v.id],
              price_planned: v.buy_price,
              sort_order: i,
            }))
            const { error: e2 } = await supabase.from('shopping_items').insert(rows)
            if (e2) throw e2
            await invalidate(qk.lists)
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

export default function Page() {
  return (
    <AdminOnly>
      <BelanjaManual />
    </AdminOnly>
  )
}
