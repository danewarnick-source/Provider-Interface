-- B2: what one home or program does differently from the agency defaults
-- (Settings, "Different at", and the "Settings for <home>" card). Null = the
-- agency default. The home's lead stays teams.manager_id.
CREATE TABLE public.team_schedule_settings (
  team_id uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rule_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {"<setting key>": "off"|"warn"|"reason"|"block"}
  overnight_pay text CHECK (overnight_pay IN ('every', 'sleeprate', 'exclude')),
  premium_per_hour numeric CHECK (premium_per_hour IS NULL OR premium_per_hour > 0),
  pickup_approval text CHECK (pickup_approval IN ('auto', 'lead', 'owner')),
  swap_approval text CHECK (swap_approval IN ('lead', 'owner')),
  timeoff_approval text CHECK (timeoff_approval IN ('lead', 'owner')),
  fix_approval text CHECK (fix_approval IN ('lead', 'owner')),
  publish_approval text CHECK (publish_approval IN ('lead', 'owner')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
CREATE INDEX team_schedule_settings_org_idx ON public.team_schedule_settings (organization_id);
ALTER TABLE public.team_schedule_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_schedule_settings_read ON public.team_schedule_settings FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()) OR is_hive_executive(auth.uid()));
CREATE POLICY team_schedule_settings_owner_write ON public.team_schedule_settings FOR ALL TO authenticated
  USING (access_is_owner(organization_id, auth.uid()))
  WITH CHECK (access_is_owner(organization_id, auth.uid())
    AND EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.organization_id = team_schedule_settings.organization_id));
