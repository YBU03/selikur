-- Persentase simulasi & saran harga bisa diatur sendiri oleh admin
alter table public.store_settings
  add column sim_steps integer[] not null default '{50,60,70,80,90,100}',
  add column safe_min_pct numeric(6,2) not null default 50 check (safe_min_pct >= 0),
  add column safe_max_pct numeric(6,2) not null default 100 check (safe_max_pct > 0),
  add column target_fast_pct numeric(6,2) not null default 90 check (target_fast_pct >= 0),
  add column target_normal_pct numeric(6,2) not null default 70 check (target_normal_pct >= 0),
  add column target_slow_pct numeric(6,2) not null default 55 check (target_slow_pct >= 0),
  add column promo_min_margin_pct numeric(6,2) not null default 20 check (promo_min_margin_pct >= 0),
  add column promo_steps integer[] not null default '{5,10,15,20,25,30}',
  add column promo_extra_fee_pct numeric(5,2) not null default 0 check (promo_extra_fee_pct >= 0 and promo_extra_fee_pct < 50);
