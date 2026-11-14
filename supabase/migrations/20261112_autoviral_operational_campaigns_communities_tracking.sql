-- AutoViral operational campaigns, communities, opportunities and click tracking
-- All objects are isolated by workspace_id and use RLS. Legacy vsa_* objects are untouched.

alter table public.av_campaigns
  add column if not exists copy_text text,
  add column if not exists destination_url text,
  add column if not exists image_url text,
  add column if not exists video_url text,
  add column if not exists posting_interval_seconds integer not null default 0,
  add column if not exists pause_after_posts integer not null default 0,
  add column if not exists pause_duration_minutes integer not null default 0,
  add column if not exists channel text not null default 'manual',
  add constraint av_campaigns_interval_nonnegative check (posting_interval_seconds >= 0),
  add constraint av_campaigns_pause_count_nonnegative check (pause_after_posts >= 0),
  add constraint av_campaigns_pause_duration_nonnegative check (pause_duration_minutes >= 0);

create table public.av_campaign_posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.av_workspaces(id) on delete cascade,
  campaign_id uuid not null references public.av_campaigns(id) on delete cascade,
  channel text not null default 'manual',
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','published','cancelled','failed')),
  copy_snapshot text not null,
  media_url text,
  destination_url text,
  published_url text,
  published_at timestamptz,
  execution_note text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index av_campaign_posts_workspace_schedule_idx on public.av_campaign_posts(workspace_id, scheduled_at);
create index av_campaign_posts_campaign_idx on public.av_campaign_posts(campaign_id);

create table public.av_communities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.av_workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 180),
  url text not null,
  normalized_url text not null,
  topic text not null default 'Geral',
  rules_url text,
  notes text,
  status text not null default 'to_review' check (status in ('to_review','approved','do_not_post','archived')),
  last_reviewed_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, normalized_url)
);
create index av_communities_workspace_topic_idx on public.av_communities(workspace_id, topic);

create table public.av_opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.av_workspaces(id) on delete cascade,
  community_id uuid references public.av_communities(id) on delete set null,
  campaign_id uuid references public.av_campaigns(id) on delete set null,
  source_type text not null check (source_type in ('group_post','public_page','website','referral','other')),
  source_url text not null,
  source_title text,
  excerpt text,
  topic text not null default 'Geral',
  signal_type text not null default 'other' check (signal_type in ('question','recommendation','need','purchase_intent','discussion','other')),
  notes text,
  status text not null default 'new' check (status in ('new','reviewed','qualified','converted','discarded')),
  consent_confirmed boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index av_opportunities_workspace_created_idx on public.av_opportunities(workspace_id, created_at desc);

create table public.av_tracking_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.av_workspaces(id) on delete cascade,
  campaign_id uuid references public.av_campaigns(id) on delete set null,
  code text not null unique,
  destination_url text not null,
  label text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index av_tracking_links_workspace_idx on public.av_tracking_links(workspace_id, created_at desc);

create table public.av_tracking_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.av_workspaces(id) on delete cascade,
  tracking_link_id uuid not null references public.av_tracking_links(id) on delete cascade,
  event_type text not null default 'click' check (event_type in ('click','lead','sale')),
  referrer_host text,
  device_type text,
  city text,
  country_code text,
  created_at timestamptz not null default now()
);
create index av_tracking_events_workspace_created_idx on public.av_tracking_events(workspace_id, created_at desc);
create index av_tracking_events_link_idx on public.av_tracking_events(tracking_link_id, created_at desc);

alter table public.av_campaign_posts enable row level security;
alter table public.av_communities enable row level security;
alter table public.av_opportunities enable row level security;
alter table public.av_tracking_links enable row level security;
alter table public.av_tracking_events enable row level security;

create policy av_campaign_posts_select_member on public.av_campaign_posts for select to authenticated using ((select private.av_is_workspace_member(workspace_id)));
create policy av_campaign_posts_insert_member on public.av_campaign_posts for insert to authenticated with check ((select private.av_is_workspace_member(workspace_id)) and created_by = (select auth.uid()));
create policy av_campaign_posts_update_member on public.av_campaign_posts for update to authenticated using ((select private.av_is_workspace_member(workspace_id))) with check ((select private.av_is_workspace_member(workspace_id)));
create policy av_campaign_posts_delete_admin on public.av_campaign_posts for delete to authenticated using ((select private.av_is_workspace_admin(workspace_id)));

create policy av_communities_select_member on public.av_communities for select to authenticated using ((select private.av_is_workspace_member(workspace_id)));
create policy av_communities_insert_member on public.av_communities for insert to authenticated with check ((select private.av_is_workspace_member(workspace_id)) and created_by = (select auth.uid()));
create policy av_communities_update_member on public.av_communities for update to authenticated using ((select private.av_is_workspace_member(workspace_id))) with check ((select private.av_is_workspace_member(workspace_id)));
create policy av_communities_delete_admin on public.av_communities for delete to authenticated using ((select private.av_is_workspace_admin(workspace_id)));

create policy av_opportunities_select_member on public.av_opportunities for select to authenticated using ((select private.av_is_workspace_member(workspace_id)));
create policy av_opportunities_insert_member on public.av_opportunities for insert to authenticated with check ((select private.av_is_workspace_member(workspace_id)) and created_by = (select auth.uid()));
create policy av_opportunities_update_member on public.av_opportunities for update to authenticated using ((select private.av_is_workspace_member(workspace_id))) with check ((select private.av_is_workspace_member(workspace_id)));
create policy av_opportunities_delete_admin on public.av_opportunities for delete to authenticated using ((select private.av_is_workspace_admin(workspace_id)));

create policy av_tracking_links_select_member on public.av_tracking_links for select to authenticated using ((select private.av_is_workspace_member(workspace_id)));
create policy av_tracking_links_insert_member on public.av_tracking_links for insert to authenticated with check ((select private.av_is_workspace_member(workspace_id)) and created_by = (select auth.uid()));
create policy av_tracking_links_update_member on public.av_tracking_links for update to authenticated using ((select private.av_is_workspace_member(workspace_id))) with check ((select private.av_is_workspace_member(workspace_id)));
create policy av_tracking_links_delete_admin on public.av_tracking_links for delete to authenticated using ((select private.av_is_workspace_admin(workspace_id)));

create policy av_tracking_events_select_member on public.av_tracking_events for select to authenticated using ((select private.av_is_workspace_member(workspace_id)));

grant select, insert, update, delete on public.av_campaign_posts to authenticated;
grant select, insert, update, delete on public.av_communities to authenticated;
grant select, insert, update, delete on public.av_opportunities to authenticated;
grant select, insert, update, delete on public.av_tracking_links to authenticated;
grant select on public.av_tracking_events to authenticated;
