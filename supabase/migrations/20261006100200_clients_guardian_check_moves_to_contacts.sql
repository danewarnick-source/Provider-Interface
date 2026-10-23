-- Clients rebuild P3: the guardian now lives in client_contacts (role 'guardian'),
-- so clients rows written by the new code no longer carry guardian_name /
-- guardian_phone. The old trigger raised when a non-self-guardian client had no
-- guardian columns, which would block every later update to such a client.
-- The requirement moves to the app (Add client and the contacts editor require a
-- guardian when the client is not their own guardian; readiness checks flag a
-- missing one). Self-guardian clients still get stale guardian columns cleared.
-- Loosening only: production main keeps working (its forms still send the columns).

CREATE OR REPLACE FUNCTION public.validate_client_guardian()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_own_guardian THEN
    NEW.guardian_name := NULL;
    NEW.guardian_phone := NULL;
    NEW.guardian_relationship := NULL;
    NEW.guardian_email := NULL;
    NEW.guardian_address := NULL;
  END IF;
  RETURN NEW;
END;
$function$;
