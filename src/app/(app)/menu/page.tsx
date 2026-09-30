'use client'
import { LineChart, ClipboardList, CalendarDays, BarChart3, Settings, Percent, Package, Camera, ShoppingBasket, Sparkles } from 'lucide-react'
import { Card, LinkRow, PageHeader, SectionTitle } from '@/components/ui'

export default function MenuPage() {
  return (
    <div>
      <PageHeader title="Menu" subtitle="Semua fitur Selikur" />
      <SectionTitle>Perencanaan</SectionTitle>
      <Card className="p-1.5">
        <LinkRow href="/forecast" icon={LineChart} title="Forecast kebutuhan" text="Berapa yang harus dikulak per varian" tone="leaf" />
        <LinkRow href="/penjualan" icon={ClipboardList} title="Penjualan" text="Input manual, impor Excel/CSV, laba & affiliate" />
        <LinkRow href="/harga" icon={Percent} title="Harga jual & margin" text="Simulasi markup, potongan platform, komisi affiliate" tone="sun" />
      </Card>
      <SectionTitle>Belanja</SectionTitle>
      <Card className="p-1.5">
        <LinkRow href="/belanja" icon={ShoppingBasket} title="Daftar belanja" text="Rencana & mode belanja" />
        <LinkRow href="/jadwal" icon={CalendarDays} title="Jadwal belanja" text="Kalender & pengingat" tone="sun" />
        <LinkRow href="/rekap" icon={BarChart3} title="Rekap & laporan" text="Mingguan, bulanan, ekspor PDF/Excel" tone="ink" />
      </Card>
      <SectionTitle>Katalog</SectionTitle>
      <Card className="p-1.5">
        <LinkRow href="/produk" icon={Package} title="Katalog produk" text="Produk, varian, harga, stok" />
        <LinkRow href="/produk?status=candidate" icon={Sparkles} title="Produk kandidat" text="Temuan lapangan untuk dievaluasi" tone="sun" />
        <LinkRow href="/tangkap" icon={Camera} title="Foto produk baru" text="Mode lapangan, bisa offline" tone="sun" />
      </Card>
      <SectionTitle>Akun</SectionTitle>
      <Card className="p-1.5">
        <LinkRow href="/pengaturan" icon={Settings} title="Pengaturan" text="Profil toko, kategori, supplier, data" tone="ink" />
      </Card>
    </div>
  )
}
