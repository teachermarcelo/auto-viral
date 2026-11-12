-- Restrict direct table grants for AutoViral workspace data.
-- RLS policies remain the authorization boundary for authenticated users.
revoke all privileges on table
  public.av_profiles,
  public.av_workspaces,
  public.av_workspace_members,
  public.av_products,
  public.av_campaigns,
  public.av_integrations,
  public.av_activity_events
from anon, authenticated;

grant select, insert, update, delete on table
  public.av_profiles,
  public.av_workspaces,
  public.av_workspace_members,
  public.av_products,
  public.av_campaigns,
  public.av_integrations
 to authenticated;

grant select, insert on table public.av_activity_events to authenticated;
grant usage, select on sequence public.av_activity_events_id_seq to authenticated;
