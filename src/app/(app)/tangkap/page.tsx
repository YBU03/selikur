'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { Camera, Images, Crop, RotateCcw, Check, MapPin, ChevronRight } from 'lucide-react'
import { compressImage } from '@/lib/photos'
import { enqueue, saveBlob } from '@/lib/outbox'
import { qk, useCategories } from '@/lib/queries'
import type { Product } from '@/lib/types'
import { Button, Input, MoneyInput, PageHeader, Select, cx } from '@/components/ui'
import CropModal from '@/components/CropModal'
import { useToast } from '@/components/Toast'

const LOC_KEY = 'selikur-last-location'

export default function TangkapPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const { data: categories } = useCategories()
  const camRef = useRef<HTMLInputElement>(null)
  const galRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [cropping, setCropping] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState(0)
  const [sell, setSell] = useState(0)
  const [location, setLocation] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [more, setMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)

  useEffect(() => {
    setLocation(localStorage.getItem(LOC_KEY) ?? '')
  }, [])
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  async function onFile(f: File | undefined) {
    if (!f) return
    const c = await compressImage(f)
    setBlob(c)
    setPreview(URL.createObjectURL(c))
    setTimeout(() => nameRef.current?.focus(), 150)
  }

  function reset() {
    setBlob(null)
    setPreview(null)
    setName('')
    setPrice(0)
    setSell(0)
  }

  async function save() {
    if (!name.trim()) {
      toast('Isi nama singkat produk dulu', 'error')
      nameRef.current?.focus()
      return
    }
    setSaving(true)
    try {
      const productId = crypto.randomUUID()
      const variantId = crypto.randomUUID()
      let photoKey: string | undefined
      if (blob) {
        photoKey = productId
        await saveBlob(photoKey, blob)
      }
      if (location) localStorage.setItem(LOC_KEY, location)
      // tampil langsung di katalog walau belum tersinkron
      qc.setQueryData<Product[]>(qk.catalog, (old) => [
        {
          id: productId,
          name: name.trim(),
          category_id: categoryId || null,
          supplier_id: null,
          status: 'candidate',
          photos: preview ? [preview] : [],
          notes: null,
          attributes: {},
          source: 'field',
          found_location: location || null,
          created_at: new Date().toISOString(),
          _pending: true,
          variants: [
            {
              id: variantId,
              product_id: productId,
              name: 'Standar',
              sku: null,
              photo: null,
              buy_price: price,
              sell_price: sell,
              unit: 'pcs',
              unit_size: 1,
              stock: 0,
              min_stock: 0,
              manual_forecast: null,
            },
          ],
        },
        ...(old ?? []),
      ])
      await enqueue({
        kind: 'capture',
        productId,
        variantId,
        name: name.trim(),
        price,
        sellPrice: sell || undefined,
        location: location || undefined,
        categoryId: categoryId || null,
        photoKey,
      })
      setSavedCount((n) => n + 1)
      toast(navigator.onLine ? 'Tersimpan sebagai Kandidat' : 'Tersimpan di HP, sinkron saat online')
      setBlob(null)
      setName('')
      setPrice(0)
      setSell(0)
      setPreview(null)
    } finally {
      setSaving(false)
    }
  }

  const step = !preview && !name ? 1 : 2

  return (
    <div>
      <PageHeader title="Foto Produk" subtitle="Foto → nama & harga → simpan" back="/" />

      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ''))} />
      <input ref={galRef} type="file" accept="image/*" hidden onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ''))} />

      <div className="mb-4 flex items-center gap-2 text-xs font-semibold">
        {['Foto', 'Nama & harga', 'Simpan'].map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <span className={cx('flex size-6 items-center justify-center rounded-full', i < step ? 'bg-brand-700 text-white' : 'bg-ink-100 text-ink-500')}>{i + 1}</span>
            <span className={i < step ? 'text-ink-800' : 'text-ink-400'}>{s}</span>
          </div>
        ))}
      </div>

      {preview ? (
        <div className="relative overflow-hidden rounded-[2rem] bg-ink-100 shadow-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="aspect-square w-full object-cover" />
          <div className="absolute right-3 bottom-3 flex gap-2">
            <button onClick={() => setCropping(true)} className="flex items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-2 text-sm font-semibold shadow backdrop-blur">
              <Crop className="size-4" /> Crop
            </button>
            <button onClick={() => camRef.current?.click()} className="flex items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-2 text-sm font-semibold shadow backdrop-blur">
              <RotateCcw className="size-4" /> Ulang
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <button
            onClick={() => camRef.current?.click()}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-[2rem] bg-gradient-to-br from-sun-400 to-sun-600 text-white shadow-sun transition active:scale-[0.99]"
          >
            <span className="flex size-20 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/40">
              <Camera className="size-10" strokeWidth={2} />
            </span>
            <span className="text-xl font-bold">Buka Kamera</span>
            <span className="text-sm text-white/85">Ketuk untuk memotret produk</span>
          </button>
          <Button variant="outline" size="lg" onClick={() => galRef.current?.click()}>
            <Images className="size-5" /> Pilih dari galeri
          </Button>
        </div>
      )}

      <div className="mt-5 space-y-3.5">
        <Input ref={nameRef} label="Nama singkat" placeholder="mis. Tumbler kopi 500ml motif" value={name} onChange={(e) => setName(e.target.value)} enterKeyHint="next" />
        <MoneyInput label="Harga kulakan (per pcs)" value={price} onChange={setPrice} />
        {more ? (
          <>
            <MoneyInput label="Perkiraan harga jual" value={sell} onChange={setSell} />
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-700">Lokasi / toko supplier</span>
              <div className="relative">
                <MapPin className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-ink-400" />
                <Input className="pl-11" placeholder="mis. Pasar Asemka Blok B-12" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
            </label>
            <Select label="Kategori" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Tanpa kategori</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </>
        ) : (
          <button onClick={() => setMore(true)} className="text-sm font-semibold text-brand-700">
            + Harga jual, lokasi, kategori (opsional)
          </button>
        )}
      </div>

      <div className="sticky bottom-28 mt-6 flex gap-3">
        {(preview || name) && (
          <Button variant="outline" size="lg" onClick={reset}>
            Batal
          </Button>
        )}
        <Button variant="primary" size="lg" block loading={saving} onClick={save}>
          <Check className="size-5" /> Simpan sebagai Kandidat
        </Button>
      </div>

      {savedCount > 0 && (
        <Link href="/produk?status=candidate" className="mt-4 flex items-center justify-between rounded-2xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          {savedCount} produk tersimpan sesi ini — lengkapi varian nanti
          <ChevronRight className="size-4" />
        </Link>
      )}

      {cropping && preview && (
        <CropModal
          src={preview}
          onCancel={() => setCropping(false)}
          onDone={async (b) => {
            const c = await compressImage(b)
            setBlob(c)
            setPreview(URL.createObjectURL(c))
            setCropping(false)
          }}
        />
      )}
    </div>
  )
}
