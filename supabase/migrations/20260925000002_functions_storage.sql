-- ===== Total daftar belanja otomatis =====
create or replace function public.refresh_list_totals() returns trigger
language plpgsql set search_path = '' as $$
declare lid uuid := coalesce(new.list_id, old.list_id);
begin
  update public.shopping_lists l set
    planned_total = coalesce((select sum(i.qty_planned * i.price_planned) from public.shopping_items i where i.list_id = lid), 0),
    actual_total  = coalesce((select sum(coalesce(i.qty_actual, 0) * coalesce(i.price_actual, i.price_planned))
                              from public.shopping_items i where i.list_id = lid and i.status = 'bought'), 0)
  where l.id = lid;
  if tg_op = 'UPDATE' and old.list_id is distinct from new.list_id then
    update public.shopping_lists l set
      planned_total = coalesce((select sum(i.qty_planned * i.price_planned) from public.shopping_items i where i.list_id = old.list_id), 0)
    where l.id = old.list_id;
  end if;
  return null;
end $$;

create trigger shopping_items_totals
after insert or update or delete on public.shopping_items
for each row execute function public.refresh_list_totals();

-- ===== Penjualan per ember 7 hari (0 = 7 hari terakhir) =====
create or replace function public.sales_buckets(p_weeks integer default 8)
returns table (variant_id uuid, bucket integer, qty bigint)
language sql stable security invoker set search_path = '' as $$
  select s.variant_id, ((current_date - s.sale_date) / 7)::int as bucket, sum(s.qty)::bigint
  from public.sales s
  where s.sale_date > current_date - (p_weeks * 7) and s.sale_date <= current_date
  group by 1, 2;
$$;

-- ===== Selesaikan belanja: stok bertambah, harga kulakan terbaru tersimpan =====
create or replace function public.complete_shopping_list(p_list_id uuid)
returns public.shopping_lists
language plpgsql security invoker set search_path = '' as $$
declare
  l public.shopping_lists;
  s public.schedules;
  r record;
  next_date date;
begin
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
    values (l.owner_id, r.variant_id, current_date, coalesce(r.price_actual, r.price_planned),
            coalesce(r.supplier_id, r.product_supplier));
  end loop;

  -- kandidat yang dibeli otomatis jadi aktif
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

  -- jadwal berulang: buat jadwal berikutnya
  if l.schedule_id is not null then
    select * into s from public.schedules where id = l.schedule_id;
    if found and s.recurrence <> 'none' then
      next_date := case s.recurrence
        when 'weekly' then s.scheduled_on + 7
        when 'biweekly' then s.scheduled_on + 14
        else (s.scheduled_on + interval '1 month')::date end;
      if not exists (select 1 from public.schedules x where x.owner_id = s.owner_id and x.scheduled_on = next_date and x.title = s.title) then
        insert into public.schedules (owner_id, title, scheduled_on, scheduled_time, recurrence, location, budget, remind_day_before, remind_morning, notes)
        values (s.owner_id, s.title, next_date, s.scheduled_time, s.recurrence, s.location, s.budget, s.remind_day_before, s.remind_morning, s.notes);
      end if;
    end if;
  end if;

  return l;
end $$;

revoke execute on function public.complete_shopping_list(uuid) from public, anon;
revoke execute on function public.sales_buckets(integer) from public, anon;
grant execute on function public.complete_shopping_list(uuid) to authenticated;
grant execute on function public.sales_buckets(integer) to authenticated;

-- ===== Storage foto produk =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "unggah foto ke folder sendiri" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "ubah foto sendiri" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "hapus foto sendiri" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
