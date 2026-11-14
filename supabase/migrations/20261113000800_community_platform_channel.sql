alter table public.av_communities add column if not exists platform text not null default 'facebook';
alter table public.av_communities drop constraint if exists av_communities_platform_check;
alter table public.av_communities add constraint av_communities_platform_check check(platform = any(array['facebook','whatsapp','telegram','other']::text[]));
create index if not exists av_communities_platform_idx on public.av_communities(workspace_id,platform,status,topic);