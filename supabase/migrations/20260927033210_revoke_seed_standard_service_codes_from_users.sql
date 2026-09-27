-- DB-13 (Lane A). Applied live on Hive-Platform as version 20260927033210.
-- seed_standard_service_codes(uuid) is SECURITY DEFINER; any signed-in user could seed service codes into any org.
-- Only caller: trigger function seed_service_codes_on_org_create() (SECURITY DEFINER, owner postgres) via
-- trg_seed_service_codes_on_org_create on public.organizations; unaffected. No src/edge/cron/policy callers.
-- Prior ACL: {postgres, authenticated, service_role} (anon already had no EXECUTE).
REVOKE EXECUTE ON FUNCTION public.seed_standard_service_codes(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_standard_service_codes(uuid) TO service_role;
