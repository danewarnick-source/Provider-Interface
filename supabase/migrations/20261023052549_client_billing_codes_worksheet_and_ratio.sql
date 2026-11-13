-- B1: Worksheet facts per authorization, for the hours-vs-Worksheet and
-- absence-day views (Decision 27) and the confirmed staffing ratio (ratio rules).
ALTER TABLE public.client_billing_codes
  ADD COLUMN worksheet_weekly_hours numeric CHECK (worksheet_weekly_hours IS NULL OR worksheet_weekly_hours >= 0),
  ADD COLUMN worksheet_absence_days integer CHECK (worksheet_absence_days IS NULL OR worksheet_absence_days >= 0),
  ADD COLUMN ratio text CHECK (ratio IS NULL OR ratio ~ '^[1-9][0-9]*:[1-9][0-9]*$');
COMMENT ON COLUMN public.client_billing_codes.worksheet_weekly_hours IS 'Weekly hours on the client''s Worksheet for this code.';
COMMENT ON COLUMN public.client_billing_codes.worksheet_absence_days IS 'Absence days the Worksheet allows for this code.';
COMMENT ON COLUMN public.client_billing_codes.ratio IS 'Confirmed staff:clients ratio for this code, e.g. 1:3.';
