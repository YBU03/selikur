'use client'
import { useEffect, useState } from 'react'
import { Wand2, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { compressImage, uploadPhoto, removePhotos } from '@/lib/photos'
import { qk, useInvalidate, usePricing } from '@/lib/queries'
import { UNITS, type Product, type Variant } from '@/lib/types'
import { priceFromMarkup, pricingCfg, type PricingCfg } from '@/lib/pricing'
import { Button, Input, Label, MoneyInput, NumberInput, Select, Sheet, Thumb, Confirm, Toggle } from './ui'
import PriceSetter from './PriceSetter'
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

export type Draft = Omit<Variant, 'id' | 'product_id'> & { id?: string }

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
  price_mode: 'markup',
  markup_pct: 50,
}

export function VariantFields({
  v,
  set,
  productName,
  hasHistory,
  cfg,
}: {
  v: Draft
  set: (p: Partial<Draft>) => void
  productName: string
  hasHistory?: boolean
  cfg: PricingCfg
}) {
  return (
    <div className="space-y-3.5">
      <MoneyInput
        label="Harga kulakan (modal / pcs)"
        value={v.buy_price}
        onChange={(n) =>
          set(v.price_mode === 'markup' ? { buy_price: n, sell_price: priceFromMarkup(n, Number(v.markup_pct ?? 0), cfg) } : { buy_price: n })
        }
      />
      <div>
        <Label>Harga jual</Label>
        <PriceSetter
          cost={v.buy_price}
          cfg={cfg}
          value={{ sell_price: v.sell_price, price_mode: v.price_mode, markup_pct: v.markup_pct }}
          onChange={(p) => set(p)}
        />
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
  const [applyAll, setApplyAll] = useState(false)
  const invalidate = useInvalidate()
  const toast = useToast()
  const profile = usePricing()
  const cfg = pricingCfg(profile, product)

  useEffect(() => {
    if (open) {
      setV(variant ?? { ...emptyVariant, name: '', markup_pct: Number(profile.default_markup_pct) })
      setPhoto({})
      setApplyAll(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        price_mode: v.price_mode,
        markup_pct: v.price_mode === 'markup' ? v.markup_pct : null,
      }
      const res = variant ? await supabase.from('variants').update(row).eq('id', variant.id).select().single() : await supabase.from('variants').insert(row).select().single()
      if (res.error) throw res.error
      if ((!variant && v.buy_price > 0) || (variant && variant.buy_price !== v.buy_price)) {
        await supabase.from('price_history').insert({ variant_id: res.data.id, price: v.buy_price, supplier_id: product.supplier_id })
      }
      if (applyAll) {
        const others = product.variants.filter((x) => x.id !== res.data.id)
        const changed = others.filter((x) => x.buy_price !== v.buy_price)
        const { error } = await supabase
          .from('variants')
          .update({ buy_price: v.buy_price, sell_price: v.sell_price, price_mode: row.price_mode, markup_pct: row.markup_pct })
          .eq('product_id', product.id)
        if (error) throw error
        if (changed.length)
          await supabase.from('price_history').insert(changed.map((x) => ({ variant_id: x.id, price: v.buy_price, supplier_id: product.supplier_id })))
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
        <VariantFields v={v} set={(p) => setV({ ...v, ...p })} productName={product.name} hasHistory cfg={cfg} />
        {product.variants.length > 1 && (
          <Toggle
            checked={applyAll}
            onChange={setApplyAll}
            label="Samakan harga ke semua varian"
            text={`Harga kulak & jual diterapkan ke ${product.variants.length} varian produk ini`}
          />
        )}
      </div>
      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Hapus varian ${variant?.name ?? ''}?`}
        text="Data penjualan & riwayat harga varian ini ikut terhapus. Tindakan ini tidak bisa dibatalkan."
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
