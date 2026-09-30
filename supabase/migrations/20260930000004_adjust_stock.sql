-- Ubah stok secara atomik (dipakai input/ubah/hapus penjualan manual)
create or replace function public.adjust_stock(p_variant_id uuid, p_delta integer)
returns integer
language sql security invoker set search_path = '' as $$
  update public.variants set stock = stock + p_delta where id = p_variant_id returning stock;
$$;
revoke execute on function public.adjust_stock(uuid, integer) from public, anon;
grant execute on function public.adjust_stock(uuid, integer) to authenticated;
