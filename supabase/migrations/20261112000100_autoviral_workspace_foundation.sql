-- AutoViral AI — Phase 1 workspace foundation
-- Apply only to the confirmed AutoViral Supabase project after review.

create extension if not exists pgcrypto;

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

create index if not exists av_workspace_members_user_idx on public.av_workspace_members(user_id);
create index if not exists av_workspace_members_workspace_idx on public.av_workspace_members(workspace_id);

create or replace function public.av_is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.av_workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.av_is_workspace_admin(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1
    from public.av_workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  );
$;

revoke all on function public.av_is_workspace_member(uuid) from public;
revoke all on function public.av_is_workspace_admin(uuid) from public;
grant execute on function public.av_is_workspace_member(uuid) to authenticated;
grant execute on function public.av_is_workspace_admin(uuid) to authenticated;

alter table public.av_profiles enable row level security;
alter table public.av_workspaces enable row level security;
alter table public.av_workspace_members enable row level security;

drop policy if exists "av_profiles_select_own" on public.av_profiles;
create policy "av_profiles_select_own" on public.av_profiles
  for select to authenticated using (id = (select auth.uid()));
drop policy if exists "av_profiles_insert_own" on public.av_profiles;
create policy "av_profiles_insert_own" on public.av_profiles
  for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists "av_profiles_update_own" on public.av_profiles;
create policy "av_profiles_update_own" on public.av_profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "av_workspaces_select_member" on public.av_workspaces;
create policy "av_workspaces_select_member" on public.av_workspaces
  for select to authenticated using (owner_id = (select auth.uid()) or public.av_is_workspace_member(id));
drop policy if exists "av_workspaces_insert_owner" on public.av_workspaces;
create policy "av_workspaces_insert_owner" on public.av_workspaces
  for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists "av_workspaces_update_admin" on public.av_workspaces;
create policy "av_workspaces_update_admin" on public.av_workspaces
  for update to authenticated using (
    owner_id = (select auth.uid()) or public.av_is_workspace_admin(id)
  ) with check (
    owner_id = (select auth.uid()) or exists (
      select 1 from public.av_workspace_members m
      where m.workspace_id = id and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
    )
  );

drop policy if exists "av_members_select_workspace" on public.av_workspace_members;
create policy "av_members_select_workspace" on public.av_workspace_members
  for select to authenticated using (user_id = (select auth.uid()) or public.av_is_workspace_member(workspace_id));
drop policy if exists "av_members_insert_owner_self" on public.av_workspace_members;
create policy "av_members_insert_owner_self" on public.av_workspace_members
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and role = 'owner'
    and exists (
      select 1 from public.av_workspaces w
      where w.id = workspace_id and w.owner_id = (select auth.uid())
    )
  );
drop policy if exists "av_members_update_admin" on public.av_workspace_members;
create policy "av_members_update_admin" on public.av_workspace_members
  for update to authenticated using (
    public.av_is_workspace_admin(workspace_id)
  ) with check (
    public.av_is_workspace_admin(workspace_id)
  );
drop policy if exists "av_members_delete_owner" on public.av_workspace_members;
create policy "av_members_delete_owner" on public.av_workspace_members
  for delete to authenticated using (
    public.av_is_workspace_admin(workspace_id)
  );

-- Create profile rows for new signups. Existing auth users can create their own profile on first sign-in.
create or replace function public.av_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.av_profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists av_on_auth_user_created on auth.users;
create trigger av_on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.av_handle_new_user();
