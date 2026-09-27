-- DB-7 (Lane A). Applied live on Hive-Platform as version 20260927032731.
-- notify_medication_error is SECURITY DEFINER and executable by authenticated; any user could post critical
-- medication-error notifications into any org. Cannot revoke: staff call it via rpc() with the user client in
-- src/lib/emar-pass.functions.ts (logMedicationPass, org resolved from the client row).
-- Fix: org-membership guard as first statement. auth.uid() IS NULL (service role / cron) still passes.
-- Signature, return type, SECURITY DEFINER, search_path, and ACL unchanged.
--
-- PRIOR DEFINITION (restore by running this):
-- CREATE OR REPLACE FUNCTION public.notify_medication_error(p_organization_id uuid, p_emar_log_id uuid, p_client_name text, p_med_name text, p_reporter_name text, p_description text)
--  RETURNS void
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO 'public'
-- AS $function$
-- BEGIN
--   INSERT INTO public.notifications (
--     organization_id, recipient_role, type, urgency,
--     title, body, link_to, related_id, related_type
--   ) VALUES (
--     p_organization_id, 'admin', 'daily_log_exception', 'critical',
--     'Medication Error Reported — Immediate Review Required',
--     'Client: ' || p_client_name ||
--     ' | Medication: ' || p_med_name ||
--     ' | Reported by: ' || p_reporter_name ||
--     ' | ' || p_description,
--     '/dashboard/command-center',
--     p_emar_log_id,
--     'emar_log'
--   );
-- END;
-- $function$;

CREATE OR REPLACE FUNCTION public.notify_medication_error(p_organization_id uuid, p_emar_log_id uuid, p_client_name text, p_med_name text, p_reporter_name text, p_description text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(p_organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.notifications (
    organization_id, recipient_role, type, urgency,
    title, body, link_to, related_id, related_type
  ) VALUES (
    p_organization_id, 'admin', 'daily_log_exception', 'critical',
    'Medication Error Reported — Immediate Review Required',
    'Client: ' || p_client_name ||
    ' | Medication: ' || p_med_name ||
    ' | Reported by: ' || p_reporter_name ||
    ' | ' || p_description,
    '/dashboard/command-center',
    p_emar_log_id,
    'emar_log'
  );
END;
$function$;
