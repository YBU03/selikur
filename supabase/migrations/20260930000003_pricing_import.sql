-- ===== Harga jual: markup, potongan platform, komisi affiliate =====
alter table public.profiles
  add column platform_fee_pct numeric(5,2) not null default 20 check (platform_fee_pct >= 0 and platform_fee_pct < 100),
  add column affiliate_pct numeric(5,2) not null default 0 check (affiliate_pct >= 0 and affiliate_pct < 100),
  add column default_markup_pct numeric(6,2) not null default 50 check (default_markup_pct >= 0),
  add column fee_basis text not null default 'price' check (fee_basis in ('price','cost_margin')),
  add column price_rounding integer not null default 0 check (price_rounding in (0,100,500,1000));

alter table public.products
  add column platform_fee_pct numeric(5,2) check (platform_fee_pct >= 0 and platform_fee_pct < 100),
  add column affiliate_pct numeric(5,2) check (affiliate_pct >= 0 and affiliate_pct < 100);

alter table public.variants
  add column price_mode text not null default 'manual' check (price_mode in ('manual','markup')),
  add column markup_pct numeric(6,2) check (markup_pct >= 0);

-- kanal penjualan agar komisi affiliate bisa direkap
alter table public.sales
  add column channel text not null default 'organik' check (channel in ('organik','affiliate'));

-- ===== Impor data kulakan awal (dari file Simulasi Harga Jual Tumbler) =====
create or replace function public.import_starter_data()
returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  seed jsonb := $seed$[{"name":"Toko Kembar","location":"Jl. Asemka Mandiri No. 9A (Bawah Fly Over) Jakarta Belakang Museum Mandiri","whatsapp":"085694449481","notes":"WA lain: 081574048877, 081584177773","products":[{"name":"Vacum Set 500 mL SUS 304","buy":28000,"sell":70000,"qty":4,"variants":[{"name":"Biru","qty":1},{"name":"Abu","qty":2},{"name":"Pink","qty":1}],"attributes":{"kapasitas":"500","bahan":"SUS 304"}},{"name":"Tumbler 2f Mini Summer 3/seri 450mL SUS 316","buy":45000,"sell":115000,"qty":12,"variants":[{"name":"Merah","qty":3},{"name":"Hitam","qty":3},{"name":"Biru","qty":3},{"name":"Coklat","qty":3}],"attributes":{"kapasitas":"450","bahan":"SUS 316"}},{"name":"Xiomai Cup Mini 400 mL SUS 316","buy":60000,"sell":115000,"qty":3,"variants":[{"name":"Coklat","qty":1},{"name":"Biru","qty":1},{"name":"Pink","qty":1}],"attributes":{"kapasitas":"400","bahan":"SUS 316"}},{"name":"Tumbler Gelas Gagang Coffee 500 mL SUS 304","buy":40000,"sell":95000,"qty":6,"variants":[{"name":"Putih","qty":2},{"name":"Abu","qty":2},{"name":"Ungu","qty":2}],"attributes":{"kapasitas":"500","bahan":"SUS 304"}},{"name":"Tumbler Mug Telor 360mL SUS 304","buy":25000,"sell":68000,"qty":12,"variants":[{"name":"Putih","qty":2},{"name":"Light Blue","qty":1},{"name":"Biru Dongker","qty":6},{"name":"Pink","qty":1},{"name":"Orange","qty":2}],"attributes":{"kapasitas":"360","bahan":"SUS 304"}},{"name":"Tumbler gagang jumbo nice to meet you 800mL SUS 316","buy":55000,"sell":135000,"qty":6,"variants":[{"name":"Light Blue","qty":2},{"name":"Green","qty":2},{"name":"Red","qty":2}],"attributes":{"kapasitas":"800","bahan":"SUS 316"}},{"name":"Tumbler Supply 650mL SUS 316","buy":55000,"sell":115000,"qty":6,"variants":[{"name":"Red","qty":2},{"name":"Blue","qty":2},{"name":"Black","qty":2}],"attributes":{"kapasitas":"650","bahan":"SUS 316"}},{"name":"Tumbler 2f flowers + kotak Pk 900 mL","buy":62000,"sell":130000,"qty":8,"variants":[{"name":"Pink Flowers","qty":2},{"name":"Light Blue Flowers","qty":2},{"name":"Cream Flowers","qty":2},{"name":"Pink Kotak","qty":1},{"name":"Pink Bunga","qty":1}],"attributes":{"kapasitas":"900"}},{"name":"Tumbler 2f M. bunga","buy":62000,"sell":130000,"qty":3,"variants":[{"name":"Ungu","qty":1},{"name":"Pink","qty":1},{"name":"Cream","qty":1}],"attributes":{}},{"name":"Tumbler lF 900ml SUS 304","buy":35000,"sell":130000,"qty":14,"variants":[{"name":"Hitam","qty":3},{"name":"Dongker","qty":2},{"name":"Biru Muda","qty":2},{"name":"Kuning","qty":2},{"name":"Abu Abu","qty":1},{"name":"Pink","qty":2},{"name":"Hijau","qty":2}],"attributes":{"kapasitas":"900","bahan":"SUS 304"}},{"name":"Tumbler ow Freesip 900ml tanpa H SUS 304","buy":43000,"sell":115000,"qty":2,"variants":[{"name":"Ungu Tutup Hijau","qty":1},{"name":"Pink Tutup Ungu","qty":1}],"attributes":{"kapasitas":"900","bahan":"SUS 304"}},{"name":"Tumbler Cuculemon SUS 316 500 mL","buy":85000,"sell":135000,"qty":8,"variants":[{"name":"White","qty":2},{"name":"Hitam","qty":3},{"name":"Pink","qty":1},{"name":"Yellow","qty":2}],"attributes":{"kapasitas":"500","bahan":"SUS 316"}},{"name":"Tumbler gagang car cup OY/H/AB 1000mL SUS 304","buy":78000,"sell":178000,"qty":9,"variants":[{"name":"Putih","qty":3},{"name":"Abu-abu","qty":2},{"name":"Orange","qty":4}],"attributes":{"kapasitas":"1000","bahan":"SUS 304"}},{"name":"Tumbler Panda 710mL SUS 304","buy":55000,"sell":120000,"qty":9,"variants":[{"name":"Pink","qty":3},{"name":"Merah","qty":3},{"name":"Hitam","qty":3}],"attributes":{"kapasitas":"710","bahan":"SUS 304"}},{"name":"Tumbler Keep Puling Polos 750 ml SUS 316","buy":47000,"sell":135000,"qty":4,"variants":[{"name":"Biru Tutup Pink","qty":2},{"name":"Biru Muda","qty":2}],"attributes":{"kapasitas":"750","bahan":"SUS 316"}}]},{"name":"Toko OBI","location":"Bawah Fly Over (Depan Parkir Motor) Pasar Pagi Asemka","whatsapp":"081383821482","notes":"WA lain: 085771634430","products":[{"name":"Tumbler Freedom 700 mL","buy":63000,"sell":142000,"qty":18,"variants":[{"name":"Biru","qty":3},{"name":"Hitam","qty":3},{"name":"Merah","qty":3},{"name":"Coklat","qty":3},{"name":"Putih","qty":3},{"name":"Hijau","qty":3}],"attributes":{"kapasitas":"700"}},{"name":"Tumbler Eskrim 700 mL","buy":43000,"sell":110000,"qty":8,"variants":[{"name":"Pink","qty":2},{"name":"Kuning","qty":2},{"name":"Biru","qty":2},{"name":"Coklat","qty":2}],"attributes":{"kapasitas":"700"}},{"name":"Tumbler Keep Puling Polos 750 mL","buy":48000,"sell":135000,"qty":6,"variants":[{"name":"Kuning","qty":3},{"name":"Hitam","qty":3}],"attributes":{"kapasitas":"750"}}]}]$seed$::jsonb;
  s jsonb; p jsonb; v jsonb;
  cat_id uuid; sup_id uuid; prod_id uuid; var_id uuid; list_id uuid;
  n integer := 0; ord integer := 0;
begin
  if uid is null then raise exception 'Harus masuk dulu'; end if;
  if exists (select 1 from public.suppliers where owner_id = uid and name in ('Toko Kembar','Toko OBI')) then
    return 0;
  end if;

  insert into public.categories (owner_id, name, extra_attributes)
  values (uid, 'Tumbler', '[{"key":"kapasitas","label":"Kapasitas","unit":"ml"},{"key":"bahan","label":"Bahan"}]'::jsonb)
  on conflict (owner_id, name) do update set extra_attributes = excluded.extra_attributes
  returning id into cat_id;

  update public.profiles set platform_fee_pct = 20, default_markup_pct = 50 where id = uid;

  insert into public.shopping_lists (owner_id, title, status, started_at, completed_at)
  values (uid, 'Kulakan Asemka (impor Excel)', 'in_progress', now(), null)
  returning id into list_id;

  for s in select * from jsonb_array_elements(seed) loop
    insert into public.suppliers (owner_id, name, location, whatsapp, notes)
    values (uid, s->>'name', s->>'location', s->>'whatsapp', s->>'notes')
    returning id into sup_id;

    for p in select * from jsonb_array_elements(s->'products') loop
      insert into public.products (owner_id, name, category_id, supplier_id, status, source, attributes, found_location)
      values (uid, p->>'name', cat_id, sup_id, 'active', 'upload', coalesce(p->'attributes','{}'::jsonb), s->>'location')
      returning id into prod_id;
      n := n + 1;

      for v in select * from jsonb_array_elements(p->'variants') loop
        insert into public.variants (owner_id, product_id, name, buy_price, sell_price, stock, min_stock, price_mode)
        values (uid, prod_id, v->>'name', (p->>'buy')::numeric, (p->>'sell')::numeric, 0, 1, 'manual')
        returning id into var_id;

        ord := ord + 1;
        insert into public.shopping_items (owner_id, list_id, variant_id, supplier_id, qty_planned, price_planned, qty_actual, price_actual, status, sort_order)
        values (uid, list_id, var_id, sup_id, (v->>'qty')::int, (p->>'buy')::numeric, (v->>'qty')::int, (p->>'buy')::numeric, 'bought', ord);
      end loop;
    end loop;
  end loop;

  -- selesaikan belanja: stok bertambah & riwayat harga tercatat
  perform public.complete_shopping_list(list_id);
  return n;
end $$;

revoke execute on function public.import_starter_data() from public, anon;
grant execute on function public.import_starter_data() to authenticated;
