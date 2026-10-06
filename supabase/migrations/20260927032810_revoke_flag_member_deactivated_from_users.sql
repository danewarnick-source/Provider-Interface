-- DB-8 (Lane A). Applied live on Hive-Platform as version 20260927032810.
-- flag_member_deactivated(uuid,uuid,uuid) is SECURITY DEFINER; any signed-in user could write "deactivated"
-- entries into any org's access_change_log. Only caller: src/lib/lifecycle.functions.ts archiveEntity via
-- supabaseAdmin.rpc (service_role), after assertCallerAndTargetInOrg + assertManager. No DB/cron/policy refs.
-- Prior ACL: {postgres, authenticated, service_role}.
REVOKE EXECUTE ON FUNCTION public.flag_member_deactivated(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.flag_member_deactivated(uuid, uuid, uuid) TO service_role;
