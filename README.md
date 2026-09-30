# Selikur

Aplikasi (PWA, mobile-first) untuk penjual online: katalog produk & varian, foto produk di lapangan (offline), forecast kebutuhan stok, daftar & jadwal belanja kulakan, mode belanja, harga jual (markup, potongan platform, komisi affiliate), penjualan & laba, rekap mingguan/bulanan dengan ekspor PDF/Excel.

## Teknologi
- Next.js 16 (App Router) + Tailwind CSS 4, dideploy di Vercel
- Supabase: Postgres + RLS (data per pemilik), Auth (email / Google), Storage (foto)
- React Query + IndexedDB untuk cache offline, antrean tulis offline (foto lapangan & mode belanja)

## Jalankan lokal
```bash
cp .env.example .env.local   # isi NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm install
npm run dev
```

## Database
Migrasi ada di `supabase/migrations`. Fungsi penting:
- `complete_shopping_list(list_id)`: selesai belanja → stok bertambah, harga kulakan & riwayat harga tersimpan, jadwal berulang berikutnya dibuat.
- `sales_buckets(weeks)`: penjualan per 7 hari untuk forecast.
- `import_starter_data()`: impor data kulakan awal (Toko Kembar & Toko OBI) ke akun yang sedang masuk.
