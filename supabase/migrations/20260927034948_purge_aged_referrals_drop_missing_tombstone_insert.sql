-- referral_purge_tombstones fix (owner decision 9:34 PM MT): purge_aged_referrals inserted into public.referral_purge_tombstones, which does not exist.
-- So every purge that found an aged referral failed with 42P01 and nothing was ever purged. Per Dane, do NOT create the table: drop the insert instead.
-- The DB-9 guard (org admin/manager, or exec, or auth.uid() NULL for cron/service) is kept unchanged.
-- Signature, return type, SECURITY DEFINER, search_path and ACL are unchanged.
-- Prior definition: migration 20260927032855 (DB-9). It is identical except for this block inside the LOOP, before the DELETE:
--   INSERT INTO public.referral_purge_tombstones (organization_id, referral_id, archived_at, archive_reason, decision_outcome, purged_at)
--   VALUES (_organization_id, _r.id, _r.archived_at, _r.archive_reason, _r.decision_outcome, now());
CREATE OR REPLACE FUNCTION public.purge_aged_referrals(_organization_id uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
    DELETE FROM public.referrals WHERE id = _r.id;
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END;
$function$;
