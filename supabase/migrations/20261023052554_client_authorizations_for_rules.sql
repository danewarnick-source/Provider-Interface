-- B1: clock-in and open-shift claims run the scheduler rules as the team
-- member, who can't read client_billing_codes. Returns only what the rules read,
-- for clients the caller may see (can_access_client_phi, as client_active_codes).
CREATE FUNCTION public.client_authorizations_for_rules(_client_ids uuid[])
RETURNS TABLE(
  client_id uuid, service_code text, service_start_date date, service_end_date date,
  authorization_approved_on date, worksheet_weekly_hours numeric, ratio text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.client_id, upper(btrim(b.service_code)), b.service_start_date, b.service_end_date,
         b.authorization_approved_on, b.worksheet_weekly_hours, b.ratio
  FROM public.client_billing_codes b
  WHERE b.client_id = ANY(_client_ids)
    AND nullif(btrim(b.service_code), '') IS NOT NULL
    AND public.can_access_client_phi(b.client_id);
$$;
REVOKE ALL ON FUNCTION public.client_authorizations_for_rules(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_authorizations_for_rules(uuid[]) TO authenticated;
