-- EXEC-PHI batch 3b: apply_med_change_proposal(uuid) and reject_med_change_proposal(uuid,text) write client_medications (PHI).
-- Their guard allowed any Hive exec, in any org. The guard is now access_is_owner(p.organization_id, auth.uid()) only.
-- Applied with pg_get_functiondef + regexp_replace, so the body, signature, SECURITY DEFINER, search_path and ACL are otherwise byte-identical.
-- PRIOR guard in both functions (RESTORE by putting the OR line back):
--   IF NOT (public.access_is_owner(p.organization_id, auth.uid())
--           OR public.is_hive_executive(auth.uid())) THEN
DO $$
DECLARE f regprocedure; d text; nd text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.apply_med_change_proposal(uuid)'::regprocedure, 'public.reject_med_change_proposal(uuid,text)'::regprocedure] LOOP
    d := pg_get_functiondef(f);
    nd := regexp_replace(d, '\s*OR public\.is_hive_executive\(auth\.uid\(\)\)', '', 'g');
    IF nd = d THEN RAISE EXCEPTION 'exec branch not found in %', f; END IF;
    EXECUTE nd;
  END LOOP;
END $$;
