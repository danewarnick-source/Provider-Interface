-- PHASE B — apply only after B6 (Rotations) is on main
-- All empty and unused once B6 ships (checked Nov 19, 2026: 0 rows set). Dane approved
-- doing this right after B6 merges instead of waiting for B20.
ALTER TABLE public.recurring_shift_patterns DROP COLUMN IF EXISTS location_id;
ALTER TABLE public.recurring_shift_patterns DROP COLUMN IF EXISTS service_code_id;
ALTER TABLE public.scheduled_shifts DROP COLUMN IF EXISTS is_recurring;
ALTER TABLE public.scheduled_shifts DROP COLUMN IF EXISTS recurrence_rule;
ALTER TABLE public.scheduled_shifts DROP COLUMN IF EXISTS recurrence_end_date;
