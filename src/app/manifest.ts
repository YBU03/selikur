import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Selikur — Kulakan Cerdas',
    short_name: 'Selikur',
    description: 'Forecast stok, daftar belanja kulakan, jadwal, dan rekap modal.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f7f5',
    theme_color: '#0b5f49',
    lang: 'id',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Foto Produk', url: '/tangkap', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Daftar Belanja', url: '/belanja', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
