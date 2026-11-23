-- AutoViral Data Core: initial isolated schema.
-- Run only against the NEW Neon database. This does not modify Supabase.
-- This foundation deliberately does not expose public CRUD or bypass authentication.

begin;

create schema if not exists autoviral_core;
revoke all on schema autoviral_core from public;

create table if not exists autoviral_core.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active','suspended','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- subject is an opaque identifier issued by the future authentication provider.
-- It is not a password and must never be supplied as proof of identity by an
-- unauthenticated client. The API must verify the provider's signed session.
create table if not exists autoviral_core.users (
  id uuid primary key default gen_random_uuid(),
  auth_subject text not null unique,
  email text,
  display_name text,
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists autoviral_core.workspace_members (
  workspace_id uuid not null references autoviral_core.workspaces(id) on delete cascade,
  user_id uuid not null references autoviral_core.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','editor','analyst','member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists autoviral_core.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references autoviral_core.workspaces(id) on delete cascade,
  name text not null,
  description text,
  price numeric(14,2),
  currency char(3) not null default 'BRL',
  external_platform text,
  external_product_id text,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references autoviral_core.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, external_platform, external_product_id)
);

create index if not exists products_workspace_updated_idx
  on autoviral_core.products (workspace_id, updated_at desc);

create table if not exists autoviral_core.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references autoviral_core.workspaces(id) on delete cascade,
  product_id uuid references autoviral_core.products(id) on delete set null,
  name text not null,
  objective text,
  status text not null default 'draft' check (status in ('draft','scheduled','active','paused','completed','cancelled','failed')),
  starts_at timestamptz,
  ends_at timestamptz,
  budget_amount numeric(14,2),
  budget_currency char(3) not null default 'BRL',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references autoviral_core.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaigns_workspace_status_idx
  on autoviral_core.campaigns (workspace_id, status, updated_at desc);

create table if not exists autoviral_core.audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid references autoviral_core.workspaces(id) on delete set null,
  actor_user_id uuid references autoviral_core.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  request_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_workspace_created_idx
  on autoviral_core.audit_events (workspace_id, created_at desc);

commit;
