-- Clients rebuild P3: service codes have one source, client_billing_codes.
-- Its RLS lets only admins read it (rates live there), while staff screens
-- (caseload, punch pad, today view) used the copied clients.job_code column.
-- This function returns just the codes (no rates) of the client authorization
-- rows the caller may already see — the same rule as reading the clients row
-- (can_access_client_phi). The day filter is loose (yesterday or later);
-- callers apply the exact local-day check (src/lib/clients/codes.ts).

CREATE OR REPLACE FUNCTION public.client_active_codes(_client_ids uuid[])
RETURNS TABLE (client_id uuid, service_code text, service_end_date date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT b.client_id, upper(btrim(b.service_code)), b.service_end_date
  FROM public.client_billing_codes b
  WHERE b.client_id = ANY(_client_ids)
    AND (b.service_end_date IS NULL OR b.service_end_date >= current_date - 1)
    AND nullif(btrim(b.service_code), '') IS NOT NULL
    AND public.can_access_client_phi(b.client_id);
$function$;

REVOKE EXECUTE ON FUNCTION public.client_active_codes(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_active_codes(uuid[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.client_active_codes(uuid[]) IS
  'Active service codes (no rates) for clients the caller can see. One source: client_billing_codes.';
