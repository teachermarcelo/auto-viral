alter table public.av_campaigns add column if not exists paused_until timestamptz;
alter table public.av_campaigns add column if not exists posts_since_pause integer not null default 0 check(posts_since_pause >= 0);
alter table public.av_campaign_posts add column if not exists community_id uuid references public.av_communities(id) on delete set null;
alter table public.av_campaign_posts add column if not exists tracking_link_id uuid references public.av_tracking_links(id) on delete set null;
alter table public.av_campaign_posts drop constraint if exists av_campaign_posts_status_check;
alter table public.av_campaign_posts add constraint av_campaign_posts_status_check check(status = any(array['scheduled','publishing','published','cancelled','failed','awaiting_admin']::text[]));
create index if not exists av_campaign_posts_campaign_status_idx on public.av_campaign_posts(workspace_id,campaign_id,status,scheduled_at);
create index if not exists av_campaign_posts_community_idx on public.av_campaign_posts(workspace_id,community_id,scheduled_at);