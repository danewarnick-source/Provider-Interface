-- B1, Phase A shim: code on staging writes only service_code, while main still
-- reads scheduled_shifts.job_code. Keep the two equal until the Phase B drop
-- (scheduler_b_drop_job_code) removes the column and this trigger.
CREATE FUNCTION public.scheduled_shifts_mirror_job_code() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.service_code := coalesce(NEW.service_code, NEW.job_code);
  NEW.job_code := NEW.service_code;
  RETURN NEW;
END $$;
CREATE TRIGGER scheduled_shifts_mirror_job_code
  BEFORE INSERT OR UPDATE OF service_code, job_code ON public.scheduled_shifts
  FOR EACH ROW EXECUTE FUNCTION public.scheduled_shifts_mirror_job_code();
