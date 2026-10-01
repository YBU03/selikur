import imageCompression from 'browser-image-compression'
import { supabase, PHOTO_BUCKET, currentUserId } from './supabase'

/** Kompres ke JPEG maks ~500 KB (orientasi EXIF dari kamera ikut diterapkan). */
export async function compressImage(file: Blob): Promise<Blob> {
  const f = file instanceof File ? file : new File([file], 'foto.jpg', { type: file.type || 'image/jpeg' })
  try {
    return await imageCompression(f, {
      maxSizeMB: 0.48,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.85,
    })
  } catch {
    // Cadangan: gambar ulang lewat canvas agar tetap JPEG kecil (bucket hanya terima JPEG/PNG/WebP ≤ 2 MB).
    try {
      return await redraw(URL.createObjectURL(f), 0)
    } catch {
      throw new Error('Format foto tidak didukung. Coba foto ulang atau pilih foto JPG/PNG.')
    }
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Foto gagal dibuka'))
    i.src = src
  })
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal memproses foto'))), 'image/jpeg', 0.88))
}

/** Gambar ulang foto dengan rotasi kelipatan 90° (maks sisi 1600 px). */
async function redraw(src: string, deg: number): Promise<Blob> {
  const img = await loadImage(src)
  const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const turn = ((deg % 360) + 360) % 360
  const swap = turn === 90 || turn === 270
  const canvas = document.createElement('canvas')
  canvas.width = swap ? h : w
  canvas.height = swap ? w : h
  const ctx = canvas.getContext('2d')!
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((turn * Math.PI) / 180)
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  return toJpeg(canvas)
}

/** Putar foto 90° searah (deg = 90) atau berlawanan jarum jam (deg = -90). */
export async function rotateImage(src: string, deg: number): Promise<Blob> {
  return redraw(src, deg)
}

export async function uploadPhoto(blob: Blob, path?: string): Promise<string> {
  const uid = await currentUserId()
  const name = path ?? `${uid}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(name, blob, { contentType: 'image/jpeg', upsert: !!path, cacheControl: '31536000' })
  if (error) throw error
  return name
}

export async function removePhotos(paths: string[]) {
  const own = paths.filter((p) => p && !p.startsWith('http') && !p.startsWith('blob:'))
  if (own.length) await supabase.storage.from(PHOTO_BUCKET).remove(own)
}

/** Potong foto sesuai area dari react-easy-crop, termasuk rotasi bebas. */
export async function cropToBlob(src: string, area: { x: number; y: number; width: number; height: number }, rotation = 0): Promise<Blob> {
  const img = await loadImage(src)
  const rad = (rotation * Math.PI) / 180
  const bw = Math.abs(Math.cos(rad) * img.width) + Math.abs(Math.sin(rad) * img.height)
  const bh = Math.abs(Math.sin(rad) * img.width) + Math.abs(Math.cos(rad) * img.height)
  const full = document.createElement('canvas')
  full.width = Math.round(bw)
  full.height = Math.round(bh)
  const fctx = full.getContext('2d')!
  fctx.translate(bw / 2, bh / 2)
  fctx.rotate(rad)
  fctx.drawImage(img, -img.width / 2, -img.height / 2)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(area.width)
  canvas.height = Math.round(area.height)
  canvas.getContext('2d')!.drawImage(full, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height)
  return toJpeg(canvas)
}
