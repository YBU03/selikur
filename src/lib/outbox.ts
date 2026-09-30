'use client'
/**
 * Antrean tulis offline. Dipakai untuk alur yang harus jalan tanpa sinyal:
 * foto produk di lapangan dan mode belanja. Operasi disimpan di IndexedDB
 * lalu dikirim berurutan saat online.
 */
import { get, set, del, createStore } from 'idb-keyval'
import { supabase } from './supabase'
import { uploadPhoto } from './photos'

const store = typeof indexedDB !== 'undefined' ? createStore('selikur-outbox', 'kv') : undefined

export type OutboxOp =
  | { kind: 'update'; table: string; id: string; patch: Record<string, unknown> }
  | { kind: 'insert'; table: string; row: Record<string, unknown> }
  | { kind: 'delete'; table: string; id: string }
  | { kind: 'rpc'; fn: string; args: Record<string, unknown> }
  | {
      kind: 'capture'
      productId: string
      variantId: string
      name: string
      price: number
      sellPrice?: number
      notes?: string
      location?: string
      supplierId?: string | null
      categoryId?: string | null
      photoKey?: string
    }

interface Entry {
  id: string
  op: OutboxOp
  at: number
  tries: number
}

const KEY = 'ops'
const listeners = new Set<(n: number) => void>()
let flushing: Promise<void> | null = null
let afterFlush: (() => void) | null = null

async function readAll(): Promise<Entry[]> {
  if (!store) return []
  return ((await get(KEY, store)) as Entry[] | undefined) ?? []
}
async function writeAll(entries: Entry[]) {
  if (!store) return
  await set(KEY, entries, store)
  listeners.forEach((l) => l(entries.length))
}

export function onOutboxChange(fn: (n: number) => void) {
  listeners.add(fn)
  readAll().then((e) => fn(e.length))
  return () => listeners.delete(fn)
}

export function setAfterFlush(fn: () => void) {
  afterFlush = fn
}

export async function saveBlob(key: string, blob: Blob) {
  if (store) await set(`blob:${key}`, blob, store)
}
export async function loadBlob(key: string) {
  return store ? ((await get(`blob:${key}`, store)) as Blob | undefined) : undefined
}

export async function enqueue(op: OutboxOp) {
  const all = await readAll()
  all.push({ id: crypto.randomUUID(), op, at: Date.now(), tries: 0 })
  await writeAll(all)
  void flush()
}

function isNetworkError(e: unknown) {
  const msg = String((e as { message?: string })?.message ?? e)
  return (
    (typeof navigator !== 'undefined' && !navigator.onLine) ||
    /fetch|network|Load failed|timeout|NetworkError/i.test(msg)
  )
}

async function run(op: OutboxOp) {
  switch (op.kind) {
    case 'update': {
      const { error } = await supabase.from(op.table).update(op.patch).eq('id', op.id)
      if (error) throw error
      return
    }
    case 'insert': {
      const { error } = await supabase.from(op.table).upsert(op.row)
      if (error) throw error
      return
    }
    case 'delete': {
      const { error } = await supabase.from(op.table).delete().eq('id', op.id)
      if (error) throw error
      return
    }
    case 'rpc': {
      const { error } = await supabase.rpc(op.fn, op.args)
      if (error) throw error
      return
    }
    case 'capture': {
      const photos: string[] = []
      if (op.photoKey) {
        const blob = await loadBlob(op.photoKey)
        if (blob) photos.push(await uploadPhoto(blob))
      }
      const { error } = await supabase.from('products').insert({
        id: op.productId,
        name: op.name,
        status: 'candidate',
        source: 'field',
        photos,
        notes: op.notes || null,
        found_location: op.location || null,
        supplier_id: op.supplierId || null,
        category_id: op.categoryId || null,
      })
      if (error && error.code !== '23505') throw error
      const { error: e2 } = await supabase.from('variants').insert({
        id: op.variantId,
        product_id: op.productId,
        name: 'Standar',
        buy_price: op.price,
        sell_price: op.sellPrice ?? 0,
      })
      if (e2 && e2.code !== '23505') throw e2
      if (op.price > 0) {
        await supabase.from('price_history').insert({ variant_id: op.variantId, price: op.price, supplier_id: op.supplierId || null })
      }
      if (op.photoKey && store) await del(`blob:${op.photoKey}`, store)
      return
    }
  }
}

export function flush(): Promise<void> {
  if (flushing) return flushing
  flushing = (async () => {
    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session) return
      let entries = await readAll()
      let processed = 0
      while (entries.length) {
        const e = entries[0]
        try {
          await run(e.op)
          processed++
        } catch (err) {
          if (isNetworkError(err)) break
          e.tries++
          console.error('Outbox gagal', e.op, err)
          if (e.tries < 3) {
            await writeAll(entries)
            break
          }
        }
        entries = (await readAll()).filter((x) => x.id !== e.id)
        await writeAll(entries)
      }
      if (processed && afterFlush) afterFlush()
    } finally {
      flushing = null
    }
  })()
  return flushing
}
