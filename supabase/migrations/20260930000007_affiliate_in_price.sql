-- Harga jual disimulasikan dari potongan platform saja (penjualan organik).
-- Komisi affiliate ditampilkan terpisah sebagai laba "via affiliate".
-- Aktifkan affiliate_in_price bila ingin harga jual sudah menutup komisi affiliate.
alter table public.store_settings
  add column affiliate_in_price boolean not null default false;
