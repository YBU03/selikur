import imageCompression from 'browser-image-compression'
import { supabase, PHOTO_BUCKET, currentUserId } from './supabase'

/** Kompres ke JPEG maks ~500 KB. */
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
    return f
  }
}

export async function uploadPhoto(blob: Blob, path?: string): Promise<string> {
  const uid = await currentUserId()
  const name = path ?? `${uid}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(name, blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' })
  if (error) throw error
  return name
}

export async function removePhotos(paths: string[]) {
  const own = paths.filter((p) => p && !p.startsWith('http') && !p.startsWith('blob:'))
  if (own.length) await supabase.storage.from(PHOTO_BUCKET).remove(own)
}

export async function cropToBlob(src: string, area: { x: number; y: number; width: number; height: number }): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = src
  })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(area.width)
  canvas.height = Math.round(area.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height)
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal crop'))), 'image/jpeg', 0.9),
  )
}
