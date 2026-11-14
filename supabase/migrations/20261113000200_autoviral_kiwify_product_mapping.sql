alter table public.av_products add column if not exists kiwify_product_id text;
create unique index if not exists av_products_workspace_kiwify_product_uidx on public.av_products(workspace_id,kiwify_product_id) where kiwify_product_id is not null;
update public.av_products set kiwify_product_id='ba87b820-de2c-11f1-b149-dfd43b2ebcf4' where id='13dda56f-d0b7-4d51-91c3-184f8cde608c';
update public.av_products set kiwify_product_id='67a15390-d572-11f1-bd40-b570d8dc84fc' where id='41b70437-a525-48a3-9fd8-e07d797b174a';