-- Unggah dengan upsert (INSERT ... ON CONFLICT ... RETURNING) butuh izin SELECT.
-- Tanpa policy ini semua unggahan foto ditolak (400).
create policy "anggota lihat foto" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (select public.is_member()));
