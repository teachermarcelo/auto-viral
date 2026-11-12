-- Tighten browser-role table grants for AutoViral.
-- Row-level security remains the row boundary; SQL grants are the operation boundary.

REVOKE ALL PRIVILEGES ON TABLE
  public.av_profiles,
  public.av_workspaces,
  public.av_workspace_members,
  public.av_products,
  public.av_campaigns,
  public.av_integrations,
  public.av_activity_events
FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.av_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.av_workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.av_workspace_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.av_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.av_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.av_integrations TO authenticated;
GRANT SELECT, INSERT ON TABLE public.av_activity_events TO authenticated;

GRANT USAGE, SELECT ON SEQUENCE public.av_activity_events_id_seq TO authenticated;
