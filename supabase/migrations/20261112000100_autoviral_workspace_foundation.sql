-- AutoViral AI — isolated Phase 1 schema.
-- All objects are prefixed av_ and do not alter existing VSA, TIC, or other application tables.

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.av_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.av_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.av_workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.av_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.av_products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.av_workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 180),
  description text,
  product_type text not null default 'digital' check (product_type in ('digital','physical','service','affiliate')),
  niche text,
  price numeric(12,2) check (price is null or price >= 0),
  currency char(3) not null default 'BRL',
  checkout_url text,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.av_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.av_workspaces(id) on delete cascade,
  product_id uuid references public.av_products(id) on delete set null,
  name text not null check (char_length(name) between 1 and 180),
  objective text not null default 'organic_traffic',
  status text not null default 'draft' check (status in ('draft','planned','active','paused','completed','archived')),
  start_date date,
  end_date date,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.av_integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.av_workspaces(id) on delete cascade,
  provider text not null,
  account_label text,
  status text not null default 'disconnected' check (status in ('disconnected','pending','connected','error','revoked')),
  scopes text[] not null default '{}',
  connected_by uuid references auth.users(id) on delete set null,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, account_label)
);
comment on table public.av_integrations is 'Connection metadata only. OAuth tokens/secrets must live in server-side secret storage, never in this table or browser.';

create table if not exists public.av_activity_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.av_workspaces(id) on delete cascade,
  event_name text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}',
  actor_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now()
);

create index if not exists av_members_user_idx on public.av_workspace_members(user_id);
create index if not exists av_members_workspace_idx on public.av_workspace_members(workspace_id);
create index if not exists av_products_workspace_idx on public.av_products(workspace_id, created_at desc);
create index if not exists av_campaigns_workspace_idx on public.av_campaigns(workspace_id, created_at desc);
create index if not exists av_integrations_workspace_idx on public.av_integrations(workspace_id);
create index if not exists av_events_workspace_time_idx on public.av_activity_events(workspace_id, occurred_at desc);

-- Private membership helpers break RLS policy recursion. They are not in an exposed API schema.
create or replace function private.av_is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.av_workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.av_is_workspace_admin(target_workspace uuid)
returns boolean language sql stable security definer set search_path = ''
as $
  select exists (
    select 1 from public.av_workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  );
$;

create or replace function private.av_is_workspace_owner(target_workspace uuid)
returns boolean language sql stable security definer set search_path = ''
as $
  select exists (
    select 1 from public.av_workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$;

revoke all on function private.av_is_workspace_member(uuid) from public, anon;
revoke all on function private.av_is_workspace_admin(uuid) from public, anon;
revoke all on function private.av_is_workspace_owner(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.av_is_workspace_member(uuid) to authenticated;
grant execute on function private.av_is_workspace_admin(uuid) to authenticated;
grant execute on function private.av_is_workspace_owner(uuid) to authenticated;

alter table public.av_profiles enable row level security;
alter table public.av_workspaces enable row level security;
alter table public.av_workspace_members enable row level security;
alter table public.av_products enable row level security;
alter table public.av_campaigns enable row level security;
alter table public.av_integrations enable row level security;
alter table public.av_activity_events enable row level security;

-- Profiles: each user can access only their own profile.
create policy av_profiles_select_own on public.av_profiles for select to authenticated using (id = (select auth.uid()));
create policy av_profiles_insert_own on public.av_profiles for insert to authenticated with check (id = (select auth.uid()));
create policy av_profiles_update_own on public.av_profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Workspaces and memberships.
create policy av_workspaces_select_member on public.av_workspaces for select to authenticated
  using (owner_id = (select auth.uid()) or (select private.av_is_workspace_member(id)));
create policy av_workspaces_insert_owner on public.av_workspaces for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy av_workspaces_update_admin on public.av_workspaces for update to authenticated
  using (owner_id = (select auth.uid()) or (select private.av_is_workspace_admin(id)))
  with check (owner_id = (select auth.uid()) or (select private.av_is_workspace_admin(id)));

create policy av_members_select_workspace on public.av_workspace_members for select to authenticated
  using (user_id = (select auth.uid()) or (select private.av_is_workspace_member(workspace_id)));
create policy av_members_insert_owner_self on public.av_workspace_members for insert to authenticated
  with check (user_id = (select auth.uid()) and role = 'owner' and exists (
    select 1 from public.av_workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())
  ));
create policy av_members_update_owner on public.av_workspace_members for update to authenticated
  using ((select private.av_is_workspace_owner(workspace_id)))
  with check ((select private.av_is_workspace_owner(workspace_id)));
create policy av_members_delete_owner on public.av_workspace_members for delete to authenticated
  using ((select private.av_is_workspace_owner(workspace_id)) and user_id <> (select auth.uid()));

-- Workspace-owned operational data.
create policy av_products_select_member on public.av_products for select to authenticated using ((select private.av_is_workspace_member(workspace_id)));
create policy av_products_insert_member on public.av_products for insert to authenticated with check ((select private.av_is_workspace_member(workspace_id)) and created_by = (select auth.uid()));
create policy av_products_update_member on public.av_products for update to authenticated using ((select private.av_is_workspace_member(workspace_id))) with check ((select private.av_is_workspace_member(workspace_id)));
create policy av_products_delete_admin on public.av_products for delete to authenticated using ((select private.av_is_workspace_admin(workspace_id)));

create policy av_campaigns_select_member on public.av_campaigns for select to authenticated using ((select private.av_is_workspace_member(workspace_id)));
create policy av_campaigns_insert_member on public.av_campaigns for insert to authenticated with check ((select private.av_is_workspace_member(workspace_id)) and created_by = (select auth.uid()));
create policy av_campaigns_update_member on public.av_campaigns for update to authenticated using ((select private.av_is_workspace_member(workspace_id))) with check ((select private.av_is_workspace_member(workspace_id)));
create policy av_campaigns_delete_admin on public.av_campaigns for delete to authenticated using ((select private.av_is_workspace_admin(workspace_id)));

create policy av_integrations_select_admin on public.av_integrations for select to authenticated using ((select private.av_is_workspace_admin(workspace_id)));
create policy av_integrations_insert_admin on public.av_integrations for insert to authenticated with check ((select private.av_is_workspace_admin(workspace_id)));
create policy av_integrations_update_admin on public.av_integrations for update to authenticated using ((select private.av_is_workspace_admin(workspace_id))) with check ((select private.av_is_workspace_admin(workspace_id)));
create policy av_integrations_delete_admin on public.av_integrations for delete to authenticated using ((select private.av_is_workspace_admin(workspace_id)));

create policy av_events_select_member on public.av_activity_events for select to authenticated using ((select private.av_is_workspace_member(workspace_id)));
create policy av_events_insert_member on public.av_activity_events for insert to authenticated with check ((select private.av_is_workspace_member(workspace_id)) and actor_id = (select auth.uid()));

-- Explicit Data API grants. RLS remains the row-level authorization boundary.
grant select, insert, update, delete on public.av_profiles to authenticated;
grant select, insert, update, delete on public.av_workspaces to authenticated;
grant select, insert, update, delete on public.av_workspace_members to authenticated;
grant select, insert, update, delete on public.av_products to authenticated;
grant select, insert, update, delete on public.av_campaigns to authenticated;
grant select, insert, update, delete on public.av_integrations to authenticated;
grant select, insert on public.av_activity_events to authenticated;
grant usage, select on sequence public.av_activity_events_id_seq to authenticated;

-- Private trigger function creates a profile for new Auth users.
create or replace function private.av_handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.av_profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.av_handle_new_user() from public, anon, authenticated;
drop trigger if exists av_on_auth_user_created on auth.users;
create trigger av_on_auth_user_created after insert on auth.users
for each row execute procedure private.av_handle_new_user();

-- Backfill profile rows for existing users; no existing application tables are touched.
insert into public.av_profiles (id)
select id from auth.users
on conflict (id) do nothing;
