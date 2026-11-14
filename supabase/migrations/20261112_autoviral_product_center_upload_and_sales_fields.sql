alter table public.av_products
  add column if not exists target_audience text,
  add column if not exists benefits text,
  add column if not exists bonuses text,
  add column if not exists guarantee text,
  add column if not exists promo_price numeric(12,2);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('av-product-media', 'av-product-media', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "AV product media workspace uploads" on storage.objects;
create policy "AV product media workspace uploads"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'av-product-media'
  and private.av_is_workspace_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "AV product media workspace updates" on storage.objects;
create policy "AV product media workspace updates"
on storage.objects for update to authenticated
using (
  bucket_id = 'av-product-media'
  and private.av_is_workspace_member(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'av-product-media'
  and private.av_is_workspace_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "AV product media workspace deletes" on storage.objects;
create policy "AV product media workspace deletes"
on storage.objects for delete to authenticated
using (
  bucket_id = 'av-product-media'
  and private.av_is_workspace_member(((storage.foldername(name))[1])::uuid)
);
