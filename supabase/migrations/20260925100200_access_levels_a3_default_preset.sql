-- Access levels Phase A3 (applied to live): new non-owner members with no preset
-- get the level's default preset (admin → Program Manager, staff → DSP) so they
-- never land with every category Off. Also backfills access_level on legacy
-- invitations that only had `role`.

CREATE OR REPLACE FUNCTION public.access_sync_legacy_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_from_role boolean;
  v_seed text;
BEGIN
  v_from_role := CASE
    WHEN TG_OP = 'INSERT' THEN NEW.access_level IS NULL
    ELSE NEW.role IS DISTINCT FROM OLD.role
         AND NEW.access_level IS NOT DISTINCT FROM OLD.access_level
         AND NEW.access_scope IS NOT DISTINCT FROM OLD.access_scope
         AND NEW.access_preset_id IS NOT DISTINCT FROM OLD.access_preset_id
  END;

  IF v_from_role THEN
    NEW.access_level := CASE NEW.role::text
      WHEN 'admin' THEN 'owner' WHEN 'super_admin' THEN 'owner'
      WHEN 'program_manager' THEN 'admin' WHEN 'manager' THEN 'admin'
      ELSE 'staff' END::public.access_level;
    NEW.access_scope := CASE NEW.role::text
      WHEN 'manager' THEN 'assigned' WHEN 'committee_member' THEN 'assigned'
      WHEN 'employee' THEN 'self' ELSE 'agency' END;
    NEW.access_preset_id := (
      SELECT id FROM public.access_presets
      WHERE organization_id = NEW.organization_id
        AND seed_key = CASE NEW.role::text
          WHEN 'program_manager' THEN 'program_manager' WHEN 'manager' THEN 'home_manager'
          WHEN 'employee' THEN 'dsp' WHEN 'committee_member' THEN 'hrc_committee' END);
  ELSE
    IF NEW.access_level = 'owner' THEN
      NEW.access_scope := 'agency';
      NEW.access_preset_id := NULL;
    ELSE
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
    END IF;
    SELECT seed_key INTO v_seed FROM public.access_presets WHERE id = NEW.access_preset_id;
    NEW.role := CASE NEW.access_level
      WHEN 'owner' THEN 'admin'
      WHEN 'admin' THEN CASE WHEN NEW.access_scope = 'agency' THEN 'program_manager' ELSE 'manager' END
      ELSE CASE WHEN v_seed = 'hrc_committee' THEN 'committee_member' ELSE 'employee' END
    END::public.app_role;
  END IF;
  RETURN NEW;
END;
$function$;

UPDATE public.invitations
SET access_level = (CASE role::text
  WHEN 'admin' THEN 'owner' WHEN 'manager' THEN 'admin' WHEN 'program_manager' THEN 'admin'
  ELSE 'staff' END)::public.access_level
WHERE access_level IS NULL;

-- Legacy role-only invites (created before the app switched to access_level)
-- map the same way members did.
CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inv invitations%ROWTYPE;
  v_level public.access_level;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_inv FROM public.invitations WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'Invitation already used'; END IF;
  IF v_inv.expires_at < now() THEN RAISE EXCEPTION 'Invitation expired'; END IF;
  IF lower(v_inv.email) <> lower(COALESCE(auth.jwt() ->> 'email', '')) THEN
    RAISE EXCEPTION 'Invitation email does not match your account';
  END IF;

  v_level := COALESCE(v_inv.access_level,
    CASE v_inv.role::text WHEN 'admin' THEN 'owner' WHEN 'manager' THEN 'admin'
      WHEN 'program_manager' THEN 'admin' ELSE 'staff' END::public.access_level);

  INSERT INTO public.organization_members (organization_id, user_id, access_level, access_preset_id, active)
  VALUES (v_inv.organization_id, auth.uid(), v_level, v_inv.access_preset_id, true)
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
