-- DB-25: user_org_ids(_user) (SECURITY DEFINER) returned the org ids of ANY user to any authenticated caller.
-- Precheck: no src caller (only docs and old migrations mention it). No policy, function or view uses it. postgres and service_role keep EXECUTE.
-- PRIOR ACL: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- RESTORE: GRANT EXECUTE ON FUNCTION public.user_org_ids(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.user_org_ids(uuid) FROM PUBLIC, anon, authenticated;
