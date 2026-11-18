-- AutoViral Group Command Center: membership lifecycle and reminders
-- Safe additive migration; existing community review status remains unchanged.
alter table public.av_communities
  add column if not exists membership_status text not null default 'mapped'
    check (membership_status in ('mapped','not_requested','request_pending','joined','rejected')),
  add column if not exists request_sent_at timestamptz,
  add column if not exists membership_checked_at timestamptz,
  add column if not exists last_reminded_at timestamptz;

create index if not exists av_communities_membership_status_idx
  on public.av_communities (workspace_id, membership_status, created_at desc);

comment on column public.av_communities.membership_status is
  'Facebook membership state confirmed by operator; distinct from internal community review status.';
comment on column public.av_communities.last_reminded_at is
  'Last five-minute pending-membership reminder shown in the AutoViral dashboard.';
