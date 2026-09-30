'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ChevronRight, MapPin, History, MessageCircle } from 'lucide-react'
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { supabase } from '@/lib/supabase'
import { uploadPhoto, removePhotos } from '@/lib/photos'
import { qk, useCategories, useSuppliers, useInvalidate, useSalesBuckets, useProfile, usePriceHistory, defaultProfile } from '@/lib/queries'
import { chartSeries, forecastVariant, HISTORY_WEEKS } from '@/lib/forecast'
import { STATUS_LABEL, type Product, type ProductStatus, type Variant } from '@/lib/types'
import { margin, num, pct, rupiah, tgl } from '@/lib/format'
import { Button, Card, Input, Label, PageHeader, SectionTitle, Segmented, Select, StockBadge, Textarea, Thumb, Confirm, Badge, cx } from './ui'
import PhotoStrip, { toPhotoItems, type PhotoItem } from './PhotoStrip'
import VariantSheet, { VariantFields, emptyVariant } from './VariantSheet'
import { NewCategorySheet, SupplierSheet, waLink } from './QuickCreate'
import { useToast, errMsg } from './Toast'

export default function ProductEditor({ product }: { product: Product | null }) {
  const router = useRouter()
  const toast = useToast()
  const invalidate = useInvalidate()
  const { data: categories } = useCategories()
  const { data: suppliers } = useSuppliers()
  const { data: buckets } = useSalesBuckets()
  const { data: profile } = useProfile()
  const prof = profile ?? defaultProfile

  const [form, setForm] = useState({
    name: product?.name ?? '',
    category_id: product?.category_id ?? '',
    supplier_id: product?.supplier_id ?? '',
    status: (product?.status ?? 'active') as ProductStatus,
    notes: product?.notes ?? '',
    found_location: product?.found_location ?? '',
    attributes: product?.attributes ?? {},
  })
  const [photos, setPhotos] = useState<PhotoItem[]>(toPhotoItems(product?.photos ?? []))
  const [first, setFirst] = useState({ ...emptyVariant })
  const [saving, setSaving] = useState(false)
  const [variantSheet, setVariantSheet] = useState<{ open: boolean; v: Variant | null }>({ open: false, v: null })
  const [catSheet, setCatSheet] = useState(false)
  const [supSheet, setSupSheet] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    if (!product) return
    setForm({
      name: product.name,
      category_id: product.category_id ?? '',
      supplier_id: product.supplier_id ?? '',
      status: product.status,
      notes: product.notes ?? '',
      found_location: product.found_location ?? '',
      attributes: product.attributes ?? {},
    })
    setPhotos(toPhotoItems(product.photos ?? []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, product?.photos?.join(',')])

  const category = categories?.find((c) => c.id === form.category_id)
  const supplier = suppliers?.find((s) => s.id === form.supplier_id)
  const variantIds = useMemo(() => product?.variants.map((v) => v.id) ?? [], [product])
  const { data: prices } = usePriceHistory(variantIds)

  const forecasts = useMemo(() => {
    if (!product) return []
    return product.variants.map((v) =>
      forecastVariant(product, v, buckets?.get(v.id), {
        method: prof.forecast_method,
        coverageWeeks: Number(prof.coverage_weeks),
        seasonal: Number(prof.seasonal_factor),
      }),
    )
  }, [product, buckets, prof])

  const series = useMemo(() => {
    const total = new Array(HISTORY_WEEKS).fill(0)
    for (const f of forecasts) f.history.forEach((q, i) => (total[i] += q))
    return chartSeries(total, prof.forecast_method)
  }, [forecasts, prof.forecast_method])
  const hasSales = series.some((s) => s.aktual > 0)

  async function save() {
    if (!form.name.trim()) return toast('Nama produk wajib diisi', 'error')
    setSaving(true)
    try {
      const paths: string[] = []
      for (const p of photos) paths.push(p.path ?? (await uploadPhoto(p.blob!)))
      const removed = (product?.photos ?? []).filter((p) => !paths.includes(p))
      const row = {
        name: form.name.trim(),
        category_id: form.category_id || null,
        supplier_id: form.supplier_id || null,
        status: form.status,
        notes: form.notes || null,
        found_location: form.found_location || null,
        attributes: form.attributes,
        photos: paths,
      }
      if (product) {
        const { error } = await supabase.from('products').update(row).eq('id', product.id)
        if (error) throw error
        if (removed.length) await removePhotos(removed)
        await invalidate(qk.catalog)
        toast('Produk tersimpan')
      } else {
        const { data, error } = await supabase.from('products').insert({ ...row, source: 'upload' }).select().single()
        if (error) throw error
        const { data: v, error: e2 } = await supabase
          .from('variants')
          .insert({ ...first, name: first.name.trim() || 'Standar', product_id: data.id })
          .select()
          .single()
        if (e2) throw e2
        if (first.buy_price > 0) await supabase.from('price_history').insert({ variant_id: v.id, price: first.buy_price, supplier_id: row.supplier_id })
        await invalidate(qk.catalog)
        toast('Produk ditambahkan')
        router.replace(`/produk/detail?id=${data.id}`)
      }
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!product) return
    const paths = [...product.photos, ...product.variants.map((v) => v.photo).filter(Boolean)] as string[]
    const { error } = await supabase.from('products').delete().eq('id', product.id)
    if (error) return toast(errMsg(error), 'error')
    await removePhotos(paths)
    await invalidate(qk.catalog)
    toast('Produk dihapus')
    router.replace('/produk')
  }

  return (
    <div>
      <PageHeader
        title={product ? product.name : 'Produk baru'}
        subtitle={product ? `${product.variants.length} varian${product.source === 'field' ? ' · temuan lapangan' : ''}` : 'Upload foto & isi detail'}
        back="/produk"
        action={
          product && (
            <button onClick={() => setConfirmDel(true)} className="flex size-10 items-center justify-center rounded-full text-red-600 hover:bg-red-50" aria-label="Hapus produk">
              <Trash2 className="size-5" />
            </button>
          )
        }
      />

      {product?._pending && (
        <p className="mb-3 rounded-2xl bg-sun-50 px-4 py-2.5 text-sm text-sun-700">Produk ini belum tersinkron. Buka lagi saat online untuk melengkapi.</p>
      )}

      <PhotoStrip items={photos} onChange={setPhotos} />

      <div className="mt-5 space-y-3.5">
        <Input label="Nama produk" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mis. Tumbler Stainless 500ml" />
        <div>
          <Label>Status</Label>
          <Segmented
            value={form.status}
            onChange={(s) => setForm({ ...form, status: s })}
            options={(['active', 'candidate', 'inactive'] as ProductStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          />
        </div>
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <Select label="Kategori" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
            <option value="">Tanpa kategori</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button variant="soft" onClick={() => setCatSheet(true)} aria-label="Kategori baru">
            <Plus className="size-5" />
          </Button>
        </div>
        {category && category.extra_attributes.length > 0 && (
          <div className="grid grid-cols-2 gap-3 rounded-3xl bg-brand-50/60 p-3">
            {category.extra_attributes.map((a) => (
              <Input
                key={a.key}
                label={`${a.label}${a.unit ? ` (${a.unit})` : ''}`}
                value={form.attributes[a.key] ?? ''}
                onChange={(e) => setForm({ ...form, attributes: { ...form.attributes, [a.key]: e.target.value } })}
              />
            ))}
          </div>
        )}
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <Select label="Supplier" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
            <option value="">Belum ditentukan</option>
            {suppliers?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.location ? ` — ${s.location}` : ''}
              </option>
            ))}
          </Select>
          <Button variant="soft" onClick={() => setSupSheet(true)} aria-label="Supplier baru">
            <Plus className="size-5" />
          </Button>
        </div>
        {supplier?.whatsapp && (
          <a href={waLink(supplier.whatsapp, `Halo ${supplier.name}, saya mau tanya stok ${form.name}.`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-leaf-600">
            <MessageCircle className="size-4" /> Chat supplier via WhatsApp
          </a>
        )}
        <label className="block">
          <Label>Lokasi temuan</Label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-ink-400" />
            <Input className="pl-11" value={form.found_location} placeholder="Toko / blok di pasar" onChange={(e) => setForm({ ...form, found_location: e.target.value })} />
          </div>
        </label>
        <Textarea label="Catatan" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Kualitas, MOQ, catatan negosiasi…" />
      </div>

      {!product && (
        <>
          <SectionTitle>Varian pertama</SectionTitle>
          <Card className="space-y-3.5">
            <Input label="Nama varian" value={first.name} onChange={(e) => setFirst({ ...first, name: e.target.value })} placeholder="mis. Hitam, 500ml, atau Standar" />
            <VariantFields v={first} set={(p) => setFirst({ ...first, ...p })} productName={form.name} />
          </Card>
          <p className="mt-2 px-1 text-xs text-ink-500">Varian lain (warna, ukuran, motif) bisa ditambah setelah produk tersimpan.</p>
        </>
      )}

      <div className="sticky bottom-28 z-10 mt-5">
        <Button block size="lg" loading={saving} onClick={save}>
          {product ? 'Simpan perubahan' : 'Simpan produk'}
        </Button>
      </div>

      {product && (
        <>
          <SectionTitle
            action={
              <button onClick={() => setVariantSheet({ open: true, v: null })} className="flex items-center gap-1 text-sm font-semibold text-brand-700">
                <Plus className="size-4" /> Varian
              </button>
            }
          >
            Varian & harga
          </SectionTitle>
          <div className="space-y-2.5">
            {forecasts.map((f) => {
              const v = f.variant
              const m = margin(v.buy_price, v.sell_price)
              return (
                <button key={v.id} onClick={() => setVariantSheet({ open: true, v })} className="block w-full text-left">
                  <Card className="flex items-center gap-3 transition active:scale-[0.99]">
                    <Thumb path={v.photo ?? product.photos[0]} size={52} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold">{v.name}</p>
                        {product.status === 'active' && <StockBadge status={f.status} />}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {rupiah(v.buy_price)} → {rupiah(v.sell_price)} · <span className={cx(m != null && m < 0.15 ? 'text-sun-600' : 'text-leaf-600', 'font-semibold')}>{pct(m, 0)}</span>
                      </p>
                      <p className="text-xs text-ink-500">
                        Stok {num(v.stock)} / min {num(v.min_stock)} · {num(f.weekly, 1)}/mg{v.sku ? ` · ${v.sku}` : ''}
                      </p>
                    </div>
                    <ChevronRight className="size-5 text-ink-300" />
                  </Card>
                </button>
              )
            })}
            {product.variants.length === 0 && <p className="px-1 text-sm text-ink-500">Belum ada varian.</p>}
          </div>

          <SectionTitle>Penjualan vs forecast</SectionTitle>
          <Card>
            {hasSales ? (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={series} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#eceeeb" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6c766f' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#6c766f' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 14, border: 'none', boxShadow: '0 8px 24px -8px rgba(8,62,50,.3)', fontSize: 12 }} />
                    <Bar dataKey="aktual" name="Terjual" fill="#178a66" radius={[6, 6, 0, 0]} barSize={18} />
                    <Line dataKey="forecast" name="Forecast" stroke="#f7931e" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-ink-500">Belum ada data penjualan. Input penjualan agar forecast bekerja.</p>
            )}
            <div className="mt-2 flex justify-center gap-4 text-xs text-ink-500">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-brand-500" /> Terjual per minggu
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 bg-sun-500" /> Forecast ({prof.forecast_method === 'wma' ? 'berbobot' : 'rata-rata 4 mg'})
              </span>
            </div>
          </Card>

          <SectionTitle>
            <span className="flex items-center gap-1.5">
              <History className="size-3.5" /> Riwayat harga kulakan
            </span>
          </SectionTitle>
          <Card className="p-0">
            {prices?.length ? (
              <ul className="divide-y divide-ink-100">
                {prices.slice(0, 12).map((h, i) => {
                  const v = product.variants.find((x) => x.id === h.variant_id)
                  const prev = prices.slice(i + 1).find((x) => x.variant_id === h.variant_id)
                  const diff = prev ? (h.price - prev.price) / (prev.price || 1) : null
                  return (
                    <li key={h.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="text-ink-600">
                        {tgl(h.recorded_on)} · {v?.name ?? '–'}
                      </span>
                      <span className="flex items-center gap-2 font-semibold tabular-nums">
                        {diff != null && diff !== 0 && <Badge tone={diff > 0 ? 'orange' : 'leaf'}>{diff > 0 ? '▲' : '▼'} {pct(Math.abs(diff))}</Badge>}
                        {rupiah(h.price)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="px-4 py-5 text-center text-sm text-ink-500">Riwayat tercatat otomatis setiap belanja selesai.</p>
            )}
          </Card>

          <VariantSheet open={variantSheet.open} onClose={() => setVariantSheet({ open: false, v: null })} product={product} variant={variantSheet.v} />
        </>
      )}

      <NewCategorySheet open={catSheet} onClose={() => setCatSheet(false)} onCreated={(c) => setForm((f) => ({ ...f, category_id: c.id }))} />
      <SupplierSheet open={supSheet} onClose={() => setSupSheet(false)} onSaved={(s) => setForm((f) => ({ ...f, supplier_id: s.id }))} />
      <Confirm open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={remove} title="Hapus produk?" text="Semua varian, penjualan, dan riwayat harga produk ini ikut terhapus." />
    </div>
  )
}
