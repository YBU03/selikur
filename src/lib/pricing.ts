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
