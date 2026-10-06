-- DB-10 (Lane A). Applied live on Hive-Platform as version 20260927032927.
-- archive_eligible_referrals is SECURITY DEFINER and executable by authenticated; any user could mass-archive
-- another org's referrals. Cannot revoke: src/lib/retention.functions.ts sweepArchiveEligible calls it via rpc()
-- with the user client. Guard mirrors referrals RLS (is_org_admin_or_manager OR is_hive_executive);
-- auth.uid() IS NULL (service role / cron) passes. Signature, return type, SECURITY DEFINER, search_path, ACL unchanged.
--
-- PRIOR DEFINITION (restore by running this):
-- CREATE OR REPLACE FUNCTION public.archive_eligible_referrals(_organization_id uuid)
--  RETURNS integer
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO 'public'
-- AS $function$
-- DECLARE
--   _settings record;
--   _count int := 0;
-- BEGIN
--   SELECT * INTO _settings FROM public.org_referral_retention_settings
--     WHERE organization_id = _organization_id;
--   IF NOT FOUND OR NOT _settings.auto_archive_enabled THEN
--     RETURN 0;
--   END IF;
--
--   WITH eligible AS (
--     SELECT id FROM public.referrals
--      WHERE organization_id = _organization_id
--        AND archived_at IS NULL
--        AND status <> 'archived'
--        AND COALESCE(decision_outcome, '') <> 'placed'
--        AND due_date IS NOT NULL
--        AND now() > (due_date + (_settings.archive_days_after_due || ' days')::interval)
--   ), updated AS (
--     UPDATE public.referrals r
--        SET archived_at = now(),
--            archived_by = NULL,
--            archive_reason = 'auto: past due window',
--            purge_after = now() + (_settings.purge_grace_days || ' days')::interval,
--            status = 'archived'
--       FROM eligible e
--      WHERE r.id = e.id
--      RETURNING r.id, r.organization_id
--   ), logged AS (
--     INSERT INTO public.referral_activities
--       (organization_id, referral_id, activity_type, occurred_at, body, created_by)
--     SELECT organization_id, id, 'archive', now(), 'Auto-archived (past due + retention window)', NULL
--       FROM updated
--     RETURNING 1
--   )
--   SELECT count(*) INTO _count FROM logged;
--
--   RETURN _count;
-- END;
-- $function$;

CREATE OR REPLACE FUNCTION public.archive_eligible_referrals(_organization_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _settings record;
  _count int := 0;
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT (public.is_org_admin_or_manager(_organization_id, auth.uid()) OR public.is_hive_executive(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _settings FROM public.org_referral_retention_settings
    WHERE organization_id = _organization_id;
  IF NOT FOUND OR NOT _settings.auto_archive_enabled THEN
    RETURN 0;
  END IF;

  WITH eligible AS (
    SELECT id FROM public.referrals
     WHERE organization_id = _organization_id
       AND archived_at IS NULL
       AND status <> 'archived'
       AND COALESCE(decision_outcome, '') <> 'placed'
       AND due_date IS NOT NULL
       AND now() > (due_date + (_settings.archive_days_after_due || ' days')::interval)
  ), updated AS (
    UPDATE public.referrals r
       SET archived_at = now(),
           archived_by = NULL,
           archive_reason = 'auto: past due window',
           purge_after = now() + (_settings.purge_grace_days || ' days')::interval,
           status = 'archived'
      FROM eligible e
     WHERE r.id = e.id
     RETURNING r.id, r.organization_id
  ), logged AS (
    INSERT INTO public.referral_activities
      (organization_id, referral_id, activity_type, occurred_at, body, created_by)
    SELECT organization_id, id, 'archive', now(), 'Auto-archived (past due + retention window)', NULL
      FROM updated
    RETURNING 1
  )
  SELECT count(*) INTO _count FROM logged;

  RETURN _count;
END;
$function$;
