-- DB-9 (Lane A). Applied live on Hive-Platform as version 20260927032855.
-- purge_aged_referrals is SECURITY DEFINER and executable by authenticated; any user could hard-delete aged
-- referrals for any org id. Cannot revoke: src/lib/retention.functions.ts purgeAgedReferrals calls it via
-- rpc() with the user client (after requirePermission 'manage_referrals').
-- Guard mirrors the referrals table RLS (is_org_admin_or_manager OR is_hive_executive), so no one who can
-- manage referrals through RLS loses access; auth.uid() IS NULL (service role / cron) passes.
-- Signature, return type, SECURITY DEFINER, search_path, ACL unchanged.
-- NOTE (pre-existing, not changed): public.referral_purge_tombstones does not exist, so the purge body errors
-- (42P01) whenever a purgeable row exists. Live referrals count = 0 in all orgs.
--
-- PRIOR DEFINITION (restore by running this):
-- CREATE OR REPLACE FUNCTION public.purge_aged_referrals(_organization_id uuid)
--  RETURNS integer
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO 'public'
-- AS $function$
-- DECLARE
--   _count int := 0;
--   _r record;
-- BEGIN
--   FOR _r IN
--     SELECT id, first_name, archived_at, archive_reason, decision_outcome
--       FROM public.referrals
--      WHERE organization_id = _organization_id
--        AND archived_at IS NOT NULL
--        AND purge_after IS NOT NULL
--        AND now() > purge_after
--   LOOP
--     -- Write tombstone activity (immutable trail) BEFORE deleting referral
--     -- We log a synthetic referral_id-less row by inserting on a tombstone-table approach…
--     -- Simpler: nullify FK in activities and keep them via supersedes; the activities ON DELETE CASCADE
--     -- removes them — so write a final note in a dedicated tombstone table.
--     INSERT INTO public.referral_purge_tombstones
--       (organization_id, referral_id, archived_at, archive_reason, decision_outcome, purged_at)
--     VALUES (_organization_id, _r.id, _r.archived_at, _r.archive_reason, _r.decision_outcome, now());
--
--     DELETE FROM public.referrals WHERE id = _r.id;
--     _count := _count + 1;
--   END LOOP;
--   RETURN _count;
-- END;
-- $function$;

CREATE OR REPLACE FUNCTION public.purge_aged_referrals(_organization_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _count int := 0;
  _r record;
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT (public.is_org_admin_or_manager(_organization_id, auth.uid()) OR public.is_hive_executive(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  FOR _r IN
    SELECT id, first_name, archived_at, archive_reason, decision_outcome
      FROM public.referrals
     WHERE organization_id = _organization_id
       AND archived_at IS NOT NULL
       AND purge_after IS NOT NULL
       AND now() > purge_after
  LOOP
    -- Write tombstone activity (immutable trail) BEFORE deleting referral
    -- We log a synthetic referral_id-less row by inserting on a tombstone-table approach…
    -- Simpler: nullify FK in activities and keep them via supersedes; the activities ON DELETE CASCADE
    -- removes them — so write a final note in a dedicated tombstone table.
    INSERT INTO public.referral_purge_tombstones
      (organization_id, referral_id, archived_at, archive_reason, decision_outcome, purged_at)
    VALUES (_organization_id, _r.id, _r.archived_at, _r.archive_reason, _r.decision_outcome, now());

    DELETE FROM public.referrals WHERE id = _r.id;
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END;
$function$;
