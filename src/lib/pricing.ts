import type { Product, Profile } from './types'

/**
 * Model harga jual:
 * - markup  : margin yang diinginkan, persen dari harga kulakan (mis. 50% → untung 0,5 × modal)
 * - fee     : potongan platform marketplace (persen dari harga jual)
 * - affiliate: komisi affiliate (persen dari harga jual)
 *
 * basis 'price'      → harga jual dinaikkan agar SETELAH dipotong platform + affiliate
 *                      untungnya tetap sesuai markup: jual = modal × (1+markup) / (1 − fee − aff)
 * basis 'cost_margin'→ seperti rumus di Excel simulasi: jual = modal × (1+markup) × (1 + fee + aff)
 */
export type FeeBasis = 'price' | 'cost_margin'
export type Rounding = 0 | 100 | 500 | 1000

export interface PricingCfg {
  feePct: number
  affiliatePct: number
  basis: FeeBasis
  rounding: Rounding
}

export const MARKUP_PRESETS = [30, 40, 50, 60, 70, 80, 90, 100]

export function pricingCfg(profile: Pick<Profile, 'platform_fee_pct' | 'affiliate_pct' | 'fee_basis' | 'price_rounding'>, product?: Pick<Product, 'platform_fee_pct' | 'affiliate_pct'> | null): PricingCfg {
  return {
    feePct: Number(product?.platform_fee_pct ?? profile.platform_fee_pct ?? 0),
    affiliatePct: Number(product?.affiliate_pct ?? profile.affiliate_pct ?? 0),
    basis: profile.fee_basis ?? 'price',
    rounding: (Number(profile.price_rounding) || 0) as Rounding,
  }
}

export function roundPrice(n: number, r: Rounding) {
  if (!r) return Math.round(n)
  return Math.ceil(n / r) * r
}

export function priceFromMarkup(cost: number, markupPct: number, cfg: PricingCfg, withAffiliate = true) {
  const base = cost * (1 + markupPct / 100)
  const cut = (cfg.feePct + (withAffiliate ? cfg.affiliatePct : 0)) / 100
  const raw = cfg.basis === 'price' ? (cut >= 1 ? base : base / (1 - cut)) : base * (1 + cut)
  return roundPrice(raw, cfg.rounding)
}

export interface Breakdown {
  sell: number
  cost: number
  fee: number
  affiliate: number
  net: number
  profit: number
  profitNoAffiliate: number
  marginOnCost: number | null
  marginOnSell: number | null
}

/** Rincian nyata dari harga jual: potongan & komisi selalu dihitung dari harga jual. */
export function breakdown(cost: number, sell: number, cfg: PricingCfg): Breakdown {
  const fee = (sell * cfg.feePct) / 100
  const affiliate = (sell * cfg.affiliatePct) / 100
  const net = sell - fee - affiliate
  const profit = net - cost
  return {
    sell,
    cost,
    fee,
    affiliate,
    net,
    profit,
    profitNoAffiliate: profit + affiliate,
    marginOnCost: cost > 0 ? profit / cost : null,
    marginOnSell: sell > 0 ? profit / sell : null,
  }
}

/** Markup (persen dari modal) yang tersirat dari harga jual, dengan basis yang sama. */
export function impliedMarkup(cost: number, sell: number, cfg: PricingCfg) {
  if (!cost) return null
  const cut = (cfg.feePct + cfg.affiliatePct) / 100
  const base = cfg.basis === 'price' ? sell * (1 - cut) : sell / (1 + cut)
  return (base / cost - 1) * 100
}

// ================= Simulasi & saran harga =================

/** Kolom simulasi seperti file Excel: markup 50%–100% dari modal. */
export const SIM_STEPS = [50, 60, 70, 80, 90, 100]
export const SAFE_MIN = 50
export const SAFE_MAX = 100

/** Harga "cantik" marketplace: dibulatkan ke atas lalu berakhiran 900 (mis. 67.200 → 67.900). */
export function prettyPrice(n: number) {
  if (n <= 0) return 0
  if (n < 20000) return Math.ceil(n / 500) * 500
  let p = Math.ceil(n / 1000) * 1000 - 100
  if (p < n) p += 1000
  return p
}

export type Velocity = 'laris' | 'normal' | 'lambat' | 'baru'

export const VELOCITY_INFO: Record<Velocity, { label: string; target: number; reason: string }> = {
  laris: { label: 'Laris', target: 90, reason: 'Penjualannya di atas rata-rata toko, jadi masih ada ruang menaikkan margin.' },
  normal: { label: 'Normal', target: 70, reason: 'Penjualan setara rata-rata toko; margin tengah menjaga harga tetap bersaing.' },
  lambat: { label: 'Lambat', target: 55, reason: 'Penjualan di bawah rata-rata; margin tipis tapi aman membantu barang cepat berputar.' },
  baru: { label: 'Belum ada data', target: 70, reason: 'Belum ada data penjualan; mulai dari margin tengah lalu sesuaikan setelah ada penjualan.' },
}

/** Kecepatan jual produk dibanding rata-rata produk lain yang punya data. */
export function velocityOf(weekly: number, storeAvg: number, anySalesInStore: boolean): Velocity {
  if (!anySalesInStore) return 'baru'
  if (storeAvg <= 0) return 'normal'
  if (weekly >= storeAvg * 1.5) return 'laris'
  if (weekly < storeAvg * 0.5) return 'lambat'
  return 'normal'
}

export type PriceStatus = 'rugi' | 'murah' | 'aman' | 'premium'

export const PRICE_STATUS_INFO: Record<PriceStatus, { label: string; tone: 'red' | 'orange' | 'green' | 'leaf' }> = {
  rugi: { label: 'Rugi', tone: 'red' },
  murah: { label: 'Terlalu murah', tone: 'orange' },
  aman: { label: 'Aman', tone: 'green' },
  premium: { label: 'Premium', tone: 'leaf' },
}

export function priceStatus(cost: number, sell: number, cfg: PricingCfg): PriceStatus {
  const b = breakdown(cost, sell, cfg)
  if (b.profit <= 0) return 'rugi'
  const m = (b.marginOnCost ?? 0) * 100
  if (m < SAFE_MIN - 0.5) return 'murah'
  if (m > SAFE_MAX + 0.5) return 'premium'
  return 'aman'
}

export interface Recommendation {
  price: number
  markup: number
  velocity: Velocity
  status: PriceStatus
  /** Harga sekarang sudah dekat saran (selisih ≤ 5%). */
  fits: boolean
  message: string
}

/**
 * Saran harga jual per produk:
 * target markup menurut kecepatan jual (laris 90%, normal 70%, lambat 55%),
 * dijaga di rentang aman 50–100%, lalu dibulatkan ke harga cantik.
 */
export function recommend(cost: number, current: number, cfg: PricingCfg, velocity: Velocity): Recommendation {
  const target = VELOCITY_INFO[velocity].target
  const floor = priceFromMarkup(cost, SAFE_MIN, { ...cfg, rounding: 0 })
  const ceil = priceFromMarkup(cost, SAFE_MAX, { ...cfg, rounding: 0 })
  let price = prettyPrice(priceFromMarkup(cost, target, { ...cfg, rounding: 0 }))
  if (price < floor) price = prettyPrice(floor)
  if (price > ceil) price = Math.max(prettyPrice(floor), Math.floor(ceil / 1000) * 1000 - 100)
  const b = breakdown(cost, price, cfg)
  const status = priceStatus(cost, current, cfg)
  const fits = current > 0 && Math.abs(current - price) / price <= 0.05
  let message: string
  if (!current) message = 'Harga jual belum diisi.'
  else if (status === 'rugi') message = 'Harga sekarang rugi setelah dipotong platform. Naikkan harga atau cari modal lebih murah.'
  else if (status === 'murah') message = `Laba sekarang di bawah ${SAFE_MIN}% dari modal. Naikkan ke harga saran, atau kalau harga pasar tidak memungkinkan, coba nego modal ke supplier.`
  else if (status === 'premium') message = 'Harga sekarang di atas simulasi 100%. Boleh dipertahankan kalau tetap laku & bersaing.'
  else if (fits) message = 'Harga sekarang sudah pas dengan saran.'
  else message = current > price ? 'Harga sekarang aman dan lebih tinggi dari saran.' : 'Harga sekarang aman; ada ruang naik ke harga saran.'
  return { price, markup: Math.round((b.marginOnCost ?? 0) * 100), velocity, status, fits, message }
}
