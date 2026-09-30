'use client'
import { useEffect, useState } from 'react'
import { Calculator, ChevronDown, FileText, Share2, AlertTriangle } from 'lucide-react'
import { simulateShopping, type SimLine } from '@/lib/shoppingSim'
import type { Profile, Supplier } from '@/lib/types'
import { num, pct, rupiah } from '@/lib/format'
import { Button, Card, Sheet, Toggle, cx } from './ui'

/** Kartu simulasi belanja: modal keluar vs perkiraan omzet & laba bila semua terjual. */
export function ShoppingSimCard({
  lines,
  profile,
  suppliers,
  budget,
  title = 'Simulasi belanja',
  defaultOpen = true,
}: {
  lines: SimLine[]
  profile: Profile
  suppliers?: Supplier[]
  budget?: number | null
  title?: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [perSup, setPerSup] = useState(false)
  const { total: t, bySupplier } = simulateShopping(lines, profile)
  const aff = Number(profile.affiliate_pct) > 0
  const supName = new Map((suppliers ?? []).map((s) => [s.id, s.name]))
  const over = budget ? t.modal - budget : 0
  if (!t.lines) return null

  const Stat = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) => (
    <div className="rounded-2xl bg-white/70 px-3 py-2.5 ring-1 ring-ink-100">
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className={cx('text-base font-extrabold tabular-nums', tone)}>{value}</p>
      {sub && <p className="text-[11px] text-ink-500">{sub}</p>}
    </div>
  )

  return (
    <Card className="bg-gradient-to-br from-brand-50 to-white ring-brand-100">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 text-left">
        <Calculator className="size-5 text-brand-700" />
        <span className="flex-1 font-bold text-ink-900">{title}</span>
        <span className="text-sm font-semibold text-brand-800 tabular-nums">{rupiah(t.modal)}</span>
        <ChevronDown className={cx('size-4 text-ink-400 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Stat label="Modal belanja" value={rupiah(t.modal)} sub={`${t.lines} barang · ${num(t.pcs)} pcs`} />
            <Stat label="Perkiraan omzet" value={rupiah(t.omzet)} sub="bila semua terjual" />
            <Stat
              label="Laba organik"
              value={rupiah(t.profitOrganic)}
              sub={`margin ${pct(t.marginOrganic)} dari modal`}
              tone={t.profitOrganic >= 0 ? 'text-leaf-600' : 'text-red-600'}
            />
            {aff ? (
              <Stat
                label={`Laba via affiliate ${num(profile.affiliate_pct, 1)}%`}
                value={rupiah(t.profitAffiliate)}
                sub={`margin ${pct(t.marginAffiliate)} · komisi ${rupiah(t.commission)}`}
                tone={t.profitAffiliate >= 0 ? 'text-sun-700' : 'text-red-600'}
              />
            ) : (
              <Stat label="Potongan platform" value={rupiah(t.fee)} sub={`${num(profile.platform_fee_pct, 1)}% dari omzet`} tone="text-red-600" />
            )}
          </div>
          {budget ? (
            <p className={cx('rounded-xl px-3 py-2 text-sm', over > 0 ? 'bg-red-50 text-red-700' : 'bg-leaf-500/10 text-leaf-600')}>
              {over > 0 ? `Melebihi anggaran ${rupiah(budget)} sebesar ${rupiah(over)}` : `Masih di bawah anggaran ${rupiah(budget)} (sisa ${rupiah(-over)})`}
            </p>
          ) : null}
          {t.noSellPrice > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-sun-700">
              <AlertTriangle className="size-3.5" /> {t.noSellPrice} barang belum punya harga jual, tidak masuk hitungan omzet & laba.
            </p>
          )}
          {bySupplier.length > 1 && (
            <div>
              <button onClick={() => setPerSup(!perSup)} className="text-sm font-semibold text-brand-700">
                {perSup ? 'Sembunyikan' : 'Lihat'} rincian per supplier
              </button>
              {perSup && (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-[11px] text-ink-500 uppercase">
                        <th className="py-1 font-semibold">Supplier</th>
                        <th className="py-1 text-right font-semibold">Pcs</th>
                        <th className="py-1 text-right font-semibold">Modal</th>
                        <th className="py-1 text-right font-semibold">Laba</th>
                        {aff && <th className="py-1 text-right font-semibold text-sun-700">Affiliate</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {bySupplier.map((s) => (
                        <tr key={s.supplierId ?? '-'} className="border-t border-ink-100">
                          <td className="py-1.5">{s.supplierId ? supName.get(s.supplierId) ?? 'Supplier' : 'Tanpa supplier'}</td>
                          <td className="py-1.5 text-right tabular-nums">{num(s.pcs)}</td>
                          <td className="py-1.5 text-right font-semibold tabular-nums">{rupiah(s.modal)}</td>
                          <td className="py-1.5 text-right text-leaf-600 tabular-nums">{rupiah(s.profitOrganic)}</td>
                          {aff && <td className="py-1.5 text-right text-sun-700 tabular-nums">{rupiah(s.profitAffiliate)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          <p className="text-[11px] text-ink-500">Perkiraan memakai harga jual sekarang dan potongan platform {num(profile.platform_fee_pct, 1)}%.</p>
        </div>
      )}
    </Card>
  )
}

export interface PdfOptions {
  showPrice: boolean
  showSim: boolean
  groupBySupplier: boolean
  showStore: boolean
}

const PDF_KEY = 'selikur-pdf-options'

export function loadPdfOptions(): PdfOptions {
  try {
    const v = JSON.parse(localStorage.getItem(PDF_KEY) ?? '')
    return { showPrice: v.showPrice ?? true, showSim: v.showSim ?? false, groupBySupplier: v.groupBySupplier ?? true, showStore: v.showStore ?? true }
  } catch {
    return { showPrice: true, showSim: false, groupBySupplier: true, showStore: true }
  }
}

/** Pilihan isi PDF daftar belanja sebelum diunduh / dibagikan. */
export function PdfOptionsSheet({
  open,
  onClose,
  onExport,
  store,
}: {
  open: boolean
  onClose: () => void
  onExport: (o: PdfOptions, mode: 'download' | 'share') => Promise<void>
  /** Alamat & telepon toko dari Pengaturan, untuk keterangan toggle. */
  store?: { address: string | null; phone: string | null }
}) {
  const [o, setO] = useState<PdfOptions>({ showPrice: true, showSim: false, groupBySupplier: true, showStore: true })
  const hasStore = !!(store?.address || store?.phone)
  const [busy, setBusy] = useState<'download' | 'share' | null>(null)
  useEffect(() => {
    if (open) setO(loadPdfOptions())
  }, [open])
  const set = (p: Partial<PdfOptions>) => {
    const n = { ...o, ...p }
    if (!n.showPrice) n.showSim = false
    setO(n)
    try {
      localStorage.setItem(PDF_KEY, JSON.stringify(n))
    } catch {
      /* abaikan */
    }
  }
  const run = async (mode: 'download' | 'share') => {
    setBusy(mode)
    try {
      await onExport(o, mode)
      onClose()
    } finally {
      setBusy(null)
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title="PDF daftar belanja">
      <p className="text-sm text-ink-600">Tabel berisi nomor, foto, nama barang, warna/varian, jumlah, dan kolom centang.</p>
      <div className="mt-3 divide-y divide-ink-100 rounded-2xl bg-ink-50 px-3">
        <Toggle checked={o.showPrice} onChange={(v) => set({ showPrice: v })} label="Tampilkan acuan harga" text="Harga beli per pcs, subtotal, dan kolom harga aktual" />
        <Toggle
          checked={o.showSim}
          onChange={(v) => set({ showSim: v })}
          label="Sertakan simulasi laba"
          text={o.showPrice ? 'Ringkasan modal, perkiraan omzet & laba di akhir PDF' : 'Aktifkan acuan harga dulu'}
        />
        <Toggle checked={o.groupBySupplier} onChange={(v) => set({ groupBySupplier: v })} label="Kelompokkan per supplier" text="Memudahkan rute belanja di pasar" />
        <Toggle
          checked={o.showStore && hasStore}
          onChange={(v) => hasStore && set({ showStore: v })}
          label="Tampilkan alamat & telepon toko"
          text={hasStore ? [store?.address, store?.phone].filter(Boolean).join(' · ') : 'Isi dulu alamat & telepon di Pengaturan → Profil toko'}
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" loading={busy === 'download'} onClick={() => run('download')}>
          <FileText className="size-4" /> Unduh PDF
        </Button>
        <Button loading={busy === 'share'} onClick={() => run('share')}>
          <Share2 className="size-4" /> Bagikan
        </Button>
      </div>
      <p className="mt-2 text-xs text-ink-500">Pilihan ini diingat untuk unduhan berikutnya.</p>
    </Sheet>
  )
}
