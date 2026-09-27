-- DB-6 (Lane A). Applied live on Hive-Platform as version 20260927032534.
-- notify_incident_filed(...) is SECURITY DEFINER; any signed-in user could insert spoofed "incident filed"
-- notifications into any org. No caller in src/, supabase/functions, triggers, other functions, policies, or cron.
-- Prior ACL: {postgres, authenticated, service_role} (anon already had no EXECUTE).
REVOKE EXECUTE ON FUNCTION public.notify_incident_filed(uuid, uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_incident_filed(uuid, uuid, text, text, timestamptz) TO service_role;
