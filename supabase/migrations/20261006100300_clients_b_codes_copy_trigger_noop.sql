-- PHASE B — apply only right after the clients rebuild (P3) reaches production main.
-- NOT applied during the overnight run: production main still reads
-- clients.job_code / clients.authorized_dspd_codes (client list, caseload,
-- scheduler preview, HHS hub, punch-pad fallback), and this trigger is what keeps
-- them in step with client_billing_codes. Turning it off before main stops reading
-- those columns would show stale codes there.
--
-- After P3 every reader uses client_billing_codes (src/lib/clients/codes.ts), so the
-- copy is no longer needed. The function becomes a no-op; the columns stay intact
-- until Prompt 12 drops them.

CREATE OR REPLACE FUNCTION public.sync_client_authorized_codes_from_billing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Service codes have one source: client_billing_codes. Nothing to copy.
  RETURN NULL;
END;
$function$;
