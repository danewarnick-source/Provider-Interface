-- B1: a punch made from a scheduled shift is linked to it, and keeps the reason
-- the team member typed for a "Require a reason" rule at clock-in (Decision 4).
ALTER TABLE public.evv_timesheets
  ADD COLUMN scheduled_shift_id uuid REFERENCES public.scheduled_shifts(id) ON DELETE SET NULL,
  ADD COLUMN override_reason text;
CREATE INDEX evv_timesheets_scheduled_shift_idx ON public.evv_timesheets (scheduled_shift_id)
  WHERE scheduled_shift_id IS NOT NULL;
COMMENT ON COLUMN public.evv_timesheets.scheduled_shift_id IS 'Scheduled shift this punch was made from.';
COMMENT ON COLUMN public.evv_timesheets.override_reason IS 'Reason typed at clock-in for a rule set to Require a reason.';
