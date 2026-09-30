'use client'
import { useRole } from '@/lib/roles'
import { useMemo, useState, useDeferredValue } from 'react'
import { useQuery } from '@tanstack/react-query'
import { subDays } from 'date-fns'
import { Search, Upload, Pencil, Trash2, Users, Store, FileSpreadsheet } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCatalog, useInvalidate, qk, variantLabel, indexVariants, usePricing } from '@/lib/queries'
import { isoDate, num, rupiah, tgl, tglPanjang, pct } from '@/lib/format'
import { breakdown, pricingCfg } from '@/lib/pricing'
import type { SalesRow } from '@/lib/types'
import { Button, Card, Confirm, EmptyState, Input, Loading, NumberInput, PageHeader, Segmented, Select, Sheet, Thumb, SectionTitle, Badge, cx } from '@/components/ui'
import { useToast, errMsg } from '@/components/Toast'

type Tab = 'input' | 'impor' | 'riwayat' | 'laba'
type Channel = 'organik' | 'affiliate'

function useSales(days: number) {
  return useQuery({
    queryKey: ['sales', days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .gte('sale_date', isoDate(subDays(new Date(), days)))
        .order('sale_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as SalesRow[]
    },
  })
}

export default function PenjualanPage() {
  const [tab, setTab] = useState<Tab>('input')
  const { isAdmin } = useRole()
  return (
    <div>
      <PageHeader title="Penjualan" subtitle="Data untuk forecast & laba" back="/menu" />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'input', label: 'Input' },
          { value: 'impor', label: 'Impor' },
          { value: 'riwayat', label: 'Riwayat' },
          ...(isAdmin ? [{ value: 'laba' as Tab, label: 'Laba' }] : []),
        ]}
      />
      <div className="mt-4">
        {tab === 'input' && <ManualInput onDone={() => setTab('riwayat')} />}
        {tab === 'impor' && <ImportSales onDone={() => setTab('riwayat')} />}
        {tab === 'riwayat' && <History />}
        {tab === 'laba' && isAdmin && <Profit />}
      </div>
    </div>
  )
}

function ChannelPicker({ value, onChange }: { value: Channel; onChange: (c: Channel) => void }) {
  return (
    <Segmented
      value={value}
      onChange={onChange}
      options={[
        {
          value: 'organik',
          label: (
            <span className="inline-flex items-center gap-1.5">
              <Store className="size-4" /> Organik
            </span>
          ),
        },
        {
          value: 'affiliate',
          label: (
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" /> Affiliate
            </span>
          ),
        },
      ]}
    />
  )
}

function ManualInput({ onDone }: { onDone: () => void }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const { data: products, isPending } = useCatalog()
  const [date, setDate] = useState(isoDate(new Date()))
  const [channel, setChannel] = useState<Channel>('organik')
  const [qInput, setQ] = useState('')
  const q = useDeferredValue(qInput)
  const [qty, setQty] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)

  const list = (products ?? [])
    .filter((p) => p.status === 'active' && p.variants.length)
    .filter((p) => !q || `${p.name} ${p.variants.map((v) => `${v.name} ${v.sku ?? ''}`).join(' ')}`.toLowerCase().includes(q.toLowerCase()))
  const totalQty = Object.values(qty).reduce((s, n) => s + (n || 0), 0)

  async function save() {
    const rows = Object.entries(qty)
      .filter(([, n]) => n > 0)
      .map(([variant_id, n]) => ({ variant_id, qty: n, sale_date: date, source: 'manual', channel }))
    if (!rows.length) return toast('Isi jumlah terjual dulu', 'error')
    setBusy(true)
    const { error } = await supabase.from('sales').insert(rows)
    if (!error) {
      // stok berkurang sesuai penjualan
      await Promise.all(rows.map((r) => supabase.rpc('adjust_stock', { p_variant_id: r.variant_id, p_delta: -r.qty })))
    }
    setBusy(false)
    if (error) return toast(errMsg(error), 'error')
    setQty({})
    await invalidate(qk.buckets, qk.catalog, ['sales'])
    toast(`${rows.length} penjualan tersimpan, stok diperbarui`)
    onDone()
  }

  if (isPending) return <Loading />
  return (
    <div>
      <Card className="space-y-3">
        <Input label="Tanggal (harian) atau akhir minggu (mingguan)" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <ChannelPicker value={channel} onChange={setChannel} />
        <p className="text-xs text-ink-500">Stok varian otomatis berkurang sesuai jumlah terjual.</p>
      </Card>
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-ink-400" />
        <Input className="pl-11" placeholder="Cari produk / varian" value={qInput} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mt-3 space-y-3">
        {list.length === 0 && <EmptyState title="Belum ada produk aktif" />}
        {list.map((p) => (
          <Card key={p.id} className="p-3">
            <div className="mb-2 flex items-center gap-2.5">
              <Thumb path={p.photos[0]} size={36} />
              <p className="truncate text-sm font-semibold">{p.name}</p>
            </div>
            <div className="divide-y divide-ink-100">
              {p.variants.map((v) => (
                <div key={v.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{v.name}</p>
                    <p className="text-xs text-ink-400">stok {num(v.stock)}</p>
                  </div>
                  <div className="w-32">
                    <NumberInput compact value={qty[v.id] ?? 0} onChange={(n) => setQty({ ...qty, [v.id]: Math.max(0, n) })} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
      {totalQty > 0 && (
        <div className="sticky bottom-28 z-10 mt-4">
          <Button block size="lg" loading={busy} onClick={save}>
            Simpan {num(totalQty)} pcs terjual · {tgl(date)}
          </Button>
        </div>
      )}
    </div>
  )
}

const GUESS: Record<string, RegExp> = {
  date: /tanggal|waktu|date|dibuat|created/i,
  sku: /sku|kode|referensi/i,
  product: /nama produk|produk|product|item/i,
  variant: /variasi|varian|variant|warna/i,
  qty: /jumlah|qty|quantity|kuantitas/i,
}

function parseDate(v: unknown): string | null {
  if (v instanceof Date) return isoDate(v)
  if (typeof v === 'number' && v > 20000 && v < 80000) return isoDate(new Date(Math.round((v - 25569) * 86400 * 1000)))
  const s = String(v ?? '').trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

async function readFile(file: File): Promise<Record<string, unknown>[]> {
  if (/\.csv$/i.test(file.name)) {
    const Papa = (await import('papaparse')).default
    const text = await file.text()
    return Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true }).data
  }
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.worksheets[0]
  const rows: Record<string, unknown>[] = []
  let headers: string[] = []
  ws.eachRow((row, i) => {
    const vals = (row.values as unknown[]).slice(1).map((v) => {
      if (v && typeof v === 'object' && 'result' in (v as object)) return (v as { result: unknown }).result
      if (v && typeof v === 'object' && 'richText' in (v as object)) return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join('')
      return v
    })
    if (i === 1) headers = vals.map((v, k) => String(v ?? `Kolom ${k + 1}`))
    else rows.push(Object.fromEntries(headers.map((h, k) => [h, vals[k]])))
  })
  return rows
}

function ImportSales({ onDone }: { onDone: () => void }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const { data: products } = useCatalog()
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [map, setMap] = useState<Record<string, string>>({})
  const [fallbackDate, setFallbackDate] = useState(isoDate(new Date()))
  const [channel, setChannel] = useState<Channel>('organik')
  const [manual, setManual] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const headers = rows?.[0] ? Object.keys(rows[0]) : []

  const variants = useMemo(() => (products ?? []).flatMap((p) => p.variants.map((v) => ({ p, v, label: variantLabel(p, v).toLowerCase() }))), [products])

  const grouped = useMemo(() => {
    if (!rows) return []
    const g = new Map<string, { key: string; label: string; date: string; qty: number; variantId: string | null }>()
    for (const r of rows) {
      const qty = Number(String(r[map.qty] ?? '').replace(/[^\d.-]/g, '')) || 0
      if (qty <= 0) continue
      const sku = map.sku ? String(r[map.sku] ?? '').trim() : ''
      const pn = map.product ? String(r[map.product] ?? '').trim() : ''
      const vn = map.variant ? String(r[map.variant] ?? '').trim() : ''
      const date = (map.date && parseDate(r[map.date])) || fallbackDate
      const label = sku || [pn, vn].filter(Boolean).join(' — ')
      if (!label) continue
      let match = sku ? variants.find((x) => x.v.sku && x.v.sku.toLowerCase() === sku.toLowerCase()) : undefined
      if (!match && pn) {
        const pl = pn.toLowerCase()
        const vl = vn.toLowerCase()
        match =
          variants.find((x) => x.p.name.toLowerCase() === pl && (!vl || x.v.name.toLowerCase() === vl)) ??
          variants.find((x) => pl.includes(x.p.name.toLowerCase()) && (!vl || vl.includes(x.v.name.toLowerCase()) || x.v.name === 'Standar'))
      }
      const key = `${date}|${label}`
      const cur = g.get(key) ?? { key: label, label, date, qty: 0, variantId: match?.v.id ?? null }
      cur.qty += qty
      g.set(key, cur)
    }
    return [...g.values()]
  }, [rows, map, variants, fallbackDate])

  const resolved = grouped.map((x) => ({ ...x, variantId: manual[x.key] || x.variantId }))
  const unmatchedLabels = [...new Set(resolved.filter((x) => !x.variantId).map((x) => x.key))]
  const ready = resolved.filter((x) => x.variantId)

  if (!rows)
    return (
      <Card className="text-center">
        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <FileSpreadsheet className="size-7" />
        </div>
        <p className="font-semibold">Impor dari Excel / CSV marketplace</p>
        <p className="mt-1 text-sm text-ink-500">Ekspor pesanan dari Shopee, Tokopedia, atau TikTok Shop lalu unggah di sini. Kolom bisa dipetakan.</p>
        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-brand-700 px-5 py-3 font-semibold text-white">
          <Upload className="size-4.5" /> Pilih file
          <input
            type="file"
            hidden
            accept=".csv,.xlsx"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              try {
                const data = await readFile(f)
                const hs = data[0] ? Object.keys(data[0]) : []
                const guess: Record<string, string> = {}
                for (const [k, re] of Object.entries(GUESS)) guess[k] = hs.find((h) => re.test(h)) ?? ''
                setMap(guess)
                setRows(data)
                setFileName(f.name)
              } catch (err) {
                toast(`Gagal membaca file: ${errMsg(err)}`, 'error')
              }
            }}
          />
        </label>
      </Card>
    )

  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{fileName}</p>
          <button className="text-sm font-semibold text-brand-700" onClick={() => setRows(null)}>
            Ganti file
          </button>
        </div>
        <p className="text-xs text-ink-500">{rows.length} baris. Petakan kolom:</p>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ['qty', 'Jumlah terjual *'],
              ['date', 'Tanggal'],
              ['sku', 'SKU'],
              ['product', 'Nama produk'],
              ['variant', 'Nama varian'],
            ] as const
          ).map(([k, label]) => (
            <Select key={k} label={label} value={map[k] ?? ''} onChange={(e) => setMap({ ...map, [k]: e.target.value })}>
              <option value="">—</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </Select>
          ))}
          {!map.date && <Input label="Tanggal untuk semua" type="date" value={fallbackDate} onChange={(e) => setFallbackDate(e.target.value)} />}
        </div>
        <ChannelPicker value={channel} onChange={setChannel} />
      </Card>

      {unmatchedLabels.length > 0 && (
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-sun-700">{unmatchedLabels.length} barang belum cocok — pilih variannya:</p>
          {unmatchedLabels.slice(0, 30).map((label) => (
            <Select key={label} label={label} value={manual[label] ?? ''} onChange={(e) => setManual({ ...manual, [label]: e.target.value })}>
              <option value="">Lewati</option>
              {variants.map((x) => (
                <option key={x.v.id} value={x.v.id}>
                  {variantLabel(x.p, x.v)}
                </option>
              ))}
            </Select>
          ))}
        </Card>
      )}

      <Card className="p-0">
        <p className="px-4 pt-3 text-sm font-semibold">Pratinjau ({ready.length} siap diimpor)</p>
        <ul className="max-h-72 divide-y divide-ink-100 overflow-y-auto">
          {resolved.slice(0, 100).map((x, i) => {
            const e = variants.find((y) => y.v.id === x.variantId)
            return (
              <li key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className={cx('min-w-0 truncate', !e && 'text-ink-400 line-through')}>
                  {tgl(x.date)} · {e ? variantLabel(e.p, e.v) : x.label}
                </span>
                <b className="tabular-nums">{num(x.qty)}</b>
              </li>
            )
          })}
        </ul>
      </Card>

      <Button
        block
        size="lg"
        disabled={!ready.length || !map.qty}
        loading={busy}
        onClick={async () => {
          setBusy(true)
          const { error } = await supabase
            .from('sales')
            .insert(ready.map((x) => ({ variant_id: x.variantId, qty: x.qty, sale_date: x.date, source: 'import', channel })))
          setBusy(false)
          if (error) return toast(errMsg(error), 'error')
          await invalidate(qk.buckets, ['sales'])
          toast(`${ready.length} baris penjualan diimpor`)
          setRows(null)
          onDone()
        }}
      >
        Impor {num(ready.reduce((s, x) => s + x.qty, 0))} pcs
      </Button>
      <p className="px-1 text-xs text-ink-500">Impor tidak mengubah stok. Sesuaikan stok di katalog bila perlu.</p>
    </div>
  )
}

function History() {
  const toast = useToast()
  const invalidate = useInvalidate()
  const { data: products } = useCatalog()
  const { data: sales, isPending } = useSales(60)
  const idx = useMemo(() => indexVariants(products), [products])
  const { isAdmin, me } = useRole()
  const [edit, setEdit] = useState<SalesRow | null>(null)
  const [del, setDel] = useState<SalesRow | null>(null)
  const [form, setForm] = useState({ qty: 0, sale_date: '', channel: 'organik' as Channel })
  const [busy, setBusy] = useState(false)

  const byDate = useMemo(() => {
    const m = new Map<string, SalesRow[]>()
    for (const s of sales ?? []) m.set(s.sale_date, [...(m.get(s.sale_date) ?? []), s])
    return [...m.entries()]
  }, [sales])

  if (isPending) return <Loading />
  if (!sales?.length) return <EmptyState title="Belum ada penjualan 60 hari terakhir" text="Input manual atau impor dari marketplace." />
  return (
    <div className="space-y-4">
      {byDate.map(([date, rows]) => (
        <div key={date}>
          <p className="mb-1.5 px-1 text-xs font-semibold text-ink-500 uppercase">
            {tglPanjang(date, 'EEEE, d MMM yyyy')} · {num(rows.reduce((s, r) => s + r.qty, 0))} pcs
          </p>
          <Card className="divide-y divide-ink-100 p-0">
            {rows.map((r) => {
              const e = idx.get(r.variant_id)
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e ? variantLabel(e.product, e.variant) : 'Varian terhapus'}</p>
                    <p className="flex gap-1.5 text-xs text-ink-500">
                      {r.source === 'import' ? 'Impor' : 'Manual'}
                      {r.channel === 'affiliate' && <Badge tone="orange">Affiliate</Badge>}
                    </p>
                  </div>
                  <b className="tabular-nums">{num(r.qty)}</b>
                  {(isAdmin || r.owner_id === me?.id) && (
                  <>
                  <button
                    className="flex size-8 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100"
                    aria-label="Ubah"
                    onClick={() => {
                      setForm({ qty: r.qty, sale_date: r.sale_date, channel: r.channel })
                      setEdit(r)
                    }}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button className="flex size-8 items-center justify-center rounded-full text-red-500 hover:bg-red-50" aria-label="Hapus" onClick={() => setDel(r)}>
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

      <Sheet open={!!edit} onClose={() => setEdit(null)} title="Ubah penjualan">
        <div className="space-y-3.5">
          <Input label="Tanggal" type="date" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} />
          <NumberInput label="Jumlah terjual" value={form.qty} onChange={(n) => setForm({ ...form, qty: Math.max(0, n) })} />
          <ChannelPicker value={form.channel} onChange={(c) => setForm({ ...form, channel: c })} />
          <Button
            block
            loading={busy}
            onClick={async () => {
              setBusy(true)
              const { error } = await supabase.from('sales').update(form).eq('id', edit!.id)
              if (!error && edit!.source === 'manual' && form.qty !== edit!.qty)
                await supabase.rpc('adjust_stock', { p_variant_id: edit!.variant_id, p_delta: edit!.qty - form.qty })
              setBusy(false)
              if (error) return toast(errMsg(error), 'error')
              await invalidate(qk.buckets, qk.catalog, ['sales'])
              toast('Penjualan diperbarui')
              setEdit(null)
            }}
          >
            Simpan
          </Button>
        </div>
      </Sheet>
      <Confirm
        open={!!del}
        onClose={() => setDel(null)}
        title="Hapus data penjualan?"
        text={del ? `${num(del.qty)} pcs pada ${tgl(del.sale_date)} akan dihapus dari data forecast${del.source === 'manual' ? ' dan stok dikembalikan' : ''}.` : ''}
        onConfirm={async () => {
          const { error } = await supabase.from('sales').delete().eq('id', del!.id)
          if (error) return toast(errMsg(error), 'error')
          if (del!.source === 'manual') await supabase.rpc('adjust_stock', { p_variant_id: del!.variant_id, p_delta: del!.qty })
          await invalidate(qk.buckets, qk.catalog, ['sales'])
          toast('Penjualan dihapus')
          setDel(null)
        }}
      />
    </div>
  )
}

function Profit() {
  const [days, setDays] = useState<'7' | '30' | '60'>('30')
  const { data: products } = useCatalog()
  const { data: sales, isPending } = useSales(Number(days))
  const profile = usePricing()
  const idx = useMemo(() => indexVariants(products), [products])

  const sum = useMemo(() => {
    const init = () => ({ qty: 0, revenue: 0, fee: 0, affiliate: 0, cost: 0, profit: 0 })
    const all = init()
    const ch = { organik: init(), affiliate: init() }
    const perProduct = new Map<string, { name: string; qty: number; profit: number; affiliate: number }>()
    for (const s of sales ?? []) {
      const e = idx.get(s.variant_id)
      if (!e) continue
      const cfg = pricingCfg(profile, e.product)
      const b = breakdown(e.variant.buy_price, e.variant.sell_price, cfg, s.channel)
      for (const t of [all, ch[s.channel]]) {
        t.qty += s.qty
        t.revenue += b.sell * s.qty
        t.fee += b.fee * s.qty
        t.affiliate += b.affiliate * s.qty
        t.cost += b.cost * s.qty
        t.profit += b.profit * s.qty
      }
      const pp = perProduct.get(e.product.id) ?? { name: e.product.name, qty: 0, profit: 0, affiliate: 0 }
      pp.qty += s.qty
      pp.profit += b.profit * s.qty
      pp.affiliate += b.affiliate * s.qty
      perProduct.set(e.product.id, pp)
    }
    return { all, ch, perProduct: [...perProduct.values()].sort((a, b) => b.profit - a.profit) }
  }, [sales, idx, profile])

  if (isPending) return <Loading />
  const Line = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
    <div className="flex justify-between text-sm">
      <span className="text-ink-500">{label}</span>
      <span className={cx('font-semibold tabular-nums', tone)}>{value}</span>
    </div>
  )
  return (
    <div>
      <Segmented
        value={days}
        onChange={setDays}
        options={[
          { value: '7', label: '7 hari' },
          { value: '30', label: '30 hari' },
          { value: '60', label: '60 hari' },
        ]}
      />
      <div className="mt-3 rounded-[2rem] bg-gradient-to-br from-brand-700 to-brand-900 p-5 text-white shadow-lift">
        <p className="text-sm text-brand-100">Perkiraan laba bersih</p>
        <p className="mt-1 text-3xl font-extrabold tabular-nums">{rupiah(sum.all.profit)}</p>
        <p className="mt-1 text-sm text-brand-100">
          {num(sum.all.qty)} pcs · omzet {rupiah(sum.all.revenue)} · margin {pct(sum.all.revenue ? sum.all.profit / sum.all.revenue : null)}
        </p>
      </div>
      <Card className="mt-3 space-y-2">
        <Line label="Omzet (harga jual)" value={rupiah(sum.all.revenue)} />
        <Line label="Potongan platform" value={`− ${rupiah(sum.all.fee)}`} tone="text-red-600" />
        <Line label="Komisi affiliate" value={`− ${rupiah(sum.all.affiliate)}`} tone="text-red-600" />
        <Line label="Modal (HPP)" value={`− ${rupiah(sum.all.cost)}`} />
        <div className="h-px bg-ink-100" />
        <Line label="Laba bersih" value={rupiah(sum.all.profit)} tone={sum.all.profit >= 0 ? 'text-leaf-600' : 'text-red-600'} />
      </Card>

      <SectionTitle>Per kanal</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {(['organik', 'affiliate'] as const).map((c) => (
          <Card key={c}>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 uppercase">
              {c === 'organik' ? <Store className="size-3.5" /> : <Users className="size-3.5" />} {c}
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums">{num(sum.ch[c].qty)} pcs</p>
            <p className="text-xs text-ink-500">laba {rupiah(sum.ch[c].profit)}</p>
            {c === 'affiliate' && <p className="text-xs font-semibold text-sun-700">komisi {rupiah(sum.ch[c].affiliate)}</p>}
          </Card>
        ))}
      </div>

      {sum.perProduct.length > 0 && (
        <>
          <SectionTitle>Laba per produk</SectionTitle>
          <Card className="divide-y divide-ink-100 p-0">
            {sum.perProduct.map((p) => (
              <div key={p.name} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate">{p.name}</span>
                <span className="shrink-0 text-right">
                  <b className="tabular-nums">{rupiah(p.profit)}</b>
                  <span className="block text-xs text-ink-500">
                    {num(p.qty)} pcs{p.affiliate ? ` · komisi ${rupiah(p.affiliate)}` : ''}
                  </span>
                </span>
              </div>
            ))}
          </Card>
        </>
      )}
      <p className="mt-3 px-1 text-xs text-ink-500">Dihitung dari harga jual & harga kulakan saat ini, potongan platform, dan komisi affiliate untuk penjualan kanal affiliate.</p>
    </div>
  )
}
