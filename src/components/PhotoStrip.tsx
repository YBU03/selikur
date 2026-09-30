'use client'
import { useRef, useState } from 'react'
import { Camera, ImagePlus, Crop, X, Star } from 'lucide-react'
import { compressImage } from '@/lib/photos'
import { photoUrl } from '@/lib/supabase'
import CropModal from './CropModal'

export interface PhotoItem {
  key: string
  path?: string
  blob?: Blob
  url: string
}

export function toPhotoItems(paths: string[]): PhotoItem[] {
  return paths.map((p) => ({ key: p, path: p, url: photoUrl(p)! }))
}

export default function PhotoStrip({ items, onChange, max = 5 }: { items: PhotoItem[]; onChange: (i: PhotoItem[]) => void; max?: number }) {
  const gal = useRef<HTMLInputElement>(null)
  const cam = useRef<HTMLInputElement>(null)
  const [crop, setCrop] = useState<PhotoItem | null>(null)
  const [busy, setBusy] = useState(false)

  async function add(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    const room = max - items.length
    const next: PhotoItem[] = []
    for (const f of Array.from(files).slice(0, room)) {
      const b = await compressImage(f)
      next.push({ key: crypto.randomUUID(), blob: b, url: URL.createObjectURL(b) })
    }
    onChange([...items, ...next])
    setBusy(false)
  }

  return (
    <div>
      <input ref={gal} type="file" accept="image/*" multiple hidden onChange={(e) => (add(e.target.files), (e.target.value = ''))} />
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (add(e.target.files), (e.target.value = ''))} />
      <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
        {items.map((it, i) => (
          <div key={it.key} className="relative size-28 shrink-0 overflow-hidden rounded-2xl bg-ink-100 ring-1 ring-ink-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.url} alt="" className="size-full object-cover" />
            {i === 0 && (
              <span className="absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded-full bg-brand-700/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                <Star className="size-2.5" /> Utama
              </span>
            )}
            <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between">
              <button type="button" onClick={() => setCrop(it)} className="flex size-7 items-center justify-center rounded-full bg-white/90 shadow" aria-label="Crop">
                <Crop className="size-3.5" />
              </button>
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([it, ...items.filter((x) => x.key !== it.key)])}
                  className="flex size-7 items-center justify-center rounded-full bg-white/90 shadow"
                  aria-label="Jadikan utama"
                >
                  <Star className="size-3.5" />
                </button>
              )}
              <button type="button" onClick={() => onChange(items.filter((x) => x.key !== it.key))} className="flex size-7 items-center justify-center rounded-full bg-white/90 text-red-600 shadow" aria-label="Hapus">
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
        {items.length < max && (
          <>
            <button type="button" onClick={() => cam.current?.click()} className="flex size-28 shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-sun-300 bg-sun-50 text-sm font-semibold text-sun-700">
              <Camera className="size-6" /> Kamera
            </button>
            <button type="button" disabled={busy} onClick={() => gal.current?.click()} className="flex size-28 shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50 text-sm font-semibold text-brand-700">
              <ImagePlus className="size-6" /> {busy ? 'Memproses…' : 'Galeri'}
            </button>
          </>
        )}
      </div>
      <p className="mt-1.5 text-xs text-ink-400">{items.length}/{max} foto · dikompres otomatis ±500 KB</p>
      {crop && (
        <CropModal
          src={crop.url}
          onCancel={() => setCrop(null)}
          onDone={async (b) => {
            const c = await compressImage(b)
            const item = { key: crypto.randomUUID(), blob: c, url: URL.createObjectURL(c) }
            onChange(items.map((x) => (x.key === crop.key ? item : x)))
            setCrop(null)
          }}
        />
      )}
    </div>
  )
}
