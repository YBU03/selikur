/* Selikur service worker — app shell offline, foto produk di-cache. */
const VERSION = 'selikur-v1'
const SHELL = `${VERSION}-shell`
const STATIC = `${VERSION}-static`
const IMAGES = `${VERSION}-img`
const ROUTES = ['/', '/masuk', '/produk', '/produk/baru', '/produk/detail', '/tangkap', '/belanja', '/belanja/detail', '/forecast', '/penjualan', '/jadwal', '/rekap', '/harga', '/pengaturan', '/menu']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => Promise.all(ROUTES.map((r) => c.add(new Request(r, { cache: 'reload' })).catch(() => {}))))
      .then(() => caches.open(STATIC))
      .then((c) => c.addAll(['/icons/icon-192.png', '/logo-mark.png', '/manifest.webmanifest']).catch(() => {}))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function networkFirst(req, cacheName, fallbackKey) {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(req)
    if (res.ok) cache.put(fallbackKey ?? req, res.clone())
    return res
  } catch {
    const hit = (await cache.match(fallbackKey ?? req, { ignoreSearch: true })) || (await cache.match('/'))
    if (hit) return hit
    throw new Error('offline')
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone())
  return res
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // foto produk dari Supabase Storage (publik)
  if (url.pathname.includes('/storage/v1/object/public/')) {
    event.respondWith(cacheFirst(req, IMAGES))
    return
  }
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    const key = new Request(url.origin + url.pathname)
    event.respondWith(networkFirst(req, SHELL, key))
    return
  }
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || /\.(png|svg|woff2?|webmanifest)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(req, STATIC))
    return
  }
  // payload RSC navigasi Next.js
  if (req.headers.get('RSC') === '1') {
    event.respondWith(networkFirst(req, SHELL).catch(() => Response.error()))
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((list) => {
      for (const c of list) if ('focus' in c) return c.navigate('/jadwal').then((w) => w && w.focus())
      return self.clients.openWindow('/jadwal')
    }),
  )
})
