-- Alamat & telepon toko (bisa ditampilkan di PDF)
alter table public.store_settings
  add column store_address text,
  add column store_phone text;
