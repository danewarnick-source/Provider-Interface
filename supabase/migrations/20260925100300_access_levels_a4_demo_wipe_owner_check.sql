-- Access levels Phase A4: last live function reading organization_members.role.
-- rebuild_wipe_requirements_tns_fake (both overloads) now authorizes via
-- access_is_owner (legacy admin/super_admin both map to Owner). Bodies otherwise unchanged.

CREATE OR REPLACE FUNCTION public.rebuild_wipe_requirements_tns_fake(p_keep_pending boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := '7fabcf5d-f826-487f-8730-8b0c3f1969bb';
  v_deleted integer;
BEGIN
  IF NOT public.access_is_owner(v_org, auth.uid())
     AND NOT public.is_hive_executive(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to rebuild demo requirements.';
  END IF;

  ALTER TABLE public.nectar_requirement_approval_events
    DISABLE TRIGGER trg_req_approval_events_no_update;

  BEGIN
    IF p_keep_pending THEN
      DELETE FROM public.nectar_requirement_approval_events e
       USING public.nectar_requirements r
       WHERE e.requirement_id = r.id
         AND r.organization_id = v_org
         AND COALESCE((r.metadata ->> 'rebuild_pending')::boolean, false) = false;

      DELETE FROM public.nectar_requirements
       WHERE organization_id = v_org
         AND COALESCE((metadata ->> 'rebuild_pending')::boolean, false) = false;
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
    ELSE
      DELETE FROM public.nectar_requirement_approval_events
       WHERE organization_id = v_org;

      DELETE FROM public.nectar_requirements
       WHERE organization_id = v_org;
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    ALTER TABLE public.nectar_requirement_approval_events
      ENABLE TRIGGER trg_req_approval_events_no_update;
    RAISE;
  END;

  ALTER TABLE public.nectar_requirement_approval_events
    ENABLE TRIGGER trg_req_approval_events_no_update;

  RETURN v_deleted;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rebuild_wipe_requirements_tns_fake()
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.rebuild_wipe_requirements_tns_fake(false) $$;
