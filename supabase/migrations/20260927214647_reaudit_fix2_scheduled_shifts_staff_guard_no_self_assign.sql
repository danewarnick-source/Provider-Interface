-- Re-audit fix 2: team members may no longer take an open shift by UPDATEing scheduled_shifts.staff_id.
-- RLS WITH CHECK cannot see the OLD row, so the rule is enforced in the existing BEFORE UPDATE guard trigger.
-- Non-admins: staff_id and published may not change at all (removed the "NULL -> self" take branch, which also
-- let a claimant self-approve their own claim). claim_requested_by may be set to self only when no claim is pending
-- (no overwriting another member's claim), or cleared by the claimant. On unassigned shifts only the claim may change.
-- Admins/managers (is_org_admin_or_manager) and service-role/no-JWT callers are unchanged. Own-shift respond
-- (status/notes on a shift assigned to the caller) is unchanged.
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
  -- Assignment is admin/manager-only. Staff request open shifts via claim_requested_by and wait for approval.
  IF NEW.staff_id IS DISTINCT FROM OLD.staff_id THEN
    RAISE EXCEPTION 'Only admins/managers can assign shifts; submit a claim for approval instead' USING ERRCODE = '42501';
  END IF;
  IF NEW.published IS DISTINCT FROM OLD.published THEN
    RAISE EXCEPTION 'Only admins/managers can publish shifts' USING ERRCODE = '42501';
  END IF;
  -- claim_requested_by may only be set to the caller when no claim is pending, or cleared by the claimant.
  IF NEW.claim_requested_by IS DISTINCT FROM OLD.claim_requested_by
     AND NOT ((NEW.claim_requested_by = v_uid AND OLD.claim_requested_by IS NULL)
              OR (NEW.claim_requested_by IS NULL AND OLD.claim_requested_by = v_uid)) THEN
    RAISE EXCEPTION 'Staff may only request a claim for themselves on an unclaimed shift' USING ERRCODE = '42501';
  END IF;
  -- On an unassigned shift a non-admin may only change the claim.
  IF OLD.staff_id IS NULL
     AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.notes IS DISTINCT FROM OLD.notes) THEN
    RAISE EXCEPTION 'Only admins/managers can change an unassigned shift; submit a claim instead' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
