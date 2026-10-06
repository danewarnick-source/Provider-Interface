-- Lane B item 3 = DB-19 (Dane-approved via Tony 2026-09-27): Nectar rate/token buckets no longer callable by end users.
-- Problem: both SECURITY DEFINER functions take a caller-supplied key, so any signed-in user could reset or burn
--   another user's rate and token buckets.
-- Precheck: signatures nectar_check_rate(text,integer,bigint) and nectar_record_tokens(text,bigint), SECURITY DEFINER,
--   search_path=public. Prior ACL for both: {postgres=X, authenticated=X, service_role=X} (service_role explicit, so no re-grant needed).
--   Only caller: src/lib/nectar-rate-limit.server.ts via supabaseAdmin (service role). No edge-function callers.
-- Retest (rolled back): sec2 -> 42501 on both; service_role -> ok on both. ACL now {postgres=X, service_role=X}.
-- ROLLBACK:
-- GRANT EXECUTE ON FUNCTION public.nectar_check_rate(text, integer, bigint) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.nectar_record_tokens(text, bigint) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.nectar_check_rate(text, integer, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.nectar_record_tokens(text, bigint) FROM PUBLIC, anon, authenticated;
