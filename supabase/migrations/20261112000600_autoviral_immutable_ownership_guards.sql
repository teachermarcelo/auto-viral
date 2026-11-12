-- Protect ownership and attribution fields from direct authenticated updates.
-- Ownership transfers must be implemented as an explicit, audited workflow.

CREATE OR REPLACE FUNCTION private.av_guard_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'av_workspaces' THEN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      RAISE EXCEPTION 'Workspace owner cannot be changed directly'
        USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME IN ('av_products', 'av_campaigns') THEN
    IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
       OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'Workspace and creator fields are immutable'
        USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'av_workspace_members' THEN
    IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Membership identity fields are immutable'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.role = 'owner' AND NEW.role <> 'owner' THEN
      RAISE EXCEPTION 'Workspace owner role cannot be changed directly'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.role <> 'owner' AND NEW.role = 'owner' THEN
      RAISE EXCEPTION 'Ownership transfer must use a dedicated workflow'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.av_guard_immutable_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS av_guard_workspace_owner ON public.av_workspaces;
CREATE TRIGGER av_guard_workspace_owner
BEFORE UPDATE ON public.av_workspaces
FOR EACH ROW EXECUTE FUNCTION private.av_guard_immutable_fields();

DROP TRIGGER IF EXISTS av_guard_product_ownership ON public.av_products;
CREATE TRIGGER av_guard_product_ownership
BEFORE UPDATE ON public.av_products
FOR EACH ROW EXECUTE FUNCTION private.av_guard_immutable_fields();

DROP TRIGGER IF EXISTS av_guard_campaign_ownership ON public.av_campaigns;
CREATE TRIGGER av_guard_campaign_ownership
BEFORE UPDATE ON public.av_campaigns
FOR EACH ROW EXECUTE FUNCTION private.av_guard_immutable_fields();

DROP TRIGGER IF EXISTS av_guard_membership_identity ON public.av_workspace_members;
CREATE TRIGGER av_guard_membership_identity
BEFORE UPDATE ON public.av_workspace_members
FOR EACH ROW EXECUTE FUNCTION private.av_guard_immutable_fields();
