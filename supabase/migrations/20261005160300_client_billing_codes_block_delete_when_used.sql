-- A 1056 authorization that has shifts or EVV timesheets recorded against it
-- is billing evidence. It can be ended (service_end_date) but not deleted.
-- Authorizations added by mistake, with nothing recorded yet, can still be
-- removed.

CREATE OR REPLACE FUNCTION public.prevent_used_billing_code_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.evv_timesheets t
    WHERE t.client_id = OLD.client_id
      AND upper(t.service_type_code) = upper(OLD.service_code)
  ) OR EXISTS (
    SELECT 1 FROM public.scheduled_shifts s
    WHERE s.client_id = OLD.client_id
      AND upper(s.service_code) = upper(OLD.service_code)
  ) THEN
    RAISE EXCEPTION '% has shifts or timesheets recorded against it. Set an end date instead of removing it.', OLD.service_code
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_used_billing_code_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cbc_prevent_used_delete ON public.client_billing_codes;
CREATE TRIGGER trg_cbc_prevent_used_delete
  BEFORE DELETE ON public.client_billing_codes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_used_billing_code_delete();
