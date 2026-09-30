'use client'
import { useEffect, useState } from 'react'
import { Wand2, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { compressImage, uploadPhoto, removePhotos } from '@/lib/photos'
import { qk, useInvalidate } from '@/lib/queries'
import { UNITS, type Product, type Variant } from '@/lib/types'
import { margin, pct, rupiah } from '@/lib/format'
import { Button, Input, MoneyInput, NumberInput, Select, Sheet, Thumb, Confirm, cx } from './ui'
import { useToast, errMsg } from './Toast'

export function autoSku(productName: string, variantName: string) {
  const init = (s: string) =>
    s
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => (/\d/.test(w) ? w : w[0]))
      .join('')
      .slice(0, 5)
  return `${init(productName) || 'PRD'}-${init(variantName) || 'STD'}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`
}

type Draft = Omit<Variant, 'id' | 'product_id'> & { id?: string }

export const emptyVariant: Draft = {
  name: 'Standar',
  sku: null,
  photo: null,
  buy_price: 0,
  sell_price: 0,
  unit: 'pcs',
  unit_size: 1,
  stock: 0,
  min_stock: 0,
  manual_forecast: null,
}

export function VariantFields({ v, set, productName, hasHistory }: { v: Draft; set: (p: Partial<Draft>) => void; productName: string; hasHistory?: boolean }) {
  const m = margin(v.buy_price, v.sell_price)
  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput label="Harga kulakan" value={v.buy_price} onChange={(n) => set({ buy_price: n })} />
        <MoneyInput label="Harga jual" value={v.sell_price} onChange={(n) => set({ sell_price: n })} />
      </div>
      <div className="flex items-center justify-between rounded-2xl bg-ink-50 px-4 py-2.5 text-sm">
        <span className="text-ink-500">Margin</span>
        <span className={cx('font-bold tabular-nums', m == null ? 'text-ink-400' : m < 0.15 ? 'text-sun-600' : 'text-leaf-600')}>
          {m == null ? '–' : `${pct(m, 1)} · ${rupiah(v.sell_price - v.buy_price)}/pcs`}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Satuan beli"
          value={v.unit}
          onChange={(e) => {
            const u = UNITS.find((x) => x.value === e.target.value)!
            set({ unit: u.value, unit_size: u.value === 'karton' ? v.unit_size > 1 ? v.unit_size : u.size : u.size })
          }}
        >
          {UNITS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </Select>
        <NumberInput label="Isi per satuan" hint="pcs" value={v.unit_size} min={1} onChange={(n) => set({ unit_size: Math.max(1, n) })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberInput label="Stok saat ini" hint="pcs" value={v.stock} onChange={(n) => set({ stock: n })} />
        <NumberInput label="Stok minimum" hint="safety" value={v.min_stock} onChange={(n) => set({ min_stock: n })} />
      </div>
      <label className="block">
        <span className="mb-1.5 flex justify-between text-sm font-medium text-ink-700">
          SKU <span className="text-xs font-normal text-ink-400">opsional</span>
        </span>
        <div className="flex gap-2">
          <Input value={v.sku ?? ''} placeholder="Kode barang" onChange={(e) => set({ sku: e.target.value || null })} />
          <Button type="button" variant="soft" className="shrink-0" onClick={() => set({ sku: autoSku(productName, v.name) })}>
            <Wand2 className="size-4" /> Auto
          </Button>
        </div>
      </label>
      <NumberInput
        label="Perkiraan jual / minggu"
        hint={hasHistory ? 'dipakai jika data penjualan kosong' : 'untuk produk baru tanpa riwayat'}
        value={v.manual_forecast ?? 0}
        onChange={(n) => set({ manual_forecast: n || null })}
      />
    </div>
  )
}

export default function VariantSheet({
  open,
  onClose,
  product,
  variant,
}: {
  open: boolean
  onClose: () => void
  product: Product
  variant: Variant | null
}) {
  const [v, setV] = useState<Draft>(variant ?? emptyVariant)
  const [photo, setPhoto] = useState<{ blob?: Blob; url?: string | null }>({})
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const invalidate = useInvalidate()
  const toast = useToast()

  useEffect(() => {
    if (open) {
      setV(variant ?? { ...emptyVariant, name: '' })
      setPhoto({})
    }
  }, [open, variant])

  async function save() {
    if (!v.name.trim()) return toast('Isi nama varian (mis. warna/ukuran)', 'error')
    setBusy(true)
    try {
      let photoPath = v.photo
      if (photo.blob) {
        photoPath = await uploadPhoto(photo.blob)
        if (variant?.photo) await removePhotos([variant.photo])
      } else if (photo.url === null) {
        if (variant?.photo) await removePhotos([variant.photo])
        photoPath = null
      }
      const row = {
        product_id: product.id,
        name: v.name.trim(),
        sku: v.sku,
        photo: photoPath,
        buy_price: v.buy_price,
        sell_price: v.sell_price,
        unit: v.unit,
        unit_size: v.unit_size,
        stock: v.stock,
        min_stock: v.min_stock,
        manual_forecast: v.manual_forecast,
      }
      const res = variant ? await supabase.from('variants').update(row).eq('id', variant.id).select().single() : await supabase.from('variants').insert(row).select().single()
      if (res.error) throw res.error
      if ((!variant && v.buy_price > 0) || (variant && variant.buy_price !== v.buy_price)) {
        await supabase.from('price_history').insert({ variant_id: res.data.id, price: v.buy_price, supplier_id: product.supplier_id })
      }
      await invalidate(qk.catalog, ['price-history'])
      toast('Varian tersimpan')
      onClose()
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const shown = photo.url === null ? null : photo.url ?? v.photo
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={variant ? 'Ubah varian' : 'Varian baru'}
      footer={
        <div className="flex gap-3">
          {variant && (
            <Button variant="danger" onClick={() => setConfirm(true)} aria-label="Hapus varian">
              <Trash2 className="size-4.5" />
            </Button>
          )}
          <Button block loading={busy} onClick={save}>
            Simpan varian
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        <div className="flex items-end gap-3">
          <label className="relative cursor-pointer">
            <Thumb path={shown} size={64} />
            <span className="absolute -right-1 -bottom-1 rounded-full bg-brand-700 px-1.5 text-[10px] font-bold text-white">Foto</span>
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const b = await compressImage(f)
                setPhoto({ blob: b, url: URL.createObjectURL(b) })
              }}
            />
          </label>
          <div className="flex-1">
            <Input label="Nama varian" placeholder="mis. Hitam 500ml, Motif Bunga" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </div>
        </div>
        {shown && (
          <button className="text-xs font-semibold text-red-600" onClick={() => setPhoto({ url: null })}>
            Hapus foto varian
          </button>
        )}
        <VariantFields v={v} set={(p) => setV({ ...v, ...p })} productName={product.name} hasHistory />
      </div>
      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Hapus varian?"
        text="Data penjualan & riwayat harga varian ini ikut terhapus."
        onConfirm={async () => {
          const { error } = await supabase.from('variants').delete().eq('id', variant!.id)
          if (error) return toast(errMsg(error), 'error')
          if (variant?.photo) await removePhotos([variant.photo])
          await invalidate(qk.catalog)
          setConfirm(false)
          onClose()
        }}
      />
    </Sheet>
  )
}
