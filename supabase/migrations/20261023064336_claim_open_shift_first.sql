-- B2: "First to claim" (Settings › Open shifts). Where a home's pickups are
-- automatic, a claim assigns the open shift at once. Only the server calls
-- this (service role) after claimOpenShift has picked the pickup mode
-- (src/lib/scheduler/settings/pickup.ts) and run the rule engine for the
-- claimer; staff can't assign shifts under RLS. Returns true when it assigned
-- the shift, false when it was already taken.
CREATE FUNCTION public.claim_open_shift_first(_shift uuid, _staff uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.scheduled_shifts s SET staff_id = _staff, status = 'accepted', claim_requested_by = NULL
   WHERE s.id = _shift AND s.staff_id IS NULL AND s.status = 'open' AND s.claim_requested_by IS NULL
     AND public.is_org_member(s.organization_id, _staff);
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.claim_open_shift_first(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_open_shift_first(uuid, uuid) TO service_role;
