-- PHASE B — apply only after Scheduler B1 (Foundations) is on main
-- Nothing in main reads or writes scheduled_shifts.job_code once B1 ships;
-- service_code is the one column. Removes the Phase A mirror trigger with it.
-- Rows: every live job_code equals service_code (re-checked Nov 13, 2026: 0 differ), so no data is lost.
-- client_discharge_preview read coalesce(service_code, job_code); it now reads service_code
-- (CREATE OR REPLACE keeps its grants).
CREATE OR REPLACE FUNCTION public.client_discharge_preview(_client uuid, _discharge_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid := public.client_discharge_assert(_client);
  v_cutoff timestamptz := public.client_discharge_cutoff(_discharge_date);
begin
  return jsonb_build_object(
    'authorizations', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'service_code', service_code,
        'service_end_date', service_end_date) order by service_code)
      from public.client_billing_codes
      where organization_id = v_org and client_id = _client
        and (service_end_date is null or service_end_date > _discharge_date)
        and (service_start_date is null or service_start_date <= _discharge_date)
    ), '[]'::jsonb),
    'upcoming_authorizations', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'service_code', service_code,
        'service_start_date', service_start_date) order by service_code)
      from public.client_billing_codes
      where organization_id = v_org and client_id = _client
        and service_start_date > _discharge_date
    ), '[]'::jsonb),
    'team', coalesce((
      select jsonb_agg(jsonb_build_object('staff_id', staff_id, 'service_codes', service_codes))
      from public.staff_assignments
      where organization_id = v_org and client_id = _client
    ), '[]'::jsonb),
    'shifts', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'starts_at', starts_at, 'staff_id', staff_id,
        'service_code', service_code) order by starts_at)
      from public.scheduled_shifts
      where organization_id = v_org and client_id = _client
        and starts_at >= v_cutoff and status <> 'cancelled'
    ), '[]'::jsonb)
  );
end;
$function$;

DROP TRIGGER IF EXISTS scheduled_shifts_mirror_job_code ON public.scheduled_shifts;
DROP FUNCTION IF EXISTS public.scheduled_shifts_mirror_job_code();
ALTER TABLE public.scheduled_shifts DROP COLUMN IF EXISTS job_code;
