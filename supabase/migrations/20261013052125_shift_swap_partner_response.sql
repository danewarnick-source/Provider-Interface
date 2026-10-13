-- Scheduler S1: let the named coworker accept or decline a swap.
-- The scheduler still approves. Responses go through a SECURITY DEFINER function so the
-- coworker can only touch the partner fields (RLS cannot limit columns).

ALTER TABLE public.shift_swap_requests
  ADD COLUMN IF NOT EXISTS partner_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS partner_responded_at timestamptz;

ALTER TABLE public.shift_swap_requests
  ADD CONSTRAINT shift_swap_requests_partner_status_check
  CHECK (partner_status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text]));

-- Coworkers can see open (unaddressed) pending swaps in their org.
CREATE POLICY "staff read open swaps" ON public.shift_swap_requests
  FOR SELECT TO authenticated
  USING (
    to_staff_id IS NULL AND status = 'pending' AND from_staff_id <> auth.uid()
    AND public.is_org_member(organization_id, auth.uid())
  );

CREATE OR REPLACE FUNCTION public.respond_to_swap_request(_request uuid, _accept boolean)
RETURNS TABLE (id uuid, organization_id uuid, shift_id uuid, from_staff_id uuid, partner_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r public.shift_swap_requests%ROWTYPE;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO r FROM public.shift_swap_requests s WHERE s.id = _request FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Swap request not found'; END IF;
  IF NOT public.is_org_member(r.organization_id, uid) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'This swap is no longer open'; END IF;
  IF r.from_staff_id = uid THEN RAISE EXCEPTION 'You cannot respond to your own swap'; END IF;
  IF r.to_staff_id IS NOT NULL AND r.to_staff_id <> uid THEN
    RAISE EXCEPTION 'This swap was offered to someone else';
  END IF;
  IF r.partner_status <> 'pending' THEN RAISE EXCEPTION 'This swap was already answered'; END IF;

  IF _accept THEN
    UPDATE public.shift_swap_requests s
       SET to_staff_id = uid, partner_status = 'accepted', partner_responded_at = now(), updated_at = now()
     WHERE s.id = _request;
  ELSIF r.to_staff_id IS NULL THEN
    RETURN QUERY SELECT r.id, r.organization_id, r.shift_id, r.from_staff_id, 'pending'::text;
    RETURN;
  ELSE
    UPDATE public.shift_swap_requests s
       SET partner_status = 'declined', partner_responded_at = now(),
           status = 'denied', decided_by = uid, decided_at = now(), updated_at = now()
     WHERE s.id = _request;
  END IF;

  RETURN QUERY
    SELECT s.id, s.organization_id, s.shift_id, s.from_staff_id, s.partner_status
      FROM public.shift_swap_requests s WHERE s.id = _request;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_to_swap_request(uuid, boolean) TO authenticated;
