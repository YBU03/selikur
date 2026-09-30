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

/** Nilai bawaan — semuanya bisa diubah admin di Pengaturan harga. */
export const SIM_STEPS = [50, 60, 70, 80, 90, 100]
export const SAFE_MIN = 50
export const SAFE_MAX = 100

export interface SimCfg {
  steps: number[]
  safeMin: number
  safeMax: number
  targets: Record<Velocity, number>
}

type SimProfile = Partial<
  Pick<Profile, 'sim_steps' | 'safe_min_pct' | 'safe_max_pct' | 'target_fast_pct' | 'target_normal_pct' | 'target_slow_pct'>
>

export function simCfg(p: SimProfile): SimCfg {
  const steps = (p.sim_steps?.length ? p.sim_steps : SIM_STEPS).map(Number).sort((a, b) => a - b)
  const normal = Number(p.target_normal_pct ?? 70)
  return {
    steps,
    safeMin: Number(p.safe_min_pct ?? SAFE_MIN),
    safeMax: Number(p.safe_max_pct ?? SAFE_MAX),
    targets: {
      laris: Number(p.target_fast_pct ?? 90),
      normal,
      lambat: Number(p.target_slow_pct ?? 55),
      baru: normal,
    },
  }
}

export const DEFAULT_SIM = simCfg({})

/** Harga "cantik" marketplace: dibulatkan ke atas lalu berakhiran 900 (mis. 67.200 → 67.900). */
export function prettyPrice(n: number) {
  if (n <= 0) return 0
  if (n < 20000) return Math.ceil(n / 500) * 500
  let p = Math.ceil(n / 1000) * 1000 - 100
  if (p < n) p += 1000
  return p
}

export type Velocity = 'laris' | 'normal' | 'lambat' | 'baru'

export const VELOCITY_INFO: Record<Velocity, { label: string; reason: string }> = {
  laris: { label: 'Laris', reason: 'Penjualannya di atas rata-rata toko, jadi masih ada ruang menaikkan margin.' },
  normal: { label: 'Normal', reason: 'Penjualan setara rata-rata toko; margin tengah menjaga harga tetap bersaing.' },
  lambat: { label: 'Lambat', reason: 'Penjualan di bawah rata-rata; margin tipis tapi aman membantu barang cepat berputar.' },
  baru: { label: 'Belum ada data', reason: 'Belum ada data penjualan; mulai dari margin tengah lalu sesuaikan setelah ada penjualan.' },
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

export function priceStatus(cost: number, sell: number, cfg: PricingCfg, sim: SimCfg = DEFAULT_SIM): PriceStatus {
  const b = breakdown(cost, sell, cfg)
  if (b.profit <= 0) return 'rugi'
  const m = (b.marginOnCost ?? 0) * 100
  if (m < sim.safeMin - 0.5) return 'murah'
  if (m > sim.safeMax + 0.5) return 'premium'
  return 'aman'
}

export interface Recommendation {
  price: number
  markup: number
  target: number
  velocity: Velocity
  status: PriceStatus
  /** Harga sekarang sudah dekat saran (selisih ≤ 5%). */
  fits: boolean
  message: string
}

/**
 * Saran harga jual per produk: target margin menurut kecepatan jual,
 * dijaga di rentang aman, lalu dibulatkan ke harga cantik.
 */
export function recommend(cost: number, current: number, cfg: PricingCfg, velocity: Velocity, sim: SimCfg = DEFAULT_SIM): Recommendation {
  const target = sim.targets[velocity]
  const raw = { ...cfg, rounding: 0 as Rounding }
  const floor = priceFromMarkup(cost, sim.safeMin, raw)
  const ceil = priceFromMarkup(cost, sim.safeMax, raw)
  let price = prettyPrice(priceFromMarkup(cost, target, raw))
  if (price < floor) price = prettyPrice(floor)
  if (price > ceil) price = Math.max(prettyPrice(floor), Math.floor(ceil / 1000) * 1000 - 100)
  const b = breakdown(cost, price, cfg)
  const status = priceStatus(cost, current, cfg, sim)
  const fits = current > 0 && Math.abs(current - price) / price <= 0.05
  let message: string
  if (!current) message = 'Harga jual belum diisi.'
  else if (status === 'rugi') message = 'Harga sekarang rugi setelah dipotong platform. Naikkan harga atau cari modal lebih murah.'
  else if (status === 'murah')
    message = `Laba sekarang di bawah ${sim.safeMin}% dari modal. Naikkan ke harga saran, atau kalau harga pasar tidak memungkinkan, coba nego modal ke supplier.`
  else if (status === 'premium') message = `Harga sekarang di atas ${sim.safeMax}%. Boleh dipertahankan kalau tetap laku & bersaing.`
  else if (fits) message = 'Harga sekarang sudah pas dengan saran.'
  else message = current > price ? 'Harga sekarang aman dan lebih tinggi dari saran.' : 'Harga sekarang aman; ada ruang naik ke harga saran.'
  return { price, markup: Math.round((b.marginOnCost ?? 0) * 100), target, velocity, status, fits, message }
}

// ================= Promo: flash sale & voucher =================

export type PromoType = 'flash' | 'voucher' | 'diskon'

export const PROMO_INFO: Record<PromoType, { label: string; range: [number, number]; ideal: number; why: string }> = {
  flash: {
    label: 'Flash Sale',
    range: [10, 20],
    ideal: 15,
    why: 'Flash sale butuh potongan yang terasa (10–20%) supaya menarik di halaman promo, tapi hanya berlaku singkat dan stok terbatas, jadi margin tipis masih bisa diterima.',
  },
  voucher: {
    label: 'Voucher Toko',
    range: [5, 10],
    ideal: 10,
    why: 'Voucher toko cukup 5–10% dengan minimal belanja; tujuannya menaikkan jumlah barang per pesanan, bukan banting harga.',
  },
  diskon: {
    label: 'Diskon Harian',
    range: [3, 8],
    ideal: 5,
    why: 'Diskon harian dipasang terus-menerus, jadi kecil saja (3–8%) agar harga coret terlihat tanpa menggerus laba setiap hari.',
  },
}

export interface PromoResult {
  /** Diskon maksimal agar laba masih ≥ batas minimum promo. */
  safe: number
  /** Diskon maksimal sebelum rugi (impas). */
  breakEven: number
  /** Diskon yang disarankan untuk jenis promo ini. */
  suggested: number
  ok: boolean
  reason: string
}

/** Laba setelah diskon; potongan platform/affiliate + biaya program promo dihitung dari harga setelah diskon. */
export function promoBreakdown(cost: number, price: number, discountPct: number, cfg: PricingCfg, extraFeePct = 0) {
  const sell = price * (1 - discountPct / 100)
  return breakdown(cost, sell, { ...cfg, feePct: cfg.feePct + extraFeePct })
}

export function analyzePromo(cost: number, price: number, cfg: PricingCfg, type: PromoType, minMarginPct: number, extraFeePct = 0): PromoResult {
  const cut = (cfg.feePct + cfg.affiliatePct + extraFeePct) / 100
  const netFull = price * (1 - cut)
  const dFor = (profit: number) => (netFull > 0 ? Math.max(0, (1 - (cost + profit) / netFull) * 100) : 0)
  const safe = Math.floor(dFor((cost * minMarginPct) / 100))
  const breakEven = Math.floor(dFor(0))
  const [lo] = PROMO_INFO[type].range
  const { label, ideal } = PROMO_INFO[type]
  // titik ideal per jenis promo; turun ke kelipatan 5 terdekat bila margin tidak cukup
  let suggested = Math.min(ideal, Math.floor(safe / 5) * 5 || safe)
  if (safe >= lo && suggested < lo) suggested = lo
  const ok = suggested >= lo
  let reason: string
  if (!price || !cost) {
    suggested = 0
    reason = 'Isi harga kulak dan harga jual dulu.'
  } else if (breakEven <= 0) {
    suggested = 0
    reason = `Harga sekarang sudah rugi/impas, jangan ikut ${label} dulu. Naikkan harga normal terlebih dahulu.`
  } else if (!ok) {
    reason = `Margin tipis: diskon di atas ${safe}% membuat laba di bawah ${minMarginPct}% modal. ${label} biasanya butuh ≥${lo}%, jadi lebih baik naikkan harga normal (harga coret) dulu atau pilih promo yang lebih kecil.`
  } else {
    reason =
      suggested === ideal
        ? `Diskon ${suggested}% sudah cukup menarik untuk ${label} dan laba masih di atas ${minMarginPct}% modal. Masih aman sampai ${safe}%, di atas ${breakEven}% mulai rugi.`
        : `Diskon ${suggested}% adalah yang terbesar sebelum laba turun di bawah ${minMarginPct}% modal (batas aman ${safe}%, impas di ${breakEven}%).`
  }
  return { safe, breakEven, suggested: Math.max(0, suggested), ok, reason }
}
