alter table public.av_products
  add column if not exists image_url text;

comment on column public.av_products.image_url is
  'Public or signed URL for the product image used in the AutoViral product catalog.';
