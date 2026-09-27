-- DB-11 (Lane A). Applied live on Hive-Platform as version 20260927033005.
-- find_possible_duplicate_referral (SQL, SECURITY DEFINER, executable by authenticated) returned referral
-- first names/ages for whatever org id the caller passed. Caller: src/lib/referrals.functions.ts
-- findPossibleDuplicateReferral via rpc() with the user client (after view_referrals/manage_referrals check).
-- Fix: predicate so only members of that org (or Hive execs, who already read referrals via RLS) get rows;
-- auth.uid() IS NULL (service role) unaffected. Signature, return type, STABLE, SECURITY DEFINER,
-- search_path, ACL unchanged.
--
-- PRIOR DEFINITION (restore by running this):
-- CREATE OR REPLACE FUNCTION public.find_possible_duplicate_referral(_organization_id uuid, _first_name text, _age integer, _support_coordinator_id uuid)
--  RETURNS TABLE(id uuid, first_name text, age integer, category text, support_coordinator_id uuid, created_at timestamp with time zone)
--  LANGUAGE sql
--  STABLE SECURITY DEFINER
--  SET search_path TO 'public'
-- AS $function$
--   SELECT r.id, r.first_name, r.age, r.category, r.support_coordinator_id, r.created_at
--   FROM public.referrals r
--   WHERE r.organization_id = _organization_id
--     AND lower(r.first_name) = lower(_first_name)
--     AND (
--       _age IS NULL OR r.age IS NULL OR r.age = _age
--     )
--     AND (
--       _support_coordinator_id IS NULL
--       OR r.support_coordinator_id IS NULL
--       OR r.support_coordinator_id = _support_coordinator_id
--     )
--     AND r.created_at >= now() - interval '90 days'
--     AND r.status <> 'archived'
--   ORDER BY r.created_at DESC
--   LIMIT 5;
-- $function$;

CREATE OR REPLACE FUNCTION public.find_possible_duplicate_referral(_organization_id uuid, _first_name text, _age integer, _support_coordinator_id uuid)
 RETURNS TABLE(id uuid, first_name text, age integer, category text, support_coordinator_id uuid, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT r.id, r.first_name, r.age, r.category, r.support_coordinator_id, r.created_at
  FROM public.referrals r
  WHERE r.organization_id = _organization_id
    AND (auth.uid() IS NULL
         OR public.is_org_member(_organization_id, auth.uid())
         OR public.is_hive_executive(auth.uid()))
    AND lower(r.first_name) = lower(_first_name)
    AND (
      _age IS NULL OR r.age IS NULL OR r.age = _age
    )
    AND (
      _support_coordinator_id IS NULL
      OR r.support_coordinator_id IS NULL
      OR r.support_coordinator_id = _support_coordinator_id
    )
    AND r.created_at >= now() - interval '90 days'
    AND r.status <> 'archived'
  ORDER BY r.created_at DESC
  LIMIT 5;
$function$;
