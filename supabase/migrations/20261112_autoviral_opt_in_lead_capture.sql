create table public.av_leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.av_workspaces(id) on delete cascade,
  campaign_id uuid references public.av_campaigns(id) on delete set null,
  tracking_link_id uuid references public.av_tracking_links(id) on delete set null,
  name text not null check (char_length(name) between 2 and 180),
  email text,
  whatsapp text,
  city text,
  consent_at timestamptz not null,
  consent_text text not null,
  status text not null default 'new' check (status in ('new','contacted','qualified','converted','discarded')),
  created_at timestamptz not null default now(),
  constraint av_leads_contact_required check (coalesce(nullif(trim(email),''),'') <> '' or coalesce(nullif(trim(whatsapp),''),'') <> '')
);
create index av_leads_workspace_created_idx on public.av_leads(workspace_id, created_at desc);
create index av_leads_campaign_idx on public.av_leads(campaign_id);
alter table public.av_leads enable row level security;
create policy av_leads_select_member on public.av_leads for select to authenticated using ((select private.av_is_workspace_member(workspace_id)));
create policy av_leads_update_member on public.av_leads for update to authenticated using ((select private.av_is_workspace_member(workspace_id))) with check ((select private.av_is_workspace_member(workspace_id)));
create policy av_leads_delete_admin on public.av_leads for delete to authenticated using ((select private.av_is_workspace_admin(workspace_id)));
grant select, update, delete on public.av_leads to authenticated;