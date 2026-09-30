'use client'
import { LineChart, ClipboardList, CalendarDays, BarChart3, Settings, Percent, Package, Camera, ShoppingBasket, Sparkles, Users, LogOut } from 'lucide-react'
import { Card, LinkRow, PageHeader, SectionTitle } from '@/components/ui'
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
