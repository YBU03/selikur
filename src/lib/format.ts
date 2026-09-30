import { format, parseISO } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

const rupiahFmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

export function rupiah(n: number | null | undefined) {
  return `Rp ${rupiahFmt.format(Math.round(Number(n) || 0))}`
}

export function num(n: number | null | undefined, digits = 0) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(Number(n) || 0)
}

export function pct(n: number | null | undefined, digits = 0) {
  if (n == null || !isFinite(n)) return '–'
  return `${num(n * 100, digits)}%`
}

export function toDate(d: string | Date) {
  return typeof d === 'string' ? parseISO(d) : d
}

/** DD/MM/YYYY */
export function tgl(d: string | Date | null | undefined) {
  if (!d) return '–'
  return format(toDate(d), 'dd/MM/yyyy')
}

export function tglPanjang(d: string | Date, pattern = 'EEEE, d MMMM yyyy') {
  return format(toDate(d), pattern, { locale: localeId })
}

export function isoDate(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

export function unitLabel(qty: number, unit: string, unitSize: number) {
  if (unitSize > 1 && qty % unitSize === 0 && qty > 0) {
    return `${num(qty / unitSize)} ${unit} (${num(qty)} pcs)`
  }
  return `${num(qty)} pcs`
}

/** Parsing input Rupiah: "25.000" -> 25000 */
export function parseNumber(v: string) {
  const cleaned = v.replace(/[^\d,-]/g, '').replace(',', '.')
  const n = Number(cleaned)
  return isFinite(n) ? n : 0
}

export function margin(buy: number, sell: number) {
  if (!sell) return null
  return (sell - buy) / sell
}
