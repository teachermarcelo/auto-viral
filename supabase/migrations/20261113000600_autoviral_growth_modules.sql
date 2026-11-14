-- AutoViral expansion: research, creative studio, city targeting, social content and email drafts.
create table if not exists public.av_creative_assets (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.av_workspaces(id) on delete cascade,
 product_id uuid references public.av_products(id) on delete set null, campaign_id uuid references public.av_campaigns(id) on delete set null,
 asset_type text not null check(asset_type in ('copy','short_video_script','carousel','pin','story','image_brief','email')),
 channel text not null default 'general', title text not null check(char_length(title) between 2 and 180), content text not null default '',
 status text not null default 'draft' check(status in ('draft','approved','archived')), metadata jsonb not null default '{}'::jsonb,
 created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists av_creative_assets_workspace_idx on public.av_creative_assets(workspace_id,created_at desc);
create table if not exists public.av_city_targets (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.av_workspaces(id) on delete cascade,
 city text not null, state_code text not null check(char_length(state_code)=2), product_id uuid references public.av_products(id) on delete set null,
 audience text not null default '', channel text not null default 'organic', status text not null default 'planned' check(status in ('planned','researching','active','paused','completed')),
 notes text, created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(),
 unique(workspace_id,city,state_code,product_id,channel)
);
create index if not exists av_city_targets_workspace_idx on public.av_city_targets(workspace_id,state_code,status);
create table if not exists public.av_research_reports (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.av_workspaces(id) on delete cascade,
 product_id uuid references public.av_products(id) on delete set null, query text not null,
 report_type text not null default 'pain_search' check(report_type in ('pain_search','market_research','competitor','trend','ai_report')),
 content jsonb not null default '{}'::jsonb, source_summary text, created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now()
);
create index if not exists av_research_reports_workspace_idx on public.av_research_reports(workspace_id,created_at desc);
create table if not exists public.av_email_campaigns (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.av_workspaces(id) on delete cascade,
 name text not null, subject text not null, html_content text not null default '', status text not null default 'draft' check(status in ('draft','ready','scheduled','sent','failed')),
 provider_campaign_id text, sent_at timestamptz, stats jsonb not null default '{}'::jsonb,
 created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists av_email_campaigns_workspace_idx on public.av_email_campaigns(workspace_id,created_at desc);
create table if not exists public.av_social_content (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.av_workspaces(id) on delete cascade,
 product_id uuid references public.av_products(id) on delete set null, platform text not null check(platform in ('instagram','facebook','youtube','pinterest','tiktok','whatsapp')),
 content_type text not null default 'post', title text not null, caption text not null default '', media_url text, destination_url text,
 status text not null default 'draft' check(status in ('draft','approved','scheduled','published','failed')), scheduled_at timestamptz, published_url text, provider_post_id text,
 created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists av_social_content_queue_idx on public.av_social_content(workspace_id,platform,status,scheduled_at);
do $$
declare t text;
begin
 foreach t in array array['av_creative_assets','av_city_targets','av_research_reports','av_email_campaigns','av_social_content'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy %I on public.%I for select to authenticated using ((select private.av_is_workspace_member(workspace_id)))',t||'_select_member',t);
  execute format('create policy %I on public.%I for insert to authenticated with check ((select private.av_is_workspace_member(workspace_id)) and created_by=(select auth.uid()))',t||'_insert_member',t);
  execute format('create policy %I on public.%I for update to authenticated using ((select private.av_is_workspace_member(workspace_id))) with check ((select private.av_is_workspace_member(workspace_id)))',t||'_update_member',t);
  execute format('create policy %I on public.%I for delete to authenticated using ((select private.av_is_workspace_admin(workspace_id)))',t||'_delete_admin',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 end loop;
end $$;