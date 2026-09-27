-- DB-20 (Lane A). Applied live as version 20260927034012.
-- Fixes: any signed-in user could alter any agency's Nectar draft job counters (SECURITY DEFINER, no org check).
-- Guard: when auth.uid() is set, caller must be an ACTIVE owner/admin (any scope) member of the job's org.
--   Deliberately owner/admin-any-scope (not is_org_admin_or_manager, which requires agency scope for admin) to
--   mirror the live user-client caller: authoritative-sources.functions.ts processDraftChunk ->
--   loadDraftJobDoc -> requireOrgMembership(..., "admin") (isLevelAtLeast admin, scope not checked).
--   Service-role caller (nectar-draft-tick.server.ts via supabaseAdmin; auth.uid() NULL) unaffected.
-- Signatures, return types, language, SECURITY DEFINER, search_path, ACL unchanged
--   (ACL {postgres, authenticated, service_role} on all three).
--
-- PRIOR DEFINITIONS:
-- CREATE OR REPLACE FUNCTION public.nectar_bump_chunk_attempt(p_job uuid, p_index integer)
--  RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
-- AS $function$
-- DECLARE
--   v_key   text := p_index::text;
--   v_prior integer;
--   v_next  integer;
-- BEGIN
--   SELECT COALESCE((chunk_attempts ->> v_key)::int, 0) INTO v_prior
--     FROM public.nectar_draft_jobs
--    WHERE id = p_job
--    FOR UPDATE;
--   v_next := COALESCE(v_prior, 0) + 1;
--   UPDATE public.nectar_draft_jobs
--      SET chunk_attempts = COALESCE(chunk_attempts, '{}'::jsonb)
--                           || jsonb_build_object(v_key, v_next)
--    WHERE id = p_job;
--   RETURN v_next;
-- END;
-- $function$;
--
-- CREATE OR REPLACE FUNCTION public.nectar_bump_draft_attempt(p_job uuid)
--  RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
-- AS $function$
--   update public.nectar_draft_jobs
--     set attempts_started = attempts_started + 1,
--         last_attempt_at = now()
--     where id = p_job;
-- $function$;
--
-- CREATE OR REPLACE FUNCTION public.nectar_bump_draft_transient(p_job uuid, p_msg text)
--  RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
-- AS $function$
--   update public.nectar_draft_jobs
--     set transient_errors = transient_errors + 1,
--         last_transient_at = now(),
--         last_transient_message = left(coalesce(p_msg, ''), 300)
--     where id = p_job;
-- $function$;

CREATE OR REPLACE FUNCTION public.nectar_bump_chunk_attempt(p_job uuid, p_index integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key   text := p_index::text;
  v_prior integer;
  v_next  integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.nectar_draft_jobs j
    JOIN public.organization_members m ON m.organization_id = j.organization_id
    WHERE j.id = p_job AND m.user_id = auth.uid() AND m.active
      AND m.access_level IN ('owner','admin')) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE((chunk_attempts ->> v_key)::int, 0) INTO v_prior
    FROM public.nectar_draft_jobs
   WHERE id = p_job
   FOR UPDATE;
  v_next := COALESCE(v_prior, 0) + 1;
  UPDATE public.nectar_draft_jobs
     SET chunk_attempts = COALESCE(chunk_attempts, '{}'::jsonb)
                          || jsonb_build_object(v_key, v_next)
   WHERE id = p_job;
  RETURN v_next;
END;
$function$;

CREATE OR REPLACE FUNCTION public.nectar_bump_draft_attempt(p_job uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.nectar_draft_jobs j
    set attempts_started = attempts_started + 1,
        last_attempt_at = now()
    where j.id = p_job
      and (auth.uid() is null or exists (
        select 1 from public.organization_members m
        where m.organization_id = j.organization_id and m.user_id = auth.uid() and m.active
          and m.access_level in ('owner','admin')));
$function$;

CREATE OR REPLACE FUNCTION public.nectar_bump_draft_transient(p_job uuid, p_msg text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.nectar_draft_jobs j
    set transient_errors = transient_errors + 1,
        last_transient_at = now(),
        last_transient_message = left(coalesce(p_msg, ''), 300)
    where j.id = p_job
      and (auth.uid() is null or exists (
        select 1 from public.organization_members m
        where m.organization_id = j.organization_id and m.user_id = auth.uid() and m.active
          and m.access_level in ('owner','admin')));
$function$;
