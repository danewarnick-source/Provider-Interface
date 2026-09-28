-- public.org_member_last_sign_ins(_org uuid): also answer the service role.
--
-- The Team Members roster now loads through one server fn
-- (src/lib/team-members/roster.functions.ts -> listTeamRoster). That fn checks
-- the caller's access (staff_roster View + viewer scope) itself, then reads
-- with the service-role client, where auth.uid() is NULL — so the old
-- "is_org_admin_or_manager(_org, auth.uid())" gate always raised and scoped
-- Admins saw no Last login. Browser callers keep the exact same check.
--
-- Additive: strictly widens access to service_role only (which already
-- bypasses RLS and can read auth.users directly). Compatible with main.

CREATE OR REPLACE FUNCTION public.org_member_last_sign_ins(_org uuid)
 RETURNS TABLE(user_id uuid, last_sign_in_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_org_admin_or_manager(_org, auth.uid()) THEN
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
