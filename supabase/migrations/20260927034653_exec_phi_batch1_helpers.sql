-- EXEC-PHI batch 1 (owner decision, 9:34 PM MT): take the is_super_admin / is_hive_executive branches out of the PHI helper functions.
-- is_super_admin(u) = is_hive_executive(u), so both branches handed every Hive exec every client's PHI across all orgs.
-- Signature, return type, SECURITY DEFINER, search_path and ACL are all unchanged (CREATE OR REPLACE keeps the ACL).
-- Precheck: owners 0a6df668 and d672c985 each pass access_can_see_client for 4 of 4 True North clients through agency-scope ownership.
-- Exec 1a45bc15 (True North staff, no caseload) now gets 0 of 4, which is the intended result.
-- ===== PRIOR DEFINITIONS (RESTORE) =====
-- CREATE OR REPLACE FUNCTION public.can_access_client_phi(_client_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
--   SELECT public.is_super_admin(auth.uid()) OR public.is_hive_executive(auth.uid()) OR public.access_can_see_client(_client_id, auth.uid())
--     OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = _client_id AND public.is_org_member(c.organization_id, auth.uid()) AND public.staff_assigned_to_client(c.id, auth.uid()));
-- $function$;
-- CREATE OR REPLACE FUNCTION public.can_view_client_intake(_org uuid, _client uuid, _viewer uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
--   SELECT public.access_is_owner(_org, _viewer) OR public.is_hive_executive(_viewer) OR public.access_can_see_client(_client, _viewer)
--     OR EXISTS (SELECT 1 FROM public.staff_assignments sa WHERE sa.organization_id = _org AND sa.client_id = _client AND sa.staff_id = _viewer);
-- $function$;
-- clients_for_staff(_org uuid, _staff uuid): the prior body had
--   "AND NOT public.is_super_admin(auth.uid())" in BOTH guard IFs (the caseload check and the member check). The rest of the body is identical to the version below.
-- ===== APPLIED =====
CREATE OR REPLACE FUNCTION public.can_access_client_phi(_client_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT public.access_can_see_client(_client_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = _client_id AND public.is_org_member(c.organization_id, auth.uid()) AND public.staff_assigned_to_client(c.id, auth.uid()));
$function$;
CREATE OR REPLACE FUNCTION public.can_view_client_intake(_org uuid, _client uuid, _viewer uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT public.access_is_owner(_org, _viewer) OR public.access_can_see_client(_client, _viewer)
    OR EXISTS (SELECT 1 FROM public.staff_assignments sa WHERE sa.organization_id = _org AND sa.client_id = _client AND sa.staff_id = _viewer);
$function$;
-- clients_for_staff: same body as before, with only the two "AND NOT public.is_super_admin(auth.uid())" clauses removed:
--   IF auth.uid() IS DISTINCT FROM _staff AND NOT public.is_org_admin_or_manager(_org, auth.uid()) THEN RAISE EXCEPTION 'forbidden: cannot resolve another staff caseload'; END IF;
--   IF NOT public.is_org_member(_org, auth.uid()) THEN RAISE EXCEPTION 'forbidden: not an org member'; END IF;

-- (file corrected 10:05 PM MT: the applied clients_for_staff definition, verbatim from schema_migrations)
CREATE OR REPLACE FUNCTION public.clients_for_staff(_org uuid, _staff uuid)
 RETURNS SETOF clients
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF auth.uid() IS DISTINCT FROM _staff
     AND NOT public.is_org_admin_or_manager(_org, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: cannot resolve another staff caseload';
  END IF;
  IF NOT public.is_org_member(_org, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: not an org member';
  END IF;

  RETURN QUERY
  WITH direct AS (
    SELECT c.*
      FROM public.clients c
      JOIN public.staff_assignments sa
        ON sa.client_id = c.id
       AND sa.organization_id = c.organization_id
     WHERE sa.organization_id = _org
       AND sa.staff_id = _staff
  ),
  group_home_addrs AS (
    SELECT DISTINCT c.physical_address
      FROM public.clients c
      JOIN public.staff_assignments sa
        ON sa.client_id = c.id
       AND sa.organization_id = c.organization_id
     WHERE sa.organization_id = _org
       AND sa.staff_id = _staff
       AND sa.is_group_home_assignment = true
       AND c.physical_address IS NOT NULL
       AND length(btrim(c.physical_address)) > 0
  ),
  facility_mates AS (
    SELECT c.*
      FROM public.clients c
     WHERE c.organization_id = _org
       AND c.physical_address IN (SELECT physical_address FROM group_home_addrs)
  )
  SELECT * FROM direct
  UNION
  SELECT * FROM facility_mates;
END;
$function$;
