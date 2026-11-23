create table if not exists public.av_campaign_runs (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.av_workspaces(id) on delete cascade,
 campaign_id uuid not null references public.av_campaigns(id) on delete cascade,
 name text not null default 'Execução',
 status text not null default 'queued' check(status in ('queued','running','paused','completed','cancelled')),
 total_groups integer not null default 0 check(total_groups>=0),
 total_tasks integer not null default 0 check(total_tasks>=0),
 created_by uuid not null default auth.uid() references auth.users(id),
 started_at timestamptz,
 completed_at timestamptz,
 paused_until timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.av_campaign_posts add column if not exists campaign_run_id uuid references public.av_campaign_runs(id) on delete set null;
create index if not exists av_campaign_runs_workspace_campaign_idx on public.av_campaign_runs(workspace_id,campaign_id,created_at desc);
create index if not exists av_campaign_posts_run_idx on public.av_campaign_posts(workspace_id,campaign_run_id,status);
alter table public.av_campaign_runs enable row level security;
drop policy if exists av_campaign_runs_select_member on public.av_campaign_runs;
create policy av_campaign_runs_select_member on public.av_campaign_runs for select to authenticated using ((select private.av_is_workspace_member(workspace_id)));
drop policy if exists av_campaign_runs_insert_member on public.av_campaign_runs;
create policy av_campaign_runs_insert_member on public.av_campaign_runs for insert to authenticated with check ((select private.av_is_workspace_member(workspace_id)) and created_by=(select auth.uid()));
drop policy if exists av_campaign_runs_update_member on public.av_campaign_runs;
create policy av_campaign_runs_update_member on public.av_campaign_runs for update to authenticated using ((select private.av_is_workspace_member(workspace_id))) with check ((select private.av_is_workspace_member(workspace_id)));
drop policy if exists av_campaign_runs_delete_admin on public.av_campaign_runs;
create policy av_campaign_runs_delete_admin on public.av_campaign_runs for delete to authenticated using ((select private.av_is_workspace_admin(workspace_id)));
grant select,insert,update,delete on public.av_campaign_runs to authenticated;