'use client'
import { useRole } from '@/lib/roles'
import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, FileText, FileSpreadsheet, Share2, MessageCircle, Play, CheckCheck, Check, X, Repeat, MoreHorizontal, MapPin, AlertTriangle, Search,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { enqueue } from '@/lib/outbox'
import { useList, useCatalog, useSuppliers, useSchedules, useLists, useProfile, defaultProfile, indexVariants, variantLabel, qk, useInvalidate } from '@/lib/queries'
import { rupiah, num, unitLabel, tgl, pct } from '@/lib/format'
import { exportListExcel, exportListPdf, listWhatsAppText, type Deliver } from '@/lib/exporters'
import { LIST_STATUS, type ShoppingItem, type ShoppingList } from '@/lib/types'
import { Badge, Button, Card, Confirm, EmptyState, IconButton, Input, Loading, MoneyInput, NumberInput, PageHeader, Segmented, Select, Sheet, Thumb, cx } from '@/components/ui'
import { useToast, errMsg } from '@/components/Toast'
import { ShoppingSimCard, PdfOptionsSheet } from '@/components/ShoppingSim'
import type { SimLine } from '@/lib/shoppingSim'
import { waLink } from '@/components/QuickCreate'

type Data = { list: ShoppingList; items: ShoppingItem[] }

function Detail() {
  const params = useSearchParams()
  const id = params.get('id')!
  const router = useRouter()
  const qc = useQueryClient()
  const toast = useToast()
  const invalidate = useInvalidate()
  const { data, isPending } = useList(id)
  const { data: products } = useCatalog()
  const { data: suppliers } = useSuppliers()
  const { data: schedules } = useSchedules()
  const { data: lists } = useLists()
  const { data: profile } = useProfile()
  const idx = useMemo(() => indexVariants(products), [products])
  const supMap = useMemo(() => new Map((suppliers ?? []).map((s) => [s.id, s])), [suppliers])

  const { isAdmin } = useRole()
  const [mode, setMode] = useState<'rencana' | 'belanja'>(params.get('mode') === 'belanja' ? 'belanja' : 'rencana')
  const [groupBy, setGroupBy] = useState<'supplier' | 'lokasi'>('supplier')
  const [editItem, setEditItem] = useState<ShoppingItem | null>(null)
  const [delItem, setDelItem] = useState<ShoppingItem | null>(null)
  const [adding, setAdding] = useState(false)
  const [editList, setEditList] = useState(false)
  const [delList, setDelList] = useState(false)
  const [menu, setMenu] = useState(false)
  const [finish, setFinish] = useState(false)
  const [swap, setSwap] = useState<ShoppingItem | null>(null)
  const [pdf, setPdf] = useState(false)

  if (isPending) return <Loading />
  if (!data)
    return (
      <>
        <PageHeader title="Daftar belanja" back="/belanja" />
        <EmptyState title="Daftar tidak ditemukan" />
      </>
    )
  const { list, items } = data
  const done = list.status === 'done'
  const shopping = mode === 'belanja' && !done

  // --- optimistik + antrean offline ---
  function patchLocal(fn: (d: Data) => Data) {
    qc.setQueryData<Data>(qk.list(id), (old) => (old ? fn(old) : old))
  }
  function updateItem(it: ShoppingItem, patch: Partial<ShoppingItem>) {
    patchLocal((d) => ({ ...d, items: d.items.map((x) => (x.id === it.id ? { ...x, ...patch } : x)) }))
    void enqueue({ kind: 'update', table: 'shopping_items', id: it.id, patch })
  }
  function updateList(patch: Partial<ShoppingList>) {
    patchLocal((d) => ({ ...d, list: { ...d.list, ...patch } }))
    void enqueue({ kind: 'update', table: 'shopping_lists', id: list.id, patch })
    void qc.invalidateQueries({ queryKey: qk.lists })
  }

  const name = (it: ShoppingItem) => {
    const e = it.variant_id ? idx.get(it.variant_id) : undefined
    return e ? variantLabel(e.product, e.variant) : it.custom_name ?? 'Barang'
  }
  const supplierOf = (it: ShoppingItem) => {
    const e = it.variant_id ? idx.get(it.variant_id) : undefined
    return it.supplier_id ?? e?.product.supplier_id ?? null
  }

  const planned = items.reduce((s, i) => s + i.qty_planned * i.price_planned, 0)
  const actual = items.filter((i) => i.status === 'bought').reduce((s, i) => s + (i.qty_actual ?? i.qty_planned) * (i.price_actual ?? i.price_planned), 0)
  const bought = items.filter((i) => i.status === 'bought').length
  const handled = items.filter((i) => i.status !== 'pending').length
  const budget = Number(list.budget) || 0
  const shown = shopping || done ? actual : planned
  const over = budget > 0 && (shopping ? Math.max(actual, planned) : shown) > budget

  const groups = new Map<string, { title: string; sub?: string; phone?: string | null; items: ShoppingItem[] }>()
  for (const it of [...items].sort((a, b) => a.sort_order - b.sort_order)) {
    const sid = supplierOf(it)
    const s = sid ? supMap.get(sid) : undefined
    const key = groupBy === 'supplier' ? sid ?? '-' : s?.location?.trim() || '-'
    const title = groupBy === 'supplier' ? s?.name ?? 'Tanpa supplier' : s?.location?.trim() || 'Lokasi belum diisi'
    const g = groups.get(key) ?? { title, sub: groupBy === 'supplier' ? s?.location ?? undefined : undefined, phone: s?.whatsapp, items: [] }
    g.items.push(it)
    groups.set(key, g)
  }

  async function doExport(kind: 'pdf' | 'xlsx', how: Deliver) {
    setMenu(false)
    if (kind === 'pdf') return setPdf(true)
    try {
      await exportListExcel(list, items, products ?? [], suppliers ?? [], how)
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  // baris simulasi: pakai jumlah & harga aktual untuk barang terbeli, rencana untuk sisanya
  const simLines: SimLine[] = items
    .filter((it) => it.status !== 'unavailable' && (!done || it.status === 'bought'))
    .map((it) => {
      const e = it.variant_id ? idx.get(it.variant_id) : undefined
      if (!e) return null
      const useActual = it.status === 'bought'
      return {
        product: e.product,
        variant: e.variant,
        qty: useActual ? it.qty_actual ?? it.qty_planned : it.qty_planned,
        price: useActual ? it.price_actual ?? it.price_planned : it.price_planned,
        supplierId: it.supplier_id ?? e.product.supplier_id,
      }
    })
    .filter(Boolean) as SimLine[]

  return (
    <div>
      <PageHeader
        title={list.title}
        subtitle={`${items.length} barang · ${LIST_STATUS[list.status].label}`}
        back="/belanja"
        action={
          <IconButton aria-label="Menu" onClick={() => setMenu(true)}>
            <MoreHorizontal className="size-5" />
          </IconButton>
        }
      />

      {/* ringkasan */}
      <Card className={cx('mb-4', over && 'ring-red-200')}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-ink-500">{shopping || done ? 'Realisasi' : 'Estimasi total'}</p>
            <p className="text-2xl font-extrabold tabular-nums">{rupiah(shown)}</p>
            {(shopping || done) && <p className="text-xs text-ink-500">rencana {rupiah(planned)}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-500">Anggaran</p>
            <p className="font-semibold tabular-nums">{budget ? rupiah(budget) : '—'}</p>
          </div>
        </div>
        {budget > 0 && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100">
            <div className={cx('h-full rounded-full transition-all', over ? 'bg-red-500' : 'bg-brand-500')} style={{ width: `${Math.min(100, (shown / budget) * 100)}%` }} />
          </div>
        )}
        {over && (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-red-600">
            <AlertTriangle className="size-4" /> Melebihi anggaran {rupiah(Math.max(actual, planned) - budget)}
          </p>
        )}
        {(shopping || done) && items.length > 0 && (
          <p className="mt-2 text-xs text-ink-500">
            {bought}/{items.length} terbeli · kesesuaian rencana {pct(bought / items.length)}
          </p>
        )}
      </Card>

      {isAdmin && simLines.length > 0 && (
        <div className="mb-4">
          <ShoppingSimCard
            lines={simLines}
            profile={profile ?? defaultProfile}
            suppliers={suppliers}
            budget={list.budget}
            title={done ? 'Simulasi hasil belanja' : 'Simulasi belanja'}
            defaultOpen={false}
          />
        </div>
      )}

      {!done && (
        <Segmented
          className="mb-3"
          value={mode}
          onChange={(m) => {
            setMode(m)
            if (m === 'belanja' && list.status === 'draft') updateList({ status: 'in_progress', started_at: new Date().toISOString() })
          }}
          options={[
            { value: 'rencana', label: 'Rencana' },
            {
              value: 'belanja',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Play className="size-3.5" /> Mode Belanja
                </span>
              ),
            },
          ]}
        />
      )}

      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex gap-1 text-xs font-semibold">
          {(['supplier', 'lokasi'] as const).map((g) => (
            <button key={g} onClick={() => setGroupBy(g)} className={cx('rounded-full px-3 py-1', groupBy === g ? 'bg-ink-800 text-white' : 'text-ink-500')}>
              Per {g}
            </button>
          ))}
        </div>
        {isAdmin && !done && !shopping && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-sm font-semibold text-brand-700">
            <Plus className="size-4" /> Barang
          </button>
        )}
      </div>

      {items.length === 0 && <EmptyState title="Daftar masih kosong" text="Tambah barang manual atau buat dari forecast." action={isAdmin ? <Button size="sm" onClick={() => setAdding(true)}>Tambah barang</Button> : undefined} />}

      <div className="space-y-4">
        {[...groups.entries()].map(([key, g]) => (
          <div key={key}>
            <div className="mb-1.5 flex items-center gap-2 px-1">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink-800">{g.title}</p>
                {g.sub && (
                  <p className="flex items-center gap-1 truncate text-xs text-ink-500">
                    <MapPin className="size-3" /> {g.sub}
                  </p>
                )}
              </div>
              {g.phone && (
                <a href={waLink(g.phone, `Halo, saya mau kulakan:\n${g.items.map((i) => `- ${name(i)} ${i.qty_planned} pcs`).join('\n')}`)} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-full bg-leaf-500/10 px-2.5 py-1 text-xs font-semibold text-leaf-600">
                  <MessageCircle className="size-3.5" /> WA
                </a>
              )}
              <span className="text-xs font-semibold text-ink-500 tabular-nums">
                {rupiah(g.items.reduce((s, i) => s + (shopping || done ? (i.status === 'bought' ? (i.qty_actual ?? i.qty_planned) * (i.price_actual ?? i.price_planned) : 0) : i.qty_planned * i.price_planned), 0))}
              </span>
            </div>
            <Card className="divide-y divide-ink-100 p-0">
              {g.items.map((it) => {
                const e = it.variant_id ? idx.get(it.variant_id) : undefined
                const photo = e?.variant.photo ?? e?.product.photos[0]
                const isBought = it.status === 'bought'
                const na = it.status === 'unavailable'
                if (shopping)
                  return (
                    <div key={it.id} className={cx('px-3 py-3 transition', isBought && 'bg-leaf-500/5', na && 'opacity-55')}>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() =>
                            updateItem(it, isBought ? { status: 'pending', qty_actual: null, price_actual: null } : { status: 'bought', qty_actual: it.qty_actual ?? it.qty_planned, price_actual: it.price_actual ?? it.price_planned })
                          }
                          className={cx('flex size-11 shrink-0 items-center justify-center rounded-2xl border-2 transition active:scale-90', isBought ? 'border-leaf-500 bg-leaf-500 text-white' : 'border-ink-300 bg-white')}
                          aria-label="Centang terbeli"
                        >
                          {isBought && <Check className="size-6" strokeWidth={3} />}
                        </button>
                        <Thumb path={photo} size={44} />
                        <div className="min-w-0 flex-1">
                          <p className={cx('truncate text-sm font-semibold', (isBought || na) && 'line-through decoration-ink-400')}>{name(it)}</p>
                          <p className="text-xs text-ink-500">
                            {e ? unitLabel(it.qty_planned, e.variant.unit, e.variant.unit_size) : `${num(it.qty_planned)} pcs`} × {rupiah(it.price_planned)}
                          </p>
                          {na && <Badge tone="red">Tidak tersedia</Badge>}
                        </div>
                      </div>
                      {isBought && (
                        <div className="mt-2.5 grid grid-cols-2 gap-2 pl-14">
                          <NumberInput compact value={it.qty_actual ?? it.qty_planned} onChange={(n) => updateItem(it, { qty_actual: Math.max(0, n) })} />
                          <MoneyInput value={it.price_actual ?? it.price_planned} onChange={(n) => updateItem(it, { price_actual: n })} />
                        </div>
                      )}
                      {!isBought && (
                        <div className="mt-2 flex gap-2 pl-14">
                          <button onClick={() => updateItem(it, { status: na ? 'pending' : 'unavailable' })} className="flex items-center gap-1 rounded-full bg-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-600">
                            <X className="size-3.5" /> {na ? 'Batal tidak tersedia' : 'Tidak tersedia'}
                          </button>
                          {e && e.product.variants.length > 1 && (
                            <button onClick={() => setSwap(it)} className="flex items-center gap-1 rounded-full bg-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-600">
                              <Repeat className="size-3.5" /> Ganti varian
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                return (
                  <div key={it.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Thumb path={photo} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{name(it)}</p>
                      <p className="text-xs text-ink-500">
                        {done
                          ? `${num(it.qty_actual ?? 0)} pcs × ${rupiah(it.price_actual ?? it.price_planned)}`
                          : `${e ? unitLabel(it.qty_planned, e.variant.unit, e.variant.unit_size) : `${num(it.qty_planned)} pcs`} × ${rupiah(it.price_planned)}`}
                      </p>
                    </div>
                    {done || !isAdmin ? (
                      <Badge tone={isBought ? 'leaf' : na ? 'red' : 'gray'}>{isBought ? 'Terbeli' : na ? 'Tidak ada' : 'Tidak dibeli'}</Badge>
                    ) : (
                      <>
                        <p className="text-sm font-semibold tabular-nums">{rupiah(it.qty_planned * it.price_planned)}</p>
                        <button className="flex size-8 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100" onClick={() => setEditItem(it)} aria-label="Ubah">
                          <Pencil className="size-4" />
                        </button>
                        <button className="flex size-8 items-center justify-center rounded-full text-red-500 hover:bg-red-50" onClick={() => setDelItem(it)} aria-label="Hapus">
                          <Trash2 className="size-4" />
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </Card>
          </div>
        ))}
      </div>

      {shopping && items.length > 0 && (
        <div className="sticky bottom-28 z-10 mt-5">
          <Button block size="lg" variant="primary" onClick={() => setFinish(true)}>
            <CheckCheck className="size-5" /> Selesai belanja · {handled}/{items.length}
          </Button>
        </div>
      )}

      {/* sheet menu */}
      <Sheet open={menu} onClose={() => setMenu(false)} title="Aksi daftar">
        <div className="grid gap-1">
          {isAdmin && !done && (
            <MenuBtn icon={Pencil} label="Ubah judul, anggaran, jadwal" onClick={() => (setMenu(false), setEditList(true))} />
          )}
          <MenuBtn icon={FileText} label="PDF daftar belanja (foto, nama, warna, jumlah)" onClick={() => doExport('pdf', 'download')} />
          <MenuBtn icon={FileSpreadsheet} label="Unduh Excel" onClick={() => doExport('xlsx', 'download')} />
          <MenuBtn
            icon={MessageCircle}
            label="Kirim teks daftar ke WhatsApp"
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(listWhatsAppText(list, items, products ?? [], suppliers ?? []))}`, '_blank')}
          />
          {isAdmin && <MenuBtn icon={Trash2} label="Hapus daftar" danger onClick={() => (setMenu(false), setDelList(true))} />}
        </div>
      </Sheet>

      <ItemSheet
        open={adding || !!editItem}
        item={editItem}
        onClose={() => (setAdding(false), setEditItem(null))}
        products={products ?? []}
        suppliers={suppliers ?? []}
        existing={items}
        onSave={async (row) => {
          try {
            if (editItem) {
              const { error } = await supabase.from('shopping_items').update(row).eq('id', editItem.id)
              if (error) throw error
            } else {
              const { error } = await supabase.from('shopping_items').insert({ ...row, list_id: list.id, sort_order: items.length })
              if (error) throw error
            }
            await invalidate(qk.list(id), qk.lists)
            setAdding(false)
            setEditItem(null)
          } catch (e) {
            toast(errMsg(e), 'error')
          }
        }}
      />

      <Sheet open={!!swap} onClose={() => setSwap(null)} title="Ganti varian">
        <div className="grid gap-2">
          {swap &&
            idx
              .get(swap.variant_id!)
              ?.product.variants.filter((v) => v.id !== swap.variant_id)
              .map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    updateItem(swap, { variant_id: v.id, price_planned: v.buy_price })
                    setSwap(null)
                  }}
                  className="flex items-center gap-3 rounded-2xl p-2 text-left hover:bg-ink-50"
                >
                  <Thumb path={v.photo} size={40} />
                  <span className="flex-1 font-medium">{v.name}</span>
                  <span className="text-sm text-ink-500">{rupiah(v.buy_price)}</span>
                </button>
              ))}
        </div>
      </Sheet>

      <EditListSheet
        open={editList}
        onClose={() => setEditList(false)}
        list={list}
        schedules={(schedules ?? []).filter((s) => s.id === list.schedule_id || !(lists ?? []).some((l) => l.schedule_id === s.id))}
        onSave={async (patch) => {
          const { error } = await supabase.from('shopping_lists').update(patch).eq('id', list.id)
          if (error) return toast(errMsg(error), 'error')
          await invalidate(qk.list(id), qk.lists)
          setEditList(false)
          toast('Daftar diperbarui')
        }}
      />

      <PdfOptionsSheet
        open={pdf}
        onClose={() => setPdf(false)}
        onExport={async (o, how) => {
          try {
            await exportListPdf(list, items, products ?? [], suppliers ?? [], (profile ?? defaultProfile).store_name, how, { ...o, profile: profile ?? defaultProfile })
          } catch (e) {
            toast(errMsg(e), 'error')
          }
        }}
      />

      <Confirm
        open={!!delItem}
        onClose={() => setDelItem(null)}
        title="Hapus barang dari daftar?"
        text={delItem ? name(delItem) : ''}
        onConfirm={async () => {
          const { error } = await supabase.from('shopping_items').delete().eq('id', delItem!.id)
          if (error) return toast(errMsg(error), 'error')
          await invalidate(qk.list(id), qk.lists)
          setDelItem(null)
        }}
      />
      <Confirm
        open={delList}
        onClose={() => setDelList(false)}
        title={`Hapus "${list.title}"?`}
        text={done ? 'Daftar ini sudah selesai — rekap belanjanya ikut hilang. Stok yang sudah bertambah tidak dikurangi.' : 'Semua barang di daftar ini ikut terhapus.'}
        onConfirm={async () => {
          const { error } = await supabase.from('shopping_lists').delete().eq('id', list.id)
          if (error) return toast(errMsg(error), 'error')
          await invalidate(qk.lists)
          toast('Daftar dihapus')
          router.replace('/belanja')
        }}
      />
      <Confirm
        open={finish}
        onClose={() => setFinish(false)}
        requireWord={null}
        confirmLabel="Selesaikan"
        title="Selesaikan belanja?"
        text={`${bought} barang terbeli senilai ${rupiah(actual)}. Stok bertambah otomatis dan harga kulakan terbaru disimpan.${items.length - handled > 0 ? ` ${items.length - handled} barang belum dicentang akan dianggap tidak dibeli.` : ''}`}
        onConfirm={async () => {
          patchLocal((d) => ({ ...d, list: { ...d.list, status: 'done', completed_at: new Date().toISOString(), actual_total: actual } }))
          await enqueue({ kind: 'rpc', fn: 'complete_shopping_list', args: { p_list_id: list.id } })
          setFinish(false)
          setMode('rencana')
          toast(navigator.onLine ? 'Belanja selesai! Stok diperbarui' : 'Tersimpan offline, stok diperbarui saat online')
          await invalidate(qk.catalog, qk.lists, qk.schedules)
        }}
      />
    </div>
  )
}

function MenuBtn({ icon: Icon, label, onClick, danger }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cx('flex items-center gap-3 rounded-2xl px-3 py-3 text-left font-medium hover:bg-ink-50', danger ? 'text-red-600' : 'text-ink-800')}>
      <Icon className="size-5" /> {label}
    </button>
  )
}

function ItemSheet({
  open,
  item,
  onClose,
  products,
  suppliers,
  existing,
  onSave,
}: {
  open: boolean
  item: ShoppingItem | null
  onClose: () => void
  products: import('@/lib/types').Product[]
  suppliers: import('@/lib/types').Supplier[]
  existing: ShoppingItem[]
  onSave: (row: Partial<ShoppingItem>) => Promise<void>
}) {
  const [q, setQ] = useState('')
  const [variantId, setVariantId] = useState<string | null>(null)
  const [custom, setCustom] = useState('')
  const [qty, setQty] = useState(1)
  const [price, setPrice] = useState(0)
  const [supplierId, setSupplierId] = useState('')
  const [busy, setBusy] = useState(false)
  const [init, setInit] = useState<string | null>(null)
  const idx = useMemo(() => indexVariants(products), [products])

  const key = open ? item?.id ?? 'new' : null
  if (key !== init) {
    setInit(key)
    if (open) {
      setQ('')
      setVariantId(item?.variant_id ?? null)
      setCustom(item?.custom_name ?? '')
      setQty(item?.qty_planned ?? 1)
      setPrice(item?.price_planned ?? 0)
      setSupplierId(item?.supplier_id ?? '')
    }
  }
  const e = variantId ? idx.get(variantId) : undefined
  const inList = new Set(existing.map((x) => x.variant_id))
  const results = q
    ? products
        .flatMap((p) => p.variants.map((v) => ({ p, v })))
        .filter(({ p, v }) => `${p.name} ${v.name} ${v.sku ?? ''}`.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 12)
    : []

  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Ubah barang' : 'Tambah barang'}>
      <div className="space-y-3.5">
        {!item && !e && (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-ink-400" />
              <Input className="pl-11" autoFocus placeholder="Cari produk di katalog…" value={q} onChange={(ev) => setQ(ev.target.value)} />
            </div>
            <div className="grid gap-1">
              {results.map(({ p, v }) => (
                <button
                  key={v.id}
                  onClick={() => {
                    setVariantId(v.id)
                    setPrice(v.buy_price)
                    setQty(Math.max(1, v.unit_size))
                    setSupplierId(p.supplier_id ?? '')
                  }}
                  className="flex items-center gap-3 rounded-2xl p-2 text-left hover:bg-ink-50"
                >
                  <Thumb path={v.photo ?? p.photos[0]} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{variantLabel(p, v)}</span>
                    <span className="block text-xs text-ink-500">
                      {rupiah(v.buy_price)} · stok {num(v.stock)}
                      {inList.has(v.id) ? ' · sudah di daftar' : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-ink-400">— atau barang di luar katalog —</p>
            <Input label="Nama barang" placeholder="mis. Plastik packing" value={custom} onChange={(ev) => setCustom(ev.target.value)} />
          </>
        )}
        {e && (
          <div className="flex items-center gap-3 rounded-2xl bg-ink-50 p-2.5">
            <Thumb path={e.variant.photo ?? e.product.photos[0]} size={44} />
            <p className="flex-1 text-sm font-semibold">{variantLabel(e.product, e.variant)}</p>
            {!item && (
              <button className="text-sm font-semibold text-brand-700" onClick={() => setVariantId(null)}>
                Ganti
              </button>
            )}
          </div>
        )}
        {item && !e && <Input label="Nama barang" value={custom} onChange={(ev) => setCustom(ev.target.value)} />}
        <div className="grid grid-cols-2 gap-3">
          <NumberInput label="Jumlah (pcs)" hint={e && e.variant.unit_size > 1 ? unitLabel(qty, e.variant.unit, e.variant.unit_size) : undefined} value={qty} step={e ? Math.max(1, e.variant.unit_size) : 1} onChange={(n) => setQty(Math.max(0, n))} />
          <MoneyInput label="Harga / pcs" value={price} onChange={setPrice} />
        </div>
        <Select label="Supplier" value={supplierId} onChange={(ev) => setSupplierId(ev.target.value)}>
          <option value="">Ikuti produk / tanpa supplier</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <p className="text-right text-sm text-ink-500">
          Subtotal <b className="text-ink-900">{rupiah(qty * price)}</b>
        </p>
        <Button
          block
          loading={busy}
          disabled={!variantId && !custom.trim()}
          onClick={async () => {
            setBusy(true)
            await onSave({ variant_id: variantId, custom_name: variantId ? null : custom.trim(), qty_planned: qty, price_planned: price, supplier_id: supplierId || null })
            setBusy(false)
          }}
        >
          Simpan
        </Button>
      </div>
    </Sheet>
  )
}

function EditListSheet({
  open,
  onClose,
  list,
  schedules,
  onSave,
}: {
  open: boolean
  onClose: () => void
  list: ShoppingList
  schedules: { id: string; title: string; scheduled_on: string }[]
  onSave: (p: Partial<ShoppingList>) => Promise<void>
}) {
  const [title, setTitle] = useState(list.title)
  const [budget, setBudget] = useState(Number(list.budget) || 0)
  const [scheduleId, setScheduleId] = useState(list.schedule_id ?? '')
  const [busy, setBusy] = useState(false)
  return (
    <Sheet open={open} onClose={onClose} title="Ubah daftar">
      <div className="space-y-3.5">
        <Input label="Judul" value={title} onChange={(e) => setTitle(e.target.value)} />
        <MoneyInput label="Batas anggaran" value={budget} onChange={setBudget} />
        <Select label="Jadwal" value={scheduleId} onChange={(e) => setScheduleId(e.target.value)}>
          <option value="">Tanpa jadwal</option>
          {schedules.map((s) => (
            <option key={s.id} value={s.id}>
              {tgl(s.scheduled_on)} — {s.title}
            </option>
          ))}
        </Select>
        <Button
          block
          loading={busy}
          onClick={async () => {
            setBusy(true)
            await onSave({ title: title.trim() || list.title, budget: budget || null, schedule_id: scheduleId || null })
            setBusy(false)
          }}
        >
          Simpan
        </Button>
      </div>
    </Sheet>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Detail />
    </Suspense>
  )
}
