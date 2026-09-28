-- public.org_member_last_sign_ins(_org uuid)
--
-- Backs the Team Members roster "Last Login" column. This function was applied
-- to the live project on 2026-09-11 (supabase_migrations version 20260911070716,
-- name org_member_last_sign_ins) but the file was never committed, so it existed
-- only in the live database. Copied verbatim from live
-- pg_get_functiondef('public.org_member_last_sign_ins(uuid)'::regprocedure).
-- No behavior change.

CREATE OR REPLACE FUNCTION public.org_member_last_sign_ins(_org uuid)
 RETURNS TABLE(user_id uuid, last_sign_in_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_org_admin_or_manager(_org, auth.uid()) THEN
    RAISE EXCEPTION 'Admin or manager access required.';
  END IF;

  RETURN QUERY
  SELECT m.user_id, u.last_sign_in_at
  FROM public.organization_members m
  JOIN auth.users u ON u.id = m.user_id
  WHERE m.organization_id = _org;
END;
$function$
;
