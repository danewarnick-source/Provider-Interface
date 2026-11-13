-- B2: every agency starts with a settings row, the nine built-in shift types and
-- the Utah holiday list. Seeds existing agencies now and new ones on insert.
CREATE FUNCTION public.seed_scheduling_settings(_org uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.org_shift_behavior_settings (organization_id, rule_settings, ot_threshold_hours)
    SELECT _org, '{}'::jsonb, 40 WHERE NOT EXISTS (SELECT 1 FROM public.org_shift_behavior_settings WHERE organization_id = _org);
  INSERT INTO public.shift_types (organization_id, key, name, color, start_time, end_time, used_at, counts_toward_coverage, pay_kind, built_in)
  VALUES
    (_org, 'day', 'Day', '#2D5A9B', '07:00', '15:00', '{home}', true, 'normal', true),
    (_org, 'eve', 'Evening', '#5B4B8A', '15:00', '23:00', '{home}', true, 'normal', true),
    (_org, 'awake', 'Awake night', '#16213A', '23:00', '07:00', '{home}', true, 'normal', true),
    (_org, 'asleep', 'Asleep night', '#6B7385', '23:00', '07:00', '{home}', true, 'sleep', true),
    (_org, 'paired', 'Paired (training)', '#B8901F', '15:00', '23:00', '{home}', true, 'normal', true),
    (_org, 'oncall', 'On-call', '#9A6208', '07:00', '07:00', '{home,program}', false, 'stipend', true),
    (_org, 'prog', 'Day program', '#1F6F8B', '09:00', '15:00', '{program}', true, 'normal', true),
    (_org, 'transport', 'Transport', '#237A47', '08:00', '09:00', '{program}', false, 'normal', true),
    (_org, 'visit', 'Community visit', '#2F7D5B', '10:00', '14:00', '{client}', false, 'normal', true)
  ON CONFLICT (organization_id, key) DO NOTHING;
  INSERT INTO public.agency_holidays (organization_id, name, holiday_date, pay_multiplier)
  VALUES
    (_org, 'Thanksgiving', '2026-11-26', 1.5), (_org, 'Christmas Day', '2026-12-25', 1.5),
    (_org, 'New Year''s Day', '2027-01-01', 1.5), (_org, 'Memorial Day', '2027-05-31', NULL),
    (_org, 'Independence Day', '2027-07-04', 1.5), (_org, 'Pioneer Day', '2027-07-24', 1.5),
    (_org, 'Labor Day', '2027-09-06', NULL)
  ON CONFLICT (organization_id, holiday_date) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION public.seed_scheduling_settings(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.organizations_seed_scheduling_settings() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.seed_scheduling_settings(NEW.id); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.organizations_seed_scheduling_settings() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER organizations_seed_scheduling_settings AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.organizations_seed_scheduling_settings();

SELECT public.seed_scheduling_settings(id) FROM public.organizations;
