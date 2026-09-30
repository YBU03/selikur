import type { Product, Profile, Variant } from './types'
import { breakdown, pricingCfg } from './pricing'

export interface SimLine {
  product: Product
  variant: Variant
  qty: number
  /** Harga beli per pcs (rencana atau aktual). */
  price: number
  supplierId: string | null
}

export interface SimTotals {
  lines: number
  pcs: number
  /** Total uang belanja (modal). */
  modal: number
  /** Perkiraan omzet bila semua terjual di harga jual sekarang. */
  omzet: number
  fee: number
  commission: number
  profitOrganic: number
  profitAffiliate: number
  marginOrganic: number | null
  marginAffiliate: number | null
  /** Barang yang harga jualnya belum diisi. */
  noSellPrice: number
}

export interface SupplierSim extends SimTotals {
  supplierId: string | null
}

function empty(): SimTotals {
  return {
    lines: 0,
    pcs: 0,
    modal: 0,
    omzet: 0,
    fee: 0,
    commission: 0,
    profitOrganic: 0,
    profitAffiliate: 0,
    marginOrganic: null,
    marginAffiliate: null,
    noSellPrice: 0,
  }
}

function add(t: SimTotals, l: SimLine, profile: Profile) {
  const cfg = pricingCfg(profile, l.product)
  const b = breakdown(l.price, l.variant.sell_price, cfg)
  t.lines++
  t.pcs += l.qty
  t.modal += l.qty * l.price
  if (!l.variant.sell_price) {
    t.noSellPrice++
    return
  }
  t.omzet += l.qty * b.sell
  t.fee += l.qty * b.fee
  t.commission += l.qty * b.commission
  t.profitOrganic += l.qty * b.profitOrganic
  t.profitAffiliate += l.qty * b.profitAffiliate
}

function finish(t: SimTotals) {
  // margin dari modal barang yang sudah punya harga jual (omzet − potongan − laba = modalnya)
  const modalWithPrice = t.omzet - t.fee - t.profitOrganic
  t.marginOrganic = modalWithPrice > 0 ? t.profitOrganic / modalWithPrice : null
  t.marginAffiliate = modalWithPrice > 0 ? t.profitAffiliate / modalWithPrice : null
  return t
}

/**
 * Simulasi belanja: berapa modal keluar, perkiraan omzet & laba bila semua barang terjual
 * di harga jual sekarang — organik dan bila lewat affiliate.
 */
export function simulateShopping(lines: SimLine[], profile: Profile) {
  const total = empty()
  const bySup = new Map<string, SupplierSim>()
  for (const l of lines) {
    if (l.qty <= 0) continue
    add(total, l, profile)
    const key = l.supplierId ?? '-'
    const s = bySup.get(key) ?? { ...empty(), supplierId: l.supplierId }
    add(s, l, profile)
    bySup.set(key, s)
  }
  return { total: finish(total), bySupplier: [...bySup.values()].map((s) => finish(s) as SupplierSim).sort((a, b) => b.modal - a.modal) }
}
