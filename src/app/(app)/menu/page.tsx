'use client'
import { LineChart, ClipboardList, CalendarDays, BarChart3, Settings, Percent, Package, Camera, ShoppingBasket, Sparkles, Users, LogOut, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, Input, LinkRow, PageHeader, SectionTitle, Sheet } from '@/components/ui'
import { useToast, errMsg } from '@/components/Toast'
import { useRole } from '@/lib/roles'
import { ROLE_LABEL } from '@/lib/types'

export default function MenuPage() {
  const { isAdmin, me } = useRole()
  return (
    <div>
      <PageHeader title="Menu" subtitle={me ? `${me.full_name ?? me.email} · ${ROLE_LABEL[me.role]}` : 'Semua fitur Selikur'} />
      <SectionTitle>Perencanaan</SectionTitle>
      <Card className="p-1.5">
        <LinkRow href="/forecast" icon={LineChart} title="Forecast kebutuhan" text="Berapa yang harus dikulak per varian" tone="leaf" />
        <LinkRow href="/penjualan" icon={ClipboardList} title="Penjualan" text={isAdmin ? 'Input manual, impor Excel/CSV, laba & affiliate' : 'Input manual & impor Excel/CSV'} />
        {isAdmin && <LinkRow href="/harga" icon={Percent} title="Harga jual & margin" text="Simulasi markup, potongan platform, komisi affiliate" tone="sun" />}
      </Card>
      <SectionTitle>Belanja</SectionTitle>
      <Card className="p-1.5">
        <LinkRow href="/belanja" icon={ShoppingBasket} title="Daftar belanja" text="Rencana & mode belanja" />
        <LinkRow href="/jadwal" icon={CalendarDays} title="Jadwal belanja" text="Kalender & pengingat" tone="sun" />
        {isAdmin && <LinkRow href="/rekap" icon={BarChart3} title="Rekap & laporan" text="Mingguan, bulanan, ekspor PDF/Excel" tone="ink" />}
      </Card>
      <SectionTitle>Katalog</SectionTitle>
      <Card className="p-1.5">
        <LinkRow href="/produk" icon={Package} title="Katalog produk" text="Produk, varian, harga, stok" />
        <LinkRow href="/produk?status=candidate" icon={Sparkles} title="Produk kandidat" text="Temuan lapangan untuk dievaluasi" tone="sun" />
        <LinkRow href="/tangkap" icon={Camera} title="Foto produk baru" text="Mode lapangan, bisa offline" tone="sun" />
      </Card>
      <SectionTitle>Akun</SectionTitle>
      <Card className="p-1.5">
        {isAdmin && <LinkRow href="/pengguna" icon={Users} title="Kelola pengguna" text="Setujui akun, atur peran Super Admin / Admin / User" tone="sun" />}
        {isAdmin && <LinkRow href="/pengaturan" icon={Settings} title="Pengaturan" text="Profil toko, kategori, supplier, data" tone="ink" />}
        <PasswordRow />
        {!isAdmin && <LogoutRow />}
      </Card>
    </div>
  )
}

function LogoutRow() {
  return (
    <button
      onClick={async () => {
        const { supabase } = await import('@/lib/supabase')
        await supabase.auth.signOut()
        location.replace('/masuk')
      }}
      className="flex w-full items-center gap-3.5 rounded-2xl p-3 text-left font-semibold text-red-600 hover:bg-red-50"
    >
      <span className="flex size-11 items-center justify-center rounded-2xl bg-red-50">
        <LogOut className="size-5" />
      </span>
      Keluar
    </button>
  )
}

function PasswordRow() {
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex w-full items-center gap-3.5 rounded-2xl p-3 text-left transition hover:bg-ink-50">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-ink-100 text-ink-700">
          <KeyRound className="size-5" />
        </span>
        <span>
          <span className="block font-semibold text-ink-900">Ganti kata sandi</span>
          <span className="block text-sm text-ink-500">Ubah kata sandi akun kamu</span>
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Ganti kata sandi">
        <div className="space-y-3.5">
          <Input label="Kata sandi baru" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="min. 6 karakter" />
          <Input label="Ulangi kata sandi baru" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          {pw2 && pw !== pw2 && <p className="text-sm text-red-600">Kata sandi belum sama.</p>}
          <Button
            block
            loading={busy}
            disabled={pw.length < 6 || pw !== pw2}
            onClick={async () => {
              setBusy(true)
              const { supabase } = await import('@/lib/supabase')
              const { error } = await supabase.auth.updateUser({ password: pw })
              setBusy(false)
              if (error) return toast(errMsg(error), 'error')
              toast('Kata sandi berhasil diganti')
              setPw('')
              setPw2('')
              setOpen(false)
            }}
          >
            Simpan kata sandi
          </Button>
        </div>
      </Sheet>
    </>
  )
}
