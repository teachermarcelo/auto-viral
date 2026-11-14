create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;
create table if not exists public.av_meta_scheduler_secrets (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.av_workspaces(id) on delete cascade,
 token_hash text not null unique,
 active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.av_meta_scheduler_secrets enable row level security;
revoke all on public.av_meta_scheduler_secrets from anon,authenticated;
grant all on public.av_meta_scheduler_secrets to service_role;
create index if not exists av_campaign_posts_due_idx on public.av_campaign_posts(channel,status,scheduled_at) where channel='instagram_story' and status='scheduled';