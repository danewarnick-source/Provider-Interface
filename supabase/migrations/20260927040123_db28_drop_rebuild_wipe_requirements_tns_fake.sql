-- Item: DB-28 (Low). Leftover demo maintenance functions, executable by authenticated, that wipe nectar_requirements
--   and approval events for the True North org (disable an append-only trigger while doing so).
-- Precheck: repo search = only docs/audits/SCHEMA_AUDIT.md and the creating migration
--   (supabase/migrations/20260925100300_access_levels_a4_demo_wipe_owner_check.sql); no src/edge caller.
--   cron.job: 4 jobs, none reference it. No other function body references it. pg_depend: 0 dependents.
-- Retest: 0 rows in pg_proc for proname rebuild_wipe_requirements_tns_fake.
-- RESTORE (full prior definitions; ACL was {postgres=X, authenticated=X, service_role=X} for both):
/*
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
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT public.rebuild_wipe_requirements_tns_fake(false) $function$;

REVOKE ALL ON FUNCTION public.rebuild_wipe_requirements_tns_fake() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rebuild_wipe_requirements_tns_fake(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rebuild_wipe_requirements_tns_fake() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rebuild_wipe_requirements_tns_fake(boolean) TO authenticated, service_role;
*/

DROP FUNCTION public.rebuild_wipe_requirements_tns_fake();
DROP FUNCTION public.rebuild_wipe_requirements_tns_fake(boolean);
