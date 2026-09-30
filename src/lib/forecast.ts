import type { Product, Profile, Variant } from './types'

export type StockStatus = 'aman' | 'perlu' | 'kritis'

export const STOCK_LABEL: Record<StockStatus, string> = {
  aman: 'Aman',
  perlu: 'Perlu Kulak',
  kritis: 'Kritis',
}

export const WINDOW = 4
export const HISTORY_WEEKS = 12

/** Map variant_id -> qty per ember 7 hari; index 0 = 7 hari terakhir. */
export type Buckets = Map<string, number[]>

export function toBuckets(rows: { variant_id: string; bucket: number; qty: number }[], weeks = HISTORY_WEEKS): Buckets {
  const map: Buckets = new Map()
  for (const r of rows) {
    if (r.bucket < 0 || r.bucket >= weeks) continue
    let arr = map.get(r.variant_id)
    if (!arr) {
      arr = new Array(weeks).fill(0)
      map.set(r.variant_id, arr)
    }
    arr[r.bucket] += Number(r.qty)
  }
  return map
}

/** Rata-rata bergerak (sma) atau berbobot 4-3-2-1 (wma) dari 4 ember mulai `offset`. */
export function movingAverage(b: number[], method: 'sma' | 'wma', offset = 0) {
  const w = b.slice(offset, offset + WINDOW)
  while (w.length < WINDOW) w.push(0)
  if (method === 'wma') {
    const weights = [4, 3, 2, 1]
    return w.reduce((s, q, i) => s + q * weights[i], 0) / 10
  }
  return w.reduce((s, q) => s + q, 0) / WINDOW
}

export interface ForecastOpts {
  method: 'sma' | 'wma'
  coverageWeeks: number
  seasonal: number
}

export interface VariantForecast {
  variant: Variant
  product: Product
  history: number[]
  weekly: number
  basis: 'data' | 'manual' | 'kosong'
  need: number
  status: StockStatus
  weeksLeft: number | null
}

export function forecastVariant(product: Product, v: Variant, history: number[] | undefined, o: ForecastOpts): VariantForecast {
  const h = history ?? new Array(HISTORY_WEEKS).fill(0)
  const hasData = h.slice(0, WINDOW).some((q) => q > 0)
  let base = 0
  let basis: VariantForecast['basis'] = 'kosong'
  if (hasData) {
    base = movingAverage(h, o.method)
    basis = 'data'
  } else if (v.manual_forecast != null) {
    base = Number(v.manual_forecast)
    basis = 'manual'
  }
  const weekly = base * (o.seasonal || 1)
  const raw = Math.max(0, weekly * o.coverageWeeks + v.min_stock - v.stock)
  const size = Math.max(1, v.unit_size || 1)
  const need = raw > 0 ? Math.ceil(raw / size) * size : 0

  let status: StockStatus = 'aman'
  if (v.stock < v.min_stock || (weekly > 0 && v.stock < weekly)) status = 'kritis'
  else if (need > 0) status = 'perlu'

  return {
    variant: v,
    product,
    history: h,
    weekly,
    basis,
    need,
    status,
    weeksLeft: weekly > 0 ? v.stock / weekly : null,
  }
}

export function forecastAll(products: Product[], buckets: Buckets, profile: Pick<Profile, 'forecast_method' | 'coverage_weeks' | 'seasonal_factor'>, coverageOverride?: number) {
  const o: ForecastOpts = {
    method: profile.forecast_method,
    coverageWeeks: coverageOverride ?? Number(profile.coverage_weeks) ?? 2,
    seasonal: Number(profile.seasonal_factor) || 1,
  }
  const out: VariantForecast[] = []
  for (const p of products) {
    if (p.status !== 'active') continue
    for (const v of p.variants) out.push(forecastVariant(p, v, buckets.get(v.id), o))
  }
  const rank: Record<StockStatus, number> = { kritis: 0, perlu: 1, aman: 2 }
  out.sort((a, b) => rank[a.status] - rank[b.status] || b.need - a.need)
  return out
}

/** Selisih forecast vs aktual minggu lalu (MAPE sederhana) — metrik akurasi PRD. */
export function forecastAccuracy(forecasts: VariantForecast[], method: 'sma' | 'wma') {
  let err = 0
  let actual = 0
  for (const f of forecasts) {
    if (f.basis !== 'data') continue
    const predicted = movingAverage(f.history, method, 1)
    if (predicted === 0 && f.history[0] === 0) continue
    err += Math.abs(predicted - f.history[0])
    actual += f.history[0]
  }
  return actual > 0 ? err / actual : null
}

/** Seri grafik penjualan vs forecast (8 minggu, lama -> baru). */
export function chartSeries(history: number[], method: 'sma' | 'wma') {
  const weeks = history.length
  const shown = Math.min(8, weeks)
  const rows: { label: string; aktual: number; forecast: number | null }[] = []
  for (let i = shown - 1; i >= 0; i--) {
    const hasPrior = i + WINDOW < weeks
    rows.push({
      label: i === 0 ? 'Mg ini' : `-${i} mg`,
      aktual: history[i],
      forecast: hasPrior ? Math.round(movingAverage(history, method, i + 1) * 10) / 10 : null,
    })
  }
  return rows
}
