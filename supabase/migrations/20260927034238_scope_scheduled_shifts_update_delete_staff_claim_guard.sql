-- DB-21 (Lane A). Applied live as version 20260927034238. Owner decision D8: Dane 9:34 PM MT Sep 26 2026
-- ("staff may only claim or call out their OWN shifts; edit and delete are admin/manager only").
-- Fixes: any org member could edit/reassign/delete any shift in the agency.
-- Staff write paths found (all plain UPDATE with the user client, no server role checks; RLS is the only guard):
--   respondToShift (workflow.functions.ts): own shift -> status accepted/declined, notes
--   claimOpenShift (open-shifts.functions.ts): unassigned 'open' shift -> claim_requested_by = self
--   takeOpenShift (scheduler/setup.functions.ts): unassigned open/pending shift -> staff_id = self, status accepted,
--     claim_requested_by null, published true
--   Call-out does NOT touch scheduled_shifts (inserts shift_callouts + callout_escalation_events).
-- Admin paths (scheduler, schedule-preview, publish, decideClaim, decideSwap, auto-assign, templates) keep full
--   access via is_org_admin_or_manager. Live members today: owners + staff only (no admin-level rows).
-- Column scoping for staff is done by BEFORE UPDATE trigger scheduled_shifts_staff_update_guard: non-admins may only
--   change status, notes, staff_id (NULL -> self only), claim_requested_by (-> self, or cleared by claimant/taker),
--   published (only when taking an open shift). INSERT policy left unchanged (not in decision).
--
-- PRIOR POLICIES (restore):
--   ALTER POLICY "Org members can update shifts" ON public.scheduled_shifts
--     USING (is_org_member(organization_id, auth.uid())) WITH CHECK (is_org_member(organization_id, auth.uid()));
--   ALTER POLICY "Org members can delete shifts" ON public.scheduled_shifts
--     USING (is_org_member(organization_id, auth.uid()));
--   DROP TRIGGER scheduled_shifts_staff_update_guard ON public.scheduled_shifts;
--   DROP FUNCTION public.scheduled_shifts_staff_update_guard();

ALTER POLICY "Org members can update shifts" ON public.scheduled_shifts
  USING (public.is_org_admin_or_manager(organization_id, auth.uid())
         OR (public.is_org_member(organization_id, auth.uid())
             AND (staff_id = auth.uid() OR (staff_id IS NULL AND status IN ('open','pending')))))
  WITH CHECK (public.is_org_admin_or_manager(organization_id, auth.uid())
         OR (public.is_org_member(organization_id, auth.uid())
             AND (staff_id = auth.uid() OR (staff_id IS NULL AND claim_requested_by = auth.uid()))));

ALTER POLICY "Org members can delete shifts" ON public.scheduled_shifts
  USING (public.is_org_admin_or_manager(organization_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.scheduled_shifts_staff_update_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_allowed text[] := ARRAY['status','notes','staff_id','claim_requested_by','published','updated_at'];
BEGIN
  IF v_uid IS NULL OR public.is_org_admin_or_manager(OLD.organization_id, v_uid) THEN
    RETURN NEW;
  END IF;
  -- Non-admin: only claim / respond columns may change.
  IF (to_jsonb(NEW) - v_allowed) IS DISTINCT FROM (to_jsonb(OLD) - v_allowed) THEN
    RAISE EXCEPTION 'Only admins/managers can edit shift details' USING ERRCODE = '42501';
  END IF;
  -- staff_id may only go from unassigned to the caller (take open shift).
  IF NEW.staff_id IS DISTINCT FROM OLD.staff_id
     AND NOT (OLD.staff_id IS NULL AND NEW.staff_id = v_uid) THEN
    RAISE EXCEPTION 'Staff may only claim a shift for themselves' USING ERRCODE = '42501';
  END IF;
  -- claim_requested_by may only be set to the caller, or cleared by the claimant / by the taker.
  IF NEW.claim_requested_by IS DISTINCT FROM OLD.claim_requested_by
     AND NOT (NEW.claim_requested_by = v_uid
              OR (NEW.claim_requested_by IS NULL
                  AND (OLD.claim_requested_by = v_uid OR (OLD.staff_id IS NULL AND NEW.staff_id = v_uid)))) THEN
    RAISE EXCEPTION 'Staff may only request a claim for themselves' USING ERRCODE = '42501';
  END IF;
  -- published may only flip as part of taking an open shift.
  IF NEW.published IS DISTINCT FROM OLD.published
     AND NOT (OLD.staff_id IS NULL AND NEW.staff_id = v_uid) THEN
    RAISE EXCEPTION 'Only admins/managers can publish shifts' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.scheduled_shifts_staff_update_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER scheduled_shifts_staff_update_guard
  BEFORE UPDATE ON public.scheduled_shifts
  FOR EACH ROW EXECUTE FUNCTION public.scheduled_shifts_staff_update_guard();
