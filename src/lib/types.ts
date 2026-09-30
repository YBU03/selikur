export type ProductStatus = 'active' | 'candidate' | 'inactive'
export type ListStatus = 'draft' | 'in_progress' | 'done'
export type ItemStatus = 'pending' | 'bought' | 'unavailable'
export type Recurrence = 'none' | 'weekly' | 'biweekly' | 'monthly'

/** Pengaturan toko (satu baris bersama, tabel store_settings). */
export interface Profile {
  id: number
  store_name: string
  coverage_weeks: number
  forecast_method: 'sma' | 'wma'
  seasonal_factor: number
  seasonal_label: string | null
  default_budget: number | null
  platform_fee_pct: number
  affiliate_pct: number
  default_markup_pct: number
  fee_basis: 'price' | 'cost_margin'
  price_rounding: number
  sim_steps: number[]
  safe_min_pct: number
  safe_max_pct: number
  target_fast_pct: number
  target_normal_pct: number
  target_slow_pct: number
  promo_min_margin_pct: number
  promo_steps: number[]
  promo_extra_fee_pct: number
}

export interface ExtraAttribute {
  key: string
  label: string
  unit?: string
}

export interface Category {
  id: string
  name: string
  extra_attributes: ExtraAttribute[]
}

export interface Supplier {
  id: string
  name: string
  location: string | null
  whatsapp: string | null
  notes: string | null
}

export interface Variant {
  id: string
  product_id: string
  name: string
  sku: string | null
  photo: string | null
  buy_price: number
  sell_price: number
  unit: string
  unit_size: number
  stock: number
  min_stock: number
  manual_forecast: number | null
  price_mode: 'manual' | 'markup'
  markup_pct: number | null
  created_at?: string
}

export interface Product {
  id: string
  name: string
  category_id: string | null
  supplier_id: string | null
  status: ProductStatus
  photos: string[]
  notes: string | null
  attributes: Record<string, string>
  source: 'upload' | 'field'
  found_location: string | null
  platform_fee_pct: number | null
  affiliate_pct: number | null
  created_at: string
  variants: Variant[]
  _pending?: boolean
}

export interface SalesRow {
  id: string
  owner_id: string
  variant_id: string
  sale_date: string
  qty: number
  source: 'manual' | 'import'
  channel: 'organik' | 'affiliate'
  note: string | null
  created_at: string
}

export interface PriceHistory {
  id: string
  variant_id: string
  recorded_on: string
  price: number
  supplier_id: string | null
}

export interface Schedule {
  id: string
  title: string
  scheduled_on: string
  scheduled_time: string | null
  recurrence: Recurrence
  location: string | null
  budget: number | null
  remind_day_before: boolean
  remind_morning: boolean
  notes: string | null
}

export interface ShoppingList {
  id: string
  schedule_id: string | null
  title: string
  status: ListStatus
  budget: number | null
  planned_total: number
  actual_total: number
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface ShoppingItem {
  id: string
  list_id: string
  variant_id: string | null
  supplier_id: string | null
  custom_name: string | null
  qty_planned: number
  price_planned: number
  qty_actual: number | null
  price_actual: number | null
  status: ItemStatus
  note: string | null
  sort_order: number
  created_at?: string
}

export const UNITS: { value: string; label: string; size: number }[] = [
  { value: 'pcs', label: 'Pcs', size: 1 },
  { value: 'lusin', label: 'Lusin (12)', size: 12 },
  { value: 'kodi', label: 'Kodi (20)', size: 20 },
  { value: 'karton', label: 'Karton', size: 24 },
]

export const STATUS_LABEL: Record<ProductStatus, string> = {
  active: 'Aktif',
  candidate: 'Kandidat',
  inactive: 'Nonaktif',
}

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: 'Sekali',
  weekly: 'Mingguan',
  biweekly: '2 Mingguan',
  monthly: 'Bulanan',
}

export const LIST_STATUS: Record<ListStatus, { label: string; tone: 'gray' | 'orange' | 'green' }> = {
  draft: { label: 'Draf', tone: 'gray' },
  in_progress: { label: 'Berjalan', tone: 'orange' },
  done: { label: 'Selesai', tone: 'green' },
}

export type Role = 'super_admin' | 'admin' | 'user'
export type MemberStatus = 'pending' | 'approved' | 'rejected' | 'disabled'

export interface Member {
  id: string
  email: string | null
  full_name: string | null
  role: Role
  status: MemberStatus
  approved_by: string | null
  approved_at: string | null
  created_at: string
}

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  user: 'User',
}

export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  pending: 'Menunggu',
  approved: 'Aktif',
  rejected: 'Ditolak',
  disabled: 'Nonaktif',
}
