-- Security fix 1 (Dane go 2026-09-26 9:12 PM MT). Applied live on Hive-Platform as version 20260927031338.
-- purge_phi_access_audit_log is SECURITY DEFINER and deletes PHI access audit rows older than `retention`.
-- Any signed-in user could call it with retention => '0 seconds' and wipe the audit log.
-- No app code or pg_cron job calls it; keep it for service_role / postgres only.
REVOKE EXECUTE ON FUNCTION public.purge_phi_access_audit_log(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_phi_access_audit_log(interval) TO service_role;
