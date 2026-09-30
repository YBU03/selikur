'use client'
import { AdminOnly } from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Plus, LogOut, FileSpreadsheet, MessageCircle, MapPin, DownloadCloud, Percent, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useProfile, useCategories, useSuppliers, useCatalog, defaultProfile, qk, useInvalidate } from '@/lib/queries'
import { exportCatalogExcel } from '@/lib/exporters'
import { pricingCfg } from '@/lib/pricing'
import { num } from '@/lib/format'
import type { Category, ExtraAttribute, Supplier } from '@/lib/types'
import { Button, Card, Confirm, Input, MoneyInput, NumberInput, PageHeader, SectionTitle, Segmented, Sheet } from '@/components/ui'
import { SupplierSheet, waLink } from '@/components/QuickCreate'
import PricingSettings from '@/components/PricingSettings'
import { useToast, errMsg } from '@/components/Toast'
import StarterImport from '@/components/StarterImport'

function PengaturanPageInner() {
  const router = useRouter()
  const toast = useToast()
  const invalidate = useInvalidate()
  const { data: profile } = useProfile()
  const { data: categories } = useCategories()
  const { data: suppliers } = useSuppliers()
  const { data: products } = useCatalog()
  const p = profile ?? defaultProfile
  const [f, setF] = useState(p)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [pricing, setPricing] = useState(false)
  const [cat, setCat] = useState<Category | 'new' | null>(null)
  const [delCat, setDelCat] = useState<Category | null>(null)
  const [sup, setSup] = useState<Supplier | 'new' | null>(null)
  const [delSup, setDelSup] = useState<Supplier | null>(null)
  const [logout, setLogout] = useState(false)

  useEffect(() => setF(p), [p])
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? ''))
  }, [])

  const usage = (key: 'category_id' | 'supplier_id', id: string) => (products ?? []).filter((x) => x[key] === id).length

  return (
    <div>
      <PageHeader title="Pengaturan" subtitle={email} back="/menu" />

      <SectionTitle>Profil toko</SectionTitle>
      <Card className="space-y-3.5">
        <Input label="Nama toko" value={f.store_name} onChange={(e) => setF({ ...f, store_name: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <NumberInput label="Minggu cakupan" hint="default" value={Number(f.coverage_weeks)} step={0.5} min={0.5} onChange={(n) => setF({ ...f, coverage_weeks: Math.max(0.5, n) })} />
          <MoneyInput label="Anggaran default" value={f.default_budget} onChange={(n) => setF({ ...f, default_budget: n || null })} />
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink-700">Metode forecast</span>
          <Segmented
            value={f.forecast_method}
            onChange={(v) => setF({ ...f, forecast_method: v })}
            options={[
              { value: 'sma', label: 'Rata-rata 4 minggu' },
              { value: 'wma', label: 'Berbobot (terbaru)' },
            ]}
          />
        </div>
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">Faktor musim</span>
            <div className="relative">
              <input
                inputMode="decimal"
                value={f.seasonal_factor}
                onChange={(e) => setF({ ...f, seasonal_factor: Number(e.target.value.replace(',', '.')) || 1 })}
                className="h-12 w-full rounded-2xl border border-ink-200 bg-white pr-4 pl-8 text-right font-semibold tabular-nums outline-none focus:border-brand-500"
              />
              <X className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-ink-400" />
            </div>
          </label>
          <Input label="Keterangan musim" placeholder="mis. Ramadan, 11.11, 12.12" value={f.seasonal_label ?? ''} onChange={(e) => setF({ ...f, seasonal_label: e.target.value || null })} />
        </div>
        <p className="text-xs text-ink-500">Isi 1 jika normal. Contoh 1,5 = forecast dinaikkan 50% menjelang Ramadan. Mata uang Rupiah, minggu dimulai Senin.</p>
        <Button
          block
          loading={busy}
          onClick={async () => {
            setBusy(true)
            const { error } = await supabase
              .from('store_settings')
              .update({
                store_name: f.store_name.trim() || 'Toko Saya',
                coverage_weeks: f.coverage_weeks,
                default_budget: f.default_budget,
                forecast_method: f.forecast_method,
                seasonal_factor: f.seasonal_factor,
                seasonal_label: f.seasonal_label,
              })
              .eq('id', 1)
            setBusy(false)
            if (error) return toast(errMsg(error), 'error')
            await invalidate(qk.profile)
            toast('Profil tersimpan')
          }}
        >
          Simpan profil
        </Button>
      </Card>

      <SectionTitle>Harga jual</SectionTitle>
      <button onClick={() => setPricing(true)} className="w-full text-left">
        <Card className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-sun-50 text-sun-600">
            <Percent className="size-5" />
          </span>
          <span className="flex-1 text-sm">
            <b className="block text-ink-900">Potongan {num(p.platform_fee_pct, 1)}% · Affiliate {num(p.affiliate_pct, 1)}%</b>
            <span className="text-ink-500">Markup awal {num(p.default_markup_pct)}% · {p.fee_basis === 'price' ? 'dari harga jual' : 'seperti Excel'}</span>
          </span>
          <Pencil className="size-4 text-ink-400" />
        </Card>
      </button>

      <SectionTitle
        action={
          <button onClick={() => setCat('new')} className="flex items-center gap-1 text-sm font-semibold text-brand-700">
            <Plus className="size-4" /> Kategori
          </button>
        }
      >
        Kategori
      </SectionTitle>
      <Card className="divide-y divide-ink-100 p-0">
        {!categories?.length && <p className="px-4 py-4 text-sm text-ink-500">Belum ada kategori.</p>}
        {categories?.map((c) => (
          <div key={c.id} className="flex items-center gap-2 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{c.name}</p>
              <p className="truncate text-xs text-ink-500">
                {usage('category_id', c.id)} produk
                {c.extra_attributes.length > 0 && ` · ${c.extra_attributes.map((a) => a.label).join(', ')}`}
              </p>
            </div>
            <button onClick={() => setCat(c)} className="flex size-9 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100" aria-label="Ubah">
              <Pencil className="size-4" />
            </button>
            <button onClick={() => setDelCat(c)} className="flex size-9 items-center justify-center rounded-full text-red-500 hover:bg-red-50" aria-label="Hapus">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </Card>

      <SectionTitle
        action={
          <button onClick={() => setSup('new')} className="flex items-center gap-1 text-sm font-semibold text-brand-700">
            <Plus className="size-4" /> Supplier
          </button>
        }
      >
        Supplier
      </SectionTitle>
      <Card className="divide-y divide-ink-100 p-0">
        {!suppliers?.length && <p className="px-4 py-4 text-sm text-ink-500">Belum ada supplier.</p>}
        {suppliers?.map((s) => (
          <div key={s.id} className="flex items-center gap-2 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{s.name}</p>
              <p className="flex items-center gap-1 truncate text-xs text-ink-500">
                {s.location && (
                  <>
                    <MapPin className="size-3 shrink-0" /> <span className="truncate">{s.location}</span> ·
                  </>
                )}
                {usage('supplier_id', s.id)} produk
              </p>
            </div>
            {s.whatsapp && (
              <a href={waLink(s.whatsapp)} target="_blank" rel="noreferrer" className="flex size-9 items-center justify-center rounded-full text-leaf-600 hover:bg-leaf-500/10" aria-label="WhatsApp">
                <MessageCircle className="size-4" />
              </a>
            )}
            <button onClick={() => setSup(s)} className="flex size-9 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100" aria-label="Ubah">
              <Pencil className="size-4" />
            </button>
            <button onClick={() => setDelSup(s)} className="flex size-9 items-center justify-center rounded-full text-red-500 hover:bg-red-50" aria-label="Hapus">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </Card>

      <SectionTitle>Data</SectionTitle>
      <div className="space-y-2">
        <StarterImport compact />
        <Button
          variant="outline"
          block
          onClick={async () => {
            try {
              await exportCatalogExcel(products ?? [], categories ?? [], suppliers ?? [], (x) => pricingCfg(p, x))
            } catch (e) {
              toast(errMsg(e), 'error')
            }
          }}
        >
          <FileSpreadsheet className="size-4.5" /> Ekspor katalog + harga (Excel)
        </Button>
        <p className="px-1 text-xs text-ink-500">Data tersimpan aman di cloud (Supabase) dan tersinkron antar perangkat saat kamu masuk dengan akun yang sama.</p>
      </div>

      <Button variant="danger" block className="mt-6" onClick={() => setLogout(true)}>
        <LogOut className="size-4.5" /> Keluar
      </Button>
      <p className="mt-4 text-center text-xs text-ink-400">Selikur v1.0</p>

      <PricingSettings open={pricing} onClose={() => setPricing(false)} />
      <CategorySheet category={cat} onClose={() => setCat(null)} />
      <SupplierSheet key={sup === 'new' ? 'new' : sup?.id ?? 'none'} open={!!sup} supplier={sup === 'new' ? null : sup} onClose={() => setSup(null)} />
      <Confirm
        open={!!delCat}
        onClose={() => setDelCat(null)}
        title={`Hapus kategori "${delCat?.name}"?`}
        text={delCat ? `${usage('category_id', delCat.id)} produk akan menjadi tanpa kategori. Produknya tidak ikut terhapus.` : ''}
        onConfirm={async () => {
          const { error } = await supabase.from('categories').delete().eq('id', delCat!.id)
          if (error) return toast(errMsg(error), 'error')
          await invalidate(qk.categories, qk.catalog)
          toast('Kategori dihapus')
          setDelCat(null)
        }}
      />
      <Confirm
        open={!!delSup}
        onClose={() => setDelSup(null)}
        title={`Hapus supplier "${delSup?.name}"?`}
        text={delSup ? `${usage('supplier_id', delSup.id)} produk akan menjadi tanpa supplier. Produk & riwayat belanja tetap ada.` : ''}
        onConfirm={async () => {
          const { error } = await supabase.from('suppliers').delete().eq('id', delSup!.id)
          if (error) return toast(errMsg(error), 'error')
          await invalidate(qk.suppliers, qk.catalog)
          toast('Supplier dihapus')
          setDelSup(null)
        }}
      />
      <Confirm
        open={logout}
        onClose={() => setLogout(false)}
        requireWord={null}
        confirmLabel="Keluar"
        title="Keluar dari Selikur?"
        text="Perubahan yang belum tersinkron akan dikirim saat kamu masuk lagi."
        onConfirm={async () => {
          await supabase.auth.signOut()
          router.replace('/masuk')
        }}
      />
    </div>
  )
}

function CategorySheet({ category, onClose }: { category: Category | 'new' | null; onClose: () => void }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const [name, setName] = useState('')
  const [attrs, setAttrs] = useState<ExtraAttribute[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!category) return
    setName(category === 'new' ? '' : category.name)
    setAttrs(category === 'new' ? [] : category.extra_attributes)
  }, [category])
  return (
    <Sheet open={!!category} onClose={onClose} title={category === 'new' ? 'Kategori baru' : 'Ubah kategori'}>
      <div className="space-y-3.5">
        <Input label="Nama kategori" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Tumbler" />
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-700">Atribut tambahan</p>
          <p className="mb-2 text-xs text-ink-500">Muncul di form produk kategori ini, mis. Kapasitas (ml) untuk tumbler, Ukuran untuk baju.</p>
          <div className="space-y-2">
            {attrs.map((a, i) => (
              <div key={i} className="grid grid-cols-[1fr_5.5rem_auto] gap-2">
                <Input placeholder="Nama atribut" value={a.label} onChange={(e) => setAttrs(attrs.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
                <Input placeholder="Satuan" value={a.unit ?? ''} onChange={(e) => setAttrs(attrs.map((x, k) => (k === i ? { ...x, unit: e.target.value } : x)))} />
                <button onClick={() => setAttrs(attrs.filter((_, k) => k !== i))} className="flex size-12 items-center justify-center rounded-2xl text-red-500 hover:bg-red-50" aria-label="Hapus atribut">
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <Button variant="soft" size="sm" className="mt-2" onClick={() => setAttrs([...attrs, { key: '', label: '', unit: '' }])}>
            <Plus className="size-4" /> Atribut
          </Button>
        </div>
        <Button
          block
          loading={busy}
          disabled={!name.trim()}
          onClick={async () => {
            setBusy(true)
            const clean = attrs
              .filter((a) => a.label.trim())
              .map((a) => ({ key: a.key || a.label.trim().toLowerCase().replace(/\W+/g, '_'), label: a.label.trim(), unit: a.unit?.trim() || undefined }))
            const row = { name: name.trim(), extra_attributes: clean }
            const res = category === 'new' ? await supabase.from('categories').insert(row) : await supabase.from('categories').update(row).eq('id', (category as Category).id)
            setBusy(false)
            if (res.error) return toast(errMsg(res.error), 'error')
            await invalidate(qk.categories)
            toast('Kategori tersimpan')
            onClose()
          }}
        >
          Simpan
        </Button>
      </div>
    </Sheet>
  )
}


export default function PengaturanPage() {
  return (
    <AdminOnly>
      <PengaturanPageInner />
    </AdminOnly>
  )
}
