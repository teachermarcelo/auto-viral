create table if not exists public.av_sales (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.av_workspaces(id) on delete cascade,
 product_id uuid references public.av_products(id) on delete set null, campaign_id uuid references public.av_campaigns(id) on delete set null,
 tracking_link_id uuid references public.av_tracking_links(id) on delete set null, provider text not null default 'kiwify',
 provider_order_id text not null, order_status text not null, amount numeric(12,2), currency text not null default 'BRL',
 payment_method text, paid_at timestamptz, received_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb,
 constraint av_sales_provider_order_unique unique(provider,provider_order_id),
 constraint av_sales_status_check check(order_status in ('paid','approved','waiting_payment','refused','refunded','chargedback','canceled','unknown'))
);
create index if not exists av_sales_workspace_paid_idx on public.av_sales(workspace_id,paid_at desc);
create index if not exists av_sales_product_idx on public.av_sales(product_id);
alter table public.av_sales enable row level security;
drop policy if exists av_sales_workspace_read on public.av_sales;
create policy av_sales_workspace_read on public.av_sales for select to authenticated using (
 exists(select 1 from public.av_workspace_members m where m.workspace_id=av_sales.workspace_id and m.user_id=(select auth.uid()))
);
revoke insert,update,delete on public.av_sales from anon,authenticated;
grant select on public.av_sales to authenticated;
grant all on public.av_sales to service_role;
create table if not exists public.av_kiwify_webhook_secrets (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.av_workspaces(id) on delete cascade,
 token_hash text not null unique, active boolean not null default true, created_at timestamptz not null default now()
);
alter table public.av_kiwify_webhook_secrets enable row level security;
revoke all on public.av_kiwify_webhook_secrets from anon,authenticated;
grant all on public.av_kiwify_webhook_secrets to service_role;