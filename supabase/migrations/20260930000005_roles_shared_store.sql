-- =====================================================================
-- Satu toko bersama + peran: super_admin, admin, user
-- Akun baru berstatus 'pending' sampai disetujui admin.
-- Akun pertama yang mendaftar otomatis menjadi super_admin.
-- =====================================================================

-- ===== Pengaturan toko (satu baris, dipakai bersama) =====
create table public.store_settings (
  id integer primary key default 1 check (id = 1),
  store_name text not null default 'Toko Saya',
  coverage_weeks numeric(4,1) not null default 2 check (coverage_weeks > 0),
  forecast_method text not null default 'sma' check (forecast_method in ('sma','wma')),
  seasonal_factor numeric(4,2) not null default 1 check (seasonal_factor > 0),
  seasonal_label text,
  default_budget numeric(14,2),
  platform_fee_pct numeric(5,2) not null default 20 check (platform_fee_pct >= 0 and platform_fee_pct < 100),
  affiliate_pct numeric(5,2) not null default 0 check (affiliate_pct >= 0 and affiliate_pct < 100),
  default_markup_pct numeric(6,2) not null default 50 check (default_markup_pct >= 0),
  fee_basis text not null default 'price' check (fee_basis in ('price','cost_margin')),
  price_rounding integer not null default 0 check (price_rounding in (0,100,500,1000)),
  updated_at timestamptz not null default now()
);
insert into public.store_settings (id) values (1) on conflict do nothing;
create trigger store_settings_touch before update on public.store_settings for each row execute function public.touch_updated_at();

-- ===== Profil = anggota tim =====
alter table public.profiles
  drop column store_name,
  drop column coverage_weeks,
  drop column forecast_method,
  drop column seasonal_factor,
  drop column seasonal_label,
  drop column default_budget,
  drop column platform_fee_pct,
  drop column affiliate_pct,
  drop column default_markup_pct,
  drop column fee_basis,
  drop column price_rounding,
  add column email text,
  add column full_name text,
  add column role text not null default 'user' check (role in ('super_admin','admin','user')),
  add column status text not null default 'pending' check (status in ('pending','approved','rejected','disabled')),
  add column approved_by uuid references auth.users(id) on delete set null,
  add column approved_at timestamptz;

create index on public.profiles(status);
create index on public.profiles(approved_by);

-- ===== Fungsi peran =====
create or replace function public.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and status = 'approved'
$$;
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'approved')
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'approved' and role in ('admin','super_admin'))
$$;
revoke execute on function public.my_role(), public.is_member(), public.is_admin() from public, anon;
grant execute on function public.my_role(), public.is_member(), public.is_admin() to authenticated;

-- ===== Pendaftaran: akun pertama = super admin, lainnya menunggu persetujuan =====
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  first_user boolean;
begin
  perform pg_advisory_xact_lock(hashtext('selikur_first_user'));
  first_user := not exists (select 1 from public.profiles where role = 'super_admin' and status = 'approved');
  insert into public.profiles (id, email, full_name, role, status, approved_at)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    case when first_user then 'super_admin' else 'user' end,
    case when first_user then 'approved' else 'pending' end,
    case when first_user then now() else null end
  )
  on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ===== Setujui / ubah peran / nonaktifkan anggota =====
create or replace function public.set_member(p_user uuid, p_role text, p_status text)
returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  target public.profiles;
begin
  select * into me from public.profiles where id = auth.uid() and status = 'approved';
  if me.id is null or me.role not in ('admin','super_admin') then
    raise exception 'Hanya admin yang bisa mengelola pengguna';
  end if;
  if p_user = me.id then raise exception 'Tidak bisa mengubah akun sendiri'; end if;
  if p_role not in ('super_admin','admin','user') or p_status not in ('pending','approved','rejected','disabled') then
    raise exception 'Peran atau status tidak valid';
  end if;
  select * into target from public.profiles where id = p_user for update;
  if target.id is null then raise exception 'Pengguna tidak ditemukan'; end if;
  if me.role <> 'super_admin' and (target.role = 'super_admin' or p_role = 'super_admin') then
    raise exception 'Hanya super admin yang bisa mengatur super admin';
  end if;

  update public.profiles set
    role = p_role,
    status = p_status,
    approved_by = case when p_status = 'approved' and target.status <> 'approved' then me.id else approved_by end,
    approved_at = case when p_status = 'approved' and target.status <> 'approved' then now() else approved_at end
  where id = p_user
  returning * into target;
  return target;
end $$;
revoke execute on function public.set_member(uuid, text, text) from public, anon;
grant execute on function public.set_member(uuid, text, text) to authenticated;

-- ===== RLS profil =====
drop policy "profil milik sendiri" on public.profiles;
create policy "lihat profil sendiri atau admin" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "ubah nama sendiri" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- ===== RLS pengaturan toko =====
alter table public.store_settings enable row level security;
create policy "anggota lihat pengaturan" on public.store_settings for select to authenticated using ((select public.is_member()));
create policy "admin ubah pengaturan" on public.store_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ===== RLS data toko: dipakai bersama semua anggota =====
do $$
declare t text;
begin
  foreach t in array array['categories','suppliers','products','variants','sales','price_history','schedules','shopping_lists','shopping_items']
  loop
    execute format('drop policy "data milik sendiri" on public.%I', t);
    execute format('create policy "anggota lihat" on public.%I for select to authenticated using ((select public.is_member()))', t);
  end loop;
end $$;

-- master data & jadwal: hanya admin yang mengubah
do $$
declare t text;
begin
  foreach t in array array['categories','suppliers','schedules']
  loop
    execute format('create policy "admin tambah" on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy "admin ubah" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy "admin hapus" on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end $$;

-- produk, varian, riwayat harga: anggota boleh menambah (foto lapangan), admin mengubah/menghapus
do $$
declare t text;
begin
  foreach t in array array['products','variants','price_history']
  loop
    execute format('create policy "anggota tambah" on public.%I for insert to authenticated with check ((select public.is_member()))', t);
    execute format('create policy "admin ubah" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy "admin hapus" on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end $$;

-- penjualan: anggota menambah; ubah/hapus milik sendiri atau admin
create policy "anggota tambah" on public.sales for insert to authenticated with check ((select public.is_member()));
create policy "pemilik atau admin ubah" on public.sales for update to authenticated
  using ((select public.is_admin()) or (owner_id = (select auth.uid()) and (select public.is_member())))
  with check ((select public.is_admin()) or (owner_id = (select auth.uid()) and (select public.is_member())));
create policy "pemilik atau admin hapus" on public.sales for delete to authenticated
  using ((select public.is_admin()) or (owner_id = (select auth.uid()) and (select public.is_member())));

-- daftar belanja: admin membuat/menghapus; anggota boleh mencentang (mode belanja)
do $$
declare t text;
begin
  foreach t in array array['shopping_lists','shopping_items']
  loop
    execute format('create policy "admin tambah" on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy "anggota ubah" on public.%I for update to authenticated using ((select public.is_member())) with check ((select public.is_member()))', t);
    execute format('create policy "admin hapus" on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end $$;

-- kategori unik per toko (bukan per akun)
alter table public.categories drop constraint categories_owner_id_name_key;
alter table public.categories add constraint categories_name_key unique (name);

-- ===== Fungsi yang dipanggil anggota biasa =====
-- selesai belanja: anggota boleh, walau tidak punya hak ubah varian secara langsung
create or replace function public.complete_shopping_list(p_list_id uuid)
returns public.shopping_lists
language plpgsql security definer set search_path = '' as $$
declare
  l public.shopping_lists;
  s public.schedules;
  r record;
  next_date date;
begin
  if not public.is_member() then raise exception 'Akun belum disetujui'; end if;
  select * into l from public.shopping_lists where id = p_list_id for update;
  if not found then raise exception 'Daftar belanja tidak ditemukan'; end if;
  if l.status = 'done' then return l; end if;

  for r in
    select i.*, p.supplier_id as product_supplier
    from public.shopping_items i
    left join public.variants v on v.id = i.variant_id
    left join public.products p on p.id = v.product_id
    where i.list_id = p_list_id and i.status = 'bought' and i.variant_id is not null
  loop
    update public.variants set
      stock = stock + coalesce(r.qty_actual, r.qty_planned),
      buy_price = coalesce(r.price_actual, r.price_planned)
    where id = r.variant_id;

    insert into public.price_history (owner_id, variant_id, recorded_on, price, supplier_id)
    values (auth.uid(), r.variant_id, current_date, coalesce(r.price_actual, r.price_planned),
            coalesce(r.supplier_id, r.product_supplier));
  end loop;

  update public.products p set status = 'active'
  where p.status = 'candidate' and p.id in (
    select v.product_id from public.shopping_items i join public.variants v on v.id = i.variant_id
    where i.list_id = p_list_id and i.status = 'bought');

  update public.shopping_items set qty_actual = qty_planned
  where list_id = p_list_id and status = 'bought' and qty_actual is null;
  update public.shopping_items set price_actual = price_planned
  where list_id = p_list_id and status = 'bought' and price_actual is null;

  update public.shopping_lists set status = 'done', completed_at = now(),
    started_at = coalesce(started_at, now())
  where id = p_list_id returning * into l;

  if l.schedule_id is not null then
    select * into s from public.schedules where id = l.schedule_id;
    if found and s.recurrence <> 'none' then
      next_date := case s.recurrence
        when 'weekly' then s.scheduled_on + 7
        when 'biweekly' then s.scheduled_on + 14
        else (s.scheduled_on + interval '1 month')::date end;
      if not exists (select 1 from public.schedules x where x.scheduled_on = next_date and x.title = s.title) then
        insert into public.schedules (owner_id, title, scheduled_on, scheduled_time, recurrence, location, budget, remind_day_before, remind_morning, notes)
        values (auth.uid(), s.title, next_date, s.scheduled_time, s.recurrence, s.location, s.budget, s.remind_day_before, s.remind_morning, s.notes);
      end if;
    end if;
  end if;

  return l;
end $$;
revoke execute on function public.complete_shopping_list(uuid) from public, anon;
grant execute on function public.complete_shopping_list(uuid) to authenticated;

-- stok berkurang saat anggota mencatat penjualan manual
create or replace function public.adjust_stock(p_variant_id uuid, p_delta integer)
returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not public.is_member() then raise exception 'Akun belum disetujui'; end if;
  update public.variants set stock = stock + p_delta where id = p_variant_id returning stock into n;
  return n;
end $$;
revoke execute on function public.adjust_stock(uuid, integer) from public, anon;
grant execute on function public.adjust_stock(uuid, integer) to authenticated;

-- ===== Data awal dari file Simulasi Harga Jual Tumbler =====
create or replace function public.starter_seed() returns jsonb
language sql immutable set search_path = '' as $fn$
  select $seed$[{"name":"Toko Kembar","location":"Jl. Asemka Mandiri No. 9A (Bawah Fly Over) Jakarta Belakang Museum Mandiri","whatsapp":"085694449481","notes":"WA lain: 081574048877, 081584177773","products":[{"name":"Vacum Set 500 mL SUS 304","buy":28000,"sell":70000,"qty":4,"variants":[{"name":"Biru","qty":1},{"name":"Abu","qty":2},{"name":"Pink","qty":1}],"attributes":{"kapasitas":"500","bahan":"SUS 304"}},{"name":"Tumbler 2f Mini Summer 3/seri 450mL SUS 316","buy":45000,"sell":115000,"qty":12,"variants":[{"name":"Merah","qty":3},{"name":"Hitam","qty":3},{"name":"Biru","qty":3},{"name":"Coklat","qty":3}],"attributes":{"kapasitas":"450","bahan":"SUS 316"}},{"name":"Xiomai Cup Mini 400 mL SUS 316","buy":60000,"sell":115000,"qty":3,"variants":[{"name":"Coklat","qty":1},{"name":"Biru","qty":1},{"name":"Pink","qty":1}],"attributes":{"kapasitas":"400","bahan":"SUS 316"}},{"name":"Tumbler Gelas Gagang Coffee 500 mL SUS 304","buy":40000,"sell":95000,"qty":6,"variants":[{"name":"Putih","qty":2},{"name":"Abu","qty":2},{"name":"Ungu","qty":2}],"attributes":{"kapasitas":"500","bahan":"SUS 304"}},{"name":"Tumbler Mug Telor 360mL SUS 304","buy":25000,"sell":68000,"qty":12,"variants":[{"name":"Putih","qty":2},{"name":"Light Blue","qty":1},{"name":"Biru Dongker","qty":6},{"name":"Pink","qty":1},{"name":"Orange","qty":2}],"attributes":{"kapasitas":"360","bahan":"SUS 304"}},{"name":"Tumbler gagang jumbo nice to meet you 800mL SUS 316","buy":55000,"sell":135000,"qty":6,"variants":[{"name":"Light Blue","qty":2},{"name":"Green","qty":2},{"name":"Red","qty":2}],"attributes":{"kapasitas":"800","bahan":"SUS 316"}},{"name":"Tumbler Supply 650mL SUS 316","buy":55000,"sell":115000,"qty":6,"variants":[{"name":"Red","qty":2},{"name":"Blue","qty":2},{"name":"Black","qty":2}],"attributes":{"kapasitas":"650","bahan":"SUS 316"}},{"name":"Tumbler 2f flowers + kotak Pk 900 mL","buy":62000,"sell":130000,"qty":8,"variants":[{"name":"Pink Flowers","qty":2},{"name":"Light Blue Flowers","qty":2},{"name":"Cream Flowers","qty":2},{"name":"Pink Kotak","qty":1},{"name":"Pink Bunga","qty":1}],"attributes":{"kapasitas":"900"}},{"name":"Tumbler 2f M. bunga","buy":62000,"sell":130000,"qty":3,"variants":[{"name":"Ungu","qty":1},{"name":"Pink","qty":1},{"name":"Cream","qty":1}],"attributes":{}},{"name":"Tumbler lF 900ml SUS 304","buy":35000,"sell":130000,"qty":14,"variants":[{"name":"Hitam","qty":3},{"name":"Dongker","qty":2},{"name":"Biru Muda","qty":2},{"name":"Kuning","qty":2},{"name":"Abu Abu","qty":1},{"name":"Pink","qty":2},{"name":"Hijau","qty":2}],"attributes":{"kapasitas":"900","bahan":"SUS 304"}},{"name":"Tumbler ow Freesip 900ml tanpa H SUS 304","buy":43000,"sell":115000,"qty":2,"variants":[{"name":"Ungu Tutup Hijau","qty":1},{"name":"Pink Tutup Ungu","qty":1}],"attributes":{"kapasitas":"900","bahan":"SUS 304"}},{"name":"Tumbler Cuculemon SUS 316 500 mL","buy":85000,"sell":135000,"qty":8,"variants":[{"name":"White","qty":2},{"name":"Hitam","qty":3},{"name":"Pink","qty":1},{"name":"Yellow","qty":2}],"attributes":{"kapasitas":"500","bahan":"SUS 316"}},{"name":"Tumbler gagang car cup OY/H/AB 1000mL SUS 304","buy":78000,"sell":178000,"qty":9,"variants":[{"name":"Putih","qty":3},{"name":"Abu-abu","qty":2},{"name":"Orange","qty":4}],"attributes":{"kapasitas":"1000","bahan":"SUS 304"}},{"name":"Tumbler Panda 710mL SUS 304","buy":55000,"sell":120000,"qty":9,"variants":[{"name":"Pink","qty":3},{"name":"Merah","qty":3},{"name":"Hitam","qty":3}],"attributes":{"kapasitas":"710","bahan":"SUS 304"}},{"name":"Tumbler Keep Puling Polos 750 ml SUS 316","buy":47000,"sell":135000,"qty":4,"variants":[{"name":"Biru Tutup Pink","qty":2},{"name":"Biru Muda","qty":2}],"attributes":{"kapasitas":"750","bahan":"SUS 316"}}]},{"name":"Toko OBI","location":"Bawah Fly Over (Depan Parkir Motor) Pasar Pagi Asemka","whatsapp":"081383821482","notes":"WA lain: 085771634430","products":[{"name":"Tumbler Freedom 700 mL","buy":63000,"sell":142000,"qty":18,"variants":[{"name":"Biru","qty":3},{"name":"Hitam","qty":3},{"name":"Merah","qty":3},{"name":"Coklat","qty":3},{"name":"Putih","qty":3},{"name":"Hijau","qty":3}],"attributes":{"kapasitas":"700"}},{"name":"Tumbler Eskrim 700 mL","buy":43000,"sell":110000,"qty":8,"variants":[{"name":"Pink","qty":2},{"name":"Kuning","qty":2},{"name":"Biru","qty":2},{"name":"Coklat","qty":2}],"attributes":{"kapasitas":"700"}},{"name":"Tumbler Keep Puling Polos 750 mL","buy":48000,"sell":135000,"qty":6,"variants":[{"name":"Kuning","qty":3},{"name":"Hitam","qty":3}],"attributes":{"kapasitas":"750"}}]}]$seed$::jsonb
$fn$;
revoke execute on function public.starter_seed() from public, anon;
grant execute on function public.starter_seed() to authenticated;

-- ===== Impor data awal: sekali untuk toko, hanya admin =====
create or replace function public.import_starter_data()
returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  seed jsonb;
  s jsonb; p jsonb; v jsonb;
  cat_id uuid; sup_id uuid; prod_id uuid; var_id uuid; list_id uuid;
  n integer := 0; ord integer := 0;
begin
  if not public.is_admin() then raise exception 'Hanya admin yang bisa mengimpor data'; end if;
  if exists (select 1 from public.suppliers where name in ('Toko Kembar','Toko OBI')) then
    return 0;
  end if;
  seed := public.starter_seed();

  insert into public.categories (name, extra_attributes)
  values ('Tumbler', '[{"key":"kapasitas","label":"Kapasitas","unit":"ml"},{"key":"bahan","label":"Bahan"}]'::jsonb)
  on conflict (name) do update set extra_attributes = excluded.extra_attributes
  returning id into cat_id;

  update public.store_settings set platform_fee_pct = 20, default_markup_pct = 50 where id = 1;

  insert into public.shopping_lists (title, status, started_at)
  values ('Kulakan Asemka (impor Excel)', 'in_progress', now())
  returning id into list_id;

  for s in select * from jsonb_array_elements(seed) loop
    insert into public.suppliers (name, location, whatsapp, notes)
    values (s->>'name', s->>'location', s->>'whatsapp', s->>'notes')
    returning id into sup_id;

    for p in select * from jsonb_array_elements(s->'products') loop
      insert into public.products (name, category_id, supplier_id, status, source, attributes, found_location)
      values (p->>'name', cat_id, sup_id, 'active', 'upload', coalesce(p->'attributes','{}'::jsonb), s->>'location')
      returning id into prod_id;
      n := n + 1;

      for v in select * from jsonb_array_elements(p->'variants') loop
        insert into public.variants (product_id, name, buy_price, sell_price, stock, min_stock, price_mode)
        values (prod_id, v->>'name', (p->>'buy')::numeric, (p->>'sell')::numeric, 0, 1, 'manual')
        returning id into var_id;

        ord := ord + 1;
        insert into public.shopping_items (list_id, variant_id, supplier_id, qty_planned, price_planned, qty_actual, price_actual, status, sort_order)
        values (list_id, var_id, sup_id, (v->>'qty')::int, (p->>'buy')::numeric, (v->>'qty')::int, (p->>'buy')::numeric, 'bought', ord);
      end loop;
    end loop;
  end loop;

  perform public.complete_shopping_list(list_id);
  return n;
end $$;
revoke execute on function public.import_starter_data() from public, anon;
grant execute on function public.import_starter_data() to authenticated;

-- ===== Storage: admin boleh mengganti/menghapus foto siapa pun =====
create policy "admin ubah foto" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (select public.is_admin()));
create policy "admin hapus foto" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (select public.is_admin()));
