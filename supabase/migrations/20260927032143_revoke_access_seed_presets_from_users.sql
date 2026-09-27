-- DB-2 (Lane A). Applied live on Hive-Platform as version 20260927032143.
-- access_seed_presets(uuid) is SECURITY DEFINER; anon (via PUBLIC) and authenticated could seed/reset
-- access presets for any org id. Only caller is trigger access_trg_seed_presets (SECURITY DEFINER, owner postgres)
-- on public.organizations, which is unaffected. No app/edge caller (only a code comment in signup-workspace.functions.ts).
REVOKE EXECUTE ON FUNCTION public.access_seed_presets(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.access_seed_presets(uuid) TO service_role;
