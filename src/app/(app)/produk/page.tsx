'use client'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Search, Plus, SlidersHorizontal, Sparkles, CloudOff, FileSpreadsheet } from 'lucide-react'
import { useCatalog, useCategories, useSuppliers, useSalesBuckets, useProfile, defaultProfile } from '@/lib/queries'
import { forecastVariant, type StockStatus } from '@/lib/forecast'
import { STATUS_LABEL, type ProductStatus } from '@/lib/types'
import { num, rupiah } from '@/lib/format'
import { Badge, Button, ButtonLink, Chip, EmptyState, Input, PageHeader, Select, Sheet, Skeleton, StockBadge, Thumb, cx } from '@/components/ui'
import { exportCatalogExcel } from '@/lib/exporters'
import { useToast } from '@/components/Toast'

function Catalog() {
  const params = useSearchParams()
  const toast = useToast()
  const { data: products, isPending } = useCatalog()
  const { data: categories } = useCategories()
  const { data: suppliers } = useSuppliers()
  const { data: buckets } = useSalesBuckets()
  const { data: profile } = useProfile()
  const prof = profile ?? defaultProfile
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<ProductStatus | 'all'>((params.get('status') as ProductStatus) ?? 'all')
  const [cat, setCat] = useState('')
  const [sup, setSup] = useState('')
  const [filters, setFilters] = useState(false)
  const [limit, setLimit] = useState(40)
  const sentinel = useRef<HTMLDivElement>(null)

  const catName = useMemo(() => new Map(categories?.map((c) => [c.id, c.name])), [categories])
  const supName = useMemo(() => new Map(suppliers?.map((s) => [s.id, s.name])), [suppliers])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (products ?? [])
      .filter((p) => status === 'all' || p.status === status)
      .filter((p) => !cat || p.category_id === cat)
      .filter((p) => !sup || p.supplier_id === sup)
      .filter(
        (p) =>
          !term ||
          p.name.toLowerCase().includes(term) ||
          p.variants.some((v) => v.name.toLowerCase().includes(term) || v.sku?.toLowerCase().includes(term)) ||
          (p.supplier_id && supName.get(p.supplier_id)?.toLowerCase().includes(term)) ||
          (p.category_id && catName.get(p.category_id)?.toLowerCase().includes(term)),
      )
  }, [products, q, status, cat, sup, catName, supName])

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setLimit((l) => l + 40))
    io.observe(el)
    return () => io.disconnect()
  }, [rows.length])

  const counts = useMemo(() => {
    const c = { all: 0, active: 0, candidate: 0, inactive: 0 }
    for (const p of products ?? []) {
      c.all++
      c[p.status]++
    }
    return c
  }, [products])

  const activeFilters = (cat ? 1 : 0) + (sup ? 1 : 0)

  return (
    <div>
      <PageHeader
        title="Katalog Produk"
        subtitle={`${num(counts.all)} produk`}
        action={
          <ButtonLink href="/produk/baru" size="sm">
            <Plus className="size-4" /> Produk
          </ButtonLink>
        }
      />
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-ink-400" />
          <Input className="pl-11" placeholder="Cari nama, SKU, supplier…" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
        </div>
        <button onClick={() => setFilters(true)} className={cx('relative flex size-12 items-center justify-center rounded-2xl border', activeFilters ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-200 bg-white text-ink-600')} aria-label="Filter">
          <SlidersHorizontal className="size-5" />
          {activeFilters > 0 && <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-brand-700 text-[10px] font-bold text-white">{activeFilters}</span>}
        </button>
      </div>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
        {(['all', 'active', 'candidate', 'inactive'] as const).map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
            {s === 'all' ? 'Semua' : STATUS_LABEL[s]} <span className="opacity-60">{counts[s]}</span>
          </Chip>
        ))}
      </div>

      <div className="mt-4 space-y-2.5">
        {isPending &&
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[84px] rounded-3xl" />)}
        {!isPending && rows.length === 0 && (
          <EmptyState
            title={counts.all ? 'Tidak ada yang cocok' : 'Katalog masih kosong'}
            text={counts.all ? 'Coba ubah kata kunci atau filter.' : 'Tambah produk dari galeri, atau foto langsung di pasar.'}
            action={
              !counts.all && (
                <div className="flex gap-2">
                  <ButtonLink href="/produk/baru" size="sm">
                    Tambah produk
                  </ButtonLink>
                  <ButtonLink href="/tangkap" size="sm" variant="accent">
                    Foto di pasar
                  </ButtonLink>
                </div>
              )
            }
          />
        )}
        {rows.slice(0, limit).map((p) => {
          const prices = p.variants.map((v) => v.buy_price)
          const min = Math.min(...prices)
          const max = Math.max(...prices)
          const stock = p.variants.reduce((s, v) => s + v.stock, 0)
          let worst: StockStatus = 'aman'
          if (p.status === 'active')
            for (const v of p.variants) {
              const f = forecastVariant(p, v, buckets?.get(v.id), { method: prof.forecast_method, coverageWeeks: Number(prof.coverage_weeks), seasonal: Number(prof.seasonal_factor) })
              if (f.status === 'kritis') worst = 'kritis'
              else if (f.status === 'perlu' && worst === 'aman') worst = 'perlu'
            }
          return (
            <Link key={p.id} href={`/produk/detail?id=${p.id}`} className="flex items-center gap-3 rounded-3xl bg-white p-3 shadow-soft ring-1 ring-ink-100 transition active:scale-[0.99]">
              <Thumb path={p.photos[0]} size={60} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-semibold">{p.name}</p>
                  {p._pending && <CloudOff className="size-3.5 shrink-0 text-sun-600" />}
                </div>
                <p className="truncate text-xs text-ink-500">
                  {[p.category_id && catName.get(p.category_id), p.supplier_id && supName.get(p.supplier_id), `${p.variants.length} varian`].filter(Boolean).join(' · ')}
                </p>
                <p className="mt-0.5 text-xs font-medium text-ink-700 tabular-nums">
                  {p.variants.length ? (min === max ? rupiah(min) : `${rupiah(min)} – ${rupiah(max)}`) : 'Belum ada varian'} · stok {num(stock)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {p.status === 'candidate' && (
                  <Badge tone="orange">
                    <Sparkles className="size-3" /> Kandidat
                  </Badge>
                )}
                {p.status === 'inactive' && <Badge>Nonaktif</Badge>}
                {p.status === 'active' && p.variants.length > 0 && <StockBadge status={worst} />}
              </div>
            </Link>
          )
        })}
        <div ref={sentinel} />
      </div>

      {counts.all > 0 && (
        <Button
          variant="ghost"
          block
          className="mt-4"
          onClick={async () => {
            await exportCatalogExcel(products ?? [], categories ?? [], suppliers ?? [])
            toast('Katalog diekspor ke Excel')
          }}
        >
          <FileSpreadsheet className="size-4.5" /> Ekspor katalog ke Excel
        </Button>
      )}

      <Sheet open={filters} onClose={() => setFilters(false)} title="Filter">
        <div className="space-y-3.5">
          <Select label="Kategori" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Semua kategori</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select label="Supplier" value={sup} onChange={(e) => setSup(e.target.value)}>
            <option value="">Semua supplier</option>
            {suppliers?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button variant="outline" onClick={() => (setCat(''), setSup(''))}>
              Reset
            </Button>
            <Button onClick={() => setFilters(false)}>Terapkan</Button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense>
      <Catalog />
    </Suspense>
  )
}
