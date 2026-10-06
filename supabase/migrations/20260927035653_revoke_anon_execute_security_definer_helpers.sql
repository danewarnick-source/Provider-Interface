-- DB-24: 10 SECURITY DEFINER helpers were executable by anon through PUBLIC. anon could probe org/client/staff relationships (access_*),
-- and the trigger functions were flagged. authenticated keeps its explicit grant, so RLS and RPCs are unaffected.
-- verify_certificate(text) stays anon-executable (public certificate verification page).
-- Precheck: the only policies calling these helpers with role public are the "owners write" ALL policies on access_assignments and access_presets.
-- An anon request there now fails closed (42501) instead of returning 0 rows; no anon page uses those tables.
-- No invoker-rights function calls these helpers. Trigger functions don't check EXECUTE at fire time; the org_members insert trigger was verified.
-- PRIOR ACL on all 10: {=X/postgres,postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- RESTORE: GRANT EXECUTE ON FUNCTION <each> TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.access_can_see_client(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.access_can_see_staff(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.access_categories(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.access_has_category(uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.access_is_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.access_keep_one_owner() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.access_normalize_member() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.access_trg_seed_presets() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enforce_org_setup_before_create() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.protect_billing_exempt() FROM PUBLIC, anon;
