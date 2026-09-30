'use client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Category, Member, Product, Profile, Schedule, ShoppingItem, ShoppingList, Supplier, PriceHistory } from './types'
import { HISTORY_WEEKS, toBuckets } from './forecast'

function check<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

export const qk = {
  profile: ['profile'] as const,
  me: ['me'] as const,
  members: ['members'] as const,
  categories: ['categories'] as const,
  suppliers: ['suppliers'] as const,
  catalog: ['catalog'] as const,
  buckets: ['sales-buckets'] as const,
  lists: ['lists'] as const,
  list: (id: string) => ['list', id] as const,
  schedules: ['schedules'] as const,
}

/** Pengaturan toko bersama. */
export function useProfile() {
  return useQuery({
    queryKey: qk.profile,
    queryFn: async () => check(await supabase.from('store_settings').select('*').eq('id', 1).single()) as Profile,
  })
}

/** Akun yang sedang masuk (peran & status persetujuan). */
export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession()
      const uid = s.session?.user.id
      if (!uid) return null
      return check(await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()) as Member | null
    },
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? 15000 : false),
  })
}

export function useMembers(enabled = true) {
  return useQuery({
    queryKey: qk.members,
    enabled,
    queryFn: async () => check(await supabase.from('profiles').select('*').order('created_at', { ascending: false })) as Member[],
  })
}

export const defaultProfile: Profile = {
  id: 1,
  store_name: 'Toko Saya',
  coverage_weeks: 2,
  forecast_method: 'sma',
  seasonal_factor: 1,
  seasonal_label: null,
  default_budget: null,
  platform_fee_pct: 20,
  affiliate_pct: 0,
  default_markup_pct: 50,
  fee_basis: 'price',
  price_rounding: 0,
  sim_steps: [50, 60, 70, 80, 90, 100],
  safe_min_pct: 50,
  safe_max_pct: 100,
  target_fast_pct: 90,
  target_normal_pct: 70,
  target_slow_pct: 55,
  promo_min_margin_pct: 20,
  promo_steps: [5, 10, 15, 20, 25, 30],
  promo_extra_fee_pct: 0,
  affiliate_in_price: false,
  store_address: null,
  store_phone: null,
}

export function useCategories() {
  return useQuery({
    queryKey: qk.categories,
    queryFn: async () => check(await supabase.from('categories').select('*').order('name')) as Category[],
  })
}

export function useSuppliers() {
  return useQuery({
    queryKey: qk.suppliers,
    queryFn: async () => check(await supabase.from('suppliers').select('*').order('name')) as Supplier[],
  })
}

export function useCatalog() {
  return useQuery({
    queryKey: qk.catalog,
    queryFn: async () => {
      const rows = check(
        await supabase
          .from('products')
          .select('*, variants(*)')
          .order('created_at', { ascending: false })
          .order('created_at', { referencedTable: 'variants', ascending: true }),
      ) as Product[]
      return rows
    },
  })
}

export function useSalesBuckets() {
  return useQuery({
    queryKey: qk.buckets,
    queryFn: async () => {
      const rows = check(await supabase.rpc('sales_buckets', { p_weeks: HISTORY_WEEKS })) as {
        variant_id: string
        bucket: number
        qty: number
      }[]
      return rows
    },
    select: (rows) => toBuckets(rows),
  })
}

export type ListWithCount = ShoppingList & { shopping_items: { count: number }[] }

export function useLists() {
  return useQuery({
    queryKey: qk.lists,
    queryFn: async () =>
      check(
        await supabase.from('shopping_lists').select('*, shopping_items(count)').order('created_at', { ascending: false }),
      ) as ListWithCount[],
  })
}

export function useList(id: string | null) {
  return useQuery({
    queryKey: qk.list(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const [l, items] = await Promise.all([
        supabase.from('shopping_lists').select('*').eq('id', id!).single(),
        supabase.from('shopping_items').select('*').eq('list_id', id!).order('sort_order').order('created_at'),
      ])
      return { list: check(l) as ShoppingList, items: check(items) as ShoppingItem[] }
    },
  })
}

export function useSchedules() {
  return useQuery({
    queryKey: qk.schedules,
    queryFn: async () => check(await supabase.from('schedules').select('*').order('scheduled_on')) as Schedule[],
  })
}

export function usePriceHistory(variantIds: string[]) {
  return useQuery({
    queryKey: ['price-history', ...variantIds],
    enabled: variantIds.length > 0,
    queryFn: async () =>
      check(
        await supabase.from('price_history').select('*').in('variant_id', variantIds).order('recorded_on', { ascending: false }).limit(100),
      ) as PriceHistory[],
  })
}

export function useInvalidate() {
  const qc = useQueryClient()
  return (...keys: (readonly unknown[])[]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k })))
}

/** Indeks cepat varian -> {produk, varian}. */
export function indexVariants(products: Product[] | undefined) {
  const map = new Map<string, { product: Product; variant: Product['variants'][number] }>()
  for (const p of products ?? []) for (const v of p.variants) map.set(v.id, { product: p, variant: v })
  return map
}

export function variantLabel(p: { name: string }, v: { name: string }) {
  return v.name && v.name !== 'Standar' ? `${p.name} — ${v.name}` : p.name
}

export function usePricing() {
  const { data } = useProfile()
  return data ?? defaultProfile
}
