-- Selikur: skema awal
-- Semua tabel milik satu pemilik (owner_id = auth.uid()); RLS memastikan harga modal hanya terlihat pemilik.

create extension if not exists "pgcrypto";

-- ===== Profil toko =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  store_name text not null default 'Toko Saya',
  coverage_weeks numeric(4,1) not null default 2 check (coverage_weeks > 0),
  forecast_method text not null default 'sma' check (forecast_method in ('sma','wma')),
  seasonal_factor numeric(4,2) not null default 1 check (seasonal_factor > 0),
  seasonal_label text,
  default_budget numeric(14,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== Kategori =====
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  -- daftar atribut tambahan, mis. [{"key":"kapasitas","label":"Kapasitas","unit":"ml"}]
  extra_attributes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

-- ===== Supplier =====
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  location text,
  whatsapp text,
  notes text,
  created_at timestamptz not null default now()
);

-- ===== Produk =====
create table public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  status text not null default 'active' check (status in ('active','candidate','inactive')),
  photos text[] not null default '{}' check (coalesce(array_length(photos, 1), 0) <= 5),
  notes text,
  attributes jsonb not null default '{}'::jsonb,
  source text not null default 'upload' check (source in ('upload','field')),
  found_location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== Varian (pusat data) =====
create table public.variants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null default 'Standar',
  sku text,
  photo text,
  buy_price numeric(14,2) not null default 0 check (buy_price >= 0),
  sell_price numeric(14,2) not null default 0 check (sell_price >= 0),
  unit text not null default 'pcs',
  unit_size integer not null default 1 check (unit_size >= 1),
  stock integer not null default 0,
  min_stock integer not null default 0 check (min_stock >= 0),
  manual_forecast numeric(10,2) check (manual_forecast >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== Penjualan =====
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  variant_id uuid not null references public.variants(id) on delete cascade,
  sale_date date not null,
  qty integer not null check (qty >= 0),
  source text not null default 'manual' check (source in ('manual','import')),
  note text,
  created_at timestamptz not null default now()
);

-- ===== Riwayat harga kulakan =====
create table public.price_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  variant_id uuid not null references public.variants(id) on delete cascade,
  recorded_on date not null default current_date,
  price numeric(14,2) not null check (price >= 0),
  supplier_id uuid references public.suppliers(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ===== Jadwal belanja =====
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'Kulakan',
  scheduled_on date not null,
  scheduled_time time,
  recurrence text not null default 'none' check (recurrence in ('none','weekly','biweekly','monthly')),
  location text,
  budget numeric(14,2),
  remind_day_before boolean not null default true,
  remind_morning boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

-- ===== Daftar belanja =====
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  schedule_id uuid unique references public.schedules(id) on delete set null,
  title text not null default 'Daftar Belanja',
  status text not null default 'draft' check (status in ('draft','in_progress','done')),
  budget numeric(14,2),
  planned_total numeric(14,2) not null default 0,
  actual_total numeric(14,2) not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  variant_id uuid references public.variants(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  custom_name text,
  qty_planned integer not null default 0 check (qty_planned >= 0),
  price_planned numeric(14,2) not null default 0 check (price_planned >= 0),
  qty_actual integer check (qty_actual >= 0),
  price_actual numeric(14,2) check (price_actual >= 0),
  status text not null default 'pending' check (status in ('pending','bought','unavailable')),
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ===== Index =====
create index on public.categories(owner_id);
create index on public.suppliers(owner_id);
create index on public.products(owner_id);
create index on public.products(category_id);
create index on public.products(supplier_id);
create index on public.variants(owner_id);
create index on public.variants(product_id);
create index on public.sales(owner_id, sale_date);
create index on public.sales(variant_id, sale_date);
create index on public.price_history(owner_id);
create index on public.price_history(variant_id, recorded_on);
create index on public.price_history(supplier_id);
create index on public.schedules(owner_id, scheduled_on);
create index on public.shopping_lists(owner_id, status);
create index on public.shopping_items(owner_id);
create index on public.shopping_items(list_id);
create index on public.shopping_items(variant_id);
create index on public.shopping_items(supplier_id);

-- ===== updated_at =====
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
create trigger variants_touch before update on public.variants for each row execute function public.touch_updated_at();

-- ===== Profil otomatis saat daftar =====
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, store_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'store_name', 'Toko Saya'))
  on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ===== RLS =====
alter table public.profiles enable row level security;
create policy "profil milik sendiri" on public.profiles for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

do $$
declare t text;
begin
  foreach t in array array['categories','suppliers','products','variants','sales','price_history','schedules','shopping_lists','shopping_items']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "data milik sendiri" on public.%I for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', t);
  end loop;
end $$;
