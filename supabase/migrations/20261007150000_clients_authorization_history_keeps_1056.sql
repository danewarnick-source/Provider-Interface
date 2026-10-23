-- Renewing an ended authorization reuses its client_billing_codes row (one
-- row per client + code: UNIQUE (organization_id, client_id, service_code),
-- which the 1056 import upserts on). The history trigger kept the old rate
-- and dates but dropped the old 1056 number, approved date and units, so a
-- renewal lost them. Keep the whole earlier authorization in history.
-- Additive: new nullable columns, and the trigger function also copies them.

ALTER TABLE public.client_billing_code_rate_history
  ADD COLUMN IF NOT EXISTS authorization_number text,
  ADD COLUMN IF NOT EXISTS authorization_approved_on date,
  ADD COLUMN IF NOT EXISTS annual_unit_authorization integer,
  ADD COLUMN IF NOT EXISTS monthly_max_units integer;

CREATE OR REPLACE FUNCTION public.capture_client_billing_code_rate_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.rate_per_unit IS DISTINCT FROM NEW.rate_per_unit
     OR OLD.unit_type IS DISTINCT FROM NEW.unit_type
     OR OLD.service_start_date IS DISTINCT FROM NEW.service_start_date
     OR OLD.service_end_date IS DISTINCT FROM NEW.service_end_date
     OR OLD.authorization_number IS DISTINCT FROM NEW.authorization_number
     OR OLD.authorization_approved_on IS DISTINCT FROM NEW.authorization_approved_on
     OR OLD.annual_unit_authorization IS DISTINCT FROM NEW.annual_unit_authorization THEN
    INSERT INTO public.client_billing_code_rate_history (
      billing_code_id, organization_id, client_id, service_code, unit_type,
      rate_per_unit, effective_start, effective_end,
      rate_source, rate_source_plan_number, rate_source_document_id, rate_source_at,
      authorization_number, authorization_approved_on,
      annual_unit_authorization, monthly_max_units,
      superseded_at, superseded_by
    ) VALUES (
      OLD.id, OLD.organization_id, OLD.client_id, OLD.service_code, OLD.unit_type,
      OLD.rate_per_unit, OLD.service_start_date, OLD.service_end_date,
      OLD.rate_source, OLD.rate_source_plan_number, OLD.rate_source_document_id, OLD.rate_source_at,
      OLD.authorization_number, OLD.authorization_approved_on,
      OLD.annual_unit_authorization, OLD.monthly_max_units,
      now(), auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$function$;
