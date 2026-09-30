import { supabase } from './supabase'
import type { Category, Product, ShoppingItem, Supplier, Variant } from './types'
import { indexVariants, variantLabel } from './queries'

export type RecapItem = ShoppingItem & { shopping_lists: { id: string; title: string; status: string; completed_at: string } }

export async function fetchRecapItems(from: Date, to: Date) {
  const { data, error } = await supabase
    .from('shopping_items')
    .select('*, shopping_lists!inner(id,title,status,completed_at)')
    .eq('shopping_lists.status', 'done')
    .gte('shopping_lists.completed_at', from.toISOString())
    .lt('shopping_lists.completed_at', to.toISOString())
  if (error) throw error
  return data as RecapItem[]
}

export interface Group {
  key: string
  name: string
  amount: number
  pcs: number
}

export interface Recap {
  total: number
  planned: number
  itemsPlanned: number
  itemsBought: number
  itemsUnavailable: number
  pcs: number
  fulfillment: number | null
  lists: number
  byCategory: Group[]
  byProduct: Group[]
  bySupplier: Group[]
  rows: {
    date: string
    list: string
    product: string
    variant: string
    category: string
    supplier: string
    qtyPlanned: number
    pricePlanned: number
    qtyActual: number
    priceActual: number
    amount: number
    status: string
  }[]
}

function add(map: Map<string, Group>, key: string, name: string, amount: number, pcs: number) {
  const g = map.get(key) ?? { key, name, amount: 0, pcs: 0 }
  g.amount += amount
  g.pcs += pcs
  map.set(key, g)
}

export function itemName(it: ShoppingItem, idx: Map<string, { product: Product; variant: Variant }>) {
  const e = it.variant_id ? idx.get(it.variant_id) : undefined
  return e ? variantLabel(e.product, e.variant) : it.custom_name ?? 'Barang'
}

export function computeRecap(items: RecapItem[], products: Product[], categories: Category[], suppliers: Supplier[]): Recap {
  const idx = indexVariants(products)
  const cat = new Map(categories.map((c) => [c.id, c.name]))
  const sup = new Map(suppliers.map((s) => [s.id, s.name]))
  const byCategory = new Map<string, Group>()
  const byProduct = new Map<string, Group>()
  const bySupplier = new Map<string, Group>()
  const lists = new Set<string>()
  const r: Recap = {
    total: 0,
    planned: 0,
    itemsPlanned: items.length,
    itemsBought: 0,
    itemsUnavailable: 0,
    pcs: 0,
    fulfillment: null,
    lists: 0,
    byCategory: [],
    byProduct: [],
    bySupplier: [],
    rows: [],
  }
  for (const it of items) {
    lists.add(it.list_id)
    const e = it.variant_id ? idx.get(it.variant_id) : undefined
    r.planned += it.qty_planned * it.price_planned
    const bought = it.status === 'bought'
    const qty = bought ? it.qty_actual ?? it.qty_planned : 0
    const price = it.price_actual ?? it.price_planned
    const amount = qty * price
    const catName = e?.product.category_id ? cat.get(e.product.category_id) ?? 'Tanpa kategori' : 'Tanpa kategori'
    const supId = it.supplier_id ?? e?.product.supplier_id ?? null
    const supName = supId ? sup.get(supId) ?? 'Tanpa supplier' : 'Tanpa supplier'
    if (bought) {
      r.itemsBought++
      r.total += amount
      r.pcs += qty
      add(byCategory, e?.product.category_id ?? '-', catName, amount, qty)
      add(byProduct, e?.product.id ?? `c:${it.custom_name}`, e?.product.name ?? it.custom_name ?? 'Barang', amount, qty)
      add(bySupplier, supId ?? '-', supName, amount, qty)
    }
    if (it.status === 'unavailable') r.itemsUnavailable++
    r.rows.push({
      date: it.shopping_lists.completed_at,
      list: it.shopping_lists.title,
      product: e?.product.name ?? it.custom_name ?? 'Barang',
      variant: e?.variant.name ?? '',
      category: catName,
      supplier: supName,
      qtyPlanned: it.qty_planned,
      pricePlanned: it.price_planned,
      qtyActual: qty,
      priceActual: bought ? price : 0,
      amount,
      status: it.status === 'bought' ? 'Terbeli' : it.status === 'unavailable' ? 'Tidak tersedia' : 'Tidak dibeli',
    })
  }
  r.lists = lists.size
  r.fulfillment = items.length ? r.itemsBought / items.length : null
  const sort = (m: Map<string, Group>) => [...m.values()].sort((a, b) => b.amount - a.amount)
  r.byCategory = sort(byCategory)
  r.byProduct = sort(byProduct)
  r.bySupplier = sort(bySupplier)
  r.rows.sort((a, b) => a.date.localeCompare(b.date))
  return r
}
