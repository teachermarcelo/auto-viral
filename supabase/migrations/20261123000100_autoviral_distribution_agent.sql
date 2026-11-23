-- AutoViral distribution agent: workspace pacing policy and auditable execution events.
-- Cooldowns are operational scheduling controls, not a way to evade platform enforcement.
create table if not exists public.av_distribution_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.av_workspaces(id) on delete cascade,
  enabled boolean not null default false,
  mode text not null default 'assisted' check (mode in ('assisted','automatic')),
  batch_size integer not null default 1 check (batch_size between 1 and 10),
  pause_minutes integer not null default 30 check (pause_minutes in (30,45,60)),
  require_approval boolean not null default true,
  stop_on_rate_limit boolean not null default true check (stop_on_rate_limit = true),
  stop_on_permission_error boolean not null default true check (stop_on_permission_error = true),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.av_distribution_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.av_workspaces(id) on delete cascade,
  event_type text not null check (event_type in ('policy_saved','batch_started','batch_completed','cooldown_started','rate_limited','permission_error','paused','resumed','publish_succeeded','publish_failed')),
  channel text,
  campaign_id uuid references public.av_campaigns(id) on delete set null,
  external_reference text,
  details jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists av_distribution_events_workspace_time_idx
  on public.av_distribution_events(workspace_id, created_at desc);
alter table public.av_distribution_settings enable row level security;
alter table public.av_distribution_events enable row level security;
drop policy if exists av_distribution_settings_select_member on public.av_distribution_settings;
create policy av_distribution_settings_select_member on public.av_distribution_settings
  for select to authenticated using ((select private.av_is_workspace_member(workspace_id)));
drop policy if exists av_distribution_settings_insert_admin on public.av_distribution_settings;
create policy av_distribution_settings_insert_admin on public.av_distribution_settings
  for insert to authenticated with check ((select private.av_is_workspace_admin(workspace_id)) and created_by=(select auth.uid()));
drop policy if exists av_distribution_settings_update_admin on public.av_distribution_settings;
create policy av_distribution_settings_update_admin on public.av_distribution_settings
  for update to authenticated using ((select private.av_is_workspace_admin(workspace_id)))
  with check ((select private.av_is_workspace_admin(workspace_id)));
drop policy if exists av_distribution_settings_delete_admin on public.av_distribution_settings;
create policy av_distribution_settings_delete_admin on public.av_distribution_settings
  for delete to authenticated using ((select private.av_is_workspace_admin(workspace_id)));
drop policy if exists av_distribution_events_select_member on public.av_distribution_events;
create policy av_distribution_events_select_member on public.av_distribution_events
  for select to authenticated using ((select private.av_is_workspace_member(workspace_id)));
drop policy if exists av_distribution_events_insert_member on public.av_distribution_events;
create policy av_distribution_events_insert_member on public.av_distribution_events
  for insert to authenticated with check ((select private.av_is_workspace_member(workspace_id)) and created_by=(select auth.uid()));
grant select,insert,update,delete on public.av_distribution_settings to authenticated;
grant select,insert on public.av_distribution_events to authenticated;
