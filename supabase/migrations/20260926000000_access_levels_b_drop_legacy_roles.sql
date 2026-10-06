-- Access levels Phase B: remove the legacy role system.
--
-- NOT APPLIED YET. Apply only after the access-levels app code (PR #389) is merged
-- AND deployed. Until then production code still writes organization_members.role /
-- invitations.role, and dropping them would break hiring and invites.
--
-- Removes: organization_members.role, invitations.role, the app_role type,
-- has_org_role(), has_permission(), seed_org_role_permissions(), the role_permissions
-- seed trigger, the legacy compat views (scope_assignments, permission_audit_log),
-- and 4 tables: role_permissions, user_permission_overrides, hrc_committee_members,
-- role_change_audit_log (its rows already live in access_change_log).

-- ------------------------------------------------------------ final backfills
UPDATE public.invitations
SET access_level = CASE role::text
  WHEN 'admin' THEN 'owner' WHEN 'super_admin' THEN 'owner'
  WHEN 'manager' THEN 'admin' WHEN 'program_manager' THEN 'admin'
  ELSE 'staff' END::public.access_level
WHERE access_level IS NULL;

INSERT INTO public.access_change_log
  (id, organization_id, changed_by_user_id, changed_by_name, change_type, target_user_id, target_user_name, details, created_at)
SELECT id, organization_id, changed_by_user_id, changed_by_name, 'role_change', target_user_id, target_user_name,
       jsonb_build_object('previous_role', previous_role, 'new_role', new_role, 'change_method', change_method), created_at
FROM public.role_change_audit_log
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------ member defaults trigger (no role column)
CREATE OR REPLACE FUNCTION public.access_normalize_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.access_level = 'owner' THEN
    NEW.access_scope := 'agency';
    NEW.access_preset_id := NULL;
    RETURN NEW;
  END IF;
  IF NEW.access_preset_id IS NULL THEN
    NEW.access_preset_id := (
      SELECT id FROM public.access_presets
      WHERE organization_id = NEW.organization_id
        AND seed_key = CASE NEW.access_level WHEN 'admin' THEN 'program_manager' ELSE 'dsp' END);
  END IF;
  IF NEW.access_scope IS NULL THEN
    NEW.access_scope := COALESCE(
      (SELECT access_scope FROM public.access_presets WHERE id = NEW.access_preset_id),
      CASE NEW.access_level WHEN 'staff' THEN 'self' ELSE 'agency' END);
  END IF;
  RETURN NEW;
END;
$function$;
COMMENT ON FUNCTION public.access_normalize_member() IS
  'Access: fills default preset + scope for Staff/Admin members; Owners always see the whole agency with no preset.';

DROP TRIGGER IF EXISTS trg_access_sync_legacy_role ON public.organization_members;
DROP FUNCTION IF EXISTS public.access_sync_legacy_role();
CREATE TRIGGER trg_access_normalize_member
  BEFORE INSERT OR UPDATE OF access_level, access_scope, access_preset_id ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.access_normalize_member();

-- ------------------------------------------------------------ accept_invitation without the role fallback
CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inv invitations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_inv FROM public.invitations WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'Invitation already used'; END IF;
  IF v_inv.expires_at < now() THEN RAISE EXCEPTION 'Invitation expired'; END IF;
  IF lower(v_inv.email) <> lower(COALESCE(auth.jwt() ->> 'email', '')) THEN
    RAISE EXCEPTION 'Invitation email does not match your account';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, access_level, access_preset_id, active)
  VALUES (v_inv.organization_id, auth.uid(), v_inv.access_level, v_inv.access_preset_id, true)
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET access_level = EXCLUDED.access_level,
        access_preset_id = EXCLUDED.access_preset_id,
        access_scope = NULL,
        active = true;

  UPDATE public.invitations
    SET status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
    WHERE id = v_inv.id;

  RETURN v_inv.organization_id;
END;
$function$;

-- ------------------------------------------------------------ drop legacy views, functions, tables
DROP VIEW IF EXISTS public.permission_audit_log;
DROP VIEW IF EXISTS public.scope_assignments;

DROP TRIGGER IF EXISTS seed_role_permissions_after_org_insert ON public.organizations;
DROP FUNCTION IF EXISTS public.trg_seed_role_permissions_on_new_org();
DROP FUNCTION IF EXISTS public.seed_org_role_permissions(uuid);
DROP FUNCTION IF EXISTS public.has_permission(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.has_org_role(uuid, uuid, public.app_role);

DROP TABLE IF EXISTS public.role_change_audit_log;
DROP TABLE IF EXISTS public.role_permissions;
DROP TABLE IF EXISTS public.user_permission_overrides;
DROP TABLE IF EXISTS public.hrc_committee_members;

ALTER TABLE public.organization_members DROP COLUMN role;
ALTER TABLE public.invitations DROP COLUMN role;
DROP TYPE public.app_role;

-- ------------------------------------------------------------ lock the new columns in
ALTER TABLE public.organization_members
  ALTER COLUMN access_level SET DEFAULT 'staff',
  ALTER COLUMN access_level SET NOT NULL,
  ALTER COLUMN access_scope SET NOT NULL;
ALTER TABLE public.invitations
  ALTER COLUMN access_level SET DEFAULT 'staff',
  ALTER COLUMN access_level SET NOT NULL;
