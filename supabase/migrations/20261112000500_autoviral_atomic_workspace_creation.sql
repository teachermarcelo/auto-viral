-- Create a workspace and its owner membership in one database transaction.
-- The function derives the owner from the authenticated JWT; callers cannot
-- supply another user's ID or assign themselves an elevated role elsewhere.

CREATE OR REPLACE FUNCTION public.av_create_workspace(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_name text := btrim(p_name);
  v_slug_base text;
  v_slug text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '28000';
  END IF;

  IF v_name IS NULL OR char_length(v_name) < 1 OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'Workspace name must contain between 1 and 120 characters'
      USING ERRCODE = '22023';
  END IF;

  v_slug_base := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
  IF v_slug_base IS NULL OR char_length(v_slug_base) < 2 THEN
    v_slug_base := 'workspace';
  END IF;

  v_slug := left(v_slug_base, 48) || '-' ||
            left(replace(gen_random_uuid()::text, '-', ''), 8);

  INSERT INTO public.av_workspaces (name, slug, owner_id)
  VALUES (v_name, v_slug, v_user_id)
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.av_workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, v_user_id, 'owner');

  RETURN v_workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION public.av_create_workspace(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.av_create_workspace(text) TO authenticated;
